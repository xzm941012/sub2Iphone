// Standalone test route. Every bridge operation is intercepted; no live API calls.
import React from 'react';
import {createRoot} from 'react-dom/client';
let calls=0;
const credits={available_count:3,credits:[{expires_at:'2030-10-22T20:52:19Z'},{expires_at:'2030-10-29T18:24:11Z'}]};
window.Android={call(id,op,payload){const p=JSON.parse(payload);if(op==='api'){setTimeout(()=>window.__nativeReply?.(id,{rate_limit_reset_credits:credits}),50);return;}if(op==='resetOpenAIQuota'){calls++;document.getElementById('calls')!.textContent='模拟重置请求 '+calls+' 次';document.getElementById('payload')!.textContent=JSON.stringify(p);setTimeout(()=>window.__nativeReply?.(id,location.search.includes('fail')?null:{code:'ok',windows_reset:2,quota:{rate_limit_reset_credits:{available_count:2,credits:[]}}},location.search.includes('fail')?'模拟网络超时':undefined),700);return;}throw new Error('Unexpected operation '+op);}};
const {default:ResetDialog}=await import('../src/ResetDialog');
await import('../src/prototype.css');
const p={used:90,tokens:10000,cost:1,estimated:10,reset:'2030-10-22T00:00:00Z'};
function Fixture(){const [open,setOpen]=React.useState(false),[updated,setUpdated]=React.useState(false);return <><div style={{padding:20,fontFamily:'sans-serif'}}><h1>重置流程隔离测试</h1><p>全部使用模拟接口，无真实服务请求。</p><output id="calls">模拟重置请求 0 次</output><pre id="payload"/><p>{updated?'刷新回调已触发':'尚未刷新'}</p><button onClick={()=>setOpen(true)}>打开模拟重置</button></div><ResetDialog account={open?{id:999,name:'模拟账户',five:p,seven:p,resetCredits:credits}:null} close={()=>setOpen(false)} updated={()=>setUpdated(true)}/></>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
