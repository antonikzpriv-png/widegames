import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';

// Explicit opt-in keeps this branch's older runtime separate from the manager audit.
const root=process.env.TRANSPORT_AUDIT_ROOT;
const options={skip:root?false:'Set TRANSPORT_AUDIT_ROOT to the manager module file URL; audit is read-only.'};
const origin='http://lantern.audit';
async function until(check){for(let i=0;i<200;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('Audit condition timed out');}
async function fixture(t,overrides={},aiController={describe:()=>({mode:'demo',provider:'stub'}),decide:async()=>null}) {
  const parent=path.resolve(process.env.TRANSPORT_TEST_TEMP||'../temp');await mkdir(parent,{recursive:true});const directory=await mkdtemp(path.join(parent,'transport-lock-audit-'));
  const {createGameServer}=await import(new URL('server/transport.mjs',root));
  const actualEngine=await import(new URL('server/engine/index.mjs',root)),errors=[];
  const engine={...actualEngine,applyAction(...args){try{return actualEngine.applyAction(...args);}catch(error){errors.push({operation:'applyAction',message:error.message});throw error;}}};
  const config={dataDir:directory,publicOrigin:origin,tickMs:20,maxActiveRooms:12,roomTtlMs:3600000,ai:{provider:'demo',maxDailyCostUsd:.05,decisionIntervalMs:100},...overrides};
  const {createRoomStore}=await import(new URL('server/store.mjs',root));
  const launch=async()=>{const backing=await createRoomStore(directory);const store={...backing,async save(room){try{return await backing.save(room);}catch(error){errors.push({operation:'save',message:error.message});throw error;}}};return createGameServer(config,{aiController,engine,store});};
  let game=await launch(),base;
  const listen=async()=>{game.server.listen(0,'127.0.0.1');await once(game.server,'listening');base=`http://127.0.0.1:${game.server.address().port}`;};await listen();
  t.after(async()=>{await game.close();assert(directory.startsWith(parent+path.sep));await rm(directory,{recursive:true,force:true});});
  async function request(route,{method='GET',data,cookie}={}){
    const res=await fetch(base+route,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  const create=async(mode='human')=>request('/api/rooms',{method:'POST',data:{mode}});
  const saved=id=>readFile(path.join(directory,`room-${id}.json`),'utf8').then(JSON.parse);
  return {directory,config,request,create,saved,errors,get game(){return game;},async restart(){await game.close();game=await launch();await listen();}};
}

test('manager audit: deployment budget bounds independent rooms before simulated send and after restart',options,async t=>{
  let attempted=0,sends=0,denied=0,f;
  const ai={describe:()=>({mode:'demo',provider:'stub'}),async decide({view,context,commitReservation}){
    if(context.attempted)return null;context.attempted=true;context.pending={id:`request-${view.matchId}`,amountUsd:.04};attempted++;
    try {await commitReservation(context.pending);const disk=await f.saved(view.matchId);assert.equal(disk.aiContext.pending.id,context.pending.id);sends++;}
    catch(error){assert.match(error.message,/budget exhausted/);denied++;}return null;
  }};
  f=await fixture(t,{},ai);const rooms=await Promise.all([f.create('spectator'),f.create('spectator')]);
  await Promise.all(rooms.map(host=>f.request(`/api/rooms/${host.body.roomId}/start`,{method:'POST',cookie:host.cookie,data:{id:'start'}})));
  await until(()=>sends+denied===2);assert.equal(attempted,2);assert.equal(sends,1);assert.equal(denied,1);await f.game.close();assert.deepEqual(f.errors,[]);
  const ledger=JSON.parse(await readFile(path.join(f.directory,'ai-daily-budget.json'),'utf8'));assert.equal(ledger.total,.04);assert.equal(Object.keys(ledger.reservations).length,1);
  for(const room of rooms)assert((await f.saved(room.body.roomId)).aiContext.pending);
  await f.restart();assert.equal(sends,1);assert.equal(attempted,2);await f.game.close();
  const {createDailyBudget}=await import(new URL('server/budget.mjs',root));const restored=await createDailyBudget({directory:f.directory,maxCostUsd:.05});assert.equal(restored.status().reservedUsd,.04);await assert.rejects(restored.reserve({id:'after-restart',amount:.04}),/exhausted/);
});

test('manager audit: HTTP rule denials and elapsed deadlines persist through restart',options,async t=>{
  let now=100000;
  const f=await fixture(t,{now:()=>now,tickMs:60000,rules:{roamDeadlineMs:100,discussionMs:1000}}),host=await f.create(),id=host.body.roomId,route=`/api/rooms/${id}`;
  await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'s'}});
  const invalid={id:'retained-rule-denial',type:'move',roomId:'engine'};const first=await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:invalid});assert.equal(first.status,409);assert.equal(first.body.error.code,'INVALID_ROOM');
  assert((await f.saved(id)).state.requests.p1.some(row=>row.id===invalid.id&&!row.accepted));
  now+=101;const deadlineAction={id:'retained-deadline-denial',type:'move',roomId:'archive'};const denied=await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:deadlineAction});assert.equal(denied.status,409);assert.equal(denied.body.error.code,'WRONG_PHASE');
  const saved=await f.saved(id);assert.equal(saved.state.phase,'discussion');assert(saved.state.requests.p1.some(row=>row.id===deadlineAction.id&&!row.accepted));
  await f.restart();assert.equal((await f.request(route,{cookie:host.cookie})).body.phase,'discussion');
  const repeated=await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:invalid});assert.equal(repeated.body.error.code,'INVALID_ROOM');
  const conflict=await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:{id:invalid.id,type:'wait'}});assert.equal(conflict.body.error.code,'REQUEST_CONFLICT');
});

test('manager audit: AI proposal denial retains request and deadline state on disk',options,async t=>{
  let now=100000;
  const ai={describe:()=>({mode:'demo',provider:'stub'}),async decide({context}){if(context.proposed)return null;context.proposed=true;now+=101;return {id:'retained-ai-denial',type:'move',roomId:'archive'};}};
  const f=await fixture(t,{now:()=>now,rules:{roamDeadlineMs:100,discussionMs:10000}},ai),host=await f.create('spectator'),id=host.body.roomId;
  await f.request(`/api/rooms/${id}/start`,{method:'POST',cookie:host.cookie,data:{id:'s'}});
  try{await until(()=>Object.values(f.game.rooms.get(id).data.state.requests).some(rows=>rows.some(row=>row.id==='retained-ai-denial')));}catch(error){const room=f.game.rooms.get(id);throw new Error(JSON.stringify({error:error.message,phase:room.data.state.phase,aiBlocked:room.aiBlocked,context:room.data.aiContext,errors:f.errors,requestIds:Object.values(room.data.state.requests).flat().map(row=>row.id),now}));}
  await f.game.close();assert.deepEqual(f.errors,[]);
  const saved=await f.saved(id),denial=Object.values(saved.state.requests).flat().find(row=>row.id==='retained-ai-denial');assert.equal(denial.accepted,false);assert.equal(denial.error.code,'WRONG_PHASE');assert.equal(saved.state.phase,'discussion');
  await f.restart();const restored=f.game.rooms.get(id).data;assert(Object.values(restored.state.requests).flat().some(row=>row.id==='retained-ai-denial'&&!row.accepted));
});
