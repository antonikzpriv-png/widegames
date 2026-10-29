import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createMatch,applyAction,applyInput,getPlayerView,tick,getReplay,getReplaySnapshots} from '../server/engine/index.mjs';
import {normalizeRoster} from '../server/features/lobbies/index.mjs';
import {createTaskRegistry,relayTask} from '../server/features/tasks/index.mjs';
import {createAbilityRegistry,fieldNote} from '../server/features/abilities/index.mjs';
import {createGoalRegistry,localNavigationIntent} from '../server/features/strategy/index.mjs';
import {createGameServer} from '../server/transport.mjs';
import {WORLD_BELL} from '../shared/world.mjs';
const roster=Array.from({length:4},(_,i)=>({id:['captain','signal','archivist','medic'][i],name:'Keeper '+i,color:['#edb66c','#8fc8bc','#d5a3cf','#9fb7ed'][i],persona:'Fixture keeper '+i}));
const rules={meetingCooldownMs:1,discussionMs:30,votingMs:20,taskCooldownMs:1};
const fixture=()=>createMatch({id:'beacon-interface',world:true,systems:true,roster,humanPlayerIds:['signal','captain'],now:1000,seed:'fixture',config:rules});

test('roster interface validates explicit IDs humans and faction counts without p1 or six seats',()=>{
 const setup=normalizeRoster({roster,mode:'human',humanPlayerIds:['signal','captain']});assert.equal(setup.players.length,4);assert.deepEqual(setup.humanPlayerIds,['signal','captain']);
 for(const input of [{roster:[...roster.slice(0,3),roster[0]]},{roster,saboteurCount:2},{roster,humanPlayerIds:['p1']},{roster:roster.map((p,i)=>i? p:{...p,id:'__proto__'})}])assert.throws(()=>normalizeRoster(input));
 const state=fixture();assert.equal(state.schemaVersion,3);assert.equal(state.players.filter(p=>p.human).length,2);assert.equal(state.players.filter(p=>p.role==='saboteur').length,1);assert.deepEqual(Object.keys(state.requests),roster.map(p=>p.id));
 const eight=Array.from({length:8},(_,i)=>({...roster[i%4],id:'keeper-'+i}));assert.equal(createMatch({id:'eight',world:true,systems:true,roster:eight,saboteurCount:2,mode:'spectator',now:1000,seed:2}).players.filter(p=>p.role==='saboteur').length,2);
});

test('task registry is authoritative, packaged and exposes measurable progress',()=>{
 const tasks=createTaskRegistry([relayTask]);assert.throws(()=>createTaskRegistry([relayTask,relayTask]));
 const p={id:'captain',role:'crew',position:{x:1,y:1},cooldowns:{taskAt:0},tasks:[{id:'relay-1',roomId:'bridge',completed:false}]},s={rules:{taskCooldownMs:1}},events=[],ctx={nearby:()=>false,geometry:{WORLD_STATIONS:{bridge:{x:1,y:1}},WORLD:{interactionRadius:92}},record:(...args)=>events.push(args)};
 const action={type:'taskInteract',taskId:'relay-1',interactionId:'confirm',value:'complete'};assert.equal(tasks.validate(s,p,action,100,ctx).code,'INVALID_TASK');ctx.nearby=()=>true;assert.equal(tasks.validate(s,p,{...action,value:'fabricated'},100,ctx).code,'INVALID_TASK_INPUT');assert.equal(tasks.validate(s,p,action,100,ctx),null);tasks.apply(s,p,action,100,ctx);assert.deepEqual(tasks.progress(p.tasks[0]),{kind:'relay',completed:true,progress:1,total:1});assert.equal(events[0][1],'task_progress');assert.equal(tasks.validate(s,p,action,102,ctx).code,'INVALID_TASK');
});

test('ability and local-goal registries are exercised by actual safe-view engine actions',()=>{
 const state=fixture(),actor=state.players.find(p=>p.id==='signal'),a={id:'note',type:'ability',abilityId:'field-note',targetId:actor.id};
 assert.throws(()=>createAbilityRegistry([fieldNote,fieldNote]));const result=applyAction(state,actor.id,a,1001);assert(result.accepted);assert.equal(result.state.abilities[actor.id].notes.length,1);assert.deepEqual(state.abilities,{});
 assert.equal(applyAction(result.state,actor.id,a,1002).duplicate,true);assert.equal(applyAction(result.state,actor.id,{...a,targetId:'captain'},1002).error.code,'REQUEST_CONFLICT');
 const own=getPlayerView(result.state,actor.id,1002),other=getPlayerView(result.state,'captain',1002);assert.equal(own.abilities.notes.length,1);assert.deepEqual(other.abilities.notes,[]);assert.equal(getReplay(result.state),null);assert.equal(getReplaySnapshots(result.state),null);
 const goals=createGoalRegistry([{id:'known',select:view=>({target:view.self.position})}]);assert.equal(goals.select(own,{}).goalId,'known');assert.throws(()=>createGoalRegistry([{id:'bad'}]));assert.equal(localNavigationIntent(own,{x:NaN,y:0}).type,'wait');
});

test('real registered task interaction uses server range and lifetime idempotency',()=>{
 let state;for(let seed=0;seed<100;seed++){const s=createMatch({id:'task-seam',world:true,systems:true,now:1000,seed,config:{tasksPerCrew:1,taskCooldownMs:1}});if(s.players.some(p=>p.role==='crew'&&p.tasks[0]?.roomId==='bridge')){state=s;break;}}assert(state);const actor=state.players.find(p=>p.role==='crew'&&p.tasks[0].roomId==='bridge'),task=actor.tasks[0],action={id:'relay-proof',type:'taskInteract',taskId:task.id,interactionId:'confirm',value:'complete'};
 let result=applyAction(state,actor.id,action,1001);if(!result.accepted){assert.equal(result.error.code,'INVALID_TASK');const nav=applyAction(result.state,actor.id,{id:'approach-relay',type:'navigate',x:930,y:230},1002);assert(nav.accepted);state=tick(nav.state,4000).state;result=applyAction(state,actor.id,{...action,id:'relay-proof-after-approach'},4001);}
 assert(result.accepted);const completed=result.state.players.find(p=>p.id===actor.id).tasks.find(t=>t.id===task.id);assert(completed.completed);const acceptedId=result.state.requests[actor.id].find(r=>r.accepted&&r.fingerprint.includes('taskInteract')).id;const restored=JSON.parse(JSON.stringify(result.state));assert.equal(applyAction(restored,actor.id,{...action,id:acceptedId},4002).duplicate,true);
});

test('spatial snapshots remain locked until actual council ejection and preserve actual roles/events',()=>{
 let state=fixture(),now=1001;const actor=state.players[0];let result=applyAction(state,actor.id,{id:'to-bell',type:'navigate',...WORLD_BELL},now);assert(result.accepted);state=tick(result.state,now+=3000).state;result=applyAction(state,actor.id,{id:'call',type:'meeting'},now);assert(result.accepted);state=tick(result.state,now+=31).state;const sab=state.players.find(p=>p.role==='saboteur').id;for(const p of state.players){result=applyAction(state,p.id,{id:'vote-'+p.id,type:'vote',targetId:sab},now);assert(result.accepted);state=result.state;}state=tick(state,now+=21).state;assert.equal(state.phase,'ended');assert.equal(state.outcome.winner,'crew');const events=getReplay(state),snaps=getReplaySnapshots(state);assert(events.some(e=>e.type==='role_reveal'));assert(snaps.length>=2);assert(snaps.every(s=>s.players.length===4));assert(snaps.every((s,i)=>!i||s.at>=snaps[i-1].at));const original=snaps[0].players[0].position.x;snaps[0].players[0].position.x=99999;assert.equal(getReplaySnapshots(state)[0].players[0].position.x,original);
});

test('HTTP custom seat authorization survives restart without replacing identity action IDs or budgets',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'beacon-http-'));let server,now=1000,origin='http://beacon.test';const aiController={describe:()=>({mode:'demo',provider:'demo',calls:0,tokens:0,costUsd:0}),async decide(){return null;}};
 const config={publicOrigin:origin,dataDir:dir,now:()=>now,worldMode:true,systemsMode:true,lobbyConfig:{roster,humanPlayerIds:['signal']},tickMs:10000,ai:{provider:'demo',maxDailyCostUsd:0}};
 async function start(){server=await createGameServer(config,{aiController});await new Promise(resolve=>server.server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.server.address().port;}let base=await start();t.after(async()=>{await server?.close();await rm(dir,{recursive:true,force:true});});
 async function api(route,method='GET',data,cookie){const response=await fetch(base+route,{method,headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:response.status,value:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const created=await api('/api/rooms','POST',{mode:'human'});assert.equal(created.status,201);assert.equal(created.value.seatId,'signal');assert.equal(created.value.roster.length,4);const route='/api/rooms/'+created.value.roomId,cookie=created.cookie;
 const started=await api(route+'/start','POST',{id:'start'},cookie);assert.equal(started.status,200);assert.equal(started.value.game.beaconVersion,1);assert.equal(started.value.game.self.id,'signal');assert(started.value.game.players.every(p=>!Object.hasOwn(p,'role')));assert.equal(started.value.game.systems.transit,undefined);
 const note=await api(route+'/action','POST',{id:'location-note',type:'ability',abilityId:'field-note',targetId:'signal'},cookie);assert.equal(note.status,200);
 const input=await api(route+'/input','POST',{seq:1,dx:1,dy:0},cookie);assert.equal(input.status,200);now+=200;const stopped=await api(route+'/input','POST',{seq:2,dx:0,dy:0},cookie);assert.equal(stopped.status,200);
 const joined=await api(route+'/join','POST',{});assert.equal(joined.value.seatId,null);assert.equal((await api(route+'/input','POST',{seq:9,dx:1,dy:0},joined.cookie)).status,403);assert.equal((await api(route+'/action','POST',{id:'steal',type:'ability',abilityId:'field-note',targetId:'signal'},joined.cookie)).status,403);
 await server.close();base=await start();const restored=await api(route,'GET',null,cookie);assert.equal(restored.status,200);assert.equal(restored.value.seatId,'signal');assert.equal(restored.value.game.self.inputSeq,2);assert.equal(restored.value.game.abilities.notes.length,1);
 const retry=await api(route+'/action','POST',{id:'location-note',type:'ability',abilityId:'field-note',targetId:'signal'},cookie);assert.equal(retry.status,200);assert.equal(retry.value.game.abilities.notes.length,1);assert.equal((await api(route+'/replay','GET',null,cookie)).status,409);assert.equal(restored.value.ai.calls,0);
});
