import {useLayoutEffect,useRef,type ReactNode} from 'react';
import type {RecordData} from './data';

/** FLIP row positions with transform/opacity; native and preview share the same motion. */
export default function AnimatedRequestList({records,renderRecord}:{records:RecordData[];renderRecord:(row:RecordData,index:number)=>ReactNode}){
  const root=useRef<HTMLDivElement>(null);
  const previous=useRef(new Map<string,{top:number;height:number}>());
  useLayoutEffect(()=>{
    const feed=root.current!;
    const nodes=Array.from(feed.children) as HTMLElement[];
    const before=previous.current;
    const position=(node:HTMLElement)=>{const row=node.querySelector('.usage-row') as HTMLElement;return {top:node.offsetTop+(row?.offsetTop||0),height:row?.offsetHeight||node.offsetHeight};};
    const after=new Map(nodes.map(node=>[node.dataset.recordId!,position(node)]));
    previous.current=after;
    const firstKnown=nodes.findIndex(node=>before.has(node.dataset.recordId!));
    if(firstKnown<=0)return;
    const scroller=feed.closest('.native-scroll,.mobile-scroll') as HTMLElement|null;
    // Keep the item being read anchored when the user has scrolled away from the head.
    if(scroller&&scroller.scrollTop>24){
      const readingAt=scroller.scrollTop-feed.offsetTop;
      const anchor=[...before].find(([,box])=>box.top+box.height>readingAt);
      if(anchor&&after.has(anchor[0]))scroller.scrollTop+=after.get(anchor[0])!.top-anchor[1].top;
      return;
    }
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const animations:Animation[]=[];
    for(const [index,node] of nodes.entries()){
      if(position(node).top>(scroller?.clientHeight||800)+80)continue;
      const old=before.get(node.dataset.recordId!);
      if(old){
        const delta=old.top-position(node).top;
        if(delta)animations.push(node.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'}));
      }else if(index<firstKnown){
        animations.push(node.animate([{opacity:0,transform:'translateY(-8px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,delay:Math.min(index,4)*35,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'}));
      }
    }
    return()=>animations.forEach(animation=>animation.cancel());
  },[records]);
  return <div className="request-feed" ref={root}>{records.map((row,index)=><div className="request-row-slot" data-record-id={row.id} key={row.id}>{renderRecord(row,index)}</div>)}</div>;
}
