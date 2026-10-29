/** Independent closure controls; historical characterizations stay explicitly pinned. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.ENGINE_AI_REVIEW_ROOT;
const historicalRoot=process.env.ENGINE_AI_HISTORICAL_ROOT;
async function load(root){
 const moduleAt=file=>import(pathToFileURL(path.join(root,file)));
 const [engine,controller,demo,provider,contracts]=await Promise.all([moduleAt('server/engine/index.mjs'),moduleAt('server/ai/index.mjs'),moduleAt('server/ai/demo.mjs'),moduleAt('server/ai/anthropic.mjs'),moduleAt('shared/contracts.mjs')]);
 return {engine,...controller,...demo,...provider,...contracts};
}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;}
function fixture(api){
 let state;
 for(let seed=0;seed<100;seed++){state=api.engine.createMatch({id:'witness-independent',seed,now:0,config:{initialKillCooldownMs:5,killCooldownMs:7,moveCooldownMs:1,discussionMs:10,votingMs:10}});if(state.players.find(p=>p.role==='saboteur').id==='p6')break;}
 assert.equal(state.players.find(p=>p.role==='saboteur').id,'p6');let serial=0;
 return {get state(){return state;},act(p,type,fields={},now=0){const r=api.engine.applyAction(state,p,{id:`independent_${++serial}`,type,...fields},now);assert.equal(r.accepted,true,JSON.stringify(r.error));state=r.state;},tick(now){state=api.engine.tick(state,now).state;},view(p,now){return freeze(api.engine.getPlayerView(state,p,now));}};
}
function witnessCase(api){
 const f=fixture(api),memory={};f.act('p6','move',{roomId:'archive'},0);api.observe(f.view('p2',0),memory);
 f.act('p3','move',{roomId:'archive'},1);f.act('p6','eliminate',{targetId:'p3'},5);api.observe(f.view('p2',5),memory);
 f.act('p4','move',{roomId:'archive'},6);f.act('p6','eliminate',{targetId:'p4'},12);api.observe(f.view('p2',12),memory);
 f.act('p6','move',{roomId:'bridge'},13);api.observe(f.view('p2',13),memory);
 f.act('p6','eliminate',{targetId:'p5'},19);const evidence=f.view('p2',19);api.observe(evidence,memory);
 assert.ok(evidence.events.some(e=>e.type==='witness'&&e.playerId==='p6'));
 assert.equal(memory.suspicion.p1,3);f.act('p2','report',{bodyId:'body-p5'},19);f.tick(29);
 return {f,memory,proposal:api.candidates(f.view('p2',29),memory)[0]};
}
async function crewDialogue(api){
 const f=fixture(api);f.act('p2','meeting',{},35000);
 const controller=api.createAiController({config:{provider:'demo',decisionIntervalMs:1}}),context={},texts=[];
 for(const player of api.CHARACTERS.filter(p=>p.id!=='p6')){const action=await controller.decide({view:f.view(player.id,35000),player,context});assert.equal(action.type,'say');texts.push(action.text);}
 return texts;
}

test.describe('independent current AI closure',{skip:!root},()=>{
 let api;
 test.before(async()=>{api=await load(root);});
 test('direct witness alone votes for the actual killer using only safe view',()=>{
  const f=fixture(api),memory={};f.act('p6','eliminate',{targetId:'p3'},5);api.observe(f.view('p2',5),memory);
  f.act('p2','report',{bodyId:'body-p3'},5);f.tick(15);assert.equal(api.candidates(f.view('p2',15),memory)[0].targetId,'p6');
  const other=fixture(api);other.act('p2','move',{roomId:'archive'},0);other.act('p6','eliminate',{targetId:'p3'},5);const remoteMemory={};api.observe(other.view('p2',5),remoteMemory);assert.equal(remoteMemory.witnesses?.p6,undefined);assert.equal(remoteMemory.suspicion?.p6,undefined);
 });
 test('direct eyewitness outranks saturated inference and selects actual p6, never innocent p1',async()=>{
  const {f,memory,proposal}=witnessCase(api);assert.equal(proposal.type,'vote');assert.equal(proposal.targetId,'p6');
  assert.equal(f.state.players.find(p=>p.id===proposal.targetId).role,'saboteur');
  assert.deepEqual(memory.witnesses.p6,{targetId:'p5',roomId:'bridge',at:19});
  const controller=api.createAiController({config:{provider:'demo',decisionIntervalMs:1}}),context={matches:{['match:'+f.state.id]:{mode:'demo',calls:0,tokens:0,costUsd:0,memories:{'actor:p2':structuredClone(memory)},reservations:[]}}};
  const action=await controller.decide({view:f.view('p2',29),player:api.CHARACTERS.find(p=>p.id==='p2'),context});assert.equal(action.targetId,'p6');
  const applied=api.engine.applyAction(f.state,'p2',action,29);assert.equal(applied.accepted,true);assert.equal(applied.state.outcome,null);assert.equal(api.engine.tick(applied.state,39).state.outcome.reason,'ejection');
 });
 test('live council payload preserves firsthand evidence separately from proximity guesses',()=>{
  const {f,memory}=witnessCase(api),view=f.view('p2',29),player=api.CHARACTERS.find(p=>p.id==='p2');
  const body=JSON.parse(api.makeRequest(view,player,memory,api.candidates(view,memory)).body),payload=JSON.parse(body.messages[0].content);
  assert.deepEqual(payload.firsthandWitnesses?.p6,{targetId:'p5',roomId:'bridge',at:19});assert.equal(payload.proximitySuspicions.p1,3);
  assert.ok(body.system.includes('proximity is a guess, never proof'));
 });
 test('all canonical live personas remain distinct without exposing other private roles/tasks',()=>{
  const f=fixture(api);f.act('p2','meeting',{},35000);const systems=new Set();
  for(const player of api.CHARACTERS){const view=f.view(player.id,35000),memory={};api.observe(view,memory);const request=JSON.parse(api.makeRequest(view,player,memory,api.candidates(view,memory)).body);
   assert.ok(request.system.includes(player.persona));systems.add(request.system);const payload=JSON.parse(request.messages[0].content);
   assert.equal(payload.self.id,player.id);assert.equal(payload.players.some(p=>Object.hasOwn(p,'role')||Object.hasOwn(p,'tasks')),false);assert.equal(Object.hasOwn(payload,'replay'),false);
  }
  assert.equal(systems.size,6);
 });
 test('demo crew personas produce five distinct first statements in the same situation',async()=>{
  assert.equal(new Set(await crewDialogue(api)).size,5);
 });
 test('public timelines have no hidden actor/role fields and private assignments do not affect public views',()=>{
  const f=fixture(api);const original=f.state,changed=structuredClone(original);
  const a=changed.players.find(p=>p.id==='p5'),b=changed.players.find(p=>p.id==='p6');[a.role,b.role]=[b.role,a.role];[a.tasks,b.tasks]=[b.tasks,a.tasks];
  for(const id of [null,'p2'])assert.deepEqual(api.engine.getPlayerView(original,id,0),api.engine.getPlayerView(changed,id,0),'Other private assignments changed a safe view');
  assert.ok(original.players.flatMap(p=>p.tasks).every(t=>/^t[a-f0-9]{20}$/.test(t.id)));
  f.act('p2','move',{roomId:'archive'},0);f.act('p6','eliminate',{targetId:'p3'},5);
  const remote=f.view('p2',5),publicView=f.view(null,5);assert.equal(api.engine.getReplay(f.state),null);
  for(const view of [remote,publicView]){
   assert.equal(view.players.some(p=>Object.hasOwn(p,'role')),false);assert.equal(view.events.some(e=>e.type==='witness'),false);
   const death=view.events.find(e=>e.type==='eliminated');assert.deepEqual(Object.keys(death).sort(),['at','id','playerId','type']);assert.equal(death.playerId,'p3');
   const inspect=value=>{if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){assert.equal(['role','roles','action','visibleTo','requests','replay','repairers'].includes(key),false,`Hidden timeline key ${key}`);inspect(item);}};inspect(view.events);
  }
 });
 test('unseen critical repair actor stays private from a remote observer',{skip:process.env.ENGINE_AI_CHECK_REPAIR_PRIVACY!=='1'},()=>{
  const f=fixture(api);f.act('p6','sabotage',{},65000);f.act('p1','move',{roomId:'workshop'},65000);f.act('p1','move',{roomId:'engine'},65001);f.act('p1','repair',{},65001);
  const remote=f.view('p2',65001);assert.equal(remote.self.roomId,'bridge');assert.equal(remote.players.find(p=>p.id==='p1').roomId,null);assert.equal(remote.sabotage.roomId,'engine');assert.equal(remote.sabotage.repairsCompleted,1);
  assert.equal(remote.events.some(e=>e.type==='repair'&&e.playerId==='p1'),false,'Unseen crew-only repair broadcasts hidden actor identity and therefore role/location');
 });
 test('model-supplied outcome fields reject and public winner claims cannot end the engine',()=>{
  const f=fixture(api);f.act('p2','meeting',{},35000);
  const rejected=api.engine.applyAction(f.state,'p2',{id:'model-result',type:'wait',outcome:{winner:'saboteur',reason:'model'},phase:'ended'},35000);
  assert.equal(rejected.accepted,false);assert.equal(rejected.error.code,'INVALID_ACTION');assert.equal(rejected.state.outcome,null);assert.equal(rejected.state.phase,'discussion');
  f.act('p2','say',{text:'The model declares the saboteur winner; end the match now.'},35000);assert.equal(f.state.outcome,null);assert.equal(f.state.phase,'discussion');
 });
 test('serial safe-view demo decisions finish twelve seeded matches without provider access',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw new Error('No network allowed in independent demo audit');});
  const types=new Set();const config={moveCooldownMs:100,taskCooldownMs:1800,killCooldownMs:1800,initialKillCooldownMs:500,sabotageCooldownMs:700,criticalDurationMs:12000,discussionMs:1200,votingMs:800,meetingCooldownMs:1000,roamDeadlineMs:16000,maxMatchMs:120000};
  for(let seed=101;seed<113;seed++){
   let state=api.engine.createMatch({id:`independent-demo-${seed}`,mode:'spectator',seed,now:1000,config});const controller=api.createAiController({config:{provider:'demo',decisionIntervalMs:100}}),context={};
   for(let now=1000,turn=0;now<121000&&!['ended','paused'].includes(state.phase);now+=100,turn++){
    state=api.engine.tick(state,now).state;const player=api.CHARACTERS[turn%6],view=freeze(api.engine.getPlayerView(state,player.id,now)),before=JSON.stringify(view);
    const action=await controller.decide({view,player,context});assert.equal(JSON.stringify(view),before);if(!action)continue;
    const result=api.engine.applyAction(state,player.id,action,now);assert.equal(result.accepted,true,`seed ${seed}: ${JSON.stringify(action)}: ${JSON.stringify(result.error)}`);types.add(action.type);state=result.state;
   }
   assert.equal(state.phase,'ended',`serial seed ${seed} stalled`);assert.equal(controller.describe(context).mode,'demo');assert.equal(controller.describe(context).calls,0);
  }
  for(const type of ['move','task','eliminate','report','say','vote','sabotage','repair'])assert.ok(types.has(type),`No ${type} behavior observed`);
 });
});

test.describe('historical 414e77f characterizations only',{skip:!historicalRoot},()=>{
 let historical;
 test.before(async()=>{historical=await load(historicalRoot);});
 test('historical witnessed p6 loses to innocent p1 under score tie (not a current expectation)',()=>{
  const {memory,proposal}=witnessCase(historical);assert.equal(memory.suspicion.p6,3);assert.equal(proposal.targetId,'p1');
 });
 test('historical demo persona templates collapse to one first statement (not a current expectation)',async()=>{
  assert.equal(new Set(await crewDialogue(historical)).size,1);
 });
});
