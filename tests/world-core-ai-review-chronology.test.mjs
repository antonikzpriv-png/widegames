import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.WORLD_CORE_AI_REVIEW_ROOT?pathToFileURL(resolve(process.env.WORLD_CORE_AI_REVIEW_ROOT)+'/'):new URL('../',import.meta.url);
const {createMatch,applyInput,applyAction,tick,getReplay}=await import(new URL('server/engine/index.mjs',root));

// Active positive requirement. This fails on aa471eb, without TODO/skip or
// disguising the historical defect as successful current behavior.
test('ended exported movement replay respects real event chronology across actors',t=>{
  let state=createMatch({id:'replay-chronology',world:true,seed:2,now:0,config:{meetingCooldownMs:1}});
  const apply=(id,action,at)=>{const r=applyAction(state,id,action,at);assert.equal(r.accepted,true,JSON.stringify(r.error));state=r.state;};
  state=applyInput(state,'p1',{seq:1,dx:-1,dy:0},0).state;
  apply('p2',{id:'short-route',type:'navigate',x:818,y:272},0);
  state=tick(state,1000).state;
  assert.deepEqual(state.players.find(p=>p.id==='p2').position,{x:818,y:272});
  assert.equal(getReplay(state),null,'pre-end guard must remain intact');
  // Complete an actual rules win before accessing the attributed export.
  const saboteur=state.players.find(p=>p.role==='saboteur').id;
  apply('p2',{id:'bell',type:'meeting'},1000);
  state=tick(state,31000).state;
  const voter=state.players.find(p=>p.id!==saboteur).id;
  apply(voter,{id:'ballot',type:'vote',targetId:saboteur},31000);
  state=tick(state,51000).state;
  assert.equal(state.phase,'ended');assert.equal(state.outcome.reason,'ejection');
  const replay=getReplay(state),motions=replay.filter(e=>e.type==='motion');
  assert.equal(motions.length,2);assert.equal(motions.find(e=>e.playerId==='p1').at,600);assert.equal(motions.find(e=>e.playerId==='p2').at,100);
  t.diagnostic(JSON.stringify(motions));
  assert.ok(replay.every((event,index)=>index===0||event.at>=replay[index-1].at),'replay steps go backwards from a later actor settlement to an earlier arrival');
});
