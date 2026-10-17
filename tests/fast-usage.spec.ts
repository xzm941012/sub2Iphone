import {test,expect} from '@playwright/test';

for(const theme of ['light','dark'])test(`Fast is marked in request rows and details in ${theme} mode`,async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await page.addInitScript(({theme})=>{
    const fixture=window as any;
    const records=['priority',' FAST ','standard','flex',null].map((service_tier,i)=>({id:i+1,service_tier,model:'gpt-5',created_at:'2030-01-01T12:00:00Z',input_tokens:1000,output_tokens:200,duration_ms:2000,first_token_ms:400,api_key:{name:'演示密钥'}}));
    fixture.Android={call(id:string,op:string,payload:string){
      const p=JSON.parse(payload);let result:any=true;
      if(op==='config')result={connections:[{id:'demo',name:'Demo',url:'https://demo.invalid',keySet:true}],selected:'demo',groupId:'',accounts:[],interval:15,refreshOnOpen:false,theme};
      else if(op==='systemAppearance')result={dark:false};
      else if(op==='getCache')result=p.key.startsWith('groups:')?[]:{accounts:[],updated:Date.now()};
      else if(op==='api'){
        if(p.path.startsWith('/admin/usage?'))result={items:records,total:records.length,pages:1};
        else if(p.path.startsWith('/admin/usage/stats'))result={};
        else if(p.path.includes('snapshot-v2'))result={trend:[],models:[],groups:[]};
        else if(p.path.includes('/groups/all'))result=[];
        else throw Error('Unexpected demo API '+p.path);
      }else if(!['appearance','hideKeyboard','setCache'].includes(op))throw Error('Unexpected demo operation '+op);
      queueMicrotask(()=>fixture.__nativeReply(id,result));
    }};
  },{theme});
  await page.goto('/native.html');
  await page.getByRole('button',{name:'明细',exact:true}).click();
  await page.getByRole('tab',{name:'明细',exact:true}).click();
  const rows=page.locator('.usage-row');await expect(rows).toHaveCount(5);
  await expect(rows.nth(0).getByRole('img',{name:'Fast 已开启'})).toBeVisible();
  await expect(rows.nth(1).getByRole('img',{name:'Fast 已开启'})).toBeVisible();
  for(const i of [2,3,4])await expect(rows.nth(i).getByRole('img',{name:'Fast 已开启'})).toHaveCount(0);
  const output=rows.first().locator('.latency-data>div').last();
  expect(await output.evaluate(el=>{const label=el.querySelector('small')!.getBoundingClientRect(),icon=el.querySelector('.fast-indicator')!.getBoundingClientRect();return icon.left>=label.right&&icon.right<=el.getBoundingClientRect().right&&icon.width<=12;})).toBe(true);
  await rows.first().click();
  await expect(page.getByRole('heading',{name:'调用详情'})).toBeVisible();
  await expect(page.locator('.call-three').first().getByRole('img',{name:'Fast 已开启'})).toBeVisible();
  await page.getByRole('button',{name:'返回明细'}).click();await rows.nth(2).click();
  await expect(page.getByRole('img',{name:'Fast 已开启'})).toHaveCount(0);
});
