import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../server/engine/index.mjs';
import {getMap} from '../shared/maps/index.mjs';
import {nextStationInput} from '../shared/station-challenges.mjs';
import {worldCandidates} from '../server/ai/world.mjs';
import {createAiController} from '../server/ai/index.mjs';
import {validateSystemsState} from '../server/engine/systems/index.mjs';

const maps=[{id:'beacon',version:2},{id:'stormbreak-annex',version:1}];
function fixture(map,id,config={}){return {state:e.createMatch({id,tactical:true,stationTasks:true,map,seed:3,now:1000,mode:'spectator',config}),serial:0,time:1000};}
function act(f,id,action,now=f.time){const result=e.applyAction(f.state,id,{id:'closure:'+ ++f.serial,...action},now);assert(result.accepted,JSON.stringify({action,error:result.error}));f.state=result.state;f.time=now;return result;}
function advance(f,now){f.time=now;f.state=e.tick(f.state,now).state;}
function travel(f,id,target){act(f,id,{type:'navigate',x:target.x,y:target.y});const p=f.state.players.find(p=>p.id===id),g=getMap(f.state.map).geometry;let previous=p.position,length=0;for(const q of p.motion.path){length+=g.distance(previous,q);previous=q;}advance(f,f.time+Math.ceil(length/g.WORLD.speed*1000)+1);}
function view(f,id){return e.getPlayerView(f.state,id,f.time);}
function safeCritical(v,own){assert.equal(v.sabotage.selfContributed,own);assert.equal(v.systems.critical.selfContributed,own);for(const c of [v.sabotage,v.systems.critical]){assert(!Object.hasOwn(c,'repairers'));assert(c.sites.every(site=>!Object.hasOwn(site,'repairedBy')&&!Object.hasOwn(site,'repairedAt')));}}

for(const map of maps)test('accepted critical contribution is owner-only knowledge and releases own work after JSON restart: '+map.id,async t=>{
 const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('No provider');}),f=fixture(map,'own-contribution-'+map.id),g=getMap(map).geometry;
 const site=getMap(map).fixtures.repairs.power.find(s=>g.distance(s.position,g.WORLD_STATIONS[s.roomId])<=g.WORLD.interactionRadius&&f.state.players.some(p=>p.role==='crew'&&p.tasks.some(t=>t.roomId===s.roomId)));assert(site);
 const crew=f.state.players.find(p=>p.role==='crew'&&p.tasks.some(t=>t.roomId===site.roomId)).id,other=f.state.players.find(p=>p.role==='crew'&&p.id!==crew).id,sab=f.state.players.find(p=>p.role==='saboteur').id;
 travel(f,crew,site.position);act(f,sab,{type:'systemSabotage',kind:'power',targetId:'beacon'},Math.max(f.time,f.state.players.find(p=>p.id===sab).cooldowns.sabotageAt));
 // The first contribution is an actual authoritative accepted action, not memory.
 const before=view(f,crew);safeCritical(before,false);assert(before.interactions.some(h=>h.enabled&&h.type==='systemRepair'&&h.fields.siteId===site.id));act(f,crew,{type:'systemRepair',systemId:'power',siteId:site.id});assert(f.state.sabotage.active);assert.equal(f.state.sabotage.repairers.length,1);
 for(let restart=0;restart<2;restart++){
  if(restart)f.state=JSON.parse(JSON.stringify(f.state));assert.equal(validateSystemsState(f.state),true);
  const own=view(f,crew),otherView=view(f,other),publicView=view(f,null);safeCritical(own,true);safeCritical(otherView,false);safeCritical(view(f,sab),false);
  for(const c of [publicView.sabotage,publicView.systems.critical]){assert(!Object.hasOwn(c,'selfContributed'));assert(!Object.hasOwn(c,'repairers'));assert(c.sites.every(s=>!Object.hasOwn(s,'repairedBy')));}
  assert(!own.interactions.some(h=>h.enabled&&h.type==='systemRepair'&&h.fields.systemId==='power'));
  assert(own.interactions.some(h=>h.enabled&&h.type==='task'));const original=structuredClone(f.state),context={},ai=createAiController({config:{provider:'demo',maxCalls:0,maxCostUsd:0}}),action=await ai.decide({view:own,player:own.players.find(p=>p.id===crew),context});
  assert.equal(action?.type,'taskInteract',JSON.stringify(action));assert.deepEqual(f.state,original);act(f,crew,action);assert.equal(f.state.sabotage.repairers.length,1);assert.equal(ai.describe(context).calls,0);
 }
 assert.equal(fetch.mock.callCount(),0);
});

for(const map of maps)test('optional terminal cap counts goal and fallback, survives JSON, and never detours an owned job: '+map.id,t=>{
 const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('No provider');});
 // Controlled idle other actors and a long roam isolate three actual terminal reads;
 // this is a policy/protocol fixture, not a default autonomous-match claim.
 const f=fixture(map,'device-cap-'+map.id,{roamDeadlineMs:600000}),crew=f.state.players.find(p=>p.role==='crew').id,g=getMap(map).geometry,device=getMap(map).fixtures.devices[0];
 // A permitted nearby console must not detour unfinished owned jobs, even
 // below the cap and with investigation-goal time eligibility satisfied.
 travel(f,crew,device.position);advance(f,Math.max(f.time,14000));const jobView=view(f,crew),jobMemory={tacticalStartedAt:1000,tacticalReads:0};assert(jobView.interactions.some(h=>h.enabled&&h.type==='investigate'));
 const work=worldCandidates(jobView,jobMemory,'skip')[0];assert.notEqual(work?.type,'investigate');if(work?.type==='navigate'){assert(g.distance(work,device.position)>1);assert(jobView.self.tasks.some(task=>g.distance(work,g.WORLD_STATIONS[task.roomId])<1));}act(f,crew,work);advance(f,Math.max(f.time,f.state.players.find(p=>p.id===crew).cooldowns.moveAt));assert.equal(jobMemory.tacticalReads,0);
 // Finish only this owner's four jobs legally, leaving other owners' jobs unfinished.
 for(const task of [...f.state.players.find(p=>p.id===crew).tasks]){travel(f,crew,g.WORLD_STATIONS[task.roomId]);advance(f,Math.max(f.time,f.state.players.find(p=>p.id===crew).cooldowns.taskAt));for(let step=0;step<12;step++){advance(f,Math.max(f.time,f.state.players.find(p=>p.id===crew).cooldowns.taskAt));const own=view(f,crew).self.tasks.find(t=>t.id===task.id);if(own.completed)break;const input=nextStationInput(own.challenge);assert(input);act(f,crew,{type:'taskInteract',taskId:task.id,...input});}assert(f.state.players.find(p=>p.id===crew).tasks.find(t=>t.id===task.id).completed);}
 assert.equal(f.state.phase,'roam');travel(f,crew,device.position);const memory={tacticalStartedAt:1000,tacticalReads:0};
 for(let read=0;read<3;read++){
  // First two enter via the45s goal; third is deliberately30s fallback, with
  // the45s investigation goal ineligible. Both must share one three-read cap.
  if(read)advance(f,memory.lastTerminalAt+(read===2?31001:45001));
  const v=view(f,crew),proposal=worldCandidates(v,memory,'skip')[0];assert.equal(proposal?.type,'investigate',JSON.stringify({read,proposal,now:f.state.updatedAt,memory}));act(f,crew,proposal);const session=f.state.investigation.sessions[crew];advance(f,session.deadlineAt);
 }
 assert.equal(f.state.investigation.observations[crew].length,3);assert.equal(memory.tacticalReads,3,'fallback must consume the same read budget as goal');
 f.state=JSON.parse(JSON.stringify(f.state));const resumed=JSON.parse(JSON.stringify(memory));advance(f,resumed.lastTerminalAt+45001);
 const local=view(f,crew);assert(local.interactions.some(h=>h.enabled&&h.type==='investigate'),'policy cap must not revoke engine permission');assert.notEqual(worldCandidates(local,resumed,'skip')[0]?.type,'investigate');
 const remote=Object.values(g.WORLD_STATIONS).find(p=>g.distance(p,device.position)>500);assert(remote);travel(f,crew,remote);const proposal=worldCandidates(view(f,crew),resumed,'skip')[0];assert.notEqual(proposal?.type,'investigate');if(proposal?.type==='navigate')assert(g.distance(proposal,device.position)>1,'cap prevents optional travel to console');assert.equal(resumed.tacticalReads,3);assert.equal(fetch.mock.callCount(),0);
});
