import {useEffect} from 'react';
import {bridge,isNative} from './data';
import {resolveAppearance} from './appearance';

export default function useAppearance(preference:string){
 useEffect(()=>{
  const media=matchMedia('(prefers-color-scheme: dark)');let live=true;
  const apply=(systemDark:boolean)=>{if(!live)return;const theme=resolveAppearance(preference,systemDark);document.documentElement.dataset.theme=theme;if(isNative)bridge('appearance',{dark:theme==='dark'}).catch(()=>{});};
  const update=()=>{if(isNative)bridge<{dark:boolean}>('systemAppearance').then(value=>apply(value.dark)).catch(()=>apply(media.matches));else apply(media.matches);};
  update();media.addEventListener('change',update);window.addEventListener('nativeappearancechange',update);
  return()=>{live=false;media.removeEventListener('change',update);window.removeEventListener('nativeappearancechange',update);};
 },[preference]);
}
