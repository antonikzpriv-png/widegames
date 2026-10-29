/** Coordinator regressions for actual module boundaries, not implementation copies. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createMatch,applyAction} from '../server/engine/index.mjs';
test('engine accepts bounded AI request identities from the shared action contract',()=>{
 const state=createMatch({id:'contract-ai',seed:'audit',now:0});
 const result=applyAction(state,'p1',{id:'ai:0123456789ab:12345678-abcd-1234-abcd-123456789abc',type:'move',roomId:'archive'},0);
 assert.equal(result.accepted,true,result.error?.message);
});
test('filling duplicate history cannot turn a prior request into a new movement',()=>{
 let state=createMatch({id:'contract-dedup',seed:'audit',now:0});
 const original={id:'original',type:'move',roomId:'archive'};
 state=applyAction(state,'p1',original,0).state;
 for(let i=0;i<260;i++)state=applyAction(state,'p1',{id:'filler-'+i,type:'wait'},0).state;
 state=applyAction(state,'p1',{id:'return',type:'move',roomId:'bridge'},2000).state;
 const result=applyAction(state,'p1',original,4000);
 assert.equal(result.state.players.find(p=>p.id==='p1').roomId,'bridge','Old request must not repeat a world mutation');
 assert(result.duplicate||!result.accepted,'Retain idempotency or reject exhausted history explicitly');
});
