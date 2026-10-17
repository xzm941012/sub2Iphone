import type { Config, Connection } from './data';
import { preferencePatch } from './preferences';
import { demoRequest } from './web-demo';

const storageKey = 'subwatch.web.v1';
const demo: Connection = { id: 'demo', name: 'Sub2API 演示', url: 'https://demo.example', keySet: true };
const keys = new Map<string, string>(), cache = new Map<string, any>();
let current: Config | undefined;
function metadata(c: Config): Config {
  return { connections: c.connections.map(({ id, name, url }) => ({ id, name, url })), selected: c.selected, groupId: c.groupId, accounts: c.accounts, interval: c.interval, refreshOnOpen: c.refreshOnOpen, theme: c.theme };
}
function config() {
  if (!current) {
    current = { connections: [demo], selected: 'demo', groupId: '', accounts: [], interval: 15, refreshOnOpen: true, theme: 'system' };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && Array.isArray(saved.connections)) {
        const connections = saved.connections.filter((c: any) => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.url === 'string');
        current = metadata({ ...current, ...saved, ...preferencePatch(saved), connections });
      }
    } catch { /* Invalid or unavailable storage must not prevent startup. */ }
  }
  return current;
}
function view(c: Config) { return { ...c, connections: c.connections.map(x => ({ id: x.id, name: x.name, url: x.url, keySet: x.id === 'demo' || keys.has(x.id) })) }; }
function persist(next: Config) {
  const clean = metadata(next);
  try { localStorage.setItem(storageKey, JSON.stringify(clean)); } catch { throw Error('浏览器无法保存设置，请允许此站点使用本地存储'); }
  current = clean;
  window.dispatchEvent(new Event('subwatch-session'));
}
export function sessionInfo() {
  const c = config(), active = c.connections.find(x => x.id === c.selected);
  return { demo: active?.id === 'demo', connected: !!active && (active.id === 'demo' || keys.has(active.id)), name: active?.name || '未连接' };
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
    persist(clean);
    for (const cn of next.connections) if (cn.id !== 'demo' && cn.key) keys.set(cn.id, cn.key);
    for (const id of keys.keys()) if (!next.connections.some(x => x.id === id)) keys.delete(id);
    cache.clear(); window.dispatchEvent(new Event('subwatch-session')); result = true;
  }
  else if (['appearance', 'hideKeyboard', 'background'].includes(op)) result = true;
  else if (op === 'systemAppearance') result = { dark: matchMedia('(prefers-color-scheme: dark)').matches };
  else {
    const targetConfig: Config = op === 'testConfig' ? p.config : c;
    const target = targetConfig.connections.find(x => x.id === targetConfig.selected);
    if (!target) throw Error('请先在设置中添加服务连接');
    if (target.id === 'demo') result = await demoRequest(op, p);
    else {
      const key = target.key || keys.get(target.id);
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
