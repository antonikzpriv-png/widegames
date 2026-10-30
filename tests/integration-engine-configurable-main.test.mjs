import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../server/engine/index.mjs';
import {createSpatialWorld} from '../server/engine/world/index.mjs';
import {LOBBY_DEFAULTS,rosterFor} from '../shared/lobby.mjs';
import {getMap} from '../shared/maps/index.mjs';
import {TASK_CATALOG} from '../shared/task-catalog.mjs';
import {taskInput,taskWaitUntil} from '../server/engine/tasks.mjs';
import {normalizeRoster} from '../server/features/lobbies/index.mjs';
import {worldTaskAction} from '../server/ai/world.mjs';

const settings=patch=>({...LOBBY_DEFAULTS,...patch});
const game=(patch={},options={})=>{
 const configured=settings(patch);
 return engine.createMatch({id:'combined-engine',now:1000,seed:2,tactical:true,stationTasks:true,map:{id:'beacon',version:2},settings:configured,roster:rosterFor(configured.capacity),humanPlayerIds:['p1','p2'],...options});
};
let receipt=0;
const act=(s,p,type,fields={},at=s.updatedAt)=>engine.applyAction(s,p,{id:'combined:'+ ++receipt,type,...fields},at);

for(const reference of [{id:'beacon',version:2},{id:'stormbreak-annex',version:1}])test(`combined ${reference.id} supports15 bodies, private teammates and both task protocols`,()=>{
 const state=game({capacity:15,saboteurs:3,tasksPerCrew:4},{map:reference}),map=getMap(reference),g=map.geometry;
 assert.equal(state.schemaVersion,5);assert.equal(state.configuration.players.length,15);assert.equal(state.configuration.saboteurCount,3);assert.deepEqual(state.configuration.humanPlayerIds,['p1','p2']);
 for(const p of state.players){assert(g.isWalkable(p.position));assert.equal(p.badge,p.id.slice(1));for(const other of state.players.filter(q=>q.id!==p.id))assert(g.distance(p.position,other.position)>=g.WORLD.bodyRadius*2);if(p.role==='crew'){assert(p.tasks.some(t=>t.challenge));assert(p.tasks.some(t=>t.edition===3));}}
 const crew=state.players.find(p=>p.role==='crew'),sab=state.players.find(p=>p.role==='saboteur');
 const own=engine.getPlayerView(state,sab.id,1000),crewView=engine.getPlayerView(state,crew.id,1000),watch=engine.getPlayerView(state,null,1000);
 assert.equal(own.self.teammates.length,2);assert(own.self.teammates.every(id=>state.players.find(p=>p.id===id).role==='saboteur'));assert.equal(crewView.self.teammates,undefined);assert.equal(watch.self,null);assert(watch.players.every(p=>p.role===undefined&&p.tasks===undefined));assert(crewView.players.every(p=>p.badge===p.id.slice(1)));
});

for(const mix of ['equipment','mixed','captcha'])test(`combined tactical ${mix} obeys settings without replacing native station defaults`,()=>{
 const state=game({taskMix:mix,tasksPerCrew:8});
 for(const p of state.players.filter(p=>p.role==='crew'))for(const [i,t]of p.tasks.entries()){
  if(mix==='captcha'){assert.equal(t.edition,3);assert.equal(TASK_CATALOG[t.kind].category,'captcha');}
  else if(i%2===0){assert.equal(t.kind,'station');assert(t.challenge);if(mix==='equipment')assert.notEqual(t.challenge.kind,'glyphs');}
  else{assert.equal(t.edition,3);assert(TASK_CATALOG[t.kind]);if(mix==='equipment')assert.equal(TASK_CATALOG[t.kind].category,'equipment');}
 }
 const original=engine.createMatch({id:'old-station',now:1000,seed:2,tactical:true,stationTasks:true,map:{id:'beacon',version:2}});
 assert(original.players.flatMap(p=>p.tasks).every(t=>t.kind==='station'&&t.challenge&&t.edition===undefined));
});

test('combined tactical taskStep uses server-owned modern progress, timing and completion',()=>{
 let state=game({taskMix:'equipment',tasksPerCrew:4}),actor=state.players.find(p=>p.role==='crew'),task=actor.tasks.find(t=>t.edition===3),at=1000;
 // Deterministic equipment fixture at an authored, reachable station. No action can set a kind or position.
 task.kind='sample';delete task.progress;actor.position={...getMap(state.map).geometry.WORLD_STATIONS[task.roomId]};actor.roomId=task.roomId;
 const own=()=>engine.getPlayerView(state,actor.id,at).self.tasks.find(t=>t.id===task.id);
 assert.equal(act(state,actor.id,'task',{taskId:task.id}).error.code,'TASK_INCOMPLETE');
 let result=act(state,actor.id,'taskStep',{taskId:task.id,step:0,input:taskInput(own())},at);assert(result.accepted);state=result.state;
 assert.equal(own().progress.v,3);assert.equal(taskWaitUntil(own()),4000);
 result=act(state,actor.id,'taskStep',{taskId:task.id,step:1,input:taskInput(own())},3999);assert.equal(result.error.code,'TOO_EARLY');state=result.state;at=4000;
 while(own().progress.index<own().progress.total){result=act(state,actor.id,'taskStep',{taskId:task.id,step:own().progress.index,input:taskInput(own())},at);assert(result.accepted,JSON.stringify(result.error));state=result.state;}
 result=act(state,actor.id,'task',{taskId:task.id},at);assert(result.accepted);state=result.state;assert.equal(own().completed,true);
 assert(state.replay.some(e=>e.type==='action'&&e.action.type==='taskStep'&&e.taskProgress.v===3));
});

test('combined tactical speed and vision are per-match and do not mutate map defaults',()=>{
 let slow=game({speed:90,vision:120}),fast=game({speed:300,vision:600});const map=getMap(slow.map),baseline=JSON.stringify(map.geometry.WORLD),origin=map.geometry.worldSpawn('p1');
 for(const s of [slow,fast]){const p=s.players[0];p.position={...origin};p.roomId='bridge';}
 slow=engine.applyInput(slow,'p1',{seq:1,dx:1,dy:0},1000).state;fast=engine.applyInput(fast,'p1',{seq:1,dx:1,dy:0},1000).state;
 slow=engine.tick(slow,1100).state;fast=engine.tick(fast,1100).state;
 assert(Math.abs(map.geometry.distance(origin,slow.players[0].position)-9)<.001);assert(Math.abs(map.geometry.distance(origin,fast.players[0].position)-30)<.001);
 assert.equal(engine.getPlayerView(slow,'p1',1100).vision.radius,120);assert.equal(engine.getPlayerView(fast,'p1',1100).vision.radius,600);assert.equal(JSON.stringify(map.geometry.WORLD),baseline);assert.equal(map.geometry.WORLD.speed,180);
 assert(createSpatialWorld(map.geometry).validateSpatialState(slow));assert(createSpatialWorld(map.geometry).validateSpatialState(fast));
});

test('combined settings disable tactical sabotage before dispatch and preserve legacy roster semantics',()=>{
 let state=game({sabotageEnabled:false,emergencyMeetingsEnabled:false});const sab=state.players.find(p=>p.role==='saboteur'),r=act(state,sab.id,'systemSabotage',{kind:'lights',targetId:''},state.startedAt+state.rules.sabotageCooldownMs);assert.equal(r.accepted,false);assert.equal(r.error.code,'UNAVAILABLE');
 assert.throws(()=>normalizeRoster({mode:'spectator',roster:rosterFor(15),humanPlayerIds:['p1']}));
 assert.equal(normalizeRoster({mode:'spectator',roster:rosterFor(15),humanPlayerIds:['p1'],configurable:true}).players.length,15);
});


test('historical systems custom identities keep unique safe spawns',()=>{
 const roster=Array.from({length:8},(_,i)=>({id:'crew-'+i,name:'Keeper '+i,color:'#8fc8bc',persona:'Fixture keeper '+i})),state=engine.createMatch({id:'custom-main',world:true,systems:true,roster,saboteurCount:2,mode:'spectator',now:1000,seed:3}),map=getMap(undefined);
 assert.deepEqual(state.players.map(p=>p.id),roster.map(p=>p.id));for(const p of state.players){assert(map.geometry.isWalkable(p.position));for(const other of state.players.filter(q=>q.id!==p.id))assert(map.geometry.distance(p.position,other.position)>=map.geometry.WORLD.bodyRadius*2);}
});


test('equipment-only excludes glyph inspection across tactical maps and seeds; mixed retains it',()=>{
 for(const map of [{id:'beacon',version:1},{id:'beacon',version:2},{id:'stormbreak-annex',version:1}]){
  const mixedKinds=new Set();
  for(let seed=0;seed<12;seed++){
   const equipment=game({taskMix:'equipment',tasksPerCrew:20},{map,seed}),mixed=game({taskMix:'mixed',tasksPerCrew:20},{map,seed});
   for(const task of equipment.players.flatMap(p=>p.tasks))if(task.kind==='station')assert.notEqual(task.challenge.kind,'glyphs');else assert.equal(TASK_CATALOG[task.kind].category,'equipment');
   for(const task of mixed.players.flatMap(p=>p.tasks))if(task.challenge)mixedKinds.add(task.challenge.kind);
  }
  assert(mixedKinds.has('glyphs'),map.id+':'+map.version+' still offers glyph inspection in mixed watches');
 }
});


test('tactical modern opening hints drive a real AI taskStep without authorizing premature completion',()=>{
 let state=game({capacity:15,saboteurs:3,tasksPerCrew:4}),actor=state.players.find(p=>p.role==='crew'&&!p.human),task=actor.tasks.find(t=>t.edition===3);
 actor.position={...getMap(state.map).geometry.WORLD_STATIONS[task.roomId]};actor.roomId=task.roomId;
 const initial=engine.getPlayerView(state,actor.id,1000),opening=initial.interactions.find(h=>h.type==='task'&&h.fields.taskId===task.id);
 assert(opening?.enabled,'An incomplete modern task must expose its safe panel-opening descriptor.');
 assert.equal(act(state,actor.id,'task',{taskId:task.id}).error.code,'TASK_INCOMPLETE');
 const own=initial.self.tasks.find(t=>t.id===task.id),proposal=worldTaskAction(initial,own);assert.equal(proposal.type,'taskStep');
 const result=act(state,actor.id,proposal.type,Object.fromEntries(Object.entries(proposal).filter(([key])=>key!=='type')));assert(result.accepted,JSON.stringify(result.error));state=result.state;
 assert.equal(engine.getPlayerView(state,actor.id,1000).self.tasks.find(t=>t.id===task.id).progress.index,1);
 assert.equal(engine.getPlayerView(state,null,1000).interactions.length,0,"Spectators must not receive another actor's task controls.");
});
