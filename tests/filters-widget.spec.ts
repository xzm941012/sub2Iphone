import {test,expect} from '@playwright/test';

test('filters select, reset and apply while actions remain accessible',async({page})=>{
 await page.addInitScript(()=>{(window as any).Android={call(id:string,op:string,payload:string){const p=JSON.parse(payload);let result:any=true;if(op==='api'&&p.path.includes('search-users'))result=[{id:3,name:'测试用户'}];queueMicrotask(()=>(window as any).__nativeReply(id,result));}};});
 await page.setViewportSize({width:360,height:640});await page.goto('/tests/filters-widget-fixture.html');
 const dialog=page.getByRole('dialog',{name:'筛选',exact:true});
 const rows=await dialog.locator('.filter-fields > *').evaluateAll(elements=>elements.map(el=>{const b=el.getBoundingClientRect();return {left:b.left,top:b.top,bottom:b.bottom};}));
 expect(new Set(rows.map(row=>Math.round(row.left))).size).toBe(1);expect(rows.every((row,i)=>i===0||row.top>=rows[i-1].bottom)).toBe(true);
 await dialog.getByRole('combobox',{name:'账户',exact:true}).click();await page.getByRole('option',{name:'测试账户',exact:true}).click();
 await dialog.getByRole('button',{name:'用户',exact:true}).click();await page.getByRole('option',{name:'测试用户',exact:true}).click();
 await dialog.getByRole('button',{name:'重置',exact:true}).click();await expect(dialog.getByRole('combobox',{name:'账户',exact:true})).toHaveValue('');
 await dialog.getByRole('combobox',{name:'请求类型',exact:true}).click();await page.getByRole('option',{name:'WebSocket',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'应用筛选',exact:true})).toBeInViewport();
 await dialog.getByRole('button',{name:'应用筛选',exact:true}).click();await expect(dialog).not.toBeVisible();
 await expect(page.getByRole('status',{name:'已应用筛选'})).toHaveText('{"request_type":"ws_v2"}');
});

// Widget installation now happens exclusively through the launcher picker.
