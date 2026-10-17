import {useEffect,useState} from 'react';
import {bridge,isNative} from './data';

export default function WidgetInstructions(){
 const [hint,setHint]=useState('长按桌面空白处 → 小组件（或添加组件）→ SubWatch。');
 useEffect(()=>{let active=true;if(isNative)void bridge('widgetStatus').then(status=>{if(active&&status.manualHint)setHint(status.manualHint);}).catch(()=>{});return()=>{active=false;};},[]);
 return <p className="hint">{hint}后台刷新受手机省电策略影响。</p>;
}
