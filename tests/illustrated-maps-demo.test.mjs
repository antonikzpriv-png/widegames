import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,applyAction,tick,getPlayerView} from '../server/engine/index.mjs';
import {getWorld} from '../shared/world.mjs';
import {CHARACTERS} from '../shared/contracts.mjs';
import {createAiController} from '../server/ai/index.mjs';
import {validateRoomSnapshot} from '../server/store.mjs';

const maps=['beacon','storm-foundry','tidal-observatory'];
function roomFor(state){return {schema:1,id:state.id,mode:state.mode,createdAt:1000,updatedAt:state.updatedAt,identities:[{hash:'a'.repeat(64),host:true,seatId:state.mode==='human'?'p1':null}],state,startId:'start',aiContext:{},...(state.mapId?{mapId:state.mapId}:{}),...(state.mapRevision?{mapRevision:state.mapRevision}:{})};}

for(const mapId of maps)test(`illustrated ${mapId}: permitted-view demo bots finish revision2 with real task work and JSON restart`,{timeout:240000},async t=>{
 const provider=t.mock.method(globalThis,'fetch',()=>{throw Error('Provider calls are forbidden in illustrated-map qualification');});
 let state=createMatch({id:('illustrated_demo_'+mapId.replaceAll('-','_')).padEnd(36,'x'),mapId,mapRevision:2,world:true,mode:'spectator',now:1000,seed:7,features:{deathPolicy:'ghost-tasks',abilities:true},config:{discussionMs:6000,votingMs:4000,initialKillCooldownMs:45000}});
 let controller=createAiController({config:{provider:'demo',decisionIntervalMs:1000}}),context={},restarted=false,actions=0;const kinds=new Set(),types=new Set(),world=getWorld(mapId,2);
 for(let now=1000;now<=state.startedAt+state.rules.maxMatchMs&&!['ended','paused'].includes(state.phase);now+=250){
  state=tick(state,now).state;
  for(const player of CHARACTERS){
   const view=getPlayerView(state,player.id,now),action=await controller.decide({view,player,context});if(!action)continue;
   assert.equal(view.mapRevision,2);if(action.type==='taskStep')kinds.add(view.self.tasks.find(task=>task.id===action.taskId).progress.kind);
   const result=applyAction(state,player.id,action,now);assert(result.accepted,JSON.stringify({mapId,action,error:result.error}));state=result.state;types.add(action.type);actions++;
   for(const actor of state.players)assert(world.isWalkable(actor.position),'Authoritative bot movement stays in the new polygon/collider geometry');
   if(actions%25===0)await validateRoomSnapshot(roomFor(state));
  }
  if(!restarted&&types.has('taskStep')){state=JSON.parse(JSON.stringify(state));context=JSON.parse(JSON.stringify(context));await validateRoomSnapshot(roomFor(state));controller=createAiController({config:{provider:'demo',decisionIntervalMs:1000}});restarted=true;}
 }
 assert(restarted,'Bot confirmed work must precede the restart');assert(kinds.size>0);assert.equal(state.phase,'ended',JSON.stringify({mapId,actions,types:[...types],kinds:[...kinds],state:state.phase}));assert(['tasks','ejection','parity','critical'].includes(state.outcome.reason));
 assert.equal(state.players.flatMap(p=>p.tasks).length,world.metadata.tasksPerCrew*5);await validateRoomSnapshot(roomFor(state));assert.equal(provider.mock.callCount(),0);assert.equal(controller.describe(context).calls,0);
 t.diagnostic(JSON.stringify({mapId,mapRevision:state.mapRevision,outcome:state.outcome,kinds:[...kinds],actions}));
});

for(const mapId of maps)test(`illustrated ${mapId}: dead crew traverse the new physical routes without moving their corpse`,async()=>{
 const world=getWorld(mapId,2);let state=createMatch({id:('illustrated_ghost_'+mapId.replaceAll('-','_')).padEnd(36,'x'),mapId,mapRevision:2,world:true,now:1000,seed:'illustrated-ghost',features:{deathPolicy:'ghost-tasks',abilities:true},config:{initialKillCooldownMs:1}});
 const killer=state.players.find(p=>p.role==='saboteur'),victim=state.players.find(p=>p.role==='crew'),position=world.worldSpawn('p1');
 for(const actor of [killer,victim]){actor.position={...position};actor.roomId='bridge';}
 const tasks=structuredClone(victim.tasks),killed=applyAction(state,killer.id,{id:'new-layout-death',type:'eliminate',targetId:victim.id},1001);assert(killed.accepted);state=killed.state;
 const corpse=structuredClone(state.bodies.find(b=>b.playerId===victim.id)),destination=world.WORLD_STATIONS[tasks.find(task=>task.roomId!=='bridge')?.roomId||'engine'];
 assert.deepEqual(state.players.find(p=>p.id===victim.id).tasks,tasks,'Ghost work remains with its dead owner');
 const path=world.findWorldPath(position,destination);assert(path);const moved=applyAction(state,victim.id,{id:'new-layout-ghost-route',type:'navigate',x:destination.x,y:destination.y},1001);assert(moved.accepted,JSON.stringify(moved.error));
 let length=0,previous=position;for(const waypoint of path){length+=world.distance(previous,waypoint);previous=waypoint;}
 state=tick(moved.state,1001+Math.ceil(length/world.WORLD.speed*1000)+100).state;
 assert.equal(state.players.find(p=>p.id===victim.id).alive,false);assert(world.distance(state.players.find(p=>p.id===victim.id).position,destination)<1);assert.deepEqual(state.bodies.find(b=>b.playerId===victim.id),corpse);
 const living=getPlayerView(state,killer.id,state.updatedAt),publicView=getPlayerView(state,null,state.updatedAt);assert.equal(living.players.find(p=>p.id===victim.id).position,null);assert.equal(publicView.players.find(p=>p.id===victim.id).position,null);await validateRoomSnapshot(roomFor(state));
});
