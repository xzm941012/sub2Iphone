export type AccountState = {
  status?: string;
  schedulable?: boolean;
  error_message?: string | null;
  rate_limit_reset_at?: string | null;
  overload_until?: string | null;
  temp_unschedulable_until?: string | null;
  temp_unschedulable_reason?: string | null;
  quota_used?: number | null;
  quota_limit?: number | null;
  quota_daily_used?: number | null;
  quota_daily_limit?: number | null;
  quota_weekly_used?: number | null;
  quota_weekly_limit?: number | null;
};
export type AccountStatus = { text: string; tone: 'success' | 'warning' | 'danger' | 'gray'; normal: boolean; detail: string; until?: string };

// Match Sub2API AccountStatusIndicator's main badge precedence and labels.
export function accountStatus(a: AccountState, now = Date.now()): AccountStatus {
  const future = (value?: string | null) => !!value && new Date(value).getTime() > now;
  const result = (text: string, tone: AccountStatus['tone'], detail = '', until?: string): AccountStatus => ({ text, tone, normal: false, detail, until });
  if (future(a.rate_limit_reset_at)) return result('限流中', 'warning', '429 · 当前不参与调度，到期后自动恢复。', a.rate_limit_reset_at!);
  if (future(a.overload_until)) return result('过载中', 'danger', '529 · 服务负载过重，等待恢复。', a.overload_until!);
  if (a.status === 'error') return result('错误', 'danger', a.error_message || '服务未提供错误详情。');
  if (future(a.temp_unschedulable_until)) return result('临时不可调度', 'warning', a.temp_unschedulable_reason || '账号暂时不参与请求调度。', a.temp_unschedulable_until!);
  if (a.status !== 'active') {
    const labels: Record<string, string> = { inactive: '停用', disabled: '停用', expired: '已过期', cooldown: '冷却中', paused: '暂停', limited: '限流', unschedulable: '不可调度' };
    return result(labels[a.status || ''] || '状态未知', 'gray', a.error_message || '以 Sub2API 返回的账号状态为准。');
  }
  if (['', '_daily', '_weekly'].some(period => {
    const used = a[('quota' + period + '_used') as keyof AccountState];
    const limit = a[('quota' + period + '_limit') as keyof AccountState];
    return typeof used === 'number' && typeof limit === 'number' && limit > 0 && used >= limit;
  })) return result('配额超限', 'warning', '账号已达到配置的配额上限；重置状态不会增加可用额度。');
  if (a.schedulable === false) return result('暂停', 'gray', '请求调度已手动暂停；重置状态后仍需通过调度开关启用。');
  return { text: '正常', tone: 'success', normal: true, detail: '' };
}
