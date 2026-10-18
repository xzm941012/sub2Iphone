import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CheckIcon, Cross2Icon, ReloadIcon } from '@radix-ui/react-icons';
import { bridge, type Account } from './data';
import { accountStatus } from './account-status';

export function AccountStatusBadge({ account, now, onClick }: { account: Account; now: number; onClick: () => void }) {
  const status = accountStatus(account, now), className = 'account-status status-' + status.tone;
  return status.normal ? <span className={className}>正常</span> : <button className={className} aria-label={account.name + '状态：' + status.text} title="查看状态并重置" onClick={onClick}>{status.text}</button>;
}

export function AccountStatusDialog({ account, now, close, updated }: { account: Account; now: number; close: () => void; updated: (account?: Partial<Account>) => void }) {
  const [stage, setStage] = useState<'confirm' | 'pending' | 'success' | 'uncertain'>('confirm');
  const [error, setError] = useState(''), [result, setResult] = useState<Partial<Account>>();
  const locked = useRef(false), status = accountStatus(account, now);
  const submit = async () => {
    if (locked.current || stage !== 'confirm' || status.normal) return;
    locked.current = true; setStage('pending');
    try {
      const response = await bridge<Partial<Account>>('resetAccountStatus', { accountId: account.id, confirmed: true });
      if (response?.id !== account.id || typeof response.status !== 'string') throw Error('服务未返回有效的账号状态');
      setResult(response); setStage('success'); updated(response);
    } catch (e) { setError((e as Error).message); setStage('uncertain'); updated(); }
    finally { locked.current = false; }
  };
  return <Dialog.Root open onOpenChange={open => { if (!open && !locked.current) close(); }}><Dialog.Portal container={document.body}>
    <Dialog.Overlay className="reset-backdrop" />
    <Dialog.Content className="reset-dialog account-status-dialog" onEscapeKeyDown={e => { if (locked.current) e.preventDefault(); }} onInteractOutside={e => e.preventDefault()}>
      <header><div><Dialog.Title>{stage === 'pending' ? '正在重置状态' : stage === 'success' ? '状态已重置' : stage === 'uncertain' ? '重置结果待核实' : '重置账号状态'}</Dialog.Title><Dialog.Description>{account.name}</Dialog.Description></div><button className="icon-button" aria-label="关闭状态窗口" disabled={stage === 'pending'} onClick={close}><Cross2Icon /></button></header>
      {stage === 'confirm' ? <><div className="account-status-summary"><span className={'account-status status-' + status.tone}>{status.text}</span>{status.detail && <p>{status.detail}</p>}{status.until && <p>预计恢复：{new Date(status.until).toLocaleString('zh-CN', { hour12: false })}</p>}</div><p className="reset-message">{status.normal ? '账号当前已恢复正常。' : '是否重置该账号状态？'}</p><p className="reset-footnote">清除错误、限流和临时调度阻塞，不消耗额度重置次数，也不会增加额度。手动暂停的调度保持关闭。</p><div className="reset-actions"><button className="secondary" onClick={close}>取消</button><button className="primary" disabled={status.normal} onClick={submit}>确认重置</button></div></> : stage === 'pending' ? <div className="reset-result" role="status"><ReloadIcon className="reset-spin" /><p>正在等待服务确认</p><small>请勿重复提交。</small></div> : stage === 'success' ? <div className="reset-result" role="status"><CheckIcon /><p>服务已确认重置</p><small>当前状态：{accountStatus({ ...account, ...result }, now).text}。账号数据正在刷新。</small><button className="primary full" onClick={close}>完成</button></div> : <div className="reset-result"><p role="alert">{error}</p><small>已尝试重新读取账号数据，请核实最新状态后再操作。</small><button className="secondary full" onClick={close}>关闭</button></div>}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
