import {test,expect} from '@playwright/test';

test('uncontrolled selection updates its centered visible label',async({page})=>{
  await page.goto('/tests/appearance-fixture.html');
  const interval=page.getByRole('combobox',{name:'刷新间隔'});
  await interval.click();
  await page.getByRole('option',{name:'15 分钟',exact:true}).click();
  await expect(interval).toHaveValue('15 分钟');
  await expect(page.locator('.select-value').first()).toHaveText('15 分钟');
  await interval.press('Enter');
  await expect(page.getByRole('option',{name:'15 分钟',exact:true})).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('controlled selection changes appearance and Back closes only its options',async({page})=>{
  await page.goto('/tests/appearance-fixture.html');
  const theme=page.getByRole('combobox',{name:'外观'});
  await theme.press('Enter');
  await page.getByRole('option',{name:'深色',exact:true}).click();
  await expect(theme).toHaveValue('dark');
  await expect(page.locator('.select-value').last()).toHaveText('深色');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await theme.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(()=>(window as any).__nativeBack());
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(theme).toHaveValue('dark');
});
