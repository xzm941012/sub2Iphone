import {test,expect} from '@playwright/test';

for(const theme of ['light','dark'])for(const width of [320,390])test(`request badges match list and details without overflow (${theme}, ${width}px)`,async({page})=>{
  await page.setViewportSize({width,height:800});
  await page.addInitScript(({theme})=>{
    const w=window as any;
    const variants=[{request_type:'stream'},{request_type:'ws_v2'},{request_type:'sync',stream:true,openai_ws_mode:true},{request_type:'unknown',stream:true},{openai_ws_mode:true},{stream:true},{stream:false},{request_type:'invalid',stream:true},{request_type:'cyber'},{request_type:'live'}];
    const records=variants.map((variant,i)=>({id:i+1,...variant,model:i?'gpt-5':'very-long-model-name-that-needs-to-be-truncated',reasoning_effort:'High',service_tier:i===0?'priority':'standard',account:i===0?{name:'演示账户'}:undefined,account_id:i+40,created_at:'2030-01-01T12:00:00Z',input_tokens:1000,output_tokens:200,duration_ms:2000,api_key:{name:'演示密钥'}}));
    w.Android={call(id:string,op:string,payload:string){const p=JSON.parse(payload);let data:any=true;
      if(op==='config')data={connections:[{id:'demo',name:'Demo',url:'https://demo.invalid',keySet:true}],selected:'demo',groupId:'',accounts:[],interval:15,refreshOnOpen:false,theme};
      else if(op==='systemAppearance')data={dark:false};
      else if(op==='getCache')data=p.key.startsWith('groups:')?[]:{accounts:[],updated:Date.now()};
      else if(op==='api'){
        if(p.path.startsWith('/admin/usage?'))data={items:records,total:records.length,pages:1};
        else if(p.path.includes('snapshot-v2'))data={trend:[],models:[],groups:[]};
        else data=p.path.includes('/groups/all')?[]:{};
      }
      queueMicrotask(()=>w.__nativeReply(id,data));
    }};
  },{theme});
  await page.goto('/native.html');await page.getByRole('button',{name:'明细',exact:true}).click();await page.getByRole('tab',{name:'明细',exact:true}).click();
  const rows=page.locator('.usage-row');await expect(rows).toHaveCount(10);
  const expected=['流式','WS','同步','未知','WS','流式','同步','流式','Cyber','Live'];
  for(let i=0;i<expected.length;i++){
    const row=rows.nth(i),badge=row.locator('.request-badge');await expect(badge).toHaveText(expected[i]);
    expect(await row.evaluate(el=>{
      const badge=el.querySelector('.request-badge')!.getBoundingClientRect(),model=el.querySelector('.row-model b')!.getBoundingClientRect(),time=el.querySelector('time')!.getBoundingClientRect();
      return badge.left>=model.right&&badge.right<=time.left&&el.scrollWidth<=el.clientWidth;
    })).toBe(true);
  }
  for(const i of [0,1,2,4,5]){
    const badge=rows.nth(i).locator('.request-badge');const color=await badge.evaluate(el=>({text:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
    await rows.nth(i).click();await expect(page.getByRole('heading',{name:'调用详情'})).toBeVisible();
    const detailBadge=page.locator('.call-heading .request-badge');await expect(detailBadge).toHaveText(expected[i]);
    await expect(detailBadge).toHaveCSS('color',color.text);await expect(detailBadge).toHaveCSS('background-color',color.bg);
    await expect(page.locator('.field-row').filter({hasText:'请求类型'}).locator('b')).toHaveText(expected[i]);
    const endpoint=page.locator('.call-section').filter({has:page.locator('summary').filter({hasText:'请求与端点'})});
    await expect(endpoint.locator('.field-row').filter({hasText:'推理强度'}).locator('b')).toHaveText('High');
    await expect(endpoint.locator('.field-row').filter({hasText:'账户'}).locator('b')).toHaveText(i===0?'演示账户':String(i+40));
    expect(await page.locator('.call-heading').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.getByRole('button',{name:'返回明细'}).click();
  }
});
