import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';

const revision='9b31317c618ea12810a369edb84f87834f9218b9';
const repository=fileURLToPath(new URL('../',import.meta.url));
const root=process.env.TRANSPORT_TERMINAL_ROOT?new URL(process.env.TRANSPORT_TERMINAL_ROOT):new URL('../',import.meta.url);
const scope=['server/transport.mjs','server/rooms.mjs','server/store.mjs','server/budget.mjs','server/engine/index.mjs','server/static.mjs','shared/contracts.mjs'];
const normalized=text=>text.replaceAll('\r\n','\n');
async function assertPinned(){for(const file of scope){const committed=execFileSync('git',['show',`${revision}:${file}`],{cwd:repository,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});assert.equal(normalized(await readFile(new URL(file,root),'utf8')),normalized(committed),`${file} must match exact manager ${revision}`);}}
await assertPinned();after(assertPinned);
const actualEngine=await import(new URL('server/engine/index.mjs',root));
const {createGameServer}=await import(new URL('server/transport.mjs',root));
const {createRoomStore}=await import(new URL('server/store.mjs',root));
const {createDailyBudget}=await import(new URL('server/budget.mjs',root));
const origin='http://terminal-ai.test';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){const end=Date.now()+3000;while(Date.now()<end){if(check())return;await wait(10);}throw new Error(`Timed out: ${label}`);}

async function fixture(t,{maxMatchMs=1000000}={}){
  const parent=path.resolve(process.env.TRANSPORT_TEST_TEMP||path.join(repository,'_artifacts/test-temp'));await mkdir(parent,{recursive:true});
  const directory=await mkdtemp(path.join(parent,'transport-terminal-ai-'));
  let now=100000,game,base,pending,baselineContext,baselineLedger;
  const counts={decisions:0,simulatedSends:0,aborts:0,finished:0};
  const rules={meetingCooldownMs:1,discussionMs:100,votingMs:100,roamDeadlineMs:100000,maxMatchMs};
  let seed,targetId;
  for(let index=0;index<100;index++){
    const candidate=`terminal-review-${index}`,sample=actualEngine.createMatch({id:'terminal_seed_probe',now,seed:candidate,config:rules});
    if(sample.players.find(player=>player.id==='p1').role==='crew'&&sample.players.find(player=>player.id==='p2').role==='saboteur'){seed=candidate;targetId='p2';break;}
  }
  assert(seed,'a deterministic p1 crew / p2 saboteur seed must exist');
  // Only deterministic initialization is injected; all actions/ticks/views are real.
  const engine={...actualEngine,createMatch:options=>actualEngine.createMatch({...options,seed})};
  const aiController={
    describe:context=>{const state=context.matches?.[`match:${context.activeMatchId}`];return {mode:'demo',provider:'terminal-test-stub',calls:state?.calls||0,tokens:state?.tokens||0,costUsd:state?.costUsd||0};},
    async decide({view,player,context,signal,commitReservation}){
      counts.decisions++;
      assert.equal(player.id,'p2');assert.equal(view.self.id,'p2');assert(view.players.every(other=>!Object.hasOwn(other,'role')));
      const state=context.matches[`match:${view.matchId}`];
      state.calls++;state.tokens+=300;state.costUsd=.05;state.reservations.push({id:'already-inflight',amountUsd:.03});
      await commitReservation({id:'already-inflight',amountUsd:.03});
      assert(!signal.aborted);counts.simulatedSends++;
      pending={signal,commitReservation};
      await new Promise(resolve=>{const aborted=()=>{counts.aborts++;resolve();};if(signal.aborted)aborted();else signal.addEventListener('abort',aborted,{once:true});});
      // A delayed provider response must not overwrite the committed checkpoint.
      state.memories['actor:p2'].privateMemo='late-private-response-must-not-persist';
      counts.finished++;return {id:'late-ai-proposal',type:'wait'};
    }
  };
  const config={dataDir:directory,publicOrigin:origin,maxActiveRooms:4,roomTtlMs:3600000,tickMs:10,now:()=>now,rules,ai:{provider:'demo',maxDailyCostUsd:5,decisionIntervalMs:100}};
  async function launch(){game=await createGameServer(config,{engine,aiController});game.server.listen(0,'127.0.0.1');await once(game.server,'listening');base=`http://127.0.0.1:${game.server.address().port}`;}
  t.after(async()=>{if(game)await game.close();assert(directory.startsWith(parent+path.sep));await rm(directory,{recursive:true,force:true});});
  async function request(route,data,cookie){const response=await fetch(base+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(data===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
  await launch();const host=await request('/api/rooms',{mode:'human'});assert.equal(host.status,201);const id=host.body.roomId,route=`/api/rooms/${id}`;
  // Seed an older durable private reservation in the lobby before the pending call.
  await game.close();
  const seededContext={activeMatchId:id,matches:{[`match:${id}`]:{mode:'demo',calls:1,tokens:200,costUsd:.02,memories:{'actor:p2':{privateMemo:'existing-private-memory'}},reservations:[{id:'before-existing',amountUsd:.02}]}}};
  const store=await createRoomStore(directory);try{const [lobby]=await store.load();lobby.aiContext=seededContext;await store.save(lobby);}finally{await store.close();}
  const budget=await createDailyBudget({directory,maxCostUsd:5,now:()=>now});await budget.reserve({id:`${id}:before-existing`,amount:.02});
  await launch();const started=await request(route+'/start',{id:'start'},host.cookie);assert.equal(started.status,200);assert.equal(started.body.game.self.role,'crew');
  await until(()=>pending,'AI request reserved and pending');
  baselineContext=structuredClone(game.rooms.get(id).data.aiContext);
  baselineLedger=await readFile(path.join(directory,'ai-daily-budget.json'),'utf8');
  assert.equal(baselineContext.matches[`match:${id}`].reservations.length,2);assert.equal(JSON.parse(baselineLedger).total,.05);
  assert(!JSON.stringify(started.body).includes('existing-private-memory'));assert(!JSON.stringify(started.body).includes('matches'));
  async function checkpoint(){
    await game.close();const room=JSON.parse(await readFile(path.join(directory,`room-${id}.json`),'utf8'));
    assert.deepEqual(room.aiContext,baselineContext);assert.equal(await readFile(path.join(directory,'ai-daily-budget.json'),'utf8'),baselineLedger);
    assert(!Object.values(room.state.requests).flat().some(row=>row.id==='late-ai-proposal'));
    return room;
  }
  async function assertStopped(phase){
    await until(()=>counts.finished===1&&!game.rooms.get(id).aiBusy,'aborted decision settles');
    assert.equal(game.rooms.get(id).data.state.phase,phase);assert(pending.signal.aborted);assert.equal(counts.aborts,1);
    await assert.rejects(pending.commitReservation({id:'must-not-reserve-after-terminal',amountUsd:.01}),/AI stopped/);
    now+=1000;await wait(60);assert.deepEqual(counts,{decisions:1,simulatedSends:1,aborts:1,finished:1});
    assert.deepEqual(game.rooms.get(id).data.aiContext,baselineContext);
  }
  return {id,route,host,targetId,request,counts,checkpoint,assertStopped,get game(){return game;},get now(){return now;},advance(value){now+=value;},async restart(){await game.close();await launch();}};
}

async function victory(f){
  f.advance(2);
  const meeting=await f.request(f.route+'/action',{id:'human-meeting',type:'meeting'},f.host.cookie);assert.equal(meeting.status,200);assert.equal(meeting.body.phase,'discussion');
  f.advance(101);
  const vote=await f.request(f.route+'/action',{id:'human-singleton-vote',type:'vote',targetId:f.targetId},f.host.cookie);assert.equal(vote.status,200);assert.equal(vote.body.phase,'voting');
  assert.equal(f.game.rooms.get(f.id).data.state.meeting.votes.length,1);
  f.advance(101);
  // HTTP itself crosses tally time; its denial still commits the actual victory.
  const crossed=await f.request(f.route+'/action',{id:'human-cross-tally',type:'wait'},f.host.cookie);assert.equal(crossed.status,409);assert.equal(crossed.body.error.code,'MATCH_INACTIVE');
  const ended=await f.request(f.route,undefined,f.host.cookie);assert.equal(ended.body.phase,'ended');assert.equal(ended.body.game.outcome.winner,'crew');assert.equal(ended.body.game.outcome.reason,'ejection');
  const tally=ended.body.game.events.find(event=>event.type==='vote_result');assert.equal(tally.ejectedId,f.targetId);assert.deepEqual(tally.votes,[{playerId:'p1',targetId:f.targetId}]);
  await f.assertStopped('ended');return ended.body;
}

test('pinned manager: actual HTTP crew victory aborts pending AI and preserves earlier reservations',{timeout:10000},async t=>{
  const f=await fixture(t);const ended=await victory(f);
  assert(!JSON.stringify(ended).includes('privateMemo'));
  const replay=await f.request(f.route+'/replay',undefined,f.host.cookie);assert.equal(replay.status,200);assert(replay.body.replay.some(event=>event.type==='ended'&&event.winner==='crew'));
  const saved=await f.checkpoint();assert.equal(saved.state.phase,'ended');assert.equal(saved.aiContext.matches[`match:${f.id}`].calls,2);
});

test('pinned manager: unattended maximum-duration pause aborts pending AI without new reservation/send',{timeout:10000},async t=>{
  const f=await fixture(t,{maxMatchMs:500});f.advance(501);
  await until(()=>f.game.rooms.get(f.id).data.state.phase==='paused','real engine maximum-duration pause');
  await f.assertStopped('paused');const room=await f.request(f.route,undefined,f.host.cookie);assert.equal(room.body.game.outcome,null);assert.equal((await f.request(f.route+'/replay',undefined,f.host.cookie)).status,409);
  const saved=await f.checkpoint();assert.equal(saved.state.phase,'paused');assert.equal(saved.state.pauseReason,'maximum_duration');
});

test('pinned manager: restarting an ended victory retains private context/budget and schedules no AI',{timeout:10000},async t=>{
  const f=await fixture(t);await victory(f);const before=await f.checkpoint();
  await f.restart();f.advance(1000);await wait(80);
  const restored=await f.request(f.route,undefined,f.host.cookie);assert.equal(restored.status,200);assert.equal(restored.body.phase,'ended');assert.equal(restored.body.game.self.id,'p1');assert.deepEqual(restored.body.game.outcome,before.state.outcome);
  assert.deepEqual(f.counts,{decisions:1,simulatedSends:1,aborts:1,finished:1});assert.equal((await f.request(f.route+'/replay',undefined,f.host.cookie)).status,200);
  const after=await f.checkpoint();assert.deepEqual(after.aiContext,before.aiContext);assert.deepEqual(after.state.requests,before.state.requests);
});
