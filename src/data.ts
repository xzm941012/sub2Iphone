export type RecordData = Record<string, any>;
export type Connection = { id: string; name: string; url: string; keySet?: boolean; key?: string; rememberKey?: boolean };
export type Config = { connections: Connection[]; selected: string; groupId: string; accounts: number[]; interval: number; refreshOnOpen: boolean; theme: string };
export const defaults: Config = { connections: [], selected: '', groupId: '', accounts: [], interval: 15, refreshOnOpen: true, theme: 'light' };
declare global { interface Window { Android?: { call(id: string, op: string, payload: string): void }; __nativeReply?: (id: string, result: any, error?: string) => void; __nativeBack?: () => void; } }
const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: number }>();
window.__nativeReply = (id, result, error) => { const p = pending.get(id); if (!p) return; clearTimeout(p.timer); pending.delete(id); error ? p.reject(new Error(error)) : p.resolve(result); };
export const isNative = !!window.Android;
export const isWeb = !isNative && typeof document !== 'undefined' && document.documentElement.dataset.app === 'web';
export const isStandalone = isNative || isWeb;
export async function bridge<T = any>(op: string, payload: any = {}): Promise<T> {
  if (isWeb) { const { webBridge } = await import('./web-bridge'); return webBridge<T>(op, payload); }
  if (!window.Android) { const r = await fetch('/__native', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, payload }) }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || '连接失败'); return j.data; }
  return new Promise((resolve, reject) => { const id = Date.now() + '-' + Math.random().toString(36).slice(2); const timer = window.setTimeout(() => { pending.delete(id); reject(new Error(op==='resetOpenAIQuota'?'等待重置结果超时，请先核实账户状态':'请求超时，请重试')); }, op==='resetOpenAIQuota'?105000:45000); pending.set(id, { resolve, reject, timer }); window.Android!.call(id, op, JSON.stringify(payload)); });
}
export async function api(path: string): Promise<any> { return bridge('api', { path }); }
export function quotaColor(used:number|null){return used==null||!Number.isFinite(used)?'#92969e':used<50?'#389e0d':used<80?'#d48806':'#cf1322';}
export type ResetCredits={available_count:number;credits:{expires_at?:string}[]};
export function resetCredits(raw:any):ResetCredits|null {if(!raw||!Number.isFinite(Number(raw.available_count)))return null;return {available_count:Math.max(0,Math.floor(Number(raw.available_count))),credits:Array.isArray(raw.credits)?raw.credits.map((c:any)=>({expires_at:typeof c.expires_at==='string'?c.expires_at:undefined})):[]};}
export function query(path: string, params: RecordData) { const q = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null) q.set(k, String(v)); }); return path + '?' + q; }
export function compact(v: any, digits = 1): string { if (v == null || !Number.isFinite(Number(v))) return '—'; const n = Number(v); if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(digits) + 'B'; if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(digits) + 'M'; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(digits) + 'K'; return n.toLocaleString('en-US'); }
export function money(v: any, digits = 2) { return v == null || !Number.isFinite(Number(v)) ? '—' : '$' + Number(v).toFixed(digits); }
export function tokens(v: any) { return v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('en-US'); }
export function seconds(v: any) { return v == null ? '—' : (Number(v) / 1000).toFixed(2) + 's'; }
// Match Sub2API frontend/src/utils/latencyHealth.ts TTFT thresholds.
export function firstTokenSeverity(ms: unknown) {
  if (ms == null || ms === '' || !Number.isFinite(Number(ms))) return 'unknown';
  const value = Number(ms);
  return value >= 60000 ? 'critical' : value >= 30000 ? 'slow' : value >= 10000 ? 'warn' : 'good';
}
export function countdown(reset: any, now: number) { if(!reset)return '—'; const n = new Date(reset).getTime(); if (!Number.isFinite(n)) return '—'; const t = Math.max(0, Math.ceil((n - now) / 1000)); if (t >= 86400) return `${Math.floor(t / 86400)}天${Math.floor(t % 86400 / 3600)}时`; return `${Math.floor(t / 3600).toString().padStart(2, '0')}:${Math.floor(t % 3600 / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`; }
export function countdownMinutes(reset: any, now: number) {
  if(!reset)return '—';const stamp=new Date(reset).getTime();if(!Number.isFinite(stamp))return '—';
  const minutes=Math.max(0,Math.ceil((stamp-now)/60000));
  if(minutes>=1440)return Math.floor(minutes/1440)+'d'+Math.floor(minutes%1440/60)+'h';
  return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
}
export const palette = ['#c86b48', '#e4a149', '#768c7a', '#7289ad', '#a68ab0', '#5e9eaa', '#ba8391'];
export type Period = { used: number | null; reset: string | null; tokens: number | null; cost: number | null; estimated: number | null };
export type Account = { id: number; name: string; five: Period; seven: Period; schedulable?:boolean; resetCredits?:ResetCredits|null; error?: string };
function finite(v: any): number | null { return v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v); }
export function period(raw: any, extra: any, prefix: string): Period {
  const used = finite(raw?.utilization ?? raw?.used_percent ?? raw?.percentage ?? extra?.[prefix + '_used_percent']);
  const w = raw?.window_stats;
  const cost = finite(w?.cost ?? w?.account_cost ?? w?.standard_cost);
  return { used, reset: raw?.resets_at ?? raw?.reset_at ?? raw?.reset_time ?? extra?.[prefix + '_reset_at'] ?? null, tokens: finite(w?.tokens), cost, estimated: cost != null && used != null && used > 0 ? cost * 100 / used : null };
}
export function aggregate(items: Period[], now = Date.now()): Period {
  const known = items.filter(x => x.used != null);
  const sum = (key: 'tokens' | 'cost' | 'estimated') => items.length > 0 && items.every(x => x[key] != null) ? items.reduce((a, x) => a + x[key]!, 0) : null;
  const resets = items.map(x => x.reset).filter((x): x is string => !!x && new Date(x).getTime() > now).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const used = known.length ? known.reduce((a, x) => a + x.used!, 0) / known.length : null;
  const cost = sum('cost');
  return { used, reset: resets[0] ?? null, tokens: sum('tokens'), cost, estimated: cost != null && cost > 0 && used != null && used > 0 ? cost * 100 / Math.min(100, used) : null };
}
export async function loadQuota(groupId: string): Promise<Account[]> {
  let all: any[] = [], page = 1;
  for (;;) { const data = await api(query('/admin/accounts', { page, page_size: 200, platform: 'openai', type: 'oauth', sort_by: 'name', sort_order: 'asc', group: groupId })); const rows = data.items ?? data; if (!Array.isArray(rows)) throw new Error('账户列表格式异常'); all.push(...rows); if (rows.length < 200 || all.length >= (data.total ?? Infinity)) break; page++; }
  const accounts = [...new Map(all.map(x => [x.id ?? x.account?.id, x.account ?? x])).values()].sort((a, b) => a.id - b.id);
  const result: Account[] = [];
  // Limit concurrency to avoid flooding the admin API when many accounts exist.
  for (let i = 0; i < accounts.length; i += 4) result.push(...await Promise.all(accounts.slice(i, i + 4).map(async a => {
    try { const u = await api(`/admin/accounts/${a.id}/usage`); return { id: a.id, name: a.name,schedulable:a.schedulable!==false, five: period(u.five_hour, a.extra, 'codex_5h'), seven: period(u.seven_day, a.extra, 'codex_7d'),resetCredits:resetCredits(a.extra?.codex_reset_credit_snapshot) }; }
    catch (e) { return { id: a.id, name: a.name,schedulable:a.schedulable!==false, five: period(null, a.extra, 'codex_5h'), seven: period(null, a.extra, 'codex_7d'), error: String(e) }; }
  })));
  return result;
}
export function latencyTPS(r: RecordData) { const ms = Number(r.duration_ms); return ms > 0 && r.output_tokens != null ? (r.output_tokens / (ms / 1000)).toFixed(1) : '—'; }
export function isFastRequest(r: RecordData) { const tier=typeof r.service_tier==='string'?r.service_tier.trim().toLowerCase():'';return tier==='priority'||tier==='fast'; }
export function dateRange(days: number) { const end = new Date(); const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days + 1); const local = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; return { start_date: local(start), end_date: local(end), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }; }
export function safeFields(value: any): any { if (Array.isArray(value)) return value.map(safeFields); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !/^(key|admin_api_key|access_token|refresh_token|password|credentials|secret)$/i.test(k)).map(([k, v]) => [k, safeFields(v)])); return value; }
