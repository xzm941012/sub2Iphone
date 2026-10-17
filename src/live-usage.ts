import type {RecordData} from './data';

/** Refresh the head without discarding history already loaded by pagination. */
export function mergeUsageHead(current:RecordData[],incoming:RecordData[]):RecordData[]{
  const head=new Map(incoming.map(row=>[String(row.id),row]));
  return [...head.values(),...current.filter(row=>!head.has(String(row.id)))].sort((a,b)=>{
    const time=(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0);
    return time||Number(b.id)-Number(a.id)||0;
  });
}
