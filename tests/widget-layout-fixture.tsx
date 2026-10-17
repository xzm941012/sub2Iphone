import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import WidgetPreview from '../src/WidgetPreview';
import {aggregate,type Account} from '../src/data';
import '../src/prototype.css';
const now=Date.now(),count=Number(new URLSearchParams(location.search).get('count')||8);
const accounts:Account[]=Array.from({length:count},(_,i)=>({id:i+1,name:'账户 '+(i+1),five:{used:i*15,reset:new Date(now+3600000).toISOString(),cost:10,tokens:1000000,estimated:40},seven:{used:84,reset:new Date(now+4*86400000).toISOString(),cost:20,tokens:2000000,estimated:30}}));
function Fixture(){const [tab,setTab]=useState(0),[busy,setBusy]=useState(false);return <div className="quota-app dense-app" style={{padding:16}}><WidgetPreview accounts={accounts} five={aggregate(accounts.map(a=>a.five),now)} seven={aggregate(accounts.map(a=>a.seven),now)} now={now} tab={tab} onTab={setTab} busy={busy} onRefresh={()=>{setBusy(true);setTimeout(()=>setBusy(false),2000);}}/></div>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
