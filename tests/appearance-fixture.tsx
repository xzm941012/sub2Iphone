import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import useAppearance from '../src/useAppearance';
import {Select} from '../src/ui';
import {MobileRuntime} from '../src/mobile';
import '../src/styles.css';
import '../src/prototype.css';
function Fixture(){const [theme,setTheme]=useState('light'),[systemDark,setSystemDark]=useState(false);useAppearance(theme);return <div className="quota-app dense-app on-device"><header className="app-header"><h1>外观验证</h1></header><main className="page-content"><div className="preference-group"><label className="preference-row"><span>刷新间隔</span><Select aria-label="刷新间隔" defaultValue="1 分钟"><option>1 分钟</option><option>15 分钟</option></Select></label><label className="preference-row"><span>外观</span><Select aria-label="外观" value={theme} onChange={e=>setTheme(e.target.value)}><option value="light">浅色</option><option value="dark">深色</option><option value="system">跟随系统</option></Select></label></div><button className="secondary full" onClick={()=>{const next=!systemDark;setSystemDark(next);for(const media of mediaQueries){Object.defineProperty(media,'matches',{configurable:true,value:next});media.dispatchEvent(new Event('change'));}}}>模拟系统{systemDark?'浅色':'深色'}</button><section className="chart-section"><h3>白色卡片 / 深色卡片</h3><p className="hint">仅模拟本地外观，不访问账号 API</p></section></main></div>;}
const original=window.matchMedia.bind(window),mediaQueries:MediaQueryList[]=[];window.matchMedia=query=>{const media=original(query);mediaQueries.push(media);Object.defineProperty(media,'matches',{configurable:true,value:false});return media;};
createRoot(document.getElementById('root')!).render(<MobileRuntime><Fixture/></MobileRuntime>);
