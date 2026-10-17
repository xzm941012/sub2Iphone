import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeResetCredit} from '../src/reset-flow.ts';
test('confirmation and valid account are required before any reset transport call',async()=>{let calls=0;const send=async()=>{calls++;return {};};await assert.rejects(()=>consumeResetCredit(187,false,send));await assert.rejects(()=>consumeResetCredit(-1,true,send));assert.equal(calls,0);});
test('confirmed reset sends only the narrow operation and returns server result',async()=>{const sent=[];const expected={windows_reset:2};assert.equal(await consumeResetCredit(187,true,async(op,payload)=>{sent.push({op,payload});return expected;}),expected);assert.deepEqual(sent,[{op:'resetOpenAIQuota',payload:{accountId:187,confirmed:true}}]);});
test('indeterminate failure is propagated without automatic retry',async()=>{let calls=0;await assert.rejects(()=>consumeResetCredit(187,true,async()=>{calls++;throw Error('timeout');}),/timeout/);assert.equal(calls,1);});
