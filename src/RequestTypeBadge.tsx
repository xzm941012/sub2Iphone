import type {RecordData} from './data';
import {requestTypeLabels,resolveRequestType} from './request-type';

export default function RequestTypeBadge({record}:{record:RecordData}){
  const type=resolveRequestType(record),label=requestTypeLabels[type];
  return <span className="request-badge" data-request-type={type} title={'请求类型：'+label}>{label}</span>;
}
