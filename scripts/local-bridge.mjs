import fs from 'node:fs';
import path from 'node:path';
import {accountAdmin} from './account-admin.mjs';
import {preferencePatch} from '../src/preferences.ts';
const desktopPath = path.join(process.env.APPDATA, 'ClaudeCodeUsageMonitor', 'settings.json');
let config, cache = {};
function initial() { const d = JSON.parse(fs.readFileSync(desktopPath, 'utf8')).sub2api; return { connections: [{ id: 'desktop', name: 'Sub2API', url: d.base_url, key: d.admin_api_key }], selected: 'desktop', groupId: String(d.group_id), accounts: [], interval: 15, refreshOnOpen: true, theme: 'light' }; }
const scrub = value => Array.isArray(value) ? value.map(scrub) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([k]) => !/^(key|admin_api_key|access_token|refresh_token|password|credentials|secret)$/i.test(k)).map(([k,v]) => [k,scrub(v)])) : value;
export function localBridge() { return { name: 'local-native-bridge', configureServer(server) { server.middlewares.use('/__native', async (req, res) => { res.setHeader('Content-Type', 'application/json'); try {
  if (req.method !== 'POST' || (req.headers.origin && !/^http:\/\/(localhost|127\.0\.0\.1):4173$/.test(req.headers.origin))) throw new Error('不允许的请求');
  let body = ''; for await (const part of req) { body += part; if (body.length > 2e6) throw new Error('请求过大'); } const {op,payload:p={}} = JSON.parse(body); config ??= initial(); let data;
  if(op === 'config') data = { ...config, connections: config.connections.map(c=>({id:c.id,name:c.name,url:c.url,keySet:!!c.key})) };
  else if(op === 'saveConfig') { const next=p.config; next.connections=next.connections.map(c=>({...c,key:c.key || config.connections.find(x=>x.id===c.id)?.key || ''})); config=next; data=true; }
  else if(op === 'savePreferences') {config={...config,...preferencePatch(p.preferences)};data=true;}
  else if(op === 'getCache') data=cache[p.key] ?? null;
  else if(op === 'setCache') { cache[p.key]=p.value; data=true; }
  else if(op === 'pinWidget') data={supported:false,message:'请在安装后的手机应用中添加组件'};
  else if(op === 'appearance' || op === 'background') data=true;
  else if(op === 'testConfig') {const c=p.config.connections.find(x=>x.id===p.config.selected);const key=c?.key||config.connections.find(x=>x.id===c?.id)?.key;if(!c||!key)throw new Error('请填写管理员 API 密钥');const r=await fetch(c.url.replace(/\/$/,'')+'/api/v1/admin/groups/all?platform=openai',{headers:{'x-api-key':key},redirect:'error',signal:AbortSignal.timeout(30000)});const j=await r.json();if(!r.ok||j.code!==0)throw new Error('连接失败，请检查地址和密钥');data=true;}
  else if(['accountSettings','accountProxies','saveAccountSettings'].includes(op)) {const c=config.connections.find(x=>x.id===config.selected);if(!c?.key)throw Error('请先连接服务');data=await accountAdmin(op,p,async(method,path,payload)=>{const r=await fetch(c.url.replace(/\/$/,'')+'/api/v1'+path,{method,headers:{'x-api-key':c.key,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{}),redirect:'error',signal:AbortSignal.timeout(25000)});const j=await r.json();if(!r.ok||j.code!==0)throw Error('账户接口失败 '+r.status);return j.data;});}
  else if(op === 'resetOpenAIQuota') { if(p.confirmed!==true||!Number.isInteger(p.accountId)||p.accountId<=0)throw new Error('请先确认重置账户'); const c=config.connections.find(x=>x.id===config.selected);if(!c?.key)throw new Error('请先连接服务');const r=await fetch(c.url.replace(/\/$/,'')+'/api/v1/admin/openai/accounts/'+p.accountId+'/reset-quota',{method:'POST',headers:{'x-api-key':c.key,'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(90000)});const j=await r.json();if(!r.ok||j.code!==0)throw new Error(j.message||'服务未确认重置');data=scrub(j.data); }
  else if(op === 'api') { const c=config.connections.find(x=>x.id===config.selected); if(!c?.key) throw new Error('请先在设置中连接服务'); if(!p.path.startsWith('/admin/') || p.path.includes('..')) throw new Error('无效接口'); const r=await fetch(c.url.replace(/\/$/,'')+'/api/v1'+p.path,{headers:{'x-api-key':c.key,Accept:'application/json'},signal:AbortSignal.timeout(30000),redirect:'error'}); const j=await r.json(); if(!r.ok || j.code!==0) throw new Error(j.message || '接口错误 '+r.status); data=scrub(j.data); }
  else throw new Error('不支持的操作'); res.end(JSON.stringify({data}));
} catch(e) { res.statusCode=400; res.end(JSON.stringify({error:e.message})); } }); } }; }
