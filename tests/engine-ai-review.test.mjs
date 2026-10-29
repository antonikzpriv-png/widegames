/** Offline independent controls and characterized limitations of committed AI. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.ENGINE_AI_REVIEW_ROOT;
test.describe('independent committed AI review',{skip:!root},()=>{
 let engine,createAiController,observe,candidates,makeRequest,CHARACTERS;
 test.before(async()=>{
  engine=await import(pathToFileURL(path.join(root,'server/engine/index.mjs')));
  ({createAiController}=await import(pathToFileURL(path.join(root,'server/ai/index.mjs'))));
  ({observe,candidates}=await import(pathToFileURL(path.join(root,'server/ai/demo.mjs'))));
  ({makeRequest}=await import(pathToFileURL(path.join(root,'server/ai/anthropic.mjs'))));
  ({CHARACTERS}=await import(pathToFileURL(path.join(root,'shared/contracts.mjs'))));
 });
 function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;}
 function fixture(){
  let state;
  for(let seed=0;seed<100;seed++){state=engine.createMatch({id:'witness-independent',seed,now:0,config:{initialKillCooldownMs:5,killCooldownMs:7,moveCooldownMs:1,discussionMs:10,votingMs:10}});if(state.players.find(p=>p.role==='saboteur').id==='p6')break;}
  assert.equal(state.players.find(p=>p.role==='saboteur').id,'p6');let serial=0;
  return {get state(){return state;},act(p,type,fields={},now=0){const r=engine.applyAction(state,p,{id:`independent_${++serial}`,type,...fields},now);assert.equal(r.accepted,true,JSON.stringify(r.error));state=r.state;},tick(now){state=engine.tick(state,now).state;},view(p,now){return freeze(engine.getPlayerView(state,p,now));}};
 }
 test('direct witness alone votes for the actual killer using only safe view',()=>{
  const f=fixture(),memory={};f.act('p6','eliminate',{targetId:'p3'},5);observe(f.view('p2',5),memory);
  assert.equal(memory.suspicion.p6,3);f.act('p2','report',{bodyId:'body-p3'},5);f.tick(15);
  assert.equal(candidates(f.view('p2',15),memory)[0].targetId,'p6');
  const other=fixture();other.act('p2','move',{roomId:'archive'},0);other.act('p6','eliminate',{targetId:'p3'},5);const remoteMemory={};observe(other.view('p2',5),remoteMemory);assert.equal(remoteMemory.suspicion?.p6,undefined);
 });
 test('characterize witness counterexample: inferred suspicion ties direct evidence and chooses innocent',()=>{
  const f=fixture(),memory={};f.act('p6','move',{roomId:'archive'},0);observe(f.view('p2',0),memory);
  f.act('p3','move',{roomId:'archive'},1);f.act('p6','eliminate',{targetId:'p3'},5);observe(f.view('p2',5),memory);
  f.act('p4','move',{roomId:'archive'},6);f.act('p6','eliminate',{targetId:'p4'},12);observe(f.view('p2',12),memory);
  f.act('p6','move',{roomId:'bridge'},13);observe(f.view('p2',13),memory);
  f.act('p6','eliminate',{targetId:'p5'},19);const actualView=f.view('p2',19);observe(actualView,memory);
  assert.ok(actualView.events.some(e=>e.type==='witness'&&e.playerId==='p6'));
  assert.equal(memory.suspicion.p1,3);assert.equal(memory.suspicion.p6,3);
  f.act('p2','report',{bodyId:'body-p5'},19);f.tick(29);
  const proposal=candidates(f.view('p2',29),memory)[0];assert.equal(proposal.type,'vote');
  assert.equal(proposal.targetId,'p1','Characterized defect: innocent wins the score tie over witnessed p6');
  assert.equal(f.state.players.find(p=>p.id===proposal.targetId).role,'crew');
 });
 test('live prompts carry distinct canonical personas without exposing private engine state',()=>{
  const f=fixture();f.act('p2','meeting',{},35000);const systems=new Set();
  for(const player of CHARACTERS){const view=f.view(player.id,35000),memory={};observe(view,memory);const choices=candidates(view,memory);const request=JSON.parse(makeRequest(view,player,memory,choices).body);
   assert.ok(request.system.includes(player.persona));systems.add(request.system);
   const payload=JSON.parse(request.messages[0].content);assert.equal(payload.self.id,player.id);assert.equal(payload.players.some(p=>Object.hasOwn(p,'role')||Object.hasOwn(p,'tasks')),false);assert.equal(Object.hasOwn(payload,'replay'),false);
  }
  assert.equal(systems.size,6);
 });
 test('characterize demo persona limitation: every crew member starts with the same dialogue template',async()=>{
  const f=fixture();f.act('p2','meeting',{},35000);const controller=createAiController({config:{provider:'demo',decisionIntervalMs:1}}),context={},texts=[];
  for(const player of CHARACTERS.filter(p=>p.id!=='p6')){const action=await controller.decide({view:f.view(player.id,35000),player,context});assert.equal(action.type,'say');texts.push(action.text);}
  assert.equal(new Set(texts).size,1,'Current demo has role-based dialogue, not character-persona dialogue');
 });
 test('serial safe-view demo decisions finish seeded matches, preserve views and never contact a provider',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw new Error('No network allowed in independent demo audit');});
  const types=new Set(),reasons=new Set();
  const config={moveCooldownMs:100,taskCooldownMs:1800,killCooldownMs:1800,initialKillCooldownMs:500,sabotageCooldownMs:700,criticalDurationMs:12000,discussionMs:1200,votingMs:800,meetingCooldownMs:1000,roamDeadlineMs:16000,maxMatchMs:120000};
  for(let seed=101;seed<113;seed++){
   let state=engine.createMatch({id:`independent-demo-${seed}`,mode:'spectator',seed,now:1000,config});const controller=createAiController({config:{provider:'demo',decisionIntervalMs:100}}),context={};
   // One actor acts each 100 ms, approximating serialized transport rather than six simultaneous actors.
   for(let now=1000,turn=0;now<121000&&!['ended','paused'].includes(state.phase);now+=100,turn++){
    state=engine.tick(state,now).state;const player=CHARACTERS[turn%6],view=freeze(engine.getPlayerView(state,player.id,now)),before=JSON.stringify(view);
    const action=await controller.decide({view,player,context});assert.equal(JSON.stringify(view),before);
    if(!action)continue;const result=engine.applyAction(state,player.id,action,now);assert.equal(result.accepted,true,`seed ${seed}: ${JSON.stringify(action)}: ${JSON.stringify(result.error)}`);types.add(action.type);state=result.state;
   }
   assert.equal(state.phase,'ended',`serial seed ${seed} stalled`);reasons.add(state.outcome.reason);assert.equal(controller.describe(context).mode,'demo');assert.equal(controller.describe(context).calls,0);
  }
  for(const type of ['move','task','eliminate','report','say','vote','sabotage','repair'])assert.ok(types.has(type),`No ${type} behavior observed`);
  assert.ok(reasons.size>=1);
 });
});
