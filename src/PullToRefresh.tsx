import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ReloadIcon} from '@radix-ui/react-icons';

const threshold=64,rest=56;
type Gesture={id:number;x:number;y:number;claimed:boolean;distance:number};

/** Own downward edge drags only; normal scrolling stays with the existing scroll surface. */
export default function PullToRefresh({children,onRefresh,disabled=false}:{children:ReactNode;onRefresh:()=>Promise<void>;disabled?:boolean}){
  const root=useRef<HTMLDivElement>(null),latest=useRef({onRefresh,disabled});latest.current={onRefresh,disabled};
  const [distance,setDistance]=useState(0),[dragging,setDragging]=useState(false),[refreshing,setRefreshing]=useState(false);
  useEffect(()=>{
    const scroller=root.current!.closest('.native-scroll,.mobile-scroll') as HTMLElement;
    let gesture:Gesture|null=null,working=false,live=true,suppressClick=false;
    const start=(id:number,x:number,y:number)=>{
      if(working||latest.current.disabled||scroller.scrollTop>0)return;
      gesture={id,x,y,claimed:false,distance:0};
    };
    const downward=(x:number,y:number)=>!!gesture&&(gesture.claimed||(y-gesture.y>6&&y-gesture.y>Math.abs(x-gesture.x)*1.2));
    const move=(event:Event,x:number,y:number)=>{
      if(!gesture||!downward(x,y))return;
      gesture.claimed=true;suppressClick=true;
      if(event.cancelable)event.preventDefault();event.stopPropagation();
      gesture.distance=Math.min(104,Math.max(0,(y-gesture.y)*.5));
      setDragging(true);setDistance(gesture.distance);
    };
    const finish=(cancelled=false)=>{
      const current=gesture;gesture=null;if(!current?.claimed)return;
      setDragging(false);
      if(cancelled||current.distance<threshold||latest.current.disabled){setDistance(0);return;}
      working=true;setRefreshing(true);setDistance(rest);
      Promise.resolve().then(()=>latest.current.onRefresh()).catch(()=>{}).finally(()=>{
        working=false;if(live){setRefreshing(false);setDistance(0);}
      });
    };
    const pointerDown=(event:PointerEvent)=>{if(event.isPrimary&&event.button===0){suppressClick=false;start(event.pointerId,event.clientX,event.clientY);}};
    const pointerMove=(event:PointerEvent)=>{
      if(!gesture)return;
      if(gesture.id===-1){if(downward(event.clientX,event.clientY)){event.stopPropagation();}return;}
      if(event.pointerId!==gesture.id)return;
      move(event,event.clientX,event.clientY);
      if(gesture.claimed&&!scroller.hasPointerCapture(event.pointerId))scroller.setPointerCapture(event.pointerId);
    };
    const pointerUp=(event:PointerEvent)=>{if(gesture?.id===event.pointerId)finish(event.type==='pointercancel');};
    const touchStart=(event:TouchEvent)=>{if(event.touches.length===1){suppressClick=false;start(-1,event.touches[0].clientX,event.touches[0].clientY);}};
    const touchMove=(event:TouchEvent)=>{if(gesture?.id===-1&&event.touches.length===1)move(event,event.touches[0].clientX,event.touches[0].clientY);};
    const touchEnd=(event:TouchEvent)=>{if(gesture?.id===-1)finish(event.type==='touchcancel');};
    const click=(event:MouseEvent)=>{if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false;}};
    scroller.addEventListener('pointerdown',pointerDown,true);scroller.addEventListener('pointermove',pointerMove,true);
    scroller.addEventListener('pointerup',pointerUp,true);scroller.addEventListener('pointercancel',pointerUp,true);
    scroller.addEventListener('touchstart',touchStart,{passive:true,capture:true});scroller.addEventListener('touchmove',touchMove,{passive:false,capture:true});
    scroller.addEventListener('touchend',touchEnd,true);scroller.addEventListener('touchcancel',touchEnd,true);scroller.addEventListener('click',click,true);
    return()=>{
      live=false;scroller.removeEventListener('pointerdown',pointerDown,true);scroller.removeEventListener('pointermove',pointerMove,true);
      scroller.removeEventListener('pointerup',pointerUp,true);scroller.removeEventListener('pointercancel',pointerUp,true);
      scroller.removeEventListener('touchstart',touchStart,true);scroller.removeEventListener('touchmove',touchMove,true);
      scroller.removeEventListener('touchend',touchEnd,true);scroller.removeEventListener('touchcancel',touchEnd,true);scroller.removeEventListener('click',click,true);
    };
  },[]);
  return <div ref={root} className={'pull-refresh'+(dragging?' dragging':'')+(refreshing?' refreshing':'')} data-pull-distance={Math.round(distance)}>
    <div className="pull-refresh-indicator" role="status" aria-hidden={!distance} style={{transform:`translateY(${distance-rest}px)`,opacity:Math.min(1,distance/32)}}>
      <ReloadIcon style={refreshing?undefined:{transform:`rotate(${distance*3}deg)`}}/><span>{refreshing?'正在刷新…':distance>=threshold?'释放刷新':'下拉刷新'}</span>
    </div>
    <div className="pull-refresh-body" style={{transform:`translateY(${distance}px)`}}>{children}</div>
  </div>;
}
