import { ArrowDownIcon, ArrowUpIcon, LayersIcon, TimerIcon, PersonIcon, Link2Icon, ChevronDownIcon, TokensIcon } from '@radix-ui/react-icons';
import { tokens, money, seconds, latencyTPS, safeFields, type RecordData } from './data';
import type { ReactNode } from 'react';
import FastIndicator from './FastIndicator';
import RequestTypeBadge from './RequestTypeBadge';
import {requestTypeLabels,resolveRequestType} from './request-type';
const fields=(entries:[string,any][])=>entries.map(([label,value])=><div className="field-row" key={label}><span>{label}</span><b>{value==null||value===''?'—':String(value)}</b></div>);
function Section({title,icon,children}:{title:string;icon:ReactNode;children:ReactNode}){return <details className="call-section" open><summary>{icon}<span>{title}</span><ChevronDownIcon/></summary>{children}</details>;}
export default function CallDetail({r}:{r:RecordData}) {
  return <>
    <div className="call-heading"><div><h2>{r.model||'—'}</h2><RequestTypeBadge record={r}/>{r.reasoning_effort&&<span className="reason">{r.reasoning_effort}</span>}</div><p>{new Date(r.created_at).toLocaleString('zh-CN',{hour12:false})}</p></div>
    <Section title="Token 用量" icon={<TokensIcon/>}><div className="call-token-grid">{[
      ['输入',r.input_tokens,<ArrowDownIcon/>, 'green'],['输出',r.output_tokens,<ArrowUpIcon/>, 'purple'],
      ['缓存读取',r.cache_read_tokens,<LayersIcon/>, 'blue'],['缓存创建',r.cache_creation_tokens,<LayersIcon/>, '']
    ].map(([label,value,icon,color],i)=><div key={i}><small className={String(color)}>{icon as ReactNode}{String(label)}</small><strong>{tokens(value)}</strong><span>Tokens</span></div>)}</div><details className="fee-breakdown"><summary>缓存创建明细</summary>{fields([['5分钟缓存创建',tokens(r.cache_creation_5m_tokens)],['1小时缓存创建',tokens(r.cache_creation_1h_tokens)]])}</details></Section>
    <Section title="延迟" icon={<TimerIcon/>}><div className="call-three">{[['首字延迟',seconds(r.first_token_ms)],['总耗时',seconds(r.duration_ms)],['输出 TPS',latencyTPS(r)+' tok/s']].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}{label==='输出 TPS'&&<FastIndicator record={r}/>}</strong></div>)}</div></Section>
    <Section title="费用" icon={<TokensIcon/>}><div className="call-three fee-values">{[['实际费用',money(r.actual_cost,6)],['账户成本',money(r.account_stats_cost,6)],['标准费用',money(r.total_cost,6)]].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>{fields([['计费模式',r.billing_mode]])}<details className="fee-breakdown"><summary>费用组成</summary>{fields([['倍率',r.rate_multiplier],['账户倍率',r.account_rate_multiplier],['输入费用',money(r.input_cost,7)],['输出费用',money(r.output_cost,7)],['缓存读取费用',money(r.cache_read_cost,7)],['缓存创建费用',money(r.cache_creation_cost,7)]])}</details></Section>
    <Section title="账户与权限" icon={<PersonIcon/>}>{fields([['用户',r.user?.email||r.user_id],['API 密钥',r.api_key?.name],['账户',r.account?.name||r.account_id],['分组',r.group?.name||r.group_id]])}</Section>
    <Section title="请求与端点" icon={<Link2Icon/>}>{fields([['请求类型',requestTypeLabels[resolveRequestType(r)]],['推理强度',r.reasoning_effort],['账户',r.account?.name||r.account_id],['入站端点',r.inbound_endpoint],['上游端点',r.upstream_endpoint],['IP',r.ip_address],['请求 ID',r.request_id]])}</Section>
    <section className="detail-section"><details><summary>全部字段</summary>{Object.entries(safeFields(r)).map(([k,v])=><div key={k} className="raw-field"><span>{k}</span><pre>{typeof v==='object'?JSON.stringify(v,null,2):String(v??'—')}</pre></div>)}</details></section>
  </>;
}
