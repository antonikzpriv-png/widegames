import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch} from '../server/engine/index.mjs';
import {LOBBY_DEFAULTS,rosterFor,changeSettings} from '../shared/lobby.mjs';
import {getWorld,WORLD} from '../shared/world.mjs';
import {REPLAY_VERSION,REPLAY_MAP,validateReplayAnchor} from '../shared/replay.mjs';
import {createReplayModel} from '../public/world/replay-model.mjs';
import {worldReplayText} from '../public/world/replay.mjs';
import {challenge,advanceTask} from '../server/engine/tasks.mjs';

// Reconstruction fixtures use real engine-created initial checkpoints; they do
// not manufacture playable outcomes or claim to exercise HTTP replay access.
function recording({capacity=6,mapId='beacon',mapRevision=1,speed=180,vision=360}={}){
 const settings=changeSettings(LOBBY_DEFAULTS,{capacity,saboteurs:capacity===15?3:1,tasksPerCrew:1,speed,vision});
 const state=createMatch({id:`task-replay-${capacity}-${mapId}-${mapRevision}-${speed}-${vision}`,settings,roster:rosterFor(capacity),world:true,mode:'spectator',mapId,mapRevision,now:1000,seed:'replay-settings'});
 const anchor=structuredClone(state.replayHistory.checkpoints[0]);
 const metadata={version:REPLAY_VERSION,map:mapId==='beacon'?REPLAY_MAP:mapId,...(mapRevision===2?{mapRevision:2}:{}),matchId:state.id,anchor,coverage:{startedAt:1000,from:1000,through:10000,partial:false}};
 return {state,metadata,envelope:{matchId:state.id,metadata,replay:structuredClone(state.replay)}};
}

for(const capacity of [4,6,15])for(const mapId of ['beacon','storm-foundry','tidal-observatory'])for(const mapRevision of [1,2])test(`task replay: ${capacity} actors reconstruct ${mapId} revision ${mapRevision} anchor without fixed-six omissions`,()=>{
 const f=recording({capacity,mapId,mapRevision,speed:300,vision:600}),profiles=f.state.players.map(p=>({id:p.id,name:`Keeper ${p.id.slice(1)}`,color:p.color,badge:p.id.slice(1)})),m=createReplayModel(f.envelope,{players:profiles,mapId,mapRevision});
 assert.deepEqual(f.metadata.anchor.settings,{speed:300,vision:600});validateReplayAnchor(f.metadata.anchor,f.metadata.map,mapRevision);
 const frame=m.at(1000);assert.equal(frame.mapRevision??1,mapRevision);assert.equal(frame.players.length,capacity);assert.deepEqual(frame.players.map(p=>p.id),f.state.players.map(p=>p.id));assert.deepEqual(frame.settings,{speed:300,vision:600});
 for(const p of f.state.players){const actual=frame.players.find(q=>q.id===p.id);assert.deepEqual(actual.position,p.position);assert.equal(actual.name,`Keeper ${p.id.slice(1)}`);assert.equal(actual.badge,p.id.slice(1));}
 frame.players.at(-1).position.x=-1;frame.settings.speed=-1;assert.deepEqual(m.at(1000).players.at(-1).position,f.state.players.at(-1).position);assert.equal(m.at(1000).settings.speed,300);
});

test('task replay: a complete started event restores 15 actors without metadata or supplied profiles',()=>{
 const f=recording({capacity:15}),m=createReplayModel({replay:f.state.replay});
 assert.equal(m.at(1000).players.length,15);assert.deepEqual(m.at(1000).players.find(p=>p.id==='p15').position,f.state.players[14].position);
 const old=createReplayModel({replay:[{id:'r1',type:'started',at:1000,worldVersion:1,positions:[{id:'p1',position:{x:800,y:272}}]}]});assert.equal(old.at(1000).players.length,6,'sparse legacy start records preserve the original fallback');
});

for(const speed of [90,300])test(`task replay: checkpoint and recorded navigation use configured ${speed} units/second`,()=>{
 const f=recording({speed}),p=f.metadata.anchor.players[0];p.position={x:620,y:280};p.route=[{x:920,y:280}];
 const m=createReplayModel(f.envelope);assert.equal(m.at(1500).players[0].position.x,620+speed*.5);
 p.route=[];f.envelope.replay.push({id:'r2',type:'action',at:1100,playerId:p.id,action:{type:'navigate',x:920,y:280},position:{x:620,y:280},route:[{x:920,y:280}],speed});
 assert.equal(createReplayModel(f.envelope).at(1600).players[0].position.x,620+speed*.5);
 f.envelope.replay.at(-1).speed=speed+1;assert.equal(createReplayModel(f.envelope).at(1600).players[0].position.x,620,'a route cannot exceed the recorded match speed');
});

test('task replay: recorded vision applies to actors and bodies and stays isolated between models',()=>{
 const globals=JSON.stringify(WORLD),models=[];
 for(const vision of [120,600]){
  const f=recording({vision}),a=f.metadata.anchor;a.players[0].position={x:615,y:280};a.players[1].position={x:985,y:280};a.players[2].alive=false;a.bodies=[{id:'body-p3',playerId:'p3',roomId:'bridge',position:{x:985,y:280},at:1000,reported:false}];
  const model=createReplayModel(f.envelope);models.push(model);const perspective=model.perspective(model.at(1000),'p1');assert.equal(perspective.visible.includes('p2'),vision===600);assert.equal(perspective.bodies.includes('body-p3'),vision===600);
 }
 const before=models[0].at(1500);models[1].at(9000);assert.deepEqual(models[0].at(1500),before);assert.equal(JSON.stringify(WORLD),globals);assert.equal(getWorld().WORLD.speed,180);assert.equal(getWorld().WORLD.visibilityRadius,360);
});

test('task replay: optional settings validate strictly while historical anchors keep 180/360 defaults',()=>{
 const f=recording({speed:300,vision:600}),a=f.metadata.anchor;a.players[0].position={x:620,y:280};a.players[0].route=[{x:920,y:280}];a.players[1].position={x:985,y:280};
 for(const settings of [{speed:89,vision:120},{speed:301,vision:120},{speed:90,vision:119},{speed:90,vision:601},{speed:90.5,vision:120},{speed:'180',vision:360},{speed:180},{speed:180,vision:360,privateReasoning:'never'},null]){const invalid=structuredClone(a);invalid.settings=settings;assert.throws(()=>validateReplayAnchor(invalid),/metadata/);}
 delete a.settings;validateReplayAnchor(a);const old=createReplayModel(f.envelope),frame=old.at(1500);assert.equal(frame.players[0].position.x,710);assert(!old.perspective(old.at(1000),'p1').visible.includes('p2'));assert(!Object.hasOwn(frame,'settings'),'old anchors remain readable without adding configuration');
});

test('task replay: private power-routing events move task ownership location without moving its keeper',()=>{
 const f=recording({capacity:15}),actor=f.metadata.anchor.players.find(p=>p.role==='crew'),task=actor.tasks[0],before=structuredClone(actor.position),destination=task.roomId==='archive'?'galley':'archive';
 f.envelope.replay.push({id:'r2',type:'task_routed',at:1100,playerId:actor.id,taskId:task.id,roomId:destination,label:'Accept power at the destination'});
 const m=createReplayModel(f.envelope),original=m.at(1050).players.find(p=>p.id===actor.id),routed=m.at(1150).players.find(p=>p.id===actor.id);assert.equal(original.tasks[0].roomId,task.roomId);assert.equal(routed.tasks[0].roomId,destination);assert.equal(routed.tasks[0].label,'Accept power at the destination');assert.deepEqual(routed.position,before);
 assert.match(worldReplayText(f.envelope.replay.at(-1),{phase:'ended',players:f.state.players,rooms:getWorld().ROOM_LAYOUT}),/routed power to .*acceptance is required/);
 f.envelope.replay.at(-1).roomId='invented-room';assert.equal(createReplayModel(f.envelope).at(1150).players.find(p=>p.id===actor.id).tasks[0].roomId,task.roomId);
});


test('task replay: council interrupts an active transfer while a sample incubation continues',()=>{
 const f=recording(),actor=f.metadata.anchor.players.find(p=>p.role==='crew'),original=actor.tasks[0];
 actor.tasks=['transfer','sample'].map(kind=>{const task={...original,id:original.id+'_'+kind,kind,edition:3};task.progress=challenge(task);advanceTask(task,1000);return task;});
 f.envelope.replay.push({id:'r2',type:'meeting',at:1100,reason:'timeout'});const m=createReplayModel(f.envelope),before=m.at(1050).players.find(p=>p.id===actor.id),after=m.at(1150).players.find(p=>p.id===actor.id);
 assert.deepEqual(before.tasks.map(t=>t.progress.index),[1,1]);assert.equal(after.tasks[0].progress.index,0);assert.equal(after.tasks[0].progress.readyAt,0);assert.equal(after.tasks[1].progress.index,1);assert.equal(after.tasks[1].progress.readyAt,4000);
});


test('task replay: legacy and redesigned spawn geometry stay collision-safe for all15 keepers',()=>{
 for(const mapId of ['beacon','storm-foundry','tidal-observatory'])for(const revision of [1,2]){const world=getWorld(mapId,revision),first=world.worldSpawn('p1'),spawns=Array.from({length:15},(_,i)=>world.worldSpawn('p'+(i+1)));for(const [i,p]of spawns.entries()){assert(world.isWalkable(p));assert.equal(world.worldRoomAt(p),'bridge');for(const q of spawns.slice(i+1))assert(world.distance(p,q)>=2*world.WORLD.bodyRadius);}spawns[0].x=-1;assert.deepEqual(world.worldSpawn('p1'),first);}
 const legacy=getWorld('beacon'),modern=getWorld('beacon',2);assert.equal(legacy.metadata.revision??1,1);assert.equal(modern.metadata.revision,2);assert.notDeepEqual(legacy.worldSpawn('p15'),modern.worldSpawn('p15'));assert.equal(WORLD.speed,180);
});
