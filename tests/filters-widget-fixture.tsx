import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MobileRuntime} from '../src/mobile';
import {Sheet} from '../src/ui';
import UsageFilters from '../src/UsageFilters';
import WidgetInstructions from '../src/WidgetInstructions';
import '../src/styles.css';
import '../src/prototype.css';
function Fixture(){const [open,setOpen]=useState(true),[value,setValue]=useState({}),[applied,setApplied]=useState({});return <div className="quota-app dense-app on-device"><WidgetInstructions/><Sheet open={open} close={()=>setOpen(false)} title="筛选"><UsageFilters value={value} onChange={setValue} accounts={[{id:1,name:'测试账户'}]} groups={[{id:2,name:'测试分组'}]} onApply={()=>{setApplied(value);setOpen(false);}}/></Sheet><output aria-label="已应用筛选">{JSON.stringify(applied)}</output></div>;}
createRoot(document.getElementById('root')!).render(<MobileRuntime><Fixture/></MobileRuntime>);
