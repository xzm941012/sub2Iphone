import {test,expect} from '@playwright/test';

for(const surface of ['native','preview'])test(`appending a usage page preserves the viewport and does not chain-load (${surface})`,async({page})=>{
  if(surface==='native'){
    await page.setViewportSize({width:390,height:800});
    await page.addInitScript(()=>{
      const w=window as any;
      w.Android={call(id:string,op:string,payload:string){fetch('/__native',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,payload:JSON.parse(payload)})}).then(r=>r.json()).then(r=>w.__nativeReply(id,r.data));}};
    });
  }
  const now=Date.now(),calls:number[]=[],rows=Array.from({length:150},(_,i)=>({id:150-i,model:'gpt-5',created_at:new Date(now-i*1000).toISOString(),input_tokens:1000,output_tokens:100,duration_ms:2000,api_key:{name:'分页演示'}}));
  let releaseSecond:()=>void=()=>{},secondPending=false;
  await page.route('**/__native',async route=>{
    const {op,payload:p={}}=route.request().postDataJSON();let data:any=true;
    if(op==='config')data={connections:[{id:'demo',name:'Demo',url:'https://demo.invalid',keySet:true}],selected:'demo',groupId:'',accounts:[],interval:15,refreshOnOpen:false,theme:'light'};
    else if(op==='systemAppearance')data={dark:false};
    else if(op==='getCache')data=p.key.startsWith('groups:')?[]:{accounts:[],updated:now};
    else if(op==='api'){
      if(p.path.startsWith('/admin/usage?')){
        const number=Number(new URL(p.path,'https://demo.invalid').searchParams.get('page'));calls.push(number);
        if(number===2){secondPending=true;await new Promise<void>(resolve=>{releaseSecond=resolve;});}
        data={items:rows.slice((number-1)*30,number*30),total:150,pages:5};
      }else if(p.path.includes('snapshot-v2'))data={trend:[],models:[],groups:[]};
      else data=p.path.includes('/groups/all')?[]:{};
    }
    await route.fulfill({json:{data}});
  });
  await page.goto(surface==='native'?'/native.html':'/preview.html');
  await page.getByRole('button',{name:'明细',exact:true}).click();await page.getByRole('tab',{name:'明细',exact:true}).click();
  await expect(page.locator('.usage-row')).toHaveCount(30);
  const scroll=page.locator(surface==='native'?'.native-scroll':'.mobile-scroll');
  await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect.poll(()=>secondPending).toBe(true);
  const top=await scroll.evaluate(el=>el.scrollTop),anchor=page.locator('[data-record-id="121"]'),before=await anchor.boundingBox();
  releaseSecond();
  await expect(page.locator('.usage-row')).toHaveCount(60);
  expect(Math.abs(await scroll.evaluate(el=>el.scrollTop)-top)).toBeLessThan(2);
  expect(Math.abs((await anchor.boundingBox())!.y-before!.y)).toBeLessThan(2);
  await page.waitForTimeout(500);
  expect(calls).toEqual([1,2]);
  await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect(page.locator('.usage-row')).toHaveCount(90);
  await page.waitForTimeout(500);
  expect(calls).toEqual([1,2,3]);
});
