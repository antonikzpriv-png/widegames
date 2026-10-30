import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../server/engine/index.mjs';
import { WORLD_STATIONS, WORLD, distance, canSeeWorldPoint } from '../shared/world.mjs';
import { install, execute, intentions, remember } from '../server/ai/strategic.mjs';
import { makeRequest } from '../server/ai/anthropic.mjs';
import { createAiController } from '../server/ai/index.mjs';
import { CHARACTERS } from '../shared/contracts.mjs';
const c = extra => createAiController({config:{provider:'anthropic',apiKey:'offline',strategy:'strategic',maxTokens:250000,decisionIntervalMs:100,...extra}});
const response = choice => new Response(JSON.stringify({stop_reason:'tool_use',content:[{type:'tool_use',name:'pick_action',input:{choice}}],usage:{input_tokens:100,output_tokens:20}}));
function fixture(){const state=engine.createMatch({id:'audit',mode:'spectator',world:true,now:1000,seed:1});const player=CHARACTERS.find(p=>p.id===state.players.find(p=>p.role==='crew').id);return {state,player,view:engine.getPlayerView(state,player.id,1000)};}

test('all thirty station routes survive real wall detours without false failure or route resets',{timeout:30000},()=>{
 let id=0,detours=0;
 for(const [from,start] of Object.entries(WORLD_STATIONS))for(const [roomId,target] of Object.entries(WORLD_STATIONS)){
  if(from===roomId)continue;
  let {state,player}=fixture();
  const stage=engine.applyAction(state,player.id,{id:'stage',type:'navigate',...start},1000);assert(stage.accepted);state=engine.tick(stage.state,15000).state;
  assert(distance(state.players.find(p=>p.id===player.id).position,start)<1);
  const m={};install(m,{type:'intend',goal:'position',roomId},engine.getPlayerView(state,player.id,15000));
  let arrived=false,navigations=0,previous=distance(start,target);
  for(let now=15000;now<44000;now+=100){
   state=engine.tick(state,now).state;const view=engine.getPlayerView(state,player.id,now);const a=execute(view,m);
   assert(a,`${from} -> ${roomId}: false failure at ${now}`);
   const remaining=distance(view.self.position,target);if(remaining>previous+.1)detours++;previous=remaining;
   if(remaining<=WORLD.interactionRadius){arrived=true;break;}
   if(a.type==='navigate')navigations++;
   const applied=engine.applyAction(state,player.id,{...a,id:'audit_'+id++},now);assert(applied.accepted,JSON.stringify(applied.error));state=applied.state;
  }
  assert(arrived,`${from} -> ${roomId} failed to arrive`);assert.equal(navigations,1,'valid routes continue locally');
 }
 assert(detours>0,'the regression must actually traverse moves away from its goal');
});

test('every positional intention executes through legal engine navigation and waiting',()=>{
 for(const goal of ['position','alibi','investigate','fake_work']){
  let {state,view,player}=fixture();const m={};install(m,{type:'intend',goal,roomId:'engine',observedAt:500},view);
  const a=execute(view,m);assert.equal(a.type,'navigate');let applied=engine.applyAction(state,player.id,{...a,id:goal},1000);assert(applied.accepted);state=engine.tick(applied.state,14000).state;
  const arrived=engine.getPlayerView(state,player.id,14000);assert.equal(execute(arrived,m).type,'wait');
  assert.equal(state.players.flatMap(p=>p.tasks).filter(t=>t.completed).length,0);
 }
});

test('follow refreshes only visible coordinates; avoidance increases separation; stall failures are time bounded',()=>{
 const {view}=fixture(),m={};const p=view.players.find(p=>p.id!==view.self.id);p.position={x:view.self.position.x+20,y:view.self.position.y};p.alive=true;
 assert(canSeeWorldPoint(view.self.position,p.position));
 install(m,{type:'intend',goal:'avoid',targetId:p.id},view);const away=execute(view,m);assert.equal(away.type,'navigate');assert(distance(away,p.position)>distance(view.self.position,p.position));
 install(m,{type:'intend',goal:'follow',targetId:p.id},view);assert.equal(execute(view,m).type,'wait');p.position=null;assert.equal(execute(view,m),null);
 install(m,{type:'intend',goal:'position',roomId:'engine'},view);
 for(let n=0;n<10;n++){view.serverNow+=10;assert(execute(view,m));}assert.equal(m.planProgress.failures,0);
 for(let n=0;n<3;n++){view.serverNow+=1000;execute(view,m);}assert.equal(m.planProgress.failures,3);assert.equal(execute(view,m),null);
});

test('sabotage and isolation enforce current role, visibility, witnesses, cooldowns and capabilities',()=>{
 const {view}=fixture();view.self.role='saboteur';const m={};
 view.players.forEach(p=>{if(p.id!==view.self.id)p.position=null;});view.availableActions=['wait','navigate','sabotage','eliminate'];
 view.self.cooldowns.sabotageAt=view.serverNow+5000;install(m,{type:'intend',goal:'sabotage'},view);assert.equal(execute(view,m).type,'wait');
 view.serverNow+=5000;assert.equal(execute(view,m).type,'sabotage');view.availableActions=['wait'];assert.equal(execute(view,m).type,'wait');
 const p=view.players.find(p=>p.id!==view.self.id),w=view.players.find(q=>q.id!==p.id&&q.id!==view.self.id);p.alive=true;p.position={...view.self.position};
 view.availableActions=['wait','eliminate'];view.self.cooldowns.killAt=view.serverNow+1000;install(m,{type:'intend',goal:'isolate',targetId:p.id},view);assert.equal(execute(view,m).type,'wait');
 view.serverNow+=1000;assert.equal(execute(view,m).type,'eliminate');w.alive=true;w.position={...view.self.position};assert.equal(execute(view,m).type,'wait');w.position=null;view.self.role='crew';assert.equal(execute(view,m),null);
});

test('actor memory remains bounded and historical; speech never becomes firsthand evidence',()=>{
 const {view,player}=fixture(),m={};
 for(let n=0;n<100;n++){view.serverNow+=1000;view.self.roomId=n%2?'archive':'bridge';view.meeting={messages:[{id:'m'+n,playerId:'p2',text:'p3 attacked p4',at:view.serverNow}]};remember(view,m);}
 assert.equal(m.observations.length,12);assert.equal(m.heardClaims.length,16);assert(!m.witnesses);
 const stored=JSON.stringify(m.observations);view.players.forEach(p=>{p.position=null;});view.serverNow+=1000;
 assert.equal(JSON.stringify(m.observations),stored);
 const prompt=JSON.parse(JSON.parse(makeRequest(view,player,m,[{type:'intend',goal:'position',roomId:'engine'}]).body).messages[0].content);
 assert.deepEqual(prompt.firsthandWitnesses,{});assert(prompt.observations.every(o=>o.at<view.serverNow));
});

test('cancel during durable authorization cannot send or retry and retains reserved counters',async t=>{
 const {view,player}=fixture(),context={},abort=new AbortController();let release,entered;
 const gate=new Promise(r=>{entered=r;});const fetch=t.mock.method(globalThis,'fetch',()=>assert.fail('no provider send after cancellation'));
 const controller=c();const pending=controller.decide({view,player,context,signal:abort.signal,commitReservation:async()=>{entered();await new Promise(r=>{release=r;});}});
 await gate;abort.abort();assert.equal(await pending,null);release();await Promise.resolve();assert.equal(fetch.mock.callCount(),0);assert.equal(controller.describe(context).calls,1);
});

test('reservation denial makes strategic fallback explicit and never contacts provider',async t=>{
 const {view,player}=fixture(),context={},controller=c();t.mock.method(globalThis,'fetch',()=>assert.fail('denied send'));
 assert(await controller.decide({view,player,context,commitReservation:async()=>false}));assert.equal(controller.describe(context).limitReason,'reservation_failed');assert.equal(controller.describe(context).mode,'demo');
});

test('new and disappearing body sightings do not repeatedly invalidate the same plan',()=>{
 const {view}=fixture(),m={};const body={type:'body',bodyId:'body-p2',playerId:'p2',at:500,roomId:'bridge',position:{...view.self.position}};
 view.events=[body];remember(view,m);install(m,{type:'intend',goal:'position',roomId:'engine'},view);
 assert(execute(view,m));view.events=[];view.serverNow+=100;remember(view,m);assert(execute(view,m));
 view.events=[body];view.serverNow+=100;remember(view,m);assert(execute(view,m));assert.equal(m.seenEvents.length,1);
 const unrelated=view.players.find(p=>p.id!==view.self.id);unrelated.alive=false;view.serverNow+=100;remember(view,m);assert(execute(view,m),'unaffected task/position routes survive unrelated deaths');
 view.sabotage={active:true,roomId:'engine',deadlineAt:100000};remember(view,m);assert.equal(execute(view,m),null,'new critical event must invalidate old assumptions');
});

test('full 24-seat permitted roster and bounded memories fit the existing hard prompt cap without truncating alternatives',()=>{
 const {view,player}=fixture(),m={};
 view.players=Array.from({length:24},(_,n)=>({id:'p'+(n+1),name:'Keeper '+n,alive:true,roomId:'bridge',position:{x:800,y:272}}));
 for(let n=0;n<100;n++){view.serverNow+=1000;view.self.roomId=n%2?'archive':'bridge';view.meeting={id:'m',messages:[{id:'m'+n,playerId:'p2',text:'Claim '.repeat(46),at:view.serverNow}]};remember(view,m);}
 m.observations=Array.from({length:12},(_,i)=>({at:view.serverNow-i*1000,roomId:'bridge',players:view.players.map(p=>({id:p.id,roomId:p.roomId,position:{...p.position}}))}));
 const choices=intentions(view,m),before=structuredClone(m);
 const request=makeRequest(view,player,m,choices),prompt=JSON.parse(JSON.parse(request.body).messages[0].content);
 assert(Buffer.byteLength(request.body)<=12000);assert.equal(prompt.players.length,24);assert.deepEqual(prompt.choices,choices);assert(choices.length>4);assert.deepEqual(m,before,'compaction cannot mutate persisted memory');
});

test('seventh-seat firsthand evidence informs a legal public accusation and ballot without promoting claims',async()=>{
 const {observe,candidates}=await import('../server/ai/demo.mjs');const {view}=fixture(),m={};
 view.players.push({id:'p7',name:'Orin',alive:true,roomId:null,position:null});view.events=[{type:'witness',playerId:'p7',targetId:'p2',roomId:'bridge',at:900}];view.phase='discussion';view.meeting={id:'m',messages:[],votes:[]};view.availableActions=['say'];observe(view,m);
 assert(m.witnesses.p7);assert.match(candidates(view,m)[0].text,/I saw Orin attack/);view.phase='voting';view.availableActions=['vote'];assert.equal(candidates(view,m)[0].targetId,'p7');
});

test('model-selected task itinerary survives task completion and restart without another call',async t=>{
 let {state,view,player}=fixture(),context={},controller=c(),restored=false,taskActions=0;
 const mock=t.mock.method(globalThis,'fetch',async(_url,options)=>{const input=JSON.parse(JSON.parse(options.body).messages[0].content);return response(input.choices.findIndex(p=>p.goal==='task_route'));});
 let selected;
 for(let now=1000;now<30000;now+=250){
  state=engine.tick(state,now).state;view=engine.getPlayerView(state,player.id,now);
  if(selected?.every(id=>view.self.tasks.find(t=>t.id===id).completed))break;
  const action=await controller.decide({view,player,context,commitReservation:async()=>{}});
  selected??=context.matches['match:audit'].memories[`actor:${player.id}`].intention.taskIds;
  if(!action)continue;const applied=engine.applyAction(state,player.id,action,now);assert(applied.accepted,JSON.stringify(applied.error));state=applied.state;
  if(action.type==='task'){
   taskActions++;if(!restored){state=JSON.parse(JSON.stringify(state));context=JSON.parse(JSON.stringify(context));controller=c();restored=true;}
  }
 }
 assert(restored);assert.equal(taskActions,selected.length);assert.equal(mock.mock.callCount(),1);
});

test('investigation visits a fixed timestamped historical observation and never tracks a hidden player',()=>{
 const {view}=fixture(),m={};const p=view.players.find(p=>p.id!==view.self.id);p.position={...view.self.position};p.roomId='bridge';p.alive=true;remember(view,m);
 const observedAt=view.serverNow,old={...p.position};p.position=null;p.roomId=null;view.serverNow+=5000;view.self.position={...WORLD_STATIONS.engine};view.self.roomId='engine';remember(view,m);
 const choice=intentions(view,m).find(c=>c.goal==='investigate'&&c.observedPlayerId===p.id);assert(choice);assert.equal(choice.observedAt,observedAt);assert.deepEqual(choice.position,old);
 install(m,choice,view);const action=execute(view,m);assert.equal(action.type,'navigate');assert.deepEqual({x:action.x,y:action.y},old);
 p.position=null;view.serverNow+=100;assert.deepEqual(execute(view,m),action);
});

test('strategic requests never read hidden getters or the supplied raw-state decoy; public labels stay distinct',async t=>{
 const {view,player}=fixture(),context={};
 for(const p of view.players.filter(p=>p.id!==view.self.id))for(const key of ['role','tasks','destination','motion','privateMemory'])Object.defineProperty(p,key,{get(){assert.fail('hidden read: '+key);}});
 t.mock.method(globalThis,'fetch',async(_url,options)=>{const raw=options.body;assert(!raw.includes('privateMemory'));assert(!raw.includes('hidden-secret'));return response(0);});
 assert(await c().decide({view,player:{id:player.id,privateMemory:'hidden-secret'},context,state:new Proxy({},{get(){assert.fail('raw state access');}}),commitReservation:async()=>{}}));
 const presentation=await import('../public/presentation.mjs'),world=await import('../public/world/model.mjs');
 for(const label of [presentation.aiLabel,world.aiLabel]){assert.match(label({mode:'live',strategy:'strategic'}),/strategic/i);assert.match(label({mode:'live',strategy:'hybrid'}),/hybrid/i);assert.match(label({mode:'demo',limitReason:'provider_unavailable'}),/demo/i);}
});

test('corrupt restored plans cannot outlive the bound or invent capabilities',()=>{
 const {view}=fixture();
 for(const corrupt of [m=>{m.intention.expiresAt=Infinity;},m=>{m.intention.expiresAt=m.intention.startedAt+30001;},m=>{m.planProgress.steps=-1;},m=>{m.intention.goal='vent';},m=>{m.intention.startedAt=view.serverNow+1;}]){
  const m={};install(m,{type:'intend',goal:'position',roomId:'engine'},view);corrupt(m);assert.equal(execute(view,m),null);
 }
 const m={observations:{broken:true},heardClaims:'broken',seenEvents:{broken:true}};remember(view,m);assert(Array.isArray(m.observations));assert(Array.isArray(m.heardClaims));assert(Array.isArray(m.seenEvents));
});

test('late provider errors cannot write fallback notices into a subsequent match context',async t=>{
 const {view,player}=fixture(),context={},controller=c();let current=view,release,started;const gate=new Promise(r=>{started=r;});let count=0;
 t.mock.method(globalThis,'fetch',async()=>{if(count++===0){started();return await new Promise(r=>{release=()=>r(new Response('',{status:503}));});}return response(0);});
 const old=controller.decide({view,player,context,getCurrentView:()=>current,commitReservation:async()=>{}});await gate;
 current={...view,matchId:'new-generation'};assert(await controller.decide({view:current,player,context,commitReservation:async()=>{}}));
 const checkpoint=structuredClone(context);release();assert.equal(await old,null);assert.deepEqual(context,checkpoint);assert.equal(count,2);
});

test('model-selected sabotage, distinct crew repairs and reporting all pass actual engine validation',async t=>{
 let state=engine.createMatch({id:'capabilities',mode:'spectator',world:true,now:1000,seed:1,config:{sabotageCooldownMs:100,criticalDurationMs:75000}}),now=1000;
 const sab=state.players.find(p=>p.role==='saboteur'),crew=state.players.filter(p=>p.role==='crew').slice(0,2),context={},controller=c();let desired='sabotage',serial=0;
 t.mock.method(globalThis,'fetch',async(_url,o)=>{const input=JSON.parse(JSON.parse(o.body).messages[0].content),choice=input.choices.findIndex(p=>p.goal===desired);assert(choice>=0,desired+' must be offered');return response(choice);});
 const apply=(player,action)=>{const result=engine.applyAction(state,player.id,{id:'capability_'+serial++,...action},now);assert(result.accepted,JSON.stringify(result.error));state=result.state;};
 const travel=player=>{apply(player,{type:'navigate',...WORLD_STATIONS.engine});now+=14000;state=engine.tick(state,now).state;};
 const decision=async player=>{const action=await controller.decide({view:engine.getPlayerView(state,player.id,now),player:CHARACTERS.find(p=>p.id===player.id),context,commitReservation:async()=>{}});assert(action);apply(player,action);return action;};
 travel(sab);assert.equal((await decision(sab)).type,'sabotage');assert(state.sabotage.active);
 travel(crew[0]);travel(crew[1]);desired='repair';assert.equal((await decision(crew[0])).type,'repair');assert.equal(state.sabotage.repairsCompleted,1);
 assert.equal((await decision(crew[1])).type,'repair');assert.equal(state.sabotage.active,false);assert.equal(state.sabotage.repairsCompleted,2);
 apply(sab,{type:'eliminate',targetId:crew[0].id});desired='report';now+=100;assert.equal((await decision(crew[1])).type,'report');assert.equal(state.phase,'discussion');assert.equal(controller.describe(context).calls,4);
});

test('real saboteur model fake work only navigates and waits without completing any crew task',async t=>{
 let {state}=fixture();const sab=state.players.find(p=>p.role==='saboteur'),player=CHARACTERS.find(p=>p.id===sab.id),context={},controller=c();
 const mock=t.mock.method(globalThis,'fetch',async(_url,o)=>{const input=JSON.parse(JSON.parse(o.body).messages[0].content);return response(input.choices.findIndex(p=>p.goal==='fake_work'&&p.roomId==='archive'));});
 const types=new Set();
 for(let now=1000;now<18000;now+=250){state=engine.tick(state,now).state;const action=await controller.decide({view:engine.getPlayerView(state,player.id,now),player,context,commitReservation:async()=>{}});if(!action)continue;types.add(action.type);assert(['navigate','wait'].includes(action.type));const applied=engine.applyAction(state,player.id,action,now);assert(applied.accepted);state=applied.state;}
 assert.deepEqual([...types].sort(),['navigate','wait']);assert.equal(state.players.flatMap(p=>p.tasks).filter(t=>t.completed).length,0);assert.equal(mock.mock.callCount(),1);
});

test('strategic repair equipment persists semantic steps and waits for the authoritative diagnostic',async t=>{
 let state,player,task;
 for(let seed=0;seed<20&&!task;seed++){
  state=engine.createMatch({id:'strategic-equipment',mode:'spectator',world:true,seed,now:1000});
  const owner=state.players.find(p=>p.role==='crew'&&p.tasks.some(t=>t.roomId==='workshop'));
  if(owner){player=CHARACTERS.find(p=>p.id===owner.id);task=owner.tasks.find(t=>t.roomId==='workshop');}
 }
 assert(task);const moved=engine.applyAction(state,player.id,{id:'approach-equipment',type:'navigate',...WORLD_STATIONS.workshop},1000);assert(moved.accepted);state=engine.tick(moved.state,15000).state;
 let controller=c(),context={},restarted=false,waits=0,steps=0,completed=false;
 const mock=t.mock.method(globalThis,'fetch',async(_url,o)=>{const input=JSON.parse(JSON.parse(o.body).messages[0].content);return response(input.choices.findIndex(p=>p.goal==='task'&&p.taskId===task.id));});
 for(let now=15000;now<22000&&!completed;now+=250){
  state=engine.tick(state,now).state;const view=engine.getPlayerView(state,player.id,now),before=view.self.tasks.find(t=>t.id===task.id);
  const action=await controller.decide({view,player,context,commitReservation:async()=>{}});if(!action)continue;
  if(before.progress.index===3&&now<before.progress.readyAt){assert.equal(action.type,'wait');waits++;}
  if(action.type==='taskStep')steps++;
  if(action.type==='task'){assert.equal(before.progress.index,4);completed=true;}
  const applied=engine.applyAction(state,player.id,action,now);assert(applied.accepted,JSON.stringify(applied.error));state=applied.state;
  if(!restarted&&state.players.find(p=>p.id===player.id).tasks.find(t=>t.id===task.id).progress?.index===3){state=JSON.parse(JSON.stringify(state));context=JSON.parse(JSON.stringify(context));controller=c();restarted=true;}
 }
 assert(completed);assert(restarted);assert.equal(steps,4);assert(waits>0);assert.equal(mock.mock.callCount(),1);
});
