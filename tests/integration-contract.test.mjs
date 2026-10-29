/** Coordinator regressions for actual module boundaries, not implementation copies. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createMatch,applyAction,getPlayerView,tick,getReplay} from '../server/engine/index.mjs';
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
test('remote repair progress never identifies a hidden crew member; replay reveals the actual actor only after ending',()=>{
 let state=createMatch({id:'repair-privacy',seed:'audit',now:0});
 const sab=state.players.find(p=>p.role==='saboteur').id,crew=state.players.filter(p=>p.role==='crew');
 const repairer=crew[0].id,observer=crew[1].id;
 function act(player,action,now){const r=applyAction(state,player,{id:crypto.randomUUID(),...action},now);assert.equal(r.accepted,true,JSON.stringify(r.error));state=r.state;}
 act(sab,{type:'sabotage'},65000);act(repairer,{type:'move',roomId:'workshop'},65000);act(repairer,{type:'move',roomId:'engine'},66200);act(repairer,{type:'repair'},66200);
 for(const identity of [observer,null]){const view=getPlayerView(state,identity,66200),event=view.events.find(e=>e.type==='repair');assert.equal(event.repairsCompleted,1);assert(!Object.hasOwn(event,'playerId'));assert(!Object.hasOwn(view.sabotage,'repairers'));}
 assert.equal(getPlayerView(state,observer,66200).players.find(p=>p.id===repairer).roomId,null);assert.equal(getReplay(state),null);
 state=tick(state,140000).state;assert(getReplay(state).some(e=>e.type==='action'&&e.playerId===repairer&&e.action.type==='repair'));
});
