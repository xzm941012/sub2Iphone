import test from 'node:test';
import assert from 'node:assert/strict';
import { accountStatus } from '../src/account-status.ts';
import { accountAdmin, accountStatusFields } from '../scripts/account-admin.mjs';

const now = Date.parse('2026-10-18T12:00:00Z'), future = new Date(now + 60000).toISOString();
const active = { id: 12, platform: 'openai', type: 'oauth', status: 'active', schedulable: true };

test('main badge follows Sub2API precedence and expires runtime blocks', () => {
  assert.equal(accountStatus(active, now).normal, true);
  const blocked = { ...active, status: 'error', rate_limit_reset_at: future, overload_until: future, temp_unschedulable_until: future };
  assert.equal(accountStatus(blocked, now).text, '限流中');
  assert.equal(accountStatus({ ...blocked, rate_limit_reset_at: null }, now).text, '过载中');
  assert.equal(accountStatus({ ...blocked, rate_limit_reset_at: null, overload_until: null }, now).text, '错误');
  assert.equal(accountStatus({ ...active, temp_unschedulable_until: future }, now).text, '临时不可调度');
  assert.equal(accountStatus({ ...active, rate_limit_reset_at: future }, now + 60000).text, '正常');
  assert.equal(accountStatus({}, now).text, '状态未知');
});

test('paused and quota-exceeded accounts never masquerade as normal', () => {
  assert.equal(accountStatus({ ...active, schedulable: false }).text, '暂停');
  assert.equal(accountStatus({ ...active, quota_daily_used: 10, quota_daily_limit: 10 }).text, '配额超限');
  assert.equal(accountStatus({ ...active, status: 'inactive' }).text, '停用');
});

test('status projection excludes unrelated fields, credentials and unexpected objects', () => {
  assert.deepEqual(accountStatusFields({ ...active, credentials: { access_token: 'secret' }, extra: { secret: true }, error_message: { private: true }, overload_until: future }), { status: 'active', overload_until: future });
});

test('status reset requires confirmation and a valid account before any write', async () => {
  let calls = 0;
  for (const accountId of [0, -1, '12', 1.1, null]) await assert.rejects(() => accountAdmin('resetAccountStatus', { accountId, confirmed: true }, async () => { calls++; }));
  await assert.rejects(() => accountAdmin('resetAccountStatus', { accountId: 12 }, async () => { calls++; }));
  assert.equal(calls, 0);
  await assert.rejects(() => accountAdmin('resetAccountStatus', { accountId: 12, confirmed: true }, async method => { calls++; assert.equal(method, 'GET'); return { ...active, platform: 'anthropic' }; }));
  assert.equal(calls, 1);
});

test('status reset uses clear-error once, preserves paused scheduling and never touches quota credits', async () => {
  const calls = [];
  const result = await accountAdmin('resetAccountStatus', { accountId: 12, confirmed: true }, async (method, path, body) => {
    calls.push({ method, path, body }); return { ...active, schedulable: false, credentials: { access_token: 'secret' }, extra: { codex_reset_credit_snapshot: { available_count: 4 } } };
  });
  assert.deepEqual(calls, [{ method: 'GET', path: '/admin/accounts/12', body: undefined }, { method: 'POST', path: '/admin/accounts/12/clear-error', body: undefined }]);
  assert.equal(result.schedulable, false);
  assert.ok(!JSON.stringify(result).includes('secret'));
});

test('uncertain or malformed reset result is never retried or reported as success', async () => {
  for (const response of [null, { id: 13, status: 'active' }, { id: 12 }]) {
    let writes = 0;
    await assert.rejects(() => accountAdmin('resetAccountStatus', { accountId: 12, confirmed: true }, async method => { if (method === 'GET') return active; writes++; return response; }), /不会自动重试/);
    assert.equal(writes, 1);
  }
  let calls = 0;
  await assert.rejects(() => accountAdmin('resetAccountStatus', { accountId: 12, confirmed: true }, async method => { calls++; if (method === 'GET') return active; throw Error('timeout'); }), /不会自动重试/);
  assert.equal(calls, 2);
});
