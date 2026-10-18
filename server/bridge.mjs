import { accountAdmin, accountStatusFields } from '../scripts/account-admin.mjs';

const readPaths = /^\/admin\/(?:groups\/all|accounts(?:\/\d+\/usage)?|usage(?:\/stats|\/search-users|\/search-api-keys)?|dashboard\/snapshot-v2|openai\/accounts\/\d+\/quota)$/;
const sensitive = /(?:password|secret|credential|authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|cookie|client[_-]?key)/i;
export function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (!value || typeof value !== 'object') return value;
  const clean = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === 'api_key' && v && typeof v === 'object') { clean[k] = { id: v.id, name: v.name }; continue; }
    if (sensitive.test(k) || /(?:api[_-]?key)/i.test(k) && !k.endsWith('_id') || ['key', 'token', 'headers', 'proxy', 'custom_headers', 'base_url'].includes(k.toLowerCase())) continue;
    clean[k] = scrub(v);
  }
  return clean;
}
export function serviceUrl(value) {
  let url; try { url = new URL(value); } catch { throw Error('服务地址无效'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.port && url.port !== '443') ||
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example)$/.test(host) ||
      /(?:^|\.)(?:localhost|metadata|metadata-google|ip6-localhost)(?:\.|$)/.test(host)) throw Error('仅支持公网 HTTPS 域名，不支持本机、IP 地址、非标准端口或 URL 凭据');
  return url.href.replace(/\/$/, '').replace(/\/api\/v1$/, '');
}
function json(value, status = 200) { return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } }); }
async function boundedText(body, max) {
  if (!body) throw Error('请求正文为空');
  const reader = body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > max) { await reader.cancel(); throw Error('请求或响应过大'); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
  return new TextDecoder().decode(bytes);
}
export async function handleBridge(request, fetcher = fetch, allowedHosts = []) {
  const origin = new URL(request.url).origin;
  if (request.method !== 'POST') return json({ error: '仅支持 POST' }, 405);
  if (request.headers.get('origin') !== origin || !/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return json({ error: '不允许的请求来源或格式' }, 403);
  let op;
  try {
    const body = JSON.parse(await boundedText(request.body, 32768)); op = body.op;
    if (!['api', 'testConfig', 'accountSettings', 'accountProxies', 'saveAccountSettings', 'resetAccountStatus', 'resetOpenAIQuota'].includes(op)) throw Error('不支持的操作');
    const base = serviceUrl(body.connection?.url), key = body.connection?.key;
    if (!allowedHosts.includes(new URL(base).hostname)) throw Error('此服务域名未获本站管理员允许');
    if (typeof key !== 'string' || !key.trim() || key.length > 4096 || /[\r\n]/.test(key)) throw Error('请输入有效的管理员 API 密钥');
    const p = body.payload || {};
    const upstream = async (method, path, payload) => {
      let response;
      try {
        response = await fetcher(base + '/api/v1' + path, {
          method, headers: { 'x-api-key': key, Accept: 'application/json', ...(payload ? { 'Content-Type': 'application/json' } : {}) },
          ...(payload ? { body: JSON.stringify(payload) } : {}), redirect: 'error', signal: AbortSignal.timeout(op === 'resetOpenAIQuota' ? 90000 : 30000),
        });
      } catch { throw Error(op === 'resetOpenAIQuota' ? '未收到重置结果，请在服务端核实；不会自动重试' : '无法连接服务，请检查公网地址或稍后重试'); }
      if (!response.ok) { await response.body?.cancel(); throw Error([401, 403].includes(response.status) ? '密钥无效或权限不足' : '上游服务返回错误 ' + response.status); }
      let data;
      try { data = JSON.parse(await boundedText(response.body, 2 * 1024 * 1024)); } catch { throw Error('服务响应格式异常或响应过大'); }
      if (data.code !== 0) throw Error('服务未确认操作成功，请检查服务状态和权限');
      return data.data;
    };
    let data;
    if (op === 'testConfig') { await upstream('GET', '/admin/groups/all?platform=openai'); data = true; }
    else if (op === 'api') {
      if (typeof p.path !== 'string' || !p.path.startsWith('/admin/') || /[\\#\r\n]/.test(p.path)) throw Error('无效接口');
      const [pathname] = p.path.split('?');
      if (!readPaths.test(pathname)) throw Error('不允许的接口');
      const raw = await upstream('GET', p.path);
      if (pathname === '/admin/accounts') {
        const view = a => ({ id: a.id, name: a.name, type: a.type, platform: a.platform, schedulable: a.schedulable, ...accountStatusFields(a), extra: Object.fromEntries(Object.entries(a.extra || {}).filter(([k]) => /^codex_(?:5h|7d)_(?:used_percent|reset_at)$/.test(k) || k === 'codex_reset_credit_snapshot')) });
        data = Array.isArray(raw) ? raw.map(view) : { items: (raw.items || []).map(view), total: raw.total };
      } else data = raw;
    } else if (op === 'resetOpenAIQuota') {
      if (p.confirmed !== true || !Number.isInteger(p.accountId) || p.accountId <= 0) throw Error('请先确认重置账户');
      const raw = await upstream('POST', '/admin/openai/accounts/' + p.accountId + '/reset-quota', {});
      data = { windows_reset: raw?.windows_reset, credit: { status: raw?.credit?.status, redeemed_at: raw?.credit?.redeemed_at }, quota: { rate_limit_reset_credits: raw?.quota?.rate_limit_reset_credits }, warning_code: raw?.warning_code };
    } else data = await accountAdmin(op, p, upstream);
    return json({ data: scrub(data) });
  } catch (error) {
    // Never echo upstream response bodies, URLs, submitted keys or stack traces.
    const message = error instanceof SyntaxError ? '请求格式无效' : error.message || '请求失败';
    return json({ error: message }, 400);
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz' && ['GET', 'HEAD'].includes(request.method)) return json({ status: 'ok', app: 'SubWatch' });
    if (url.pathname === '/api/bridge') return handleBridge(request, fetch, env.ALLOWED_HOSTS || []);
    if (url.pathname.startsWith('/api/') || url.pathname === '/__native') return json({ error: '接口不存在' }, 404);
    let response = await env.ASSETS.fetch(request);
    if (response.status === 404 && request.headers.get('accept')?.includes('text/html') && ['GET', 'HEAD'].includes(request.method)) {
      url.pathname = '/index.html'; url.search = ''; response = await env.ASSETS.fetch(new Request(url, request));
    }
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff'); headers.set('Referrer-Policy', 'no-referrer');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
    if (headers.get('Content-Type')?.includes('text/html')) headers.set('Cache-Control', 'no-cache');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
