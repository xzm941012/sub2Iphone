import { test, expect, type Page } from '@playwright/test';

async function fixture(page: Page, options: { fail?: boolean; usageFail?: boolean; paused?: boolean; longName?: boolean } = {}) {
  const failures: string[] = []; page.on('pageerror', e => failures.push(e.message));
  const name = options.longName ? '很长的账号名称用来验证手机上仍然能看到完整状态标签' : '异常账号';
  let state: Record<string, unknown> = { status: 'error', error_message: '授权已失效，请核实账号', schedulable: !options.paused };
  let resets = 0, usageFails = false, release: (() => void) | undefined;
  const cache=new Map<string,unknown>();
  await page.addInitScript(()=>{const w=window as any;w.Android={call(id:string,op:string,payload:string){fetch('/__native',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,payload:JSON.parse(payload)})}).then(r=>r.json()).then(r=>w.__nativeReply(id,r.data,r.error));}};});
  await page.route('**/__native', async route => {
    const { op, payload } = route.request().postDataJSON();
    let data: unknown;
    if(op==='config')data={connections:[{id:'test',name:'测试',url:'https://demo.invalid',keySet:true}],selected:'test',groupId:'',accounts:[],interval:15,refreshOnOpen:true,theme:'light'};
    else if(op==='systemAppearance')data={dark:false};
    else if(op==='getCache')data=cache.get(payload.key)??null;
    else if(op==='setCache'){cache.set(payload.key,payload.value);data=true;}
    else if(['appearance','hideKeyboard'].includes(op))data=true;
    else if (op === 'resetAccountStatus') {
      resets++; expect(payload).toEqual({ accountId: 2, confirmed: true });
      await new Promise<void>(resolve => { release = resolve; });
      if (options.fail) { await route.fulfill({ status: 400, json: { error: '未确认状态重置结果；不会自动重试' } }); return; }
      state = { status: 'active', error_message: null, schedulable: !options.paused }; usageFails = !!options.usageFail;
      data = { id: 2, name, ...state };
    } else if (op === 'api') {
      if (payload.path.startsWith('/admin/groups')) data = [];
      else if (payload.path.startsWith('/admin/accounts?')) data = { items: [{ id: 1, name: '正常账号', status: 'active', schedulable: true, extra: {} }, { id: 2, name, ...state, extra: { codex_reset_credit_snapshot: { available_count: 3, credits: [] } } }], total: 2 };
      else if (payload.path.endsWith('/usage')) {
        if (usageFails) { await route.fulfill({ status: 400, json: { error: '额度暂不可用' } }); return; }
        data = { five_hour: { utilization: 25 }, seven_day: { utilization: 60 } };
      } else if (payload.path.endsWith('/quota')) data = { rate_limit_reset_credits: { available_count: 3, credits: [] } };
    } else if (op === 'accountSettings') data = { id: payload.accountId, name: '正常账号', platform: 'openai', type: 'oauth', proxyId: 0, wsMode: 'off', schedulable: true };
    else if (op === 'accountProxies') data = [];
    else throw Error('Unexpected bridge operation: ' + op);
    await route.fulfill({ json: { data } });
  });
  await page.goto('/native.html');
  await expect(page.getByRole('button', { name: name + '状态：错误', exact: true })).toBeVisible();
  return { name, failures, count: () => resets, release: () => release?.() };
}

test('status badge sits beside the chevron; normal status and account editing remain separate', async ({ page }) => {
  await fixture(page);
  const identity = page.locator('.account-title').first();
  await expect(identity.locator('.account-name svg')).toBeVisible();
  await expect(identity.locator('span.account-status')).toHaveText('正常');
  await expect(identity.locator('button.account-status')).toHaveCount(0);
  await page.getByRole('button', { name: '编辑账号 正常账号', exact: true }).click();
  await expect(page.getByRole('heading', { name: '账号设置', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('cancel makes no write, confirmation sends once and successful status refresh preserves credits', async ({ page }) => {
  const f = await fixture(page);
  const badge = page.getByRole('button', { name: f.name + '状态：错误', exact: true });
  await badge.click();
  const dialog = page.getByRole('dialog', { name: '重置账号状态', exact: true });
  await expect(dialog).toContainText('授权已失效');
  await expect(dialog).toContainText('不消耗额度重置次数');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  expect(f.count()).toBe(0);
  await expect(dialog).not.toBeVisible();
  await badge.click();
  const confirm = dialog.getByRole('button', { name: '确认重置', exact: true });
  await confirm.dblclick();
  await expect(page.getByRole('dialog', { name: '正在重置状态', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '关闭状态窗口' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect.poll(f.count).toBe(1); f.release();
  await expect(page.getByRole('dialog', { name: '状态已重置', exact: true })).toContainText('当前状态：正常');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('.account-item').nth(1).locator('span.account-status')).toHaveText('正常');
  await expect(page.getByRole('button', { name: f.name + '重置机会' })).toContainText('3 次');
  expect(f.count()).toBe(1); expect(f.failures).toEqual([]);
  // Existing quota-credit flow still opens independently and makes no reset write.
  await page.getByRole('button', { name: f.name + '重置机会' }).click();
  await expect(page.getByRole('dialog', { name: '重置额度', exact: true })).toBeVisible();
});

test('uncertain write shows an error without retrying or presenting a false success', async ({ page }) => {
  const f = await fixture(page, { fail: true });
  await page.getByRole('button', { name: f.name + '状态：错误' }).click();
  await page.getByRole('button', { name: '确认重置', exact: true }).click();
  await expect.poll(f.count).toBe(1); f.release();
  const dialog = page.getByRole('dialog', { name: '重置结果待核实', exact: true });
  await expect(dialog.getByRole('alert')).toContainText('不会自动重试');
  await expect(dialog.getByRole('button', { name: '确认重置', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('button', { name: f.name + '状态：错误' })).toBeVisible();
  expect(f.count()).toBe(1);
});

test('quota fetch failure keeps fresh reset status and paused scheduling', async ({ page }) => {
  const f = await fixture(page, { usageFail: true, paused: true });
  await page.getByRole('button', { name: f.name + '状态：错误' }).click();
  await page.getByRole('button', { name: '确认重置', exact: true }).click();
  await expect.poll(f.count).toBe(1); f.release();
  await expect(page.getByRole('dialog', { name: '状态已重置', exact: true })).toContainText('当前状态：暂停');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.getByRole('button', { name: f.name + '状态：暂停', exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: f.name + '调度', exact: true })).not.toBeChecked();
  await expect(page.locator('.account-item').nth(1)).toContainText('刷新失败');
});

test('long names, narrow screens and dark theme keep status and right-side controls usable', async ({ page }) => {
  const f = await fixture(page, { longName: true });
  for (const width of [320, 375, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const row = page.locator('.account-item').nth(1); await row.locator('.account-name').scrollIntoViewIfNeeded();
    for (const selector of ['.account-name', '.account-status', '.schedule-switch', '.reset-trigger']) await expect(row.locator(selector)).toBeInViewport({ ratio: 1 });
    const name = await row.locator('.account-name').boundingBox(), status = await row.locator('.account-status').boundingBox();
    expect(Math.abs(name!.y + name!.height / 2 - status!.y - status!.height / 2)).toBeLessThan(2);
    expect(status!.x).toBeGreaterThanOrEqual(name!.x + name!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: f.name + '状态：错误' }).click();
  const dialog = page.getByRole('dialog', { name: '重置账号状态', exact: true });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByRole('button', { name: '确认重置', exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: 'test-results/account-status-mobile.png' });
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await expect(dialog.getByRole('button', { name: '取消', exact: true })).toHaveCSS('background-color', 'rgb(36, 37, 41)');
  await page.screenshot({ path: 'test-results/account-status-dark.png' });
  expect(f.failures).toEqual([]);
});
