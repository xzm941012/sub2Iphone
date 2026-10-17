import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import UsageApp from './UsageApp';
import { sessionInfo, webBridge } from './web-bridge';
import '@fontsource/roboto/latin-500.css';
import './native.css';
import './web.css';

function WebApp() {
  const [session, setSession] = useState(sessionInfo);
  const [clearError, setClearError] = useState('');
  useEffect(() => { const update = () => setSession(sessionInfo()); window.addEventListener('subwatch-session', update); return () => window.removeEventListener('subwatch-session', update); }, []);
  return <div className="web-shell"><aside className="web-masthead"><a className="web-brand" href={import.meta.env.BASE_URL} aria-label="SubWatch 首页"><img src={import.meta.env.BASE_URL+'branding/sub2api-logo.svg'} alt=""/><span>SubWatch<small>WEB</small></span></a><p>额度与用量，随时掌握。</p><div className="web-session" role="status"><span className={session.demo ? 'demo-dot' : session.connected ? 'live-dot' : 'offline-dot'}/>{session.demo ? '演示数据' : session.connected ? session.name + ' · 已连接' : '待输入密钥'}</div><p className="web-context">{session.demo ? '所有数据均为模拟。可在设置中添加自己的 Sub2API 服务。' : !session.connected?'请在设置中输入管理员密钥并保存连接。':session.remembered?'密钥已保存在此浏览器，下次打开自动连接。':'当前连接未记住密钥，刷新或关闭页面后需重新输入。'}</p>{!session.demo && session.connected && <button className="end-session" onClick={() => { void webBridge('forgetKeys').then(() => location.reload()).catch(e => setClearError(e.message)); }}>清除此浏览器密钥</button>}{clearError&&<p role="alert">{clearError}</p>}<footer>连接与偏好保存在此浏览器<br/>仅在页面打开时自动刷新</footer></aside><div className="web-workspace"><div className="web-mobile-brand">SubWatch <span>{session.demo ? '演示数据' : session.connected ? '已连接' : '等待连接'}</span></div><div className="web-app-container"><UsageApp/></div></div></div>;
}
createRoot(document.getElementById('root')!).render(<WebApp/>);
