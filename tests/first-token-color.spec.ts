import {test,expect} from '@playwright/test';

for(const theme of ['light','dark'])test(`TTFT colors follow Sub2API boundaries without recoloring labels (${theme})`,async({page})=>{
  await page.setViewportSize({width:390,height:800});
  await page.addInitScript(({theme})=>{
    const w=window as any;
    const records=[null,0,9999,10000,29999,30000,59999,60000,120000].map((first_token_ms,i)=>({id:i+1,first_token_ms,model:'gpt-5',created_at:'2030-01-01T12:00:00Z',input_tokens:1000,output_tokens:200,duration_ms:150000,api_key:{name:'演示密钥'}}));
    w.Android={call(id:string,op:string,payload:string){
      const p=JSON.parse(payload);let result:any=true;
      if(op==='config')result={connections:[{id:'demo',name:'Demo',url:'https://demo.invalid',keySet:true}],selected:'demo',groupId:'',accounts:[],interval:15,refreshOnOpen:false,theme};
      else if(op==='systemAppearance')result={dark:false};
      else if(op==='getCache')result=p.key.startsWith('groups:')?[]:{accounts:[],updated:Date.now()};
      else if(op==='api'){
        if(p.path.startsWith('/admin/usage?'))result={items:records,total:records.length,pages:1};
        else if(p.path.includes('snapshot-v2'))result={trend:[],models:[],groups:[]};
        else if(p.path.includes('/groups/all'))result=[];
        else result={};
      }
      queueMicrotask(()=>w.__nativeReply(id,result));
    }};
  },{theme});
  await page.goto('/native.html');
  await page.getByRole('button',{name:'明细',exact:true}).click();
  await page.getByRole('tab',{name:'明细',exact:true}).click();
  const rows=page.locator('.usage-row');await expect(rows).toHaveCount(9);
  const severities=['unknown','good','good','warn','warn','slow','slow','critical','critical'];
  const colors=theme==='dark'?['rgb(52, 211, 153)','rgb(251, 191, 36)','rgb(251, 146, 60)','rgb(248, 113, 113)']:['rgb(5, 150, 105)','rgb(217, 119, 6)','rgb(234, 88, 12)','rgb(220, 38, 38)'];
  for(let i=0;i<severities.length;i++){
    const duration=rows.nth(i).locator('.first-token-duration');
    await expect(duration).toHaveAttribute('data-severity',severities[i]);
    await expect(duration).toHaveText(i===0?'—':`${([0,0,9999,10000,29999,30000,59999,60000,120000][i]/1000).toFixed(2)}s`);
    if(i>0)await expect(duration).toHaveCSS('color',colors[['good','warn','slow','critical'].indexOf(severities[i])]);
    const styles=await rows.nth(i).locator('.latency-data').evaluate(el=>{
      const style=getComputedStyle(el);const labels=Array.from(el.querySelectorAll('small')).map(label=>getComputedStyle(label).color);
      return {text:style.color,labels,duration:getComputedStyle(el.querySelector('.first-token-duration')!).color,firstLine:el.children[0].textContent};
    });
    expect(styles.labels.every(color=>color===styles.labels[0])).toBe(true);
    expect(styles.firstLine).toContain('总 150.00s');
    if(i===0)expect(styles.duration).toBe(styles.text);
    else expect(styles.text).not.toBe(styles.duration);
  }
});
