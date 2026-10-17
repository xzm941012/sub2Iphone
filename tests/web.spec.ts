import { test, expect, type Page } from '@playwright/test';

test('published CSS keeps Safari 16.2 compatible media queries and mobile navigation on screen', async ({ page }) => {
  await page.goto('/subwatch/');
  const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(link => (link as HTMLLinkElement).href));
  expect(stylesheets.length).toBeGreaterThan(0);
  const css = (await Promise.all(stylesheets.map(async url => (await page.request.get(url)).text()))).join('\n');
  const media = [...css.matchAll(/@media\s*([^\{]+)/g)].map(match => match[1]);
  expect(media.some(query => /max-width\s*:\s*760px/.test(query))).toBe(true);
  expect(media.filter(query => /[<>]/.test(query))).toEqual([]);
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 640 }, { width: 390, height: 700 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('.web-masthead')).toBeHidden();
    await expect(page.locator('.web-mobile-brand')).toBeVisible();
    await expect(page.getByRole('heading', { name: '整体额度', exact: true })).toBeInViewport();
    const nav = page.getByRole('navigation', { name: '主导航' });
    await expect(nav.getByRole('button')).toHaveCount(3);
    for (const button of await nav.getByRole('button').all()) await expect(button).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await nav.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
  }
});

test('Web demo keeps quota, records, filters, detail and only three navigation tabs', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', e => failures.push(e.message));
  await page.goto('/subwatch/');
  await expect(page.getByRole('heading', { name: '整体额度', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('button')).toHaveCount(3);
  await expect(page.getByRole('navigation').getByText(/组件|速览/)).toHaveCount(0);
  await page.getByRole('button', { name: '明细', exact: true }).click();
  await expect(page.getByText('总请求', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '明细', exact: true }).click();
  await expect(page.locator('.usage-row').first()).toBeVisible();
  await page.locator('.usage-row').first().click();
  await expect(page.getByRole('heading', { name: '调用详情', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回明细' }).click();
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '筛选', exact: true });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('combobox', { name: '账户', exact: true }).selectOption('1');
  await sheet.getByRole('button', { name: '应用筛选' }).click();
  await expect(sheet).not.toBeVisible();
  await expect(page.locator('.usage-row').first()).toBeVisible();
  await expect(page.locator('.filter-button')).toContainText('1');
  await page.locator('.usage-row').first().click();
  await expect(page.locator('.call-section')).toContainText(['工作账户']);
  expect(failures).toEqual([]);
});

test('mobile layout, theme and preference persistence', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/subwatch/');
  await expect(page.getByRole('heading', { name: '整体额度' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('combobox', { name: '外观', exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('combobox', { name: '外观', exact: true }).selectOption('system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

async function addConnection(page: Page) {
  await page.goto('/subwatch/');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '添加连接' }).click();
  const form = page.getByRole('dialog', { name: '编辑连接' });
  await form.getByLabel('名称', { exact: true }).fill('测试服务');
  await form.getByLabel('服务地址', { exact: true }).fill('https://sub2api-jp.onemem.cc');
  await form.getByLabel('管理员 API 密钥', { exact: true }).fill('synthetic-test-credential');
  return form;
}
async function mockConnection(page: Page) {
  const calls: string[] = [];
  await page.route('**/subwatch/api/bridge', async route => {
    const { op, payload, connection } = route.request().postDataJSON(); calls.push(op);
    expect(connection.key).toBe('synthetic-test-credential');
    let data: unknown = true;
    if (op === 'api') data = payload.path.startsWith('/admin/groups') ? [] : { items: [], total: 0 };
    await route.fulfill({ json: { data } });
  });
  return calls;
}

test('remembered connection restores after reload and reopening without reentering its key', async ({ page, browser }) => {
  const calls = await mockConnection(page);
  const form = await addConnection(page);
  await expect(form.getByRole('checkbox', { name: '在此浏览器记住密钥' })).toBeChecked();
  await form.getByRole('button', { name: '保存并连接' }).click();
  await expect(form).not.toBeVisible();
  await expect(page.getByRole('heading', { name: '额度', exact: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(stored).toContain('synthetic-test-credential');
  expect(await page.evaluate(() => localStorage.getItem('subwatch.web.v1'))).not.toContain('synthetic-test-credential');
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage }))).not.toContain('synthetic-test-credential');
  expect(stored).toContain('测试服务');
  expect(calls).toContain('testConfig');
  const count = calls.length;
  await page.reload();
  await expect.poll(() => calls.length).toBeGreaterThan(count);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '额度', exact: true })).toBeVisible();
  const context = await browser.newContext({ storageState: await page.context().storageState() });
  const reopened = await context.newPage();
  const reopenedCalls = await mockConnection(reopened);
  await reopened.goto(new URL('/subwatch/', page.url()).href);
  await expect.poll(() => reopenedCalls.length).toBeGreaterThan(0);
  await expect(reopened.getByRole('alert')).toHaveCount(0);
  await context.close();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '编辑 测试服务', exact: true }).click();
  await expect(page.getByLabel('管理员 API 密钥', { exact: true })).toHaveValue('');
});

test('unchecking remember keeps a session connection and never persists its key', async ({ page }) => {
  const calls = await mockConnection(page);
  const form = await addConnection(page);
  await form.getByRole('checkbox', { name: '在此浏览器记住密钥' }).uncheck();
  await form.getByRole('button', { name: '保存并连接' }).click();
  await expect(form).not.toBeVisible();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain('synthetic-test-credential');
  const count = calls.length;
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('会话密钥已清除');
  expect(calls).toHaveLength(count);
});

test('clear browser keys removes remembered and in-memory access but retains connection metadata', async ({ page }) => {
  const calls = await mockConnection(page);
  const form = await addConnection(page);
  await form.getByRole('button', { name: '保存并连接' }).click();
  await expect(form).not.toBeVisible();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const count = calls.length;
  await page.getByRole('button', { name: '清除本浏览器的所有密钥' }).click();
  await expect(page.getByRole('alert')).toContainText('会话密钥已清除');
  expect(calls).toHaveLength(count);
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(stored).not.toContain('synthetic-test-credential');
  expect(stored).toContain('测试服务');
});

test('disabling remember deletes an existing saved key and keeps it only for the current page', async ({ page }) => {
  const calls = await mockConnection(page);
  const form = await addConnection(page);
  await form.getByRole('button', { name: '保存并连接' }).click();
  await expect(form).not.toBeVisible();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '编辑 测试服务' }).click();
  await form.getByRole('checkbox', { name: '在此浏览器记住密钥' }).uncheck();
  await form.getByRole('button', { name: '保存并连接' }).click();
  await expect(form).not.toBeVisible();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain('synthetic-test-credential');
  const count = calls.length;
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('会话密钥已清除');
  expect(calls).toHaveLength(count);
});

test('removing a connection also removes its saved key', async ({ page }) => {
  await mockConnection(page);
  const form = await addConnection(page);
  await form.getByRole('button', { name: '保存并连接' }).click();
  await expect(form).not.toBeVisible();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '编辑 测试服务' }).click();
  await form.getByRole('button', { name: '移除此连接' }).click();
  await expect(form).not.toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(stored).not.toContain('synthetic-test-credential');
  expect(stored).not.toContain('测试服务');
});

test('saved credentials are never reused for a changed service address', async ({ page }) => {
  const calls = await mockConnection(page);
  const form = await addConnection(page);
  await form.getByRole('button', { name: '保存并连接' }).click();
  await expect(form).not.toBeVisible();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '编辑 测试服务' }).click();
  await form.getByLabel('服务地址', { exact: true }).fill('https://sub2apicn.onemem.cc');
  const count = calls.length;
  await form.getByRole('button', { name: '保存并连接' }).click();
  await expect(form.getByRole('status')).toContainText('重新输入管理员密钥');
  expect(calls).toHaveLength(count);
});

test('failed validation keeps the connection editable without saving a secret', async ({ page }) => {
  await page.route('**/subwatch/api/bridge', route => route.fulfill({ status: 400, json: { error: '密钥无效或权限不足' } }));
  const form = await addConnection(page);
  await form.getByRole('button', { name: '保存并连接' }).click();
  await expect(form).toBeVisible();
  await expect(form.getByRole('status')).toHaveText('密钥无效或权限不足');
  await expect(form.getByRole('button', { name: '保存并连接' })).toBeEnabled();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain('synthetic-test-credential');
});
