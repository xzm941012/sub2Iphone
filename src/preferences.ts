export type Preferences={interval:number;refreshOnOpen:boolean;theme:string};
export type PreferencePatch=Partial<Preferences>;
export function preferencePatch(value:PreferencePatch):PreferencePatch {
 const patch:PreferencePatch={};
 if(value.interval!==undefined){if(![1,5,10,15,30,60].includes(value.interval))throw Error('无效刷新间隔');patch.interval=value.interval;}
 if(value.refreshOnOpen!==undefined){if(typeof value.refreshOnOpen!=='boolean')throw Error('无效刷新选项');patch.refreshOnOpen=value.refreshOnOpen;}
 if(value.theme!==undefined){if(!['light','dark','system'].includes(value.theme))throw Error('无效外观');patch.theme=value.theme;}
 return patch;
}
export function preferenceWriter(send:(op:string,payload:any)=>Promise<any>){
 let queue=Promise.resolve();
 return (value:PreferencePatch)=>{const patch=preferencePatch(value);const task=queue.then(()=>send('savePreferences',{preferences:patch}));queue=task.catch(()=>{});return task;};
}
