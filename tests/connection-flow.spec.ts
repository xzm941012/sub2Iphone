import {test,expect,type Page} from '@playwright/test';

// Native bridge fixture: never contact a real service or save real credentials.
async function openConnection(page:Page){
  await page.addInitScript(()=>{
    const fixture=window as any;
    const config={connections:[{id:'fixture',name:'测试连接',url:'https://fixture.invalid',keySet:true}],selected:'fixture',groupId:'',accounts:[],interval:15,refreshOnOpen:false,theme:'light'};
    fixture.connectionCalls=[];
    fixture.pendingQuota=[];
    fixture.testFailure=false;
    fixture.saveFailure=false;
    fixture.Android={call(id:string,op:string,payload:string){
      const p=JSON.parse(payload);
      fixture.connectionCalls.push({op,payload:p});
      let result:any=true,error:string|undefined;
      if(op==='config')result=config;
      else if(op==='systemAppearance')result={dark:false};
      else if(op==='getCache')result=p.key.startsWith('groups:')?[]:{accounts:[],updated:Date.now()};
      else if(op==='testConfig'&&fixture.testFailure)error='密钥无效或权限不足';
      else if(op==='saveConfig'&&fixture.saveFailure)error='设置保存失败';
      else if(op==='api'){
        if(p.path.startsWith('/admin/accounts?')){fixture.pendingQuota.push(id);return;}
        if(p.path==='/admin/groups/all?platform=openai')result=[];
        else throw Error('Unexpected API '+p.path);
      }else if(!['testConfig','saveConfig','appearance','hideKeyboard','setCache'].includes(op))throw Error('Unexpected operation '+op);
      queueMicrotask(()=>fixture.__nativeReply(id,result,error));
    }};
    fixture.finishQuota=(error?:string)=>{for(const id of fixture.pendingQuota.splice(0))fixture.__nativeReply(id,{items:[],total:0},error);};
  });
  await page.goto('/native.html');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByRole('button',{name:'编辑 测试连接',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'编辑连接'})).toBeVisible();
}

test('saved connection closes immediately while quota is still pending; refresh failure stays on quota page',async({page})=>{
  await openConnection(page);
  await page.getByRole('button',{name:'保存并连接',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'编辑连接'})).not.toBeVisible();
  await expect(page.getByRole('heading',{name:'额度',exact:true})).toBeVisible();
  await expect(page.getByText('连接成功，设置已保存',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as any).pendingQuota.length)).toBe(1);
  await expect(page.getByText('正在更新…',{exact:true})).toBeVisible();
  await page.evaluate(()=>(window as any).finishQuota('模拟额度请求超时'));
  await expect(page.getByRole('alert')).toContainText('模拟额度请求超时');
  await expect(page.getByRole('dialog',{name:'编辑连接'})).not.toBeVisible();
  const ops=await page.evaluate(()=>(window as any).connectionCalls.map((c:any)=>c.op));
  expect(ops.filter((op:string)=>op==='testConfig')).toHaveLength(1);
  expect(ops.filter((op:string)=>op==='saveConfig')).toHaveLength(1);
});

for(const failure of ['test','save'] as const)test(`${failure} failure keeps editable connection and releases busy state`,async({page})=>{
  await openConnection(page);
  await page.evaluate((failure)=>{(window as any)[failure+'Failure']=true;},failure);
  const save=page.getByRole('button',{name:'保存并连接',exact:true});
  await save.click();
  await expect(page.getByRole('dialog',{name:'编辑连接'})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'编辑连接'}).getByRole('status')).toHaveText(failure==='test'?'密钥无效或权限不足':'设置保存失败');
  await expect(save).toBeEnabled();
  expect(await page.evaluate(()=>(window as any).pendingQuota.length)).toBe(0);
});
