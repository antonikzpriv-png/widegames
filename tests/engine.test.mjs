import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,applyAction,tick,getPlayerView,getReplay} from '../server/engine/index.mjs';

test('foundation exports create deterministic serializable private state',()=>{
 const s=createMatch({id:'test',now:0,seed:'engine'});
 assert.deepEqual(s,JSON.parse(JSON.stringify(s)));
 assert.deepEqual(s,createMatch({id:'test',now:0,seed:'engine'}));
 assert.equal(s.players.filter(p=>p.role==='saboteur').length,1);
 assert.equal(s.players.flatMap(p=>p.tasks).length,15);
 assert.equal(getReplay(s),null);
 assert.equal(getPlayerView(s,null,0).self,null);
 assert.ok(getPlayerView(s,null,0).players.every(p=>!('role' in p)));
});
test('actions are immutable and retained duplicates are inert',()=>{
 const s=createMatch({id:'test',now:0,seed:'engine'}),before=structuredClone(s);
 const action={id:'move1',type:'move',roomId:'archive'};
 const a=applyAction(s,'p1',action,0);
 assert.equal(a.accepted,true); assert.deepEqual(s,before);
 const b=applyAction(JSON.parse(JSON.stringify(a.state)),'p1',action,0);
 assert.equal(b.duplicate,true); assert.deepEqual(b.state,a.state);
 assert.equal(applyAction(a.state,'p1',{...action,roomId:'lantern'},0).error.code,'REQUEST_CONFLICT');
});
test('late tick progresses missed deadlines then pauses truthfully',()=>{
 const s=createMatch({id:'test',now:0,seed:'engine'});
 const r=tick(s,900000);
 assert.equal(r.state.phase,'paused'); assert.equal(r.state.outcome,null);
 assert.ok(r.events.some(e=>e.type==='meeting'));
 assert.equal(getReplay(r.state),null);
 assert.equal(tick(r.state,1000000).state,r.state);
});
