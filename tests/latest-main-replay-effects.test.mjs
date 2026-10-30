import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../server/engine/index.mjs';
import {getMap} from '../shared/maps/index.mjs';
import {createReplayModel} from '../public/world/replay-model.mjs';
test('real tactical replay retains a custom-roster Echo outside original map bounds',()=>{
 const map=getMap('beacon'),roster=Array.from({length:4},(_,i)=>({id:'keeper_'+i,name:'Keeper '+i,color:['#abcdef','#fedcba','#aabbcc','#ccbbaa'][i],persona:'A careful keeper.'}));
 let state=engine.createMatch({id:'mapped-echo-regression',mode:'spectator',tactical:true,stationTasks:true,map:{id:map.id,version:map.version},roster,now:1000,seed:'echo-map',features:{deathPolicy:'ghost-tasks',abilities:true},config:{sabotageCooldownMs:1,criticalDurationMs:1000}}),now=1000;
 const sab=state.players.find(p=>p.role==='saboteur'),target=map.geometry.WORLD_STATIONS.reservoir;
 function act(id,action){const r=engine.applyAction(state,id,{id:'echo:'+now+':'+action.type,...action},now);assert(r.accepted,JSON.stringify(r.error));state=r.state;}
 act(sab.id,{type:'navigate',x:target.x,y:target.y});
 let previous=sab.position,length=0;for(const p of state.players.find(p=>p.id===sab.id).motion.path){length+=map.geometry.distance(previous,p);previous=p;}
 now+=Math.ceil(length/map.geometry.WORLD.speed*1000)+100;state=engine.tick(state,now).state;
 const position=state.players.find(p=>p.id===sab.id).position;assert(position.x>1600||position.y>1200);act(sab.id,{type:'decoy',x:position.x,y:position.y});const effect=structuredClone(state.effects.find(e=>e.kind==='echo')),at=now;
 now++;act(sab.id,{type:'systemSabotage',kind:'power',targetId:'beacon'});state=engine.tick(state,state.sabotage.deadlineAt).state;assert.equal(state.phase,'ended');assert.equal(state.outcome.winner,'saboteur');
 const model=createReplayModel({matchId:state.id,metadata:engine.getReplayMetadata(state),replay:engine.getReplay(state)},{matchId:state.id,players:state.players});
 const replay=model.at(at);assert.deepEqual(replay.effects.find(e=>e.id===effect.id),effect);assert.equal(model.at(effect.expiresAt).effects.some(e=>e.id===effect.id),false);
});
