// Synthetic, browser-local data. No personal configuration or upstream calls.
const names = ['工作账户', '备用账户', '开发账户'];
const groups = [{ id: 1, name: 'openai-plus' }, { id: 2, name: '开发环境' }];
const states = names.map((name, i) => ({ id: i + 1, name, platform: 'openai', type: 'oauth', status: 'active', proxyId: 0, wsMode: 'ctx_pool', schedulable: true, credits: 3 }));
const started = Date.now();
const period = (i: number, seven = false) => ({
  utilization: (seven ? [62, 87, 64] : [24, 50, 8])[i],
  resets_at: new Date(started + (seven ? 115 * 60 : 138) * 60000).toISOString(),
  window_stats: { tokens: (seven ? [142e6, 184e6, 94e6] : [18.4e6, 25.6e6, 8.2e6])[i], cost: (seven ? [32.4, 41.6, 24.8] : [4.8, 6.4, 1.6])[i] },
});
const records = Array.from({ length: 96 }, (_, i) => ({
  id: i + 1, model: i % 4 === 3 ? 'claude-sonnet-4.5' : 'gpt-5', reasoning_effort: i % 4 === 3 ? '' : 'high',
  created_at: new Date(started - i * 35 * 60000).toISOString(),
  input_tokens: [2480, 813, 4206, 1632][i % 4], output_tokens: [642, 218, 1205, 384][i % 4],
  cache_read_tokens: 128400 - i * 1000, cache_creation_tokens: 0,
  first_token_ms: [970, 1240, 680, 1530][i % 4], duration_ms: [12800, 4870, 18600, 9240][i % 4],
  actual_cost: .0327, account_stats_cost: .0327, total_cost: .0412, billing_mode: i % 5 ? 'token' : 'per_call',
  request_type: i % 3 ? 'ws_v2' : 'stream', api_key_id: i % 2 + 1, user_id: 1, account_id: i % 3 + 1, group_id: i % 3 === 2 ? 2 : 1,
  api_key: { name: i % 2 ? '日常开发' : '代码审查' }, user: { email: 'demo@example.com' }, account: { name: names[i % 3] }, group: { name: i % 3 === 2 ? '开发环境' : 'openai-plus' },
}));
function filtered(q: URLSearchParams) {
  return records.filter(r => {
    const date = new Date(r.created_at).toLocaleDateString('sv-SE', { timeZone: q.get('timezone') || 'Asia/Shanghai' });
    if (q.get('start_date') && date < q.get('start_date')!) return false;
    if (q.get('end_date') && date > q.get('end_date')!) return false;
    return ['model', 'account_id', 'group_id', 'user_id', 'api_key_id', 'request_type', 'billing_mode'].every(k => !q.get(k) || String(r[k as keyof typeof r]) === q.get(k));
  });
}
export async function demoRequest(op: string, p: any): Promise<any> {
  if (op === 'testConfig') return true;
  if (op === 'resetOpenAIQuota') throw Error('演示模式不消费重置机会，请连接真实服务后操作');
  if (op === 'resetAccountStatus') {
    if (p.confirmed !== true) throw Error('请先确认重置账号状态');
    const a = states.find(a => a.id === p.accountId); if (!a) throw Error('账户不存在');
    a.status = 'active'; return { id: a.id, name: a.name, status: a.status, schedulable: a.schedulable };
  }
  if (op === 'accountProxies') return [];
  if (op === 'accountSettings' || op === 'saveAccountSettings') {
    const a = states.find(a => a.id === p.accountId); if (!a) throw Error('账户不存在');
    if (op === 'saveAccountSettings') {
      if (typeof p.changes?.schedulable === 'boolean') a.schedulable = p.changes.schedulable;
      if (['off', 'ctx_pool', 'passthrough', 'http_bridge'].includes(p.changes?.wsMode)) a.wsMode = p.changes.wsMode;
    }
    return { ...a };
  }
  if (op !== 'api') throw Error('演示模式不支持此操作');
  const url = new URL(p.path, 'https://demo.example'), q = url.searchParams, path = url.pathname;
  if (path === '/admin/groups/all') return groups;
  if (path === '/admin/accounts') {
    const rows = states.filter(a => !q.get('group') || Number(q.get('group')) === (a.id === 3 ? 2 : 1));
    return { items: rows.map(a => ({ ...a, extra: { codex_reset_credit_snapshot: { available_count: a.credits, credits: [] } } })), total: rows.length };
  }
  const match = path.match(/^\/admin\/accounts\/(\d+)\/usage$/);
  if (match) { const i = Number(match[1]) - 1; if (!states[i]) throw Error('账户不存在'); return { five_hour: period(i), seven_day: period(i, true) }; }
  if (/^\/admin\/openai\/accounts\/\d+\/quota$/.test(path)) return { rate_limit_reset_credits: { available_count: 3, credits: [] } };
  if (path === '/admin/usage/search-users') return 'demo@example.com'.includes(q.get('q') || '') ? [{ id: 1, email: 'demo@example.com' }] : [];
  if (path === '/admin/usage/search-api-keys') return [{ id: 1, name: '代码审查' }, { id: 2, name: '日常开发' }].filter(x => x.name.includes(q.get('q') || ''));
  const rows = filtered(q);
  const sum = (key: keyof typeof records[number]) => rows.reduce((n, r) => n + Number(r[key]), 0);
  if (path === '/admin/usage') {
    const size = Math.min(200, Math.max(1, Number(q.get('page_size')) || 30)), page = Math.max(1, Number(q.get('page')) || 1);
    return { items: rows.slice((page - 1) * size, page * size), total: rows.length, pages: Math.ceil(rows.length / size) };
  }
  if (path === '/admin/usage/stats') return {
    total_requests: rows.length, total_tokens: sum('input_tokens') + sum('output_tokens') + sum('cache_read_tokens'), total_input_tokens: sum('input_tokens'), total_output_tokens: sum('output_tokens'),
    total_cache_read_tokens: sum('cache_read_tokens'), total_actual_cost: sum('actual_cost'), total_account_cost: sum('account_stats_cost'), total_cost: sum('total_cost'), average_duration_ms: rows.length ? sum('duration_ms') / rows.length : 0,
  };
  if (path === '/admin/dashboard/snapshot-v2') {
    const buckets = new Map<string, any>();
    for (const r of rows) {
      const local = new Date(r.created_at).toLocaleString('sv-SE', { timeZone: q.get('timezone') || 'Asia/Shanghai' });
      const date = local.slice(0, q.get('granularity') === 'day' ? 10 : 13) + (q.get('granularity') === 'day' ? '' : ':00');
      const bucket = buckets.get(date) || { date, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0 };
      for (const k of ['input_tokens', 'output_tokens', 'cache_read_tokens'] as const) bucket[k] += r[k];
      buckets.set(date, bucket);
    }
    const tally = (key: 'model' | 'group_id') => [...new Set(rows.map(r => r[key]))].map(value => ({ model: value, group_name: groups.find(g => g.id === value)?.name, total_tokens: rows.filter(r => r[key] === value).reduce((n, r) => n + r.input_tokens + r.output_tokens + r.cache_read_tokens, 0) }));
    return { trend: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)), models: tally('model'), groups: tally('group_id') };
  }
  throw Error('演示数据未提供此接口');
}
