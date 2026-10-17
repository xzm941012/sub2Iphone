import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBridge, serviceUrl, scrub } from '../server/bridge.mjs';
const origin = 'https://subwatch.example.org';
const body = (op = 'api', payload = { path: '/admin/groups/all' }, url = 'https://service.example.org') => ({ op, payload, connection: { url, key: 'synthetic-credential' } });
const request = value => new Request(origin + '/api/bridge', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
const allowed = ['service.example.org'];

test('URL policy excludes local targets, IP spellings, credentials, custom ports and insecure services', () => {
  for (const url of ['http://service.example.org', 'https://127.0.0.1', 'https://2130706433', 'https://[::1]', 'https://a.local', 'https://metadata.google.internal', 'https://user:pass@service.example.org', 'https://service.example.org:8443', 'https://service.example.org?key=secret']) assert.throws(() => serviceUrl(url));
  assert.equal(serviceUrl('https://service.example.org/api/v1/'), 'https://service.example.org');
});
test('cross-origin requests, arbitrary operations, paths and hosts never reach upstream', async () => {
  let calls = 0; const fetcher = async () => { calls++; throw Error(); };
  for (const value of [body('shell'), body('api', { path: '/admin/../auth' }), body('api', { path: '/admin/accounts/1' }), body('api', { path: '/admin/groups/all' }, 'https://other.example.org')]) assert.equal((await handleBridge(request(value), fetcher, allowed)).status, 400);
  const cross = request(body()); cross.headers.set('Origin', 'https://other.example.org');
  assert.equal((await handleBridge(cross, fetcher, allowed)).status, 403);
  assert.equal(calls, 0);
});
test('authenticated reads pass the key only upstream, preserve names and remove nested credentials', async () => {
  let calls = 0;
  const response = await handleBridge(request(body('api', { path: '/admin/usage?page=1' })), async (url, options) => {
    calls++; assert.equal(url, 'https://service.example.org/api/v1/admin/usage?page=1');
    assert.equal(options.headers['x-api-key'], 'synthetic-credential'); assert.equal(options.redirect, 'error');
    return Response.json({ code: 0, data: { items: [{ api_key: { name: 'Display', key: 'private' }, account: { credentials: { password: 'private' }, name: 'A' }, extra: { refreshToken: 'private', headers: { x: 'private' } }, input_tokens: 2 }] } });
  }, allowed);
  const text = await response.text(); assert.equal(calls, 1); assert.ok(!text.includes('private')); assert.ok(text.includes('Display')); assert.ok(!text.includes('synthetic-credential')); assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('upstream authorization error bodies cannot leak into responses; no retries', async () => {
  let calls = 0; const response = await handleBridge(request(body()), async () => { calls++; return new Response('synthetic-credential', { status: 401 }); }, allowed);
  assert.equal(calls, 1); const value = await response.json(); assert.equal(value.error, '密钥无效或权限不足');
});
test('reset requires explicit confirmation and uncertain writes are never retried', async () => {
  let calls = 0; const fetcher = async () => { calls++; throw Error('synthetic-credential'); };
  await handleBridge(request(body('resetOpenAIQuota', { accountId: 1 })), fetcher, allowed); assert.equal(calls, 0);
  const response = await handleBridge(request(body('resetOpenAIQuota', { accountId: 1, confirmed: true })), fetcher, allowed);
  assert.equal(calls, 1); assert.match((await response.json()).error, /不会自动重试/);
});
test('response scrubber retains only API key display metadata', () => {
  assert.deepEqual(scrub({ api_key: { id: 1, name: 'A', key: 'secret' }, api_key_id: 1, accessToken: 'secret', input_tokens: 42, nested: { password: 'secret' } }), { api_key: { id: 1, name: 'A' }, api_key_id: 1, input_tokens: 42, nested: {} });
});
