import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../server/engine/index.mjs';
import {LOBBY_DEFAULTS,rosterFor} from '../shared/lobby.mjs';
import {createReplayModel} from '../public/world/replay-model.mjs';

for(const speed of [90,300])test(`actual ${speed} movement speed survives navigation recording and intermediate replay reconstruction`,()=>{
 const settings={...LOBBY_DEFAULTS,speed,sabotageCooldownMs:10000,criticalDurationMs:20000};let state,seed=0;
 do{state=engine.createMatch({id:'configured-replay-'+speed,world:true,settings,roster:rosterFor(6),now:1000,seed:seed++});}while(state.players[0].role!=='saboteur');
 const start=structuredClone(state.players[0].position),destination={x:start.x+90,y:start.y};
 const navigate=engine.applyAction(state,'p1',{id:'route',type:'navigate',...destination},1000);assert(navigate.accepted);state=navigate.state;
 const recorded=state.replay.find(e=>e.type==='action'&&e.action?.id==='route');assert.equal(recorded.speed,speed);
 const midpoint=1000+45000/speed;state=engine.tick(state,midpoint).state;const actual=structuredClone(state.players[0].position);assert(Math.abs(actual.x-start.x-45)<.001);
 state=engine.tick(state,1000+90000/speed+10).state;
 const sabotage=engine.applyAction(state,'p1',{id:'finish-critical',type:'sabotage'},11000);assert(sabotage.accepted,JSON.stringify(sabotage.error));state=engine.tick(sabotage.state,sabotage.state.sabotage.deadlineAt).state;assert.equal(state.phase,'ended');assert.equal(state.outcome.reason,'critical');
 const response={matchId:state.id,replay:engine.getReplay(state),metadata:engine.getReplayMetadata(state)},model=createReplayModel(response,{matchId:state.id,players:engine.getPlayerView(state,null,state.updatedAt).players});
 const projected=model.at(midpoint).players.find(p=>p.id==='p1').position;assert(Math.hypot(projected.x-actual.x,projected.y-actual.y)<.001,'replay must use this match speed, including limits lower/higher than the shared default');
});
