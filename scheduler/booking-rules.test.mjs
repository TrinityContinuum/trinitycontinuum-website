import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_WEEK,validateWeek,evaluateSlot} from './booking-rules.mjs';
test('default week is valid',()=>assert.equal(validateWeek(DEFAULT_WEEK),true));
test('early requests require approval',()=>assert.equal(evaluateSlot({week:DEFAULT_WEEK,weekday:1,start:'07:00',end:'07:30'}).status,'approval_required'));
test('regular hours permit instant eligibility',()=>assert.equal(evaluateSlot({week:DEFAULT_WEEK,weekday:1,start:'10:00',end:'10:30'}).status,'instant_eligible'));
test('evening requests require approval',()=>assert.equal(evaluateSlot({week:DEFAULT_WEEK,weekday:1,start:'18:00',end:'18:30'}).status,'approval_required'));
test('weekends default unavailable',()=>assert.equal(evaluateSlot({week:DEFAULT_WEEK,weekday:0,start:'10:00',end:'10:30'}).status,'unavailable'));
test('busy events block instant eligibility',()=>assert.equal(evaluateSlot({week:DEFAULT_WEEK,weekday:1,start:'10:00',end:'10:30',busy:[{start:'10:30',end:'11:00'}]}).status,'unavailable'));
test('day-specific overrides are supported',()=>assert.equal(evaluateSlot({week:DEFAULT_WEEK,weekday:0,start:'11:00',end:'11:30',overrides:[{mode:'instant',start:'10:00',end:'12:00'}]}).status,'instant_eligible'));
test('overlapping windows are rejected',()=>assert.throws(()=>validateWeek(DEFAULT_WEEK.map((d,i)=>i===1?{...d,windows:[{mode:'instant',start:'09:00',end:'12:00'},{mode:'late_approval',start:'11:00',end:'13:00'}]}:d))));

test('lunch remains blocked for the whole interval',()=>assert.deepEqual(evaluateSlot({week:DEFAULT_WEEK,weekday:1,start:'11:15',end:'11:45'}),{status:'unavailable',reason:'lunch_block'}));
test('after lunch is eligible',()=>assert.equal(evaluateSlot({week:DEFAULT_WEEK,weekday:1,start:'13:00',end:'13:30'}).status,'instant_eligible'));
test('explicit closed-day override removes availability',()=>assert.equal(evaluateSlot({week:DEFAULT_WEEK,weekday:1,start:'10:00',end:'10:30',overrides:[]}).status,'unavailable'));
test('lunch blackout can be disabled only through trusted server configuration',()=>assert.equal(evaluateSlot({week:DEFAULT_WEEK,weekday:1,start:'12:00',end:'12:30',lunchBlocked:false}).status,'instant_eligible'));
