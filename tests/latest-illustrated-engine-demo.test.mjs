import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../server/engine/index.mjs';
import {createAiController} from '../server/ai/index.mjs';
import {getWorld} from '../shared/world.mjs';
import {validateReplayHistoryState} from '../server/engine/replay-history.mjs';

for(const mapId of ['beacon','storm-foundry','tidal-observatory'])test('illustrated revision2 default-rule local controller makes confirmed work and reaches legal outcome: '+mapId,{timeout:120000},async t=>{
 const external=t.mock.method(globalThis,'fetch',()=>{throw Error('No providers');});
 let state=e.createMatch({id:'illustrated-local-'+mapId,world:true,mapId,mapRevision:2,seed:7,mode:'spectator',now:1000,features:{deathPolicy:'ghost-tasks',abilities:true}}),context={},controller=createAiController({config:{provider:'demo',maxCalls:0,maxCostUsd:0,decisionIntervalMs:1800}}),restarted=false;const g=getWorld(mapId,2),counts={},kinds=new Set();
 // Same seed7 as incoming illustrated demo controls; unchanged default engine rules.
 // Other owners' pending store/client revisions are intentionally not overlaid.
 for(let now=1000;now<=state.startedAt+state.rules.maxMatchMs&&!['ended','paused'].includes(state.phase);now+=500){
  state=e.tick(state,now).state;
  for(const id of state.players.map(p=>p.id)){
   const view=e.getPlayerView(state,id,now),before=JSON.stringify(view),player=view.players.find(p=>p.id===id),action=await controller.decide({view,player,context});assert.equal(JSON.stringify(view),before);if(!action)continue;
   if(action.type==='taskStep')kinds.add(view.self.tasks.find(task=>task.id===action.taskId).progress.kind);
   const result=e.applyAction(state,id,action,now);assert(result.accepted,JSON.stringify({mapId,now,action,error:result.error}));state=result.state;counts[action.type]=(counts[action.type]??0)+1;
   assert(state.players.every(p=>g.isWalkable(p.position)));assert(view.players.every(p=>view.phase==='ended'||!Object.hasOwn(p,'role')));
  }
  if(!restarted&&counts.taskStep){state=JSON.parse(JSON.stringify(state));context=JSON.parse(JSON.stringify(context));validateReplayHistoryState(state.replayHistory,state);controller=createAiController({config:{provider:'demo',maxCalls:0,maxCostUsd:0,decisionIntervalMs:1800}});restarted=true;}
 }
 t.diagnostic(JSON.stringify({fixture:'Engine/controllers only with500ms virtual ticks; not native transport/store/browser approval',mapId,mapRevision:2,seed:7,restarted,counts,kinds:[...kinds],outcome:state.outcome,phase:state.phase,external:external.mock.callCount()}));
 assert(restarted);assert(counts.taskStep>0);assert.equal(state.phase,'ended');assert(['tasks','ejection','parity','critical'].includes(state.outcome.reason));validateReplayHistoryState(state.replayHistory,state);assert.equal(external.mock.callCount(),0);assert.equal(controller.describe(context).calls,0);assert.equal(controller.describe(context).costUsd,0);
});
