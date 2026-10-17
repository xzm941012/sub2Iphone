import {ReloadIcon} from '@radix-ui/react-icons';
import {Ring,PeriodInfo,Segments} from './ui';
import type {Account,Period} from './data';

export default function WidgetPreview({accounts,five,seven,tab,onTab,now,busy,onRefresh}:{accounts:Account[];five:Period;seven:Period;tab:number;onTab:(tab:number)=>void;now:number;busy:boolean;onRefresh:()=>void}){
 const visible=accounts.slice(0,5);
 return <section className="quota-card widget-preview"><div className="quota-tabs"><Segments items={['总览','5h','7d']} value={tab} onChange={onTab}/><button className={'icon-button '+(busy?'spinning':'')} aria-label="刷新额度" aria-busy={busy} onClick={onRefresh} disabled={busy}><ReloadIcon/></button></div><div className="quota-visual" data-accounts={tab===0?0:visible.length}><Ring periods={tab===0?[five,seven]:visible.map(a=>tab===1?a.five:a.seven)}/><div className="quota-metrics" aria-label="额度明细">{tab===0?<><PeriodInfo label="5h" p={five} now={now}/><PeriodInfo label="7d" p={seven} now={now}/></>:visible.map(a=><PeriodInfo key={a.id} label={a.name} p={tab===1?a.five:a.seven} now={now} showReset/>)}</div></div>{tab!==0&&accounts.length>5&&<p className="widget-account-limit">显示前 5 个账户 · 共 {accounts.length} 个</p>}</section>;
}
