import test from 'node:test';
import assert from 'node:assert/strict';
import {ActorSamples} from '../public/world/model.mjs';
import {createMatch,tick,applyInput,applyAction} from '../server/engine/index.mjs';
import {WORLD,getWorld} from '../shared/world.mjs';

const fixture=()=>({phase:'roam',players:[{id:'p1',name:'Iona',alive:true,position:{x:700,y:272}}],self:{id:'p1',moving:true}});

test('received position timeline keeps a constant walking speed across packet boundaries',()=>{
 const game=fixture(),samples=new ActorSamples();samples.update(game,0);
 const positions=[];
 for(let at=10;at<=500;at+=10){
  if(at%100===0){game.players[0].position={x:700+at*WORLD.speed/1000,y:272};samples.update(game,at);}
  if(at>=110)positions.push(samples.at('p1',at).x);
 }
 for(let i=1;i<positions.length;i++)assert.ok(Math.abs(positions[i]-positions[i-1]-WORLD.speed*.01)<1e-8,'network packets must not restart an easing curve');
 assert.equal(samples.at('p1',10000).x,790,'stale input never extrapolates');
 assert.equal(samples.at('p1',400,true).x,790,'reduced motion uses latest authoritative position');
});

test('movement restarts from the most recent stationary observation and snapshot buffers stay bounded',()=>{
 const game=fixture(),samples=new ActorSamples();samples.update(game,0);samples.update(game,900);
 game.players[0].position={x:718,y:272};samples.update(game,1000);
 assert.equal(samples.at('p1',1000).x,700);assert.equal(samples.at('p1',1050).x,709);
 for(let at=1100;at<=3000;at+=100){game.players[0].position={x:718+(at-1000)*.01,y:272};samples.update(game,at);}
 assert.ok(samples.samples.get('p1').history.length<=8);
 const returned=samples.at('p1',9999);returned.x=-100;assert.ok(samples.at('p1',9999).x>0);
 game.players[0].position=null;samples.update(game,3100);assert.equal(samples.at('p1',3100),null);
});

test('missing corner samples hold recorded positions instead of cutting through the chart table',()=>{
 const game=fixture(),samples=new ActorSamples();game.players[0].position={x:720,y:200};samples.update(game,0);
 game.players[0].position={x:880,y:200};samples.update(game,100);
 assert.equal(samples.at('p1',150).x,720);assert.equal(samples.at('p1',200).x,880);
});

test('idle world, discussion and terminal ticks return unchanged state before cloning history',()=>{
 const state=createMatch({id:'idle-tick',world:true,mode:'spectator',seed:'perf',now:0});
 // If the no-op path traverses history it would invoke this getter. A proxy is not
 // serializable either, so the former unconditional structuredClone fails here.
 const history=state.replay;state.replay=new Proxy(history,{get(){throw Error('idle tick read replay history');}});
 assert.equal(tick(state,100).state,state);
 state.replay=history;
 const discussion=applyAction(state,'p1',{id:'meeting',type:'meeting'},state.rules.meetingCooldownMs).state;
 assert.equal(discussion.phase,'discussion');assert.equal(tick(discussion,discussion.updatedAt+1).state,discussion);
 for(const phase of ['ended','paused'])assert.equal(tick({...state,phase},100).state.phase,phase);
});

test('tick preflight still settles moving actors, input expiry and exact phase deadlines',()=>{
 const state=createMatch({id:'active-tick',world:true,mode:'human',seed:'perf',now:0,config:{roamDeadlineMs:1000}});
 const moving=applyInput(state,'p1',{seq:1,dx:1,dy:0},0).state,before=structuredClone(moving);
 const advanced=tick(moving,100).state;assert.notEqual(advanced,moving);assert.deepEqual(moving,before);
 assert.ok(Math.abs(advanced.players[0].position.x-moving.players[0].position.x-18)<1e-6);
 const expired=tick(advanced,600).state;assert.equal(expired.players[0].motion.manual,false);
 assert.equal(tick(expired,700).state,expired);
 const discussion=tick(expired,1000).state;assert.equal(discussion.phase,'discussion');assert.equal(discussion.updatedAt,1000);
});

test('fast state copy matches structuredClone for plain records, holes, undefined and aliases',async()=>{
 const {copyState}=await import('../server/engine/state-copy.mjs');
 const nested={at:12.125,unknown:undefined,values:new Array(4)};nested.values[2]='kept';nested.values.note={future:true};
 const source={nested,alias:nested,nullPrototype:Object.assign(Object.create(null),{safe:1})};
 Object.defineProperty(source,'__proto__',{value:{polluted:true},enumerable:true});source.cycle=source;
 const result=copyState(source),expected=structuredClone(source);assert.deepEqual(result,expected);
 assert.equal(result.nested,result.alias);assert.equal(result.cycle,result);assert.notEqual(result.nested,nested);
 assert.equal(0 in result.nested.values,false);assert.ok(Object.hasOwn(result.nested,'unknown'));
 assert.equal(Object.getPrototypeOf(result),Object.prototype);assert.equal({}.polluted,undefined);
 result.nested.values.note.future=false;assert.equal(source.nested.values.note.future,true);
});

test('fast state copy falls back for exotic serializable types and rejects uncloneable values',async()=>{
 const {copyState}=await import('../server/engine/state-copy.mjs');
 const date=new Date(1000),source={date,map:new Map([['date',date]]),bytes:new Uint8Array([1,2,3]),pattern:/future/gi};
 const copied=copyState(source);assert.deepEqual(copied,structuredClone(source));assert.equal(copied.date,copied.map.get('date'));copied.bytes[0]=9;assert.equal(source.bytes[0],1);
 assert.throws(()=>copyState({fn(){}}),{name:'DataCloneError'});
});

test('moving state copies preserve unknown fractional replay data, causal ties and all nested histories',()=>{
 let source=createMatch({id:'copy-unknown',world:true,mode:'human',seed:'copy',now:0});
 source=applyInput(source,'p1',{seq:1,dx:1,dy:0},0).state;
 for(let i=0;i<2;i++)source.replay.push({id:`future-${i}`,sequence:++source.replaySequence,type:'future_activity',at:50.125,nested:{items:[{observed:true}],optional:undefined}});
 source.replayBytes=source.replay.reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e)),0);
 const before=structuredClone(source),result=tick(source,100).state;assert.deepEqual(source,before);assert.notEqual(result,source);
 assert.deepEqual(result.replay.slice(-2),source.replay.slice(-2));assert.equal(result.replay.at(-1).at,50.125);
 result.replay.at(-1).nested.items[0].observed=false;
 result.replayHistory.checkpoints[0].players[0].position.x=-100;
 result.players[0].tasks.push({id:'result-only'});result.requests.p1.push({id:'result-only'});
 assert.deepEqual(source,before,'no returned mutable replay, checkpoint, task or request may alias the input');
 const actionable=applyAction(source,'p1',{id:'wait-after-motion',type:'wait'},100);assert.equal(actionable.accepted,true);assert.deepEqual(source,before);
 const steered=applyInput(source,'p1',{seq:2,dx:-1,dy:0},100);assert.equal(steered.accepted,true);assert.deepEqual(source,before);
});

test('expanded-map movement preflight uses its own runtime and still settles exact speed and deadlines',()=>{
 for(const mapId of ['storm-foundry','tidal-observatory']){
  const geometry=getWorld(mapId),initial=createMatch({id:'moving-'+mapId,world:true,mapId,mode:'human',seed:'map-perf',now:0,config:{roamDeadlineMs:1000}});
  assert.equal(tick(initial,100).state,initial);
  const moving=applyInput(initial,'p1',{seq:1,dx:1,dy:0},0).state;
  const next=tick(moving,100).state;assert.equal(next.mapId,mapId);assert.ok(geometry.isWalkable(next.players[0].position));
  assert.ok(Math.abs(next.players[0].position.x-moving.players[0].position.x-geometry.WORLD.speed*.1)<1e-6,mapId+' authoritative speed');
  assert.equal(tick(next,1000).state.phase,'discussion',mapId+' deadline');
 }
});

test('each map uses its own interpolation collisions and switching maps drops old coordinates',()=>{
 const samples=new ActorSamples();
 for(const mapId of ['storm-foundry','tidal-observatory']){
  const geometry=getWorld(mapId);
  const blocked=geometry.WORLD_OBSTACLES.map(o=>({from:{x:o.x-20,y:o.y+o.height/2},to:{x:o.x+o.width+20,y:o.y+o.height/2}})).find(({from,to})=>geometry.isWalkable(from)&&geometry.isWalkable(to));
  assert.ok(blocked,'valid observed endpoints around an obstacle in '+mapId);
  const game=fixture();game.mapId=mapId;game.players[0].position=blocked.from;samples.update(game,1000);
  assert.deepEqual(samples.at('p1',1000),blocked.from,'map switch cannot animate across unrelated coordinates');
  game.players[0].position=blocked.to;samples.update(game,1100);
  assert.deepEqual(samples.at('p1',1150),blocked.from,'hold across '+mapId+' collider');
  assert.deepEqual(samples.at('p1',1200),blocked.to);
 }
});
