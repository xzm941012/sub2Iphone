import {test,expect} from '@playwright/test';

for(const count of [1,3,5,8])test(`widget fits ${count} accounts with at most five visible`,async({page})=>{
 await page.setViewportSize({width:360,height:640});await page.goto('/tests/widget-layout-fixture.html?count='+count);
 await expect(page.locator('.ring')).not.toContainText(/\d/);await expect(page.locator('.overview-metric .metric-countdown')).toHaveCount(2);
 await expect(page.locator('.overview-metric').first().locator('.metric-top')).toContainText('01:00');
 const ring=await page.locator('.ring').boundingBox(),metrics=await page.locator('.quota-metrics').boundingBox();expect(ring!.x+ring!.width).toBeLessThanOrEqual(metrics!.x);
 await page.getByRole('tab',{name:'5h',exact:true}).click();await expect(page.locator('.account-metric')).toHaveCount(Math.min(count,5));
 await expect(page.locator('.ring')).toHaveText('');await expect(page.locator('.account-metric .metric-details time')).toHaveCount(Math.min(count,5));
 const bounds=await page.locator('.quota-metrics').evaluate(el=>{const box=el.getBoundingClientRect();return {overflow:el.scrollHeight>el.clientHeight+1,inside:Array.from(el.children).every(c=>{const b=c.getBoundingClientRect();return b.top>=box.top-1&&b.bottom<=box.bottom+1;})};});
 expect(bounds).toEqual({overflow:false,inside:true});if(count>5)await expect(page.getByText('显示前 5 个账户 · 共 8 个')).toBeVisible();
});

test('refresh arrow animates only during refresh and re-enables after completion',async({page})=>{
 await page.clock.install();await page.goto('/tests/widget-layout-fixture.html');const refresh=page.getByRole('button',{name:'刷新额度',exact:true});
 await refresh.click();await expect(refresh).toBeDisabled();await expect(refresh.locator('svg')).toHaveCSS('animation-name','spin');
 await page.clock.fastForward(2100);await expect(refresh).toBeEnabled();await expect(refresh.locator('svg')).toHaveCSS('animation-name','none');
});
