import type { Config, Connection } from './data';
import { preferencePatch } from './preferences';
import { demoRequest } from './web-demo';

const storageKey = 'subwatch.web.v1';
const keyStorageKey = 'subwatch.web.keys.v1';
const demo: Connection = { id: 'demo', name: 'Sub2API 演示', url: 'https://demo.example', keySet: true };
type SavedKey = { url: string; key: string };
const keys = new Map<string, SavedKey>(), cache = new Map<string, any>();
let current: Config | undefined;
function metadata(c: Config): Config {
  return { connections: c.connections.map(({ id, name, url, rememberKey }) => ({ id, name, url, rememberKey: rememberKey !== false })), selected: c.selected, groupId: c.groupId, accounts: c.accounts, interval: c.interval, refreshOnOpen: c.refreshOnOpen, theme: c.theme };
}
function config() {
  if (!current) {
    current = { connections: [demo], selected: 'demo', groupId: '', accounts: [], interval: 15, refreshOnOpen: true, theme: 'system' };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && Array.isArray(saved.connections)) {
        const connections = saved.connections.filter((c: any) => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.url === 'string');
        current = metadata({ ...current, ...saved, ...preferencePatch(saved), connections });
        const savedKeys = JSON.parse(localStorage.getItem(keyStorageKey) || '{}');
        for (const cn of current.connections) {
          const value = savedKeys?.[cn.id];
          if (cn.id !== 'demo' && cn.rememberKey !== false && value?.url === cn.url && typeof value.key === 'string' && value.key.length > 0 && value.key.length <= 4096) keys.set(cn.id, { url: cn.url, key: value.key });
        }
      }
    } catch { /* Invalid or unavailable storage must not prevent startup. */ }
  }
  return current;
}
function keyFor(cn: Connection) { const value = keys.get(cn.id); return value?.url === cn.url ? value.key : undefined; }
function view(c: Config) { return { ...c, connections: c.connections.map(x => ({ ...x, keySet: x.id === 'demo' || !!keyFor(x) })) }; }
function persist(next: Config, nextKeys = keys) {
  const clean = metadata(next);
  const remembered = Object.fromEntries(clean.connections.filter(cn => cn.id !== 'demo' && cn.rememberKey !== false && nextKeys.get(cn.id)?.url === cn.url).map(cn => [cn.id, nextKeys.get(cn.id)]));
  let oldConfig: string | null = null, oldKeys: string | null = null;
  try {
    oldConfig = localStorage.getItem(storageKey); oldKeys = localStorage.getItem(keyStorageKey);
    localStorage.setItem(keyStorageKey, JSON.stringify(remembered));
    localStorage.setItem(storageKey, JSON.stringify(clean));
  } catch {
    try { oldConfig === null ? localStorage.removeItem(storageKey) : localStorage.setItem(storageKey, oldConfig); oldKeys === null ? localStorage.removeItem(keyStorageKey) : localStorage.setItem(keyStorageKey, oldKeys); } catch { /* Preserve the original storage error. */ }
    throw Error('浏览器无法保存设置，请允许此站点使用本地存储');
  }
  current = clean;
  const replacement = new Map(nextKeys); keys.clear(); for (const [id, value] of replacement) keys.set(id, value);
  window.dispatchEvent(new Event('subwatch-session'));
}
export function sessionInfo() {
  const c = config(), active = c.connections.find(x => x.id === c.selected);
  return { demo: active?.id === 'demo', connected: !!active && (active.id === 'demo' || !!keyFor(active)), remembered: active?.rememberKey !== false, name: active?.name || '未连接' };
}
export async function webBridge<T = any>(op: string, p: any = {}): Promise<T> {
  const c = config(); let result: any;
  if (op === 'config') result = view(c);
  else if (op === 'getCache') result = cache.get(p.key) ?? null;
  else if (op === 'setCache') { cache.set(p.key, p.value); result = true; }
  else if (op === 'savePreferences') { persist({ ...c, ...preferencePatch(p.preferences) }); result = true; }
  else if (op === 'saveConfig') {
    const next = p.config as Config;
    const clean = metadata({ ...next, ...preferencePatch(next) });
    const nextKeys = new Map(keys);
    for (const cn of next.connections) if (cn.id !== 'demo' && cn.key) nextKeys.set(cn.id, { url: cn.url, key: cn.key });
    for (const [id, value] of nextKeys) if (!next.connections.some(x => x.id === id && x.url === value.url)) nextKeys.delete(id);
    persist(clean, nextKeys);
    cache.clear(); window.dispatchEvent(new Event('subwatch-session')); result = true;
  }
  else if (op === 'forgetKeys') {
    try { localStorage.removeItem(keyStorageKey); } catch { throw Error('浏览器无法清除保存的密钥'); }
    keys.clear(); cache.clear(); window.dispatchEvent(new Event('subwatch-session')); result = true;
  }
  else if (['appearance', 'hideKeyboard', 'background'].includes(op)) result = true;
  else if (op === 'systemAppearance') result = { dark: matchMedia('(prefers-color-scheme: dark)').matches };
  else {
    const targetConfig: Config = op === 'testConfig' ? p.config : c;
    const target = targetConfig.connections.find(x => x.id === targetConfig.selected);
    if (!target) throw Error('请先在设置中添加服务连接');
    if (target.id === 'demo') result = await demoRequest(op, p);
    else {
      const key = target.key || keyFor(target);
      if (!key) throw Error('会话密钥已清除，请在设置中重新输入管理员密钥');
      const response = await fetch(import.meta.env.BASE_URL + 'api/bridge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store',
        body: JSON.stringify({ op, payload: op === 'testConfig' ? {} : p, connection: { url: target.url, key } }),
        signal: AbortSignal.timeout(op === 'resetOpenAIQuota' ? 105000 : 45000),
      });
      const json = await response.json().catch(() => { throw Error('服务暂不可用，请稍后重试'); });
      if (!response.ok || json.error) throw Error(json.error || '请求失败'); result = json.data;
    }
  }
  return result as T;
}
