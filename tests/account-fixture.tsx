import React from 'react';
import {createRoot} from 'react-dom/client';
let value={id:999,name:'模拟账户',platform:'openai',type:'oauth',proxyId:0,wsMode:'passthrough',schedulable:true},writes=0;
window.Android={call(id,op,payload){const p=JSON.parse(payload);if(op==='accountSettings'){setTimeout(()=>window.__nativeReply?.(id,value),40);return;}if(op==='accountProxies'){window.__nativeReply?.(id,[{id:1,name:'模拟代理',protocol:'http'}]);return;}if(op==='saveAccountSettings'){writes++;document.getElementById('calls')!.textContent='模拟保存 '+writes+' 次';document.getElementById('payload')!.textContent=JSON.stringify(p);setTimeout(()=>{value={...value,...p.changes};window.__nativeReply?.(id,location.search.includes('fail')?null:value,location.search.includes('fail')?'模拟保存未确认':undefined);},500);return;}throw Error('Unexpected operation '+op);}};
const {default:Editor}=await import('../src/AccountSettings');await import('../src/prototype.css');
function Fixture(){return <><aside style={{padding:10,background:'white'}}><output id="calls">模拟保存 0 次</output><pre id="payload"/></aside><div className="quota-app dense-app on-device" style={{height:'calc(100dvh - 60px)'}}><Editor id={999} close={()=>{}} updated={()=>{}}/></div></>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
