import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createGameServer} from '../server/transport.mjs';
import {createRoomStore} from '../server/store.mjs';
const engine=await import(process.env.TRANSPORT_TEST_ENGINE||'../server/engine/index.mjs');
const origin='http://lantern.test';
const aiController={describe:()=>({mode:'demo',provider:'demo',calls:0,tokens:0,costUsd:0}),decide:async()=>null};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let n=0;n<100;n++){if(await check())return;await delay(10);}throw new Error('Condition timed out');}
async function fixture(t,overrides={},dependencies={}) {
  const directory=await mkdtemp(path.resolve(process.env.TRANSPORT_TEST_TEMP||'../temp','transport-'));
  const config={dataDir:directory,publicOrigin:origin,maxActiveRooms:12,roomTtlMs:3600000,maxBodyBytes:8192,tickMs:20,ai:{provider:'demo',decisionIntervalMs:60000,maxDailyCostUsd:5},...overrides};
  let game=await createGameServer(config,{engine,aiController,...dependencies});
  const listen=async()=>{game.server.listen(0,'127.0.0.1');await once(game.server,'listening');return `http://127.0.0.1:${game.server.address().port}`;};
  let base=await listen();
  t.after(async()=>{await game.close();await rm(directory,{recursive:true,force:true});});
  async function request(route,{method='GET',data,cookie,headers={},raw}={}) {
    const response=await fetch(base+route,{method,headers:{Origin:origin,...(data!==undefined||raw!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:raw??(data===undefined?undefined:JSON.stringify(data))});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
  }
  const create=async(mode='human')=>request('/api/rooms',{method:'POST',data:{mode}});
  return {config,directory,request,create,get game(){return game;},get base(){return base;},async restart(){await game.close();game=await createGameServer(config,{engine,aiController,...dependencies});base=await listen();}};
}

test('room cookies isolate host, human and spectators across HTTP and websocket views',async t=>{
  const f=await fixture(t),host=await f.create(),id=host.body.roomId,route=`/api/rooms/${id}`;
  assert.equal(host.status,201);assert.equal(host.body.seatId,'p1');assert.match(host.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const other=await f.create();assert.equal((await f.request(route,{cookie:other.cookie})).status,401);
  const guest=await f.request(route+'/join',{method:'POST',data:{}});assert.equal(guest.body.seatId,null);assert.equal(guest.body.isHost,false);
  const rejoin=await f.request(route+'/join',{method:'POST',data:{},cookie:host.cookie});assert.equal(rejoin.body.seatId,'p1');assert.equal(rejoin.cookie,undefined);
  assert.equal((await f.request(route+'/start',{method:'POST',cookie:guest.cookie,data:{id:'start'}})).status,403);
  const starts=await Promise.all([1,2].map(()=>f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'start'}})));
  assert(starts.every(r=>r.status===200));assert.equal(starts[0].body.game.version,starts[1].body.game.version);
  assert.equal((await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'different'}})).status,409);
  assert.equal((await f.request(route+'/action',{method:'POST',cookie:guest.cookie,data:{id:'move',type:'move',roomId:'archive'}})).status,403);
  assert.equal((await f.request(route+'/replay',{cookie:guest.cookie})).status,409);
  const ws=new WebSocket(f.base.replace('http:','ws:')+route+'/socket',{headers:{Origin:origin,Cookie:guest.cookie}});t.after(()=>ws.terminate());
  const [message]=await once(ws,'message'),payload=JSON.parse(message.toString());assert.equal(payload.type,'state');assert.equal(payload.room.game.self,null);assert(payload.room.game.players.every(p=>!Object.hasOwn(p,'role')));
  const text=JSON.stringify(payload);for(const secret of ['aiContext','identities','apiKey','replaySequence','requests'])assert(!text.includes(secret));
  const update=once(ws,'message');const action=await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:{id:'move',type:'move',roomId:'archive'}});assert.equal(action.status,200);await update;
});

test('origins, malformed bodies, limits and websocket authentication fail safely',async t=>{
  const f=await fixture(t,{maxActiveRooms:1}),host=await f.create(),route=`/api/rooms/${host.body.roomId}`;
  for(const Origin of ['http://evil.test','null',''])assert.equal((await f.request('/api/rooms',{method:'POST',data:{mode:'human'},headers:{Origin}})).status,403);
  assert.equal((await f.create()).status,429);
  assert.equal((await f.request(route+'/start',{method:'POST',cookie:host.cookie,raw:'{'})).status,400);
  assert.equal((await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'x',padding:'x'.repeat(9000)}})).status,413);
  assert.equal((await f.request(route,{cookie:host.cookie,headers:{Origin:'http://evil.test'}})).status,403);
  assert.equal((await f.request(route+'?token=secret',{cookie:host.cookie})).status,400);
  const status=await new Promise(resolve=>{const ws=new WebSocket(f.base.replace('http:','ws:')+route+'/socket',{headers:{Origin:'http://evil.test',Cookie:host.cookie}});ws.on('unexpected-response',(_req,res)=>{resolve(res.statusCode);res.resume();ws.terminate();});ws.on('error',()=>{});});assert.equal(status,403);
  const health=await f.request('/api/health');assert.deepEqual(health.body,{ok:true,game:'Lantern Wake',protocol:1});
});

test('restart retains seat cookies, start and action request IDs and authoritative deadlines',async t=>{
  const f=await fixture(t),host=await f.create(),route=`/api/rooms/${host.body.roomId}`;
  await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'start'}});
  const action={id:'move-once',type:'move',roomId:'archive'};
  const first=await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:action});assert.equal(first.status,200);
  const deadline=first.body.game.deadlineAt;
  await f.restart();const restored=await f.request(route,{cookie:host.cookie});assert.equal(restored.body.seatId,'p1');assert.equal(restored.body.game.self.roomId,'archive');assert.equal(restored.body.game.deadlineAt,deadline);
  const repeated=await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:action});assert.equal(repeated.status,200);assert.equal(repeated.body.game.version,first.body.game.version);
  assert.equal((await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:{...action,roomId:'lantern'}})).status,409);
  assert.equal((await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'start'}})).status,200);
});

test('server ticks deadlines with no browser, keeps human idle and expires abandoned lobby',async t=>{
  let now=100000;const f=await fixture(t,{now:()=>now,roomTtlMs:100,rules:{roamDeadlineMs:100,discussionMs:20,votingMs:20,maxMatchMs:10000}});
  const idle=await f.create(),host=await f.create(),route=`/api/rooms/${host.body.roomId}`;await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'s'}});
  now+=110;await until(()=>!f.game.rooms.has(idle.body.roomId)&&f.game.rooms.get(host.body.roomId).data.state.phase==='discussion');
  now+=40;await until(()=>f.game.rooms.get(host.body.roomId).data.state.phase==='roam');
  const state=f.game.rooms.get(host.body.roomId).data.state;assert.equal(state.players.find(p=>p.id==='p1').roomId,'bridge');
  assert.equal((await f.request(`/api/rooms/${idle.body.roomId}`,{cookie:idle.cookie})).status,404);
});

test('AI send boundary persists room context before durable daily reservation, on every attempt',async t=>{
  let sends=0,reserves=0,checked=0;
  const ai={describe:()=>({mode:'live',provider:'stub',calls:0}),async decide({view,context,commitReservation}){
    if(checked)return null;checked++;
    for(let attempt=0;attempt<2;attempt++){
      context.reservations??=[];const id=`reservation-${attempt}`;context.reservations.push(id);
      await commitReservation({id,amountUsd:0.01});sends++;
    }
    return {id:'ai_wait',type:'wait'};
  }};
  let f;
  const dailyBudget={async reserve({id,amount}){reserves++;const saved=JSON.parse(await readFile(path.join(f.directory,`room-${id.split(':')[0]}.json`),'utf8'));assert.equal(saved.aiContext.reservations.length,reserves);assert.equal(amount,0.01);},status:()=>({})};
  f=await fixture(t,{}, {aiController:ai,dailyBudget});const host=await f.create('spectator');await f.request(`/api/rooms/${host.body.roomId}/start`,{method:'POST',cookie:host.cookie,data:{id:'s'}});
  await until(()=>sends===2);assert.equal(reserves,2);
});

test('daily reservation errors prevent simulated provider sends and survive restart',async t=>{
  let sends=0,attempts=0;
  const ai={describe:()=>({mode:'live',provider:'stub'}),async decide({context,commitReservation}){context.calls=(context.calls||0)+1;attempts++;await commitReservation({id:'reservation',amountUsd:0.1});sends++;return null;}};
  const f=await fixture(t,{}, {aiController:ai,dailyBudget:{reserve:async()=>{throw new Error('secret provider failure');}}});const host=await f.create('spectator'),route=`/api/rooms/${host.body.roomId}`;
  await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'s'}});await until(()=>f.game.rooms.get(host.body.roomId).aiBlocked);
  assert.equal(sends,0);assert.equal(attempts,1);const safe=await f.request(route,{cookie:host.cookie});assert(!JSON.stringify(safe.body).includes('secret provider failure'));
  await f.restart();assert.equal(f.game.rooms.get(host.body.roomId).data.aiContext.calls,1);
});

test('storage failure rejects AI reservation before deployment budget and before send',async t=>{
  let sends=0,reserves=0,attempts=0;
  const ai={describe:()=>({mode:'live',provider:'stub'}),async decide({context,commitReservation}){context.pending=true;attempts++;await commitReservation({id:'r',amountUsd:0.1});sends++;return null;}};
  let underlying;
  const directory=await mkdtemp(path.resolve(process.env.TRANSPORT_TEST_TEMP||'../temp','transport-store-'));
  underlying=await createRoomStore(directory);
  const store={...underlying,save:async room=>{if(room.aiContext.pending)throw new Error('disk failed');await underlying.save(room);}};
  const f=await fixture(t,{}, {store,aiController:ai,dailyBudget:{reserve:async()=>{reserves++;}}});const host=await f.create('spectator');await f.request(`/api/rooms/${host.body.roomId}/start`,{method:'POST',cookie:host.cookie,data:{id:'s'}});
  await until(()=>f.game.rooms.get(host.body.roomId).aiBlocked);assert.equal(attempts,1);assert.equal(sends,0);assert.equal(reserves,0);
  await f.game.close();await rm(directory,{recursive:true,force:true});
});

test('store quarantines invalid files and excludes a second writer',async t=>{
  const directory=await mkdtemp(path.resolve(process.env.TRANSPORT_TEST_TEMP||'../temp','transport-store-'));
  const store=await createRoomStore(directory);t.after(async()=>{await store.close();await rm(directory,{recursive:true,force:true});});
  await assert.rejects(createRoomStore(directory),/already in use/);
  await writeFile(path.join(directory,'room-abcdefghijklmnopqrstuvwx.json'),'{broken');
  assert.deepEqual(await store.load(),[]);assert((await readdir(directory)).some(name=>name.includes('.quarantine-')));
});

test('AI scheduler gives all six actors turns and real demo bots reach a replay without browsers',async t=>{
  const {createAiController}=await import(process.env.TRANSPORT_TEST_AI||'../server/ai/index.mjs');
  let now=100000;const turns=new Set();const controller=createAiController({config:{provider:'demo',decisionIntervalMs:1}});
  const ai={describe:context=>controller.describe(context),decide:args=>{turns.add(args.player.id);return controller.decide(args);}};
  const f=await fixture(t,{now:()=>now,tickMs:10,ai:{provider:'demo',decisionIntervalMs:100},rules:{tasksPerCrew:1,moveCooldownMs:1,taskCooldownMs:1,initialKillCooldownMs:100000,killCooldownMs:100000,sabotageCooldownMs:100000,roamDeadlineMs:100000,maxMatchMs:1000000}},{aiController:ai});
  const clock=setInterval(()=>{now+=100;},10);t.after(()=>clearInterval(clock));
  const host=await f.create('spectator'),route=`/api/rooms/${host.body.roomId}`;await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'s'}});
  await until(()=>f.game.rooms.get(host.body.roomId).data.state.phase==='ended');
  assert.equal(turns.size,6);const room=(await f.request(route,{cookie:host.cookie})).body;assert.equal(room.game.outcome.winner,'crew');assert.equal(room.ai.mode,'demo');assert.equal(room.ai.calls,0);
  assert(room.game.players.every(p=>['crew','saboteur'].includes(p.role)));const replay=await f.request(route+'/replay',{cookie:host.cookie});assert.equal(replay.status,200);assert(replay.body.replay.length>0);
});

test('close aborts pending decisions, terminates sockets and releases the data directory',async t=>{
  let deciding=false,aborted=false;
  const ai={describe:()=>({mode:'demo',provider:'stub'}),async decide({signal}){deciding=true;await new Promise(resolve=>{signal.addEventListener('abort',()=>{aborted=true;resolve();},{once:true});});return null;}};
  const f=await fixture(t,{}, {aiController:ai});const host=await f.create('spectator'),route=`/api/rooms/${host.body.roomId}`;
  const ws=new WebSocket(f.base.replace('http:','ws:')+route+'/socket',{headers:{Origin:origin,Cookie:host.cookie}});await once(ws,'message');
  await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'s'}});await until(()=>deciding);
  const disconnected=once(ws,'close');await Promise.all([f.game.close(),f.game.close()]);await disconnected;assert(aborted);
  const next=await createRoomStore(f.directory);await next.close();
});
