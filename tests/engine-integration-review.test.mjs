/** Independent review: point ENGINE_REVIEW_ROOT at an immutable git archive. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';

const root=process.env.ENGINE_REVIEW_ROOT;
// Kept opt-in so ordinary engine test runs do not depend on another owner's modules.
const review=test.describe('independent engine integration review',{skip:!root},()=>{
 let engine,createGameServer;
 test.before(async()=>{
  engine=await import(pathToFileURL(path.join(root,'server/engine/index.mjs')));
  ({createGameServer}=await import(pathToFileURL(path.join(root,'server/transport.mjs'))));
 });
 const origin='http://engine-review.test';
 async function harness(t,{clock=()=>1000000,ai,tickMs=600000,directory}={}){
  const tempRoot=path.resolve('D:/Widegames-work/temp');
  assert.equal(path.resolve(os.tmpdir()).toLowerCase(),tempRoot.toLowerCase(),'Review TEMP/TMP must be on D:');
  const owned=!directory;directory??=await mkdtemp(path.join(tempRoot,'engine-independent-'));
  const relative=path.relative(tempRoot,directory);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
  const silent={describe:()=>({mode:'demo',provider:'demo',model:'review-stub',calls:0,tokens:0,costUsd:0}),decide:async()=>null};
  const config={host:'127.0.0.1',port:0,dataDir:directory,publicOrigin:origin,maxActiveRooms:8,roomTtlMs:3600000,maxBodyBytes:8192,ai:{provider:'demo',decisionIntervalMs:1800,maxDailyCostUsd:0},tickMs,now:clock};
  let game=await createGameServer(config,{aiController:ai??silent});
  await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));
  let base='http://127.0.0.1:'+game.server.address().port;
  t.after(async()=>{await game.close();if(owned)await rm(directory,{recursive:true,force:true});});
  return {
   get game(){return game;},directory,
   async restart(){await game.close();game=await createGameServer(config,{aiController:ai??silent});await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+game.server.address().port;},
   async request(route,input,cookie){const response=await fetch(base+route,{method:input===undefined?'GET':'POST',headers:{Origin:origin,...(input===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};},
   async disk(roomId){return JSON.parse(await readFile(path.join(directory,`room-${roomId}.json`),'utf8'));},
   async start(mode='human') {const made=await this.request('/api/rooms',{mode});assert.equal(made.status,201);const route='/api/rooms/'+made.body.roomId;assert.equal((await this.request(route+'/start',{id:'start'},made.cookie)).status,200);return {roomId:made.body.roomId,route,cookie:made.cookie};},
  };
 }
 async function until(predicate,timeout=2500){const deadline=Date.now()+timeout;while(!predicate()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(predicate(),'asynchronous condition did not complete');}

 test('actual AI-style IDs execute, duplicate, conflict, and survive JSON restoration',()=>{
  let state=engine.createMatch({id:'identity-review',seed:'independent',now:0});
  const id='ai:64aa0987cdef:12345678-abcd-1234-abcd-123456789abc',action={id,type:'move',roomId:'archive'};
  const accepted=engine.applyAction(state,'p1',action,0);assert.equal(accepted.accepted,true,JSON.stringify(accepted.error));state=JSON.parse(JSON.stringify(accepted.state));
  const dup=engine.applyAction(state,'p1',action,0);assert.equal(dup.duplicate,true);assert.equal(dup.state.version,state.version);
  assert.equal(engine.applyAction(state,'p1',{...action,roomId:'lantern'},0).error.code,'REQUEST_CONFLICT');
  assert.equal(engine.applyAction(state,'p2',{id,type:'wait'},0).accepted,true,'IDs are scoped to actors');
  for(const bad of ['', 'x'.repeat(101),'ai/x','ai.x','ai x'])assert.equal(engine.applyAction(state,'p1',{id:bad,type:'wait'},0).error.code,'INVALID_ACTION');
 });

 test('retained first movement cannot execute again after more than the former eviction window',()=>{
  let state=engine.createMatch({id:'old-id-review',seed:'independent',now:0});const first={id:'first-move',type:'move',roomId:'archive'};
  state=engine.applyAction(state,'p1',first,0).state;
  for(let i=0;i<300;i++)state=engine.applyAction(state,'p1',{id:`fill-${i}`,type:'wait'},0).state;
  state=engine.applyAction(state,'p1',{id:'return-bridge',type:'move',roomId:'bridge'},2000).state;
  const result=engine.applyAction(JSON.parse(JSON.stringify(state)),'p1',first,4000);
  assert.equal(result.duplicate,true);assert.equal(result.state.players.find(p=>p.id==='p1').roomId,'bridge');assert.equal(result.state.version,state.version);
 });

 test('exact 2048 cap rejects new IDs while preserving old success, denial, conflict and another actor',()=>{
  let state=engine.createMatch({id:'cap-review',seed:'independent',now:0});
  const first={id:'first',type:'move',roomId:'archive'},denied={id:'denied',type:'move',roomId:'engine'};
  state=engine.applyAction(state,'p1',first,0).state;
  state=engine.applyAction(state,'p1',denied,0).state;
  state=engine.applyAction(state,'p1',{id:'back',type:'move',roomId:'bridge'},2000).state;
  for(let i=3;i<2048;i++){const next=engine.applyAction(state,'p1',{id:`fill-${i}`,type:'wait'},2000);assert.equal(next.accepted,true);state=next.state;}
  state=JSON.parse(JSON.stringify(state));assert.equal(state.requests.p1.length,2048);
  const full=engine.applyAction(state,'p1',{id:'over:cap',type:'move',roomId:'archive'},4000);assert.equal(full.accepted,false);assert.equal(full.error.code,'REQUEST_LIMIT');assert.deepEqual(full.state,state);
  const repeated=engine.applyAction(state,'p1',first,4000);assert.equal(repeated.duplicate,true);assert.equal(repeated.state.players.find(p=>p.id==='p1').roomId,'bridge');assert.equal(repeated.state.version,state.version);
  const oldDenial=engine.applyAction(state,'p1',denied,4000);assert.equal(oldDenial.duplicate,true);assert.equal(oldDenial.accepted,false);assert.equal(oldDenial.error.code,'INVALID_ROOM');
  assert.equal(engine.applyAction(state,'p1',{id:'first',type:'wait'},4000).error.code,'REQUEST_CONFLICT');
  assert.equal(engine.applyAction(state,'p2',{id:'new:actor',type:'wait'},4000).accepted,true);
 });

 test('HTTP accepts the same colon namespace as the engine',async t=>{
  const h=await harness(t),room=await h.start();
  const result=await h.request(room.route+'/action',{id:'ai:transport:uuid',type:'move',roomId:'archive'},room.cookie);
  assert.equal(result.status,200);assert.equal(result.body.game.self.roomId,'archive');
 });

 test('HTTP denial durably saves its deadline transition before error and survives restart',async t=>{
  let at=1000000;const h=await harness(t,{clock:()=>at}),room=await h.start();at+=240001;
  const denied=await h.request(room.route+'/action',{id:'late-denied',type:'move',roomId:'archive'},room.cookie);
  assert.equal(denied.status,409);assert.equal(denied.body.error.code,'WRONG_PHASE');
  const disk=await h.disk(room.roomId);assert.equal(disk.state.phase,'discussion');assert.equal(disk.state.meeting.reason,'timeout');assert.equal(disk.state.deadlineAt,1270000);
  assert.equal(disk.state.requests.p1.find(r=>r.id==='late-denied').accepted,false);
  await h.restart();const duplicate=await h.request(room.route+'/action',{id:'late-denied',type:'move',roomId:'archive'},room.cookie);
  assert.equal(duplicate.status,409);assert.equal(duplicate.body.error.code,'WRONG_PHASE');
  const conflict=await h.request(room.route+'/action',{id:'late-denied',type:'wait'},room.cookie);assert.equal(conflict.body.error.code,'REQUEST_CONFLICT');
  const restored=await h.request(room.route,undefined,room.cookie);assert.equal(restored.body.game.phase,'discussion');assert.equal(restored.body.game.version,disk.state.version);
 });

 test('earliest-due scheduler serves all six under 500 ms decision/1800 ms interval pressure',async t=>{
  let at=1000000;const decisions=[];
  const ai={describe:()=>({mode:'demo',provider:'demo',calls:0,tokens:0,costUsd:0}),async decide({view,player,context}){
   assert.equal(view.self.id,player.id);assert.ok(view.players.every(p=>!Object.hasOwn(p,'role')&&!Object.hasOwn(p,'tasks')));assert.equal(Object.hasOwn(view,'replay'),false);assert.equal(Object.hasOwn(player,'role'),false);
   decisions.push(player.id);at+=500;context.turns=decisions.length;return {id:`ai_schedule_${decisions.length}`,type:'wait'};
  }};
  const h=await harness(t,{clock:()=>at,ai,tickMs:10});await h.start('spectator');await until(()=>decisions.length>=18);
  assert.deepEqual(new Set(decisions.slice(0,6)),new Set(['p1','p2','p3','p4','p5','p6']));
  for(const p of ['p1','p2','p3','p4','p5','p6'])assert.equal(decisions.slice(0,18).filter(id=>id===p).length,3);
 });

 test('AI rule denials and mutated AI context persist together with role-safe inputs',async t=>{
  let sequence=0;const ai={describe:()=>({mode:'demo',provider:'demo',calls:0,tokens:0,costUsd:0}),async decide({view,player,context}){
   assert.equal(view.self.id,player.id);assert.equal(Object.hasOwn(player,'role'),false);context.reviewOnlyMemory='private-review-memory';
   return {id:`ai_deny_${++sequence}`,type:'move',roomId:'engine'};
  }};
  const h=await harness(t,{ai,tickMs:10}),room=await h.start('spectator');await until(()=>[...h.game.rooms.values()][0].data.aiContext.reviewOnlyMemory==='private-review-memory');
  const disk=await h.disk(room.roomId),requests=Object.values(disk.state.requests).flat();
  assert.ok(requests.some(r=>r.id.startsWith('ai_deny_')&&!r.accepted&&r.error.code==='INVALID_ROOM'));
  assert.equal(disk.aiContext.reviewOnlyMemory,'private-review-memory');
  const publicView=await h.request(room.route,undefined,room.cookie);assert.equal(JSON.stringify(publicView.body).includes('private-review-memory'),false);
 });
});
