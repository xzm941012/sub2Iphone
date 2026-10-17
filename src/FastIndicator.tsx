import {LightningBoltIcon} from '@radix-ui/react-icons';
import {isFastRequest,type RecordData} from './data';

export default function FastIndicator({record}:{record:RecordData}) {
  return isFastRequest(record)?<span className="fast-indicator" role="img" aria-label="Fast 已开启" title="Fast 已开启"><LightningBoltIcon aria-hidden="true"/></span>:null;
}
