import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,applyAction,applyInput,tick,getReplay,getPlayerView} from '../server/engine/index.mjs';
const {WORLD,distance}=await import(process.env.WORLD_ENGINE_GEOMETRY_MODULE||'../shared/world.mjs');
const copy=value=>JSON.parse(JSON.stringify(value));
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;}
function fixture(world=true,config={}) {
  let state,serial=0,now=0;
  // Hidden role inspection is fixture selection only, never an AI/client input.
  for(let seed=0;seed<100;seed++){
    state=createMatch({id:'replay-export',world,now:0,seed,config:{meetingCooldownMs:1,initialKillCooldownMs:1,discussionMs:10,votingMs:10,...config}});
    if(state.players.find(p=>p.role==='saboteur').id==='p6')break;
  }
  assert.equal(state.players.find(p=>p.role==='saboteur').id,'p6');
  return {
    get state(){return state;},get now(){return now;},
    act(actor,type,fields={},at=now){now=at;const r=applyAction(state,actor,{id:'replay:'+ ++serial,type,...fields},now);assert.equal(r.accepted,true,JSON.stringify(r.error));state=r.state;return r;},
    input(actor,request,at=now){now=at;const r=applyInput(state,actor,request,now);assert.equal(r.accepted,true,JSON.stringify(r.error));state=r.state;return r;},
    tick(at){now=at;state=tick(state,now).state;},
    finish(){
      if(state.phase==='roam')this.act('p2','meeting',{},Math.max(now,1));
      assert.equal(state.phase,'discussion');assert.equal(getReplay(state),null);
      this.tick(state.deadlineAt);assert.equal(state.phase,'voting');assert.equal(getReplay(state),null);
      this.act('p2','vote',{targetId:'p6'});this.tick(state.deadlineAt);
      assert.equal(state.phase,'ended');assert.equal(state.outcome.reason,'ejection');
    }
  };
}
function assertPreserved(source,exported){
  assert.equal(exported.length,source.length,'No real event may be discarded');
  assert.equal(new Set(exported.map(e=>e.id)).size,source.length);
  const byId=new Map(exported.map(e=>[e.id,e]));for(const event of source)assert.deepEqual(byId.get(event.id),event,'Event data, ID and actual time must be retained');
  assert.ok(exported.every((event,index)=>!index||event.at>=exported[index-1].at),'Export time order');
  for(const at of new Set(source.map(e=>e.at)))assert.deepEqual(exported.filter(e=>e.at===at).map(e=>e.id),source.filter(e=>e.at===at).map(e=>e.id),'Equal times retain original causal append order');
}

test('actual fractional arrivals sort by numeric time, before later lease expiry, with all IDs/data intact',()=>{
  const g=fixture();
  g.input('p1',{seq:1,dx:-1,dy:0});
  const start=copy(g.state.players.find(p=>p.id==='p2').position),target={x:818.125,y:272};
  g.act('p2','navigate',target);g.act('p3','navigate',{x:890,y:272});g.tick(1000);
  const originalMotions=g.state.replay.filter(e=>e.type==='motion');
  const fractional=originalMotions.find(e=>e.playerId==='p2');
  assert.equal(fractional.at,distance(start,target)/WORLD.speed*1000);
  assert.equal(Number.isInteger(fractional.at),false,'Arrival time must not be rounded');
  assert.deepEqual(originalMotions.map(e=>e.playerId),['p1','p2','p3'],'Actual per-actor append order remains private and unchanged');
  assert.equal(originalMotions.find(e=>e.playerId==='p1').at,600);assert.equal(originalMotions.find(e=>e.playerId==='p3').at,100);
  g.finish();const stored=copy(g.state.replay),result=getReplay(g.state);
  assert.deepEqual(result.filter(e=>e.type==='motion').map(e=>e.at),[100,fractional.at,600]);
  assertPreserved(stored,result);assert.deepEqual(g.state.replay,stored);
  assert.deepEqual(getReplay(copy(g.state)),result,'JSON restoration must retain identical deterministic export');
});

test('simultaneous arrivals and causal death/report/tally/reveal retain stable recorded tie order',()=>{
  const arrivals=fixture();arrivals.act('p1','navigate',{x:746,y:272});arrivals.act('p2','navigate',{x:818,y:272});arrivals.tick(1000);arrivals.finish();
  const equal=getReplay(arrivals.state).filter(e=>e.type==='motion');assert.deepEqual(equal.map(e=>e.at),[100,100]);assert.deepEqual(equal.map(e=>e.playerId),['p1','p2']);assertPreserved(arrivals.state.replay,getReplay(arrivals.state));
  const death=fixture();death.input('p3',{seq:1,dx:1,dy:0});death.act('p6','eliminate',{targetId:'p3'},100);
  const publicView=getPlayerView(death.state,null,100);assert.ok(publicView.players.every(p=>!Object.hasOwn(p,'role')));assert.equal(publicView.events.some(e=>e.type==='witness'),false);assert.equal(getReplay(death.state),null);
  death.act('p2','report',{bodyId:'body-p3'});death.finish();
  const replay=getReplay(death.state);assertPreserved(death.state.replay,replay);
  assert.deepEqual(replay.filter(e=>e.at===100).map(e=>e.type==='action'?'action:'+e.action.type:e.type),['motion','tasks_reassigned','witness','action:eliminate','meeting','action:report']);
  const witness=replay.find(e=>e.type==='witness');assert.equal(witness.playerId,'p6');assert.equal(witness.targetId,'p3');assert.ok(witness.visibleTo.includes('p2'));
  assert.equal(replay.find(e=>e.action?.type==='eliminate').playerId,'p6');
  assert.deepEqual(replay.filter(e=>e.at===death.now).map(e=>e.type),['vote_result','tasks_reassigned','ejected','ended','role_reveal']);
  assert.equal(replay.at(-1).type,'role_reveal');assert.equal(replay.at(-1).players.find(p=>p.id==='p6').role,'saboteur');
});

test('export deeply copies frozen ended state, nested roles/tasks/actions/positions and array order',()=>{
  const g=fixture();g.input('p1',{seq:1,dx:-1,dy:0});g.act('p2','navigate',{x:818,y:272});g.tick(1000);g.finish();
  const before=copy(g.state),frozen=freeze(g.state),exported=getReplay(frozen),expected=copy(exported);
  exported.find(e=>e.type==='started').roles[0].role='tampered';
  exported.find(e=>e.type==='started').tasks[0].tasks.length=0;
  exported.find(e=>e.type==='action').action.type='tampered';
  exported.find(e=>e.type==='motion').position.x=-999;
  exported.find(e=>e.type==='role_reveal').players[0].role='tampered';exported.reverse();exported.pop();
  assert.deepEqual(frozen,before);assert.deepEqual(getReplay(frozen),expected);assert.deepEqual(getReplay(frozen),getReplay(frozen));
});

test('schema1 chronological replay retains exact legacy order/data; paused and all live phases remain guarded',()=>{
  const legacy=fixture(false);assert.equal(legacy.state.schemaVersion,1);assert.equal(getReplay(legacy.state),null);
  legacy.act('p1','wait');legacy.finish();const raw=copy(legacy.state.replay);assert.deepEqual(getReplay(legacy.state),raw,'Already chronological schema1 export is byte-for-byte equivalent as JSON');
  assert.ok(getReplay(legacy.state).every(e=>!Object.hasOwn(e,'position')&&!Object.hasOwn(e,'worldVersion')));
  const paused=fixture(true,{maxMatchMs:100});paused.input('p1',{seq:1,dx:-1,dy:0});paused.tick(1000);assert.equal(paused.state.phase,'paused');assert.equal(paused.state.outcome,null);assert.equal(getReplay(paused.state),null);
});
