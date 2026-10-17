export type AccountSettings={id:number;name:string;type:string;platform:string;proxyId:number;wsMode:string;schedulable:boolean};
export function settingsChanges(before:AccountSettings,after:AccountSettings){
 const changes:Record<string,number|string|boolean>={};
 if(before.proxyId!==after.proxyId)changes.proxyId=after.proxyId;
 if(before.wsMode!==after.wsMode)changes.wsMode=after.wsMode;
 if(before.schedulable!==after.schedulable)changes.schedulable=after.schedulable;
 return changes;
}
