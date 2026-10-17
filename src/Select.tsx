import {Children,useEffect,useRef,useState,type ReactNode,type SelectHTMLAttributes} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ChevronDownIcon,CheckIcon} from '@radix-ui/react-icons';
import {useScreenPortal} from './mobile';
import {useKeyboard} from './mobile';
import {isStandalone as isNative} from './data';

type Props=SelectHTMLAttributes<HTMLSelectElement>;
export default function Select(props:Props){return isNative?<Control {...props} container={document.body}/>:<Preview {...props}/>;}
function Preview(props:Props){const {screenRef}=useScreenPortal(),keyboard=useKeyboard();return <Control {...props} container={screenRef.current} beforeOpen={()=>keyboard.hide()}/>;}
function Control({children,className='',container,beforeOpen,...props}:Props&{container:HTMLElement|null;beforeOpen?:()=>void}){
 const ref=useRef<HTMLSelectElement>(null),[open,setOpen]=useState(false);const options=Children.toArray(children).filter((x:any)=>x?.type==='option') as {props:{value?:string|number;children:ReactNode;disabled?:boolean}}[];
 useEffect(()=>{if(!open)return;const previous=window.__nativeBack;window.__nativeBack=()=>setOpen(false);return()=>{window.__nativeBack=previous;};},[open]);
 const showOptions=()=>{beforeOpen?.();(document.activeElement as HTMLElement)?.blur();setOpen(true);};
 const choose=(value:string)=>{const element=ref.current!;Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('change',{bubbles:true}));setOpen(false);};
 const selectedValue=String(props.value??ref.current?.value??props.defaultValue??options[0]?.props.value??options[0]?.props.children??'');
 const selectedLabel=options.find(option=>String(option.props.value??option.props.children)===selectedValue)?.props.children;
 return <><span className={'select-control '+className}><select {...props} ref={ref} onPointerDown={e=>{props.onPointerDown?.(e);if(!e.defaultPrevented&&!props.disabled)e.preventDefault();}} onClick={e=>{props.onClick?.(e);if(!e.defaultPrevented&&!props.disabled){e.preventDefault();showOptions();}}} onKeyDown={e=>{props.onKeyDown?.(e);if(!e.defaultPrevented&&['Enter',' ','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();showOptions();}}}>{children}</select><span className="select-value" aria-hidden="true"><span>{selectedLabel}</span></span><ChevronDownIcon aria-hidden="true"/></span><Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal container={container}><Dialog.Overlay className="select-backdrop"/><Dialog.Content className="select-dialog" aria-describedby={undefined}><Dialog.Title>{props['aria-label']||'选择选项'}</Dialog.Title><div className="select-options" role="listbox" aria-label={props['aria-label']||'选项'}>{options.map((option,i)=>{const value=String(option.props.value??option.props.children),selected=selectedValue===value;return <button key={i} role="option" aria-selected={selected} disabled={option.props.disabled} onClick={()=>choose(value)}><span>{option.props.children}</span>{selected&&<CheckIcon/>}</button>;})}</div><Dialog.Close className="select-cancel">取消</Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root></>;
}
