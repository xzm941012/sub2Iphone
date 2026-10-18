// Server-side only. Never return raw account extra, credentials or proxy authentication.
const modes=['off','ctx_pool','passthrough','http_bridge'];
const modeKey='openai_oauth_responses_websockets_v2_mode',enabledKey='openai_oauth_responses_websockets_v2_enabled';
export function accountStatusFields(a){
 const fields=['status','error_message','rate_limit_reset_at','overload_until','temp_unschedulable_until','temp_unschedulable_reason','quota_used','quota_limit','quota_daily_used','quota_daily_limit','quota_weekly_used','quota_weekly_limit'];
 return Object.fromEntries(fields.filter(k=>a[k]===null||['string','number'].includes(typeof a[k])).map(k=>[k,a[k]]));
}
export function accountView(a){
 if(a?.platform!=='openai'||!['oauth','setup-token'].includes(a.type))throw Error('仅支持 OpenAI OAuth 账户');
 const e=a.extra??{};let mode=e[modeKey];
 if(mode==='shared'||mode==='dedicated')mode='ctx_pool';
 if(!modes.includes(mode)){const enabled=[e[enabledKey],e.responses_websockets_v2_enabled,e.openai_ws_enabled].find(v=>typeof v==='boolean');mode=enabled?'ctx_pool':'off';}
 return {id:a.id,name:a.name,type:a.type,platform:a.platform,proxyId:a.proxy_id??0,wsMode:mode,schedulable:a.schedulable!==false};
}
export async function accountAdmin(op,p,request){
 if(op==='accountProxies'){const rows=await request('GET','/admin/proxies/all');if(!Array.isArray(rows))throw Error('代理列表格式异常');return rows.map(x=>({id:x.id,name:x.name,protocol:x.protocol,status:x.status}));}
 if(!Number.isInteger(p.accountId)||p.accountId<=0)throw Error('无效账户');
 const path='/admin/accounts/'+p.accountId;
 if(op==='resetAccountStatus'){
  if(p.confirmed!==true)throw Error('请先确认重置账号状态');
  accountView(await request('GET',path));
  try{
   const a=await request('POST',path+'/clear-error');
   if(a?.id!==p.accountId||typeof a.status!=='string')throw Error('无效账号状态');
   return {id:a.id,name:a.name,schedulable:a.schedulable,...accountStatusFields(a)};
  }catch{throw Error('未确认状态重置结果，请核实账号最新状态；不会自动重试');}
 }
 if(op==='accountSettings')return accountView(await request('GET',path));
 if(op!=='saveAccountSettings')throw Error('不支持的账户操作');
 const c=p.changes;
 if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['proxyId','wsMode','schedulable'].includes(k))||!Object.keys(c).length)throw Error('无效账户设置');
 if('proxyId'in c&&(!Number.isInteger(c.proxyId)||c.proxyId<0))throw Error('无效代理');
 if('wsMode'in c&&!modes.includes(c.wsMode))throw Error('无效 WS mode');
 if('schedulable'in c&&typeof c.schedulable!=='boolean')throw Error('无效调度状态');
 const current=await request('GET',path);accountView(current);const patch={};
 if('proxyId'in c)patch.proxy_id=c.proxyId;
 if('wsMode'in c){patch.extra={...current.extra,[modeKey]:c.wsMode,[enabledKey]:c.wsMode!=='off'};delete patch.extra.responses_websockets_v2_enabled;delete patch.extra.openai_ws_enabled;}
 try{
  if(Object.keys(patch).length)await request('PUT',path,patch);
  if('schedulable'in c)await request('POST',path+'/schedulable',{schedulable:c.schedulable});
  return accountView(await request('GET',path));
 }catch{throw Error('保存未全部确认，请重新读取账户状态后核实；不会自动重试');}
}
