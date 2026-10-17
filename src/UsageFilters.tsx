import {SearchPicker,Select} from './ui';
import type {RecordData} from './data';

export default function UsageFilters({value,onChange,accounts,groups,onApply}: {value:RecordData;onChange:(value:RecordData)=>void;accounts:{id:number;name:string}[];groups:RecordData[];onApply:()=>void}){
 const change=(key:string,next:string)=>onChange({...value,[key]:next});
 return <div className="sheet-content usage-filters"><div className="filter-fields">
  <label>账户<Select aria-label="账户" value={value.account_id||''} onChange={e=>change('account_id',e.target.value)}><option value="">全部账户</option>{accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</Select></label>
  <label>分组<Select aria-label="分组" value={value.group_id||''} onChange={e=>change('group_id',e.target.value)}><option value="">全部分组</option>{groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</Select></label>
  <SearchPicker kind="users" value={value.user_id} onChange={next=>change('user_id',next)}/>
  <SearchPicker kind="api-keys" value={value.api_key_id} onChange={next=>change('api_key_id',next)}/>
  <label>请求类型<Select aria-label="请求类型" value={value.request_type||''} onChange={e=>change('request_type',e.target.value)}><option value="">全部类型</option><option value="stream">Stream</option><option value="sync">Sync</option><option value="ws_v2">WebSocket</option></Select></label>
  <label>计费模式<Select aria-label="计费模式" value={value.billing_mode||''} onChange={e=>change('billing_mode',e.target.value)}><option value="">全部模式</option><option value="token">按 Token</option><option value="per_call">按次</option></Select></label>
 </div><div className="sheet-actions filter-actions"><button className="secondary" onClick={()=>onChange({})}>重置</button><button className="primary" onClick={onApply}>应用筛选</button></div></div>;
}
