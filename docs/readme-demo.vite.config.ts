import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Isolated screenshot preview: synthetic data only; never reads local credentials.
const now=Date.now(),reset5=new Date(now+138*60000).toISOString(),reset7=new Date(now+(4*24+19)*3600000).toISOString();
const names=['工作账户','备用账户','开发账户'];
const accounts=names.map((name,i)=>({id:i+1,name,schedulable:true,resetCredits:{available_count:3,credits:[]},five:{used:[24,50,8][i],reset:reset5,tokens:[18400000,25600000,8200000][i],cost:[4.8,6.4,1.6][i],estimated:[20,12.8,20][i]},seven:{used:[62,87,64][i],reset:reset7,tokens:[142000000,184000000,94000000][i],cost:[32.4,41.6,24.8][i],estimated:[52.26,47.82,38.75][i]}}));
const groups=[{id:1,name:'openai-plus'},{id:2,name:'开发环境'}];
let config={connections:[{id:'demo',name:'Sub2API Demo',url:'https://demo.example',keySet:true}],selected:'demo',groupId:'1',accounts:[],interval:15,refreshOnOpen:false,theme:'light'};
const records=Array.from({length:14},(_,i)=>({id:i+1,model:i%4===3?'claude-sonnet-4.5':'gpt-5',reasoning_effort:i%4===3?'':'high',created_at:new Date(now-i*245000).toISOString(),input_tokens:[2480,813,4206,1632][i%4],output_tokens:[642,218,1205,384][i%4],cache_read_tokens:Math.round(128400-i*2400),cache_creation_tokens:0,first_token_ms:[970,1240,680,1530][i%4],duration_ms:[12800,4870,18600,9240][i%4],actual_cost:.0327,account_stats_cost:.0327,total_cost:.0412,billing_mode:'token',request_type:'ws_v2',api_key:{name:i%3===0?'代码审查':'日常开发'},user:{email:'demo@example.com'},account:{name:names[i%3]},group:{name:'openai-plus'}}));
export default defineConfig({plugins:[react(),{name:'readme-demo-data',configureServer(server){server.middlewares.use('/__native',async(req,res)=>{
 res.setHeader('Content-Type','application/json');try{let body='';for await(const part of req)body+=part;const {op,payload:p={}}=JSON.parse(body);let data:unknown=true;
 if(op==='config')data=config;
 else if(op==='getCache')data=p.key.startsWith('groups:')?groups:{accounts,updated:now};
 else if(op==='saveConfig'){config=p.config;}
 else if(op==='savePreferences'){config={...config,...p.preferences};}
 else if(op==='systemAppearance')data={dark:false};
 else if(op==='api'){
  if(p.path.includes('/groups/all'))data=groups;
  else if(p.path.includes('/usage/stats'))data={total_requests:1284,total_tokens:86400000,total_input_tokens:11200000,total_output_tokens:4800000,total_cache_read_tokens:70400000,total_actual_cost:18.42,total_account_cost:18.42,total_cost:23.03,average_duration_ms:8620};
  else if(p.path.includes('snapshot-v2'))data={trend:Array.from({length:12},(_,i)=>({date:new Date(now-(11-i)*3600000).toISOString().slice(0,13).replace('T',' ')+':00',input_tokens:[150000,240000,180000,390000,260000,520000,430000,680000,490000,820000,710000,590000][i],output_tokens:[60000,90000,70000,160000,110000,220000,180000,290000,210000,360000,300000,250000][i],cache_read_tokens:[800000,1200000,970000,1700000,1400000,2300000,1900000,2900000,2400000,3600000,3100000,2600000][i]})),models:[{model:'gpt-5',total_tokens:64200000},{model:'claude-sonnet-4.5',total_tokens:22200000}],groups:[{group_name:'openai-plus',total_tokens:86400000}]};
  else if(p.path.startsWith('/admin/usage?'))data={items:records,total:1284,pages:1};
  else throw Error('This demo does not implement this API');
 }else if(!['setCache','appearance','hideKeyboard','background'].includes(op))throw Error('Read-only screenshot demo');
 res.end(JSON.stringify({data}));}catch(e){res.statusCode=400;res.end(JSON.stringify({error:(e as Error).message}));}
 });}}],server:{host:'127.0.0.1',port:4182,strictPort:true}});
