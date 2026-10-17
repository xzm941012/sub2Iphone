import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAppearance} from '../src/appearance.ts';
test('explicit light and dark override either system preference',()=>{for(const dark of [true,false]){assert.equal(resolveAppearance('light',dark),'light');assert.equal(resolveAppearance('dark',dark),'dark');}});
test('system preference follows both directions and unknown defaults to light',()=>{assert.equal(resolveAppearance('system',true),'dark');assert.equal(resolveAppearance('system',false),'light');assert.equal(resolveAppearance('invalid',true),'light');});
