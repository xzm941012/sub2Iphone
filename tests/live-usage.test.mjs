import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeUsageHead} from '../src/live-usage.ts';

test('head refresh keeps paginated history, de-duplicates ids and updates matching requests',()=>{
  const current=[{id:3,created_at:'2030-01-01T00:03:00Z',output_tokens:0},{id:2,created_at:'2030-01-01T00:02:00Z'},{id:1,created_at:'2030-01-01T00:01:00Z'}];
  const result=mergeUsageHead(current,[{id:4,created_at:'2030-01-01T00:04:00Z'},{id:'3',created_at:'2030-01-01T00:03:00Z',output_tokens:200}]);
  assert.deepEqual(result.map(row=>String(row.id)),['4','3','2','1']);assert.equal(result[1].output_tokens,200);assert.equal(current[0].output_tokens,0);
  assert.deepEqual(mergeUsageHead(result,[]),result);assert.deepEqual(mergeUsageHead(result,result),result);
});
