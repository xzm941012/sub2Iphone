import { test, expect, type Page } from '@playwright/test';

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
test('session connection uses cloud endpoint; secrets never enter storage and expire on reload', async ({ page }) => {
  const calls: string[] = [];
  await page.route('**/subwatch/api/bridge', async route => {
    const { op, payload, connection } = route.request().postDataJSON(); calls.push(op);
    expect(connection.key).toBe('synthetic-test-credential');
    let data: unknown = true;
    if (op === 'api') data = payload.path.startsWith('/admin/groups') ? [] : { items: [], total: 0 };
    await route.fulfill({ json: { data } });
  });
  const form = await addConnection(page);
  await form.getByRole('button', { name: '保存并连接' }).click();
  await expect(form).not.toBeVisible();
  await expect(page.getByRole('heading', { name: '额度', exact: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(stored).not.toContain('synthetic-test-credential');
  expect(stored).toContain('测试服务');
  expect(calls).toContain('testConfig');
  const count = calls.length;
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('会话密钥已清除');
  expect(calls).toHaveLength(count);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '编辑 测试服务', exact: true }).click();
  await expect(page.getByLabel('管理员 API 密钥', { exact: true })).toHaveValue('');
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
