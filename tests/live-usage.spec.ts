import {test,expect,type Page} from '@playwright/test';

async function setup(page:Page,theme='light'){
  await page.setViewportSize({width:390,height:800});
  await page.clock.install();
  await page.addInitScript(({theme})=>{
    const w=window as any;
    const row=(id:number)=>({id,model:'gpt-5',created_at:new Date(Date.UTC(2030,0,1,12,0,id)).toISOString(),input_tokens:1000,output_tokens:200,duration_ms:2000,api_key:{name:'测试密钥'}});
    w.feed={rows:Array.from({length:60},(_,i)=>row(60-i)),calls:[],hold:false,pending:[],fail:false,add(id:number){this.rows.unshift(row(id));},release(){for(const id of this.pending)w.__nativeReply(id,{items:this.rows.slice(0,30),total:this.rows.length,pages:Math.ceil(this.rows.length/30)});this.pending=[];}};
    w.Android={call(id:string,op:string,payload:string){const p=JSON.parse(payload);let data:any=true;
      if(op==='config')data={connections:[{id:'demo',name:'Demo',url:'https://demo.invalid',keySet:true}],selected:'demo',groupId:'',accounts:[],interval:1,refreshOnOpen:false,theme};
      else if(op==='systemAppearance')data={dark:false};
      else if(op==='getCache')data=p.key.startsWith('groups:')?[]:{accounts:[],updated:Date.now()};
      else if(op==='api'){
        w.feed.calls.push(p.path);
        if(p.path.startsWith('/admin/usage?')){
          if(w.feed.hold){w.feed.pending.push(id);return;}
          if(w.feed.fail){queueMicrotask(()=>w.__nativeReply(id,null,'模拟网络中断'));return;}
          const page=Number(new URL(p.path,'https://demo.invalid').searchParams.get('page'));
          data={items:w.feed.rows.slice((page-1)*30,page*30),total:w.feed.rows.length,pages:Math.ceil(w.feed.rows.length/30)};
        }else if(p.path.includes('snapshot-v2'))data={trend:[],models:[],groups:[]};
        else if(p.path.includes('/groups/all'))data=[];else data={};
      }
      queueMicrotask(()=>w.__nativeReply(id,data));
    }};
  },{theme});
  await page.goto('/native.html');await page.getByRole('button',{name:'明细',exact:true}).click();await page.getByRole('tab',{name:'明细',exact:true}).click();
  await expect(page.locator('.usage-row')).toHaveCount(30);
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)));
}
async function calls(page:Page){return page.evaluate(()=>(window as any).feed.calls.filter((path:string)=>path.startsWith('/admin/usage?')) as string[]);}
async function pull(page:Page,distance=160){
  const box=await page.locator('.native-scroll').boundingBox();if(!box)throw Error('Missing scroller');
  await page.mouse.move(box.x+180,box.y+80);await page.mouse.down();await page.mouse.move(box.x+180,box.y+80+distance,{steps:8});
}

for(const theme of ['light','dark'])test(`10-second head polling inserts with motion, preserves nodes and can stop (${theme})`,async({page})=>{
  await setup(page,theme);
  await page.evaluate(()=>{(window as any).originalRow=document.querySelector('[data-record-id="60"]');});
  await page.getByRole('button',{name:'开启自动刷新'}).click();
  const stop=page.getByRole('button',{name:'停止自动刷新'});await expect(stop).toHaveAttribute('aria-pressed','true');await expect(stop).toHaveClass(/spinning/);
  await page.evaluate(()=>{(window as any).feed.add(61);(window as any).feed.add(62);});
  const count=(await calls(page)).length;await page.clock.runFor(9999);expect((await calls(page)).length).toBe(count);
  await page.clock.runFor(1);await expect(page.locator('.usage-row')).toHaveCount(32);
  expect(await page.evaluate(()=>(window as any).originalRow===document.querySelector('[data-record-id="60"]'))).toBe(true);
  expect(await page.locator('.request-row-slot').first().evaluate(el=>el.getAnimations().some(animation=>animation.effect?.getKeyframes().some(frame=>Number(frame.opacity)===0)))).toBe(true);
  expect(await page.locator('[data-record-id="60"]').evaluate(el=>el.getAnimations().length)).toBeGreaterThan(0);
  expect(await page.locator('.native-scroll').evaluate(el=>el.scrollTop)).toBe(0);
  await page.clock.runFor(50000);await expect(page.locator('.usage-row')).toHaveCount(32);
  expect((await calls(page)).every(path=>new URL(path,'https://demo.invalid').searchParams.get('page')==='1')).toBe(true);
  await stop.click();const stopped=(await calls(page)).length;await page.clock.runFor(30000);expect((await calls(page)).length).toBe(stopped);
  await expect(page.getByRole('button',{name:'开启自动刷新'})).not.toHaveClass(/spinning/);
});

test('slow polling never overlaps; pull reuses it, stops polling and retracts after completion',async({page})=>{
  await setup(page);await page.evaluate(()=>{(window as any).feed.hold=true;});
  await page.getByRole('button',{name:'开启自动刷新'}).click();const started=(await calls(page)).length;
  await page.clock.runFor(20000);expect((await calls(page)).length).toBe(started);
  await pull(page);await expect(page.locator('.pull-refresh-indicator')).toHaveText('释放刷新');
  expect(await page.locator('.pull-refresh-indicator svg').evaluate(el=>el.getAttribute('style'))).toContain('rotate');
  await page.mouse.up();await expect(page.locator('.pull-refresh')).toHaveClass(/refreshing/);
  await expect(page.locator('.pull-refresh-indicator')).toHaveText('正在刷新…');
  await expect(page.getByRole('button',{name:'开启自动刷新'})).toHaveAttribute('aria-pressed','false');
  expect((await calls(page)).length).toBe(started);
  await page.evaluate(()=>{(window as any).feed.add(61);(window as any).feed.hold=false;(window as any).feed.release();});
  await expect(page.locator('.usage-row')).toHaveCount(31);await expect(page.locator('.pull-refresh')).toHaveAttribute('data-pull-distance','0');
  await page.clock.runFor(30000);expect((await calls(page)).length).toBe(started);await expect(page.locator('.pull-refresh-indicator')).toHaveAttribute('aria-hidden','true');
});

test('short pull cancels, full pull requests only once, and errors keep existing rows',async({page})=>{
  await setup(page);const initial=(await calls(page)).length;
  await pull(page,50);await expect(page.locator('.pull-refresh-indicator')).toHaveText('下拉刷新');await page.mouse.up();
  expect((await calls(page)).length).toBe(initial);
  await page.evaluate(()=>{(window as any).feed.fail=true;});
  await pull(page);await page.mouse.up();await expect(page.getByText('刷新失败，下拉重试')).toBeVisible();
  await expect(page.locator('.usage-row')).toHaveCount(30);await expect(page.locator('.pull-refresh')).toHaveAttribute('data-pull-distance','0');
  expect((await calls(page)).length).toBe(initial+1);
  await page.evaluate(()=>{(window as any).feed.fail=false;(window as any).feed.add(61);});
  await pull(page);await page.mouse.up();await expect(page.locator('.usage-row')).toHaveCount(31);await expect(page.getByText('刷新失败，下拉重试')).toHaveCount(0);
});

test('history stays loaded and reading position stays anchored; reduced motion is respected',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await setup(page);
  await page.locator('.native-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});await expect(page.locator('.usage-row')).toHaveCount(60);
  await page.locator('.native-scroll').evaluate(el=>{el.scrollTop=600;});
  const anchor=page.locator('[data-record-id="50"]');const before=await anchor.boundingBox();
  await page.evaluate(()=>{(window as any).feed.add(61);});await page.getByRole('button',{name:'开启自动刷新'}).click();
  await expect(page.locator('.usage-row')).toHaveCount(61);const after=await anchor.boundingBox();expect(Math.abs(after!.y-before!.y)).toBeLessThan(2);
  await page.locator('.native-scroll').evaluate(el=>{el.scrollTop=0;});await page.evaluate(()=>{(window as any).feed.add(62);});await page.clock.runFor(10000);
  await expect(page.locator('.usage-row')).toHaveCount(62);expect(await page.locator('.request-row-slot').first().evaluate(el=>el.getAnimations().length)).toBe(0);
});

test('real touch drag releases one refresh without opening a request',async({page})=>{
  await setup(page);await page.evaluate(()=>{(window as any).feed.hold=true;});
  const device=await page.context().newCDPSession(page),box=(await page.locator('.native-scroll').boundingBox())!;
  const x=Math.round(box.x+180),y=Math.round(box.y+80),before=(await calls(page)).length;
  await device.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let dy=20;dy<=160;dy+=20)await device.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+dy}]});
  await expect(page.locator('.pull-refresh-indicator')).toHaveText('释放刷新');
  await device.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('.pull-refresh')).toHaveClass(/refreshing/);expect((await calls(page)).length).toBe(before+1);
  await expect(page.getByRole('heading',{name:'调用详情'})).toHaveCount(0);
  await page.evaluate(()=>{(window as any).feed.release();});await expect(page.locator('.pull-refresh')).toHaveAttribute('data-pull-distance','0');
});

test('phone preview pull gesture coexists with its normal drag scrolling',async({page})=>{
  let count=0;const now=Date.now();
  const rows=Array.from({length:30},(_,i)=>({id:30-i,model:'gpt-5',created_at:new Date(now-i*1000).toISOString(),input_tokens:1000,output_tokens:100,duration_ms:2000,api_key:{name:'预览密钥'}}));
  await page.route('**/__native',async route=>{
    const {op,payload:p={}}=route.request().postDataJSON();let data:any=true;
    if(op==='config')data={connections:[{id:'demo',name:'Demo',url:'https://demo.invalid'}],selected:'demo',groupId:'',accounts:[],interval:15,refreshOnOpen:false,theme:'light'};
    else if(op==='getCache')data=p.key.startsWith('groups:')?[]:{accounts:[],updated:now};
    else if(op==='api'){
      if(p.path.startsWith('/admin/usage?')){count++;data={items:rows,total:30,pages:1};}
      else if(p.path.includes('snapshot-v2'))data={trend:[],models:[],groups:[]};
      else data=p.path.includes('/groups/all')?[]:{};
    }
    await route.fulfill({json:{data}});
  });
  await page.goto('/');await page.getByRole('button',{name:'明细',exact:true}).click();await page.getByRole('tab',{name:'明细',exact:true}).click();await expect(page.locator('.usage-row')).toHaveCount(30);
  const scroll=page.locator('.mobile-scroll'),box=(await scroll.boundingBox())!,x=box.x+180,y=box.y+70;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+165,{steps:10});
  await expect(page.locator('.pull-refresh-indicator')).toHaveText('释放刷新');await page.mouse.up();
  await expect.poll(()=>count).toBe(2);await expect(page.locator('.pull-refresh')).toHaveAttribute('data-pull-distance','0');
  await page.mouse.move(x,y+200);await page.mouse.down();await page.mouse.move(x,y+30,{steps:10});await page.mouse.up();
  expect(await scroll.evaluate(el=>el.scrollTop)).toBeGreaterThan(60);
});
