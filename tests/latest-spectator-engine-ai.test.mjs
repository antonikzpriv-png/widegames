import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import * as engine from '../server/engine/index.mjs';
import {createAiController} from '../server/ai/index.mjs';
import {getMap} from '../shared/maps/index.mjs';

function apply(state,who,action,now){const r=engine.applyAction(state,who,{id:'fixture:'+now+':'+action.type,...action},now);assert(r.accepted,JSON.stringify(r.error));return r.state;}
function arrive(state,id,target,now){state=apply(state,id,{type:'navigate',x:target.x,y:target.y},now);let last=state.players.find(p=>p.id===id).position,length=0;for(const q of state.players.find(p=>p.id===id).motion.path){length+=getMap(state.map).geometry.distance(last,q);last=q;}now+=Math.ceil(length/180*1000)+1;state=engine.tick(state,now).state;return {state,now};}

for(const id of ['beacon','stormbreak-annex'])test('nearby structured job is not preempted by remote auxiliary repair: '+id,async t=>{
 const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('Offline only');});
 let state=engine.createMatch({id:'aux-job-'+id,tactical:true,stationTasks:true,map:{id,version:id==='beacon'?2:1},mode:'spectator',now:1000,seed:3});
 const crew=state.players.find(p=>p.role==='crew'),sab=state.players.find(p=>p.role==='saboteur'),map=getMap(state.map);
 // Legal travel, then actual sabotage. No injected positions, puzzle progress or hints.
 const task=crew.tasks.find(task=>map.geometry.distance(map.geometry.WORLD_STATIONS[task.roomId],map.fixtures.repairs.lights[0].position)>200);assert(task);
 let now=1000;({state,now}=arrive(state,crew.id,map.geometry.WORLD_STATIONS[task.roomId],now));
 state=apply(state,sab.id,{type:'systemSabotage',kind:'lights',targetId:'beacon'},now);
 const view=engine.getPlayerView(state,crew.id,now),before=structuredClone(view),context={};assert(view.systems.lights.active);assert(view.interactions.some(h=>h.enabled&&h.type==='task'&&h.fields.taskId===task.id));
 const ai=createAiController({config:{provider:'demo',decisionIntervalMs:1800,maxCalls:0,maxCostUsd:0}}),action=await ai.decide({view,player:view.players.find(p=>p.id===crew.id),context});
 assert.equal(action?.type,'taskInteract',JSON.stringify(action));assert.equal(action.taskId,task.id);assert(engine.applyAction(state,crew.id,action,now).accepted);assert.deepEqual(view,before);assert.equal(fetch.mock.callCount(),0);
});

test('real staggered offline controller seed3 finishes default Beacon2 and progresses jobs through auxiliary sabotage',{timeout:180000},async t=>{
 const external=t.mock.method(globalThis,'fetch',()=>{throw Error('No outbound providers');});
 let state=engine.createMatch({id:'seed3-staggered',tactical:true,stationTasks:true,map:{id:'beacon',version:2},mode:'spectator',now:1000,seed:3}),context={},ai=createAiController({config:{provider:'demo',decisionIntervalMs:1800,maxCalls:0,maxCostUsd:0}});
 const due=new Map(),counts={},denials={},trace=[],started=performance.now();let restarted=false,auxTaskInputs=0;
 // Transport-equivalent earliest-due single actor, not six synchronous decisions per frame.
 // Explicit 500ms scheduler cadence, real 1800ms actor interval, unchanged engine deadlines.
 for(let now=1000;now<=901000&&!['ended','paused'].includes(state.phase);now+=500){
  state=engine.tick(state,now).state;
  const p=state.players.filter(p=>!p.human&&(due.get(p.id)??0)<=now&&(p.alive||engine.getPlayerView(state,p.id,now).self?.ghost)).sort((a,b)=>(due.get(a.id)??0)-(due.get(b.id)??0))[0];
  if(p){due.set(p.id,now+1800);const view=engine.getPlayerView(state,p.id,now),action=await ai.decide({view,player:view.players.find(q=>q.id===p.id),context});if(action){const r=engine.applyAction(state,p.id,action,now);counts[action.type]=(counts[action.type]??0)+1;if(!r.accepted)denials[r.error.code]=(denials[r.error.code]??0)+1;if(action.type==='taskInteract'&&(state.systems.lights.active||state.systems.communications.active))auxTaskInputs++;trace.push({at:now,id:p.id,type:action.type,accepted:r.accepted,completed:state.players.flatMap(q=>q.tasks).filter(t=>t.completed).length});if(trace.length>20)trace.shift();state=r.state;}}
  if(!restarted&&now>=31000){state=JSON.parse(JSON.stringify(state));context=JSON.parse(JSON.stringify(context));ai=createAiController({config:{provider:'demo',decisionIntervalMs:1800,maxCalls:0,maxCostUsd:0}});restarted=true;}
 }
 const receipt={seed:3,fixture:'Real engine and AI controller; serialized earliest-due simulation, not native HTTP scheduler qualification',cadenceMs:500,counts,denials,auxTaskInputs,completed:state.players.flatMap(p=>p.tasks).filter(t=>t.completed).length,phase:state.phase,outcome:state.outcome,trace,cpuElapsedMs:performance.now()-started};t.diagnostic(JSON.stringify(receipt));
 assert.equal(state.phase,'ended',JSON.stringify(receipt));assert(counts.taskInteract>0);assert(auxTaskInputs>0);assert(restarted);assert.equal(ai.describe(context).calls,0);assert.equal(external.mock.callCount(),0);assert.equal(ai.describe(context).costUsd,0);
});

for(const id of ['beacon','stormbreak-annex'])test('critical repair remains urgent ahead of an enabled owned station: '+id,async t=>{
 const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('Offline only');});
 let state=engine.createMatch({id:'critical-job-'+id,tactical:true,stationTasks:true,map:{id,version:id==='beacon'?2:1},mode:'spectator',now:1000,seed:3});
 const map=getMap(state.map),site=map.fixtures.repairs.power.find(site=>state.players.some(p=>p.role==='crew'&&p.tasks.some(task=>task.roomId===site.roomId)));assert(site);
 const crew=state.players.find(p=>p.role==='crew'&&p.tasks.some(task=>task.roomId===site.roomId)),sab=state.players.find(p=>p.role==='saboteur');let now=1000;({state,now}=arrive(state,crew.id,site.position,now));now=Math.max(now,sab.cooldowns.sabotageAt);
 state=apply(state,sab.id,{type:'systemSabotage',kind:'power',targetId:'beacon'},now);const view=engine.getPlayerView(state,crew.id,now);assert(view.sabotage.active);assert(view.interactions.some(h=>h.enabled&&h.type==='systemRepair'&&h.fields.systemId==='power'));
 const ai=createAiController({config:{provider:'demo',decisionIntervalMs:1800,maxCalls:0}}),context={},action=await ai.decide({view,player:view.players.find(p=>p.id===crew.id),context});assert.equal(action.type,'systemRepair');assert.equal(action.systemId,'power');assert(engine.applyAction(state,crew.id,action,now).accepted);assert.equal(fetch.mock.callCount(),0);
});
