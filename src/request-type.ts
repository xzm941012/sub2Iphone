export type RequestType = 'unknown' | 'sync' | 'stream' | 'ws_v2' | 'cyber' | 'live';
type RequestTypeLike = {request_type?:string|null;stream?:boolean|null;openai_ws_mode?:boolean|null};
export const requestTypeLabels:Record<RequestType,string> = {unknown:'未知',sync:'同步',stream:'流式',ws_v2:'WS',cyber:'Cyber',live:'Live'};
// Same precedence and legacy fallback as Sub2API utils/usageRequestType.ts.
export function resolveRequestType(record:RequestTypeLike):RequestType {
  if(typeof record.request_type==='string'&&Object.hasOwn(requestTypeLabels,record.request_type))return record.request_type as RequestType;
  if(record.openai_ws_mode)return 'ws_v2';
  return record.stream?'stream':'sync';
}
