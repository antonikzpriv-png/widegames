import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { createGameServer } from '../server/transport.mjs';
import { createAiController } from '../server/ai/index.mjs';
import * as actualEngine from '../server/engine/index.mjs';
const origin='http://strategic-audit.test';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){for(let n=0;n<300;n++){if(check())return;await delay(10);}assert.fail('Timed out: '+label);}
async function fixture(t,{roamDeadlineMs=100000,maxMatchMs=900000,features}={}){
 const directory=await mkdtemp('/tmp/strategic-transport-');let now=1000,seen,release,apiCalls=0,captured,decisions=0;
 const seed=Array.from({length:100},(_,i)=>i).find(seed=>actualEngine.createMatch({id:'probe',seed,now}).players[0].role==='saboteur');assert.notEqual(seed,undefined);
 const realFetch=globalThis.fetch;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(url!=='https://api.anthropic.com/v1/messages')return realFetch(url,options);
  apiCalls++;assert.equal(apiCalls,1);seen=JSON.parse(options.body);
  return await new Promise(resolve=>{release=()=>resolve(new Response(JSON.stringify({stop_reason:'tool_use',content:[{type:'tool_use',name:'pick_action',input:{choice:0}}],usage:{input_tokens:100,output_tokens:20}})));});
 });
 const config={dataDir:directory,publicOrigin:origin,worldMode:true,features,tickMs:10,now:()=>now,rules:{initialKillCooldownMs:1,roamDeadlineMs,maxMatchMs,discussionMs:100,votingMs:100},ai:{provider:'anthropic',apiKey:'offline',strategy:'strategic',maxTokens:250000,maxDailyCostUsd:5,decisionIntervalMs:100}};
 const real=createAiController({config});
 const wrapper={describe:real.describe,async decide(args){if(decisions++)return null;captured=args;return real.decide(args);}};
 const engine={...actualEngine,createMatch:args=>actualEngine.createMatch({...args,seed})};
 const game=await createGameServer(config,{engine,aiController:wrapper});game.server.listen(0,'127.0.0.1');await once(game.server,'listening');const base=`http://127.0.0.1:${game.server.address().port}`;
 t.after(async()=>{release?.();await game.close();await rm(directory,{recursive:true,force:true});});
 async function request(route,data,cookie){const r=await realFetch(base+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(data===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 const host=await request('/api/rooms',{mode:'human'}),route=`/api/rooms/${host.body.roomId}`;assert.equal(host.status,201);
 assert.equal((await request(route+'/start',{id:'start'},host.cookie)).status,200);
 await until(()=>seen,'real controller provider request');assert.equal(JSON.parse(seen.messages[0].content).phase,'roam');
 const room=game.rooms.get(host.body.roomId),before=structuredClone(room.data.aiContext),ledger=JSON.parse(await readFile(directory+'/ai-daily-budget.json','utf8'));
 assert.equal(real.describe(before).calls,1);assert.equal(Object.keys(ledger.reservations).length,1);
 return {game,room,host,route,request,before,ledger,directory,config,engine,get captured(){return captured;},get apiCalls(){return apiCalls;},advance(ms){now+=ms;},release:()=>release(),settled:()=>until(()=>!room.aiBusy,'stale provider result settles')};
}
for(const transition of ['meeting','death','ghost-death','pause'])test(`real strategic transport: pending result fenced on ${transition}; durable charge remains`,{timeout:10000},async t=>{
 const f=await fixture(t,{...(transition==='meeting'?{roamDeadlineMs:100}:{}),...(transition==='pause'?{maxMatchMs:100}: {}),...(transition==='ghost-death'?{features:{deathPolicy:'ghost-tasks',abilities:false}}:{})});
 if(transition.endsWith('death')){
  const destination=f.room.data.state.players.find(p=>p.id==='p2').position;
  assert.equal((await f.request(f.route+'/action',{id:'human-approach',type:'navigate',...destination},f.host.cookie)).status,200);
  f.advance(100);const r=await f.request(f.route+'/action',{id:'human-eliminate',type:'eliminate',targetId:'p2'},f.host.cookie);assert.equal(r.status,200,JSON.stringify(r.body));
  assert.equal(f.room.data.state.players.find(p=>p.id==='p2').alive,false);
 }else{f.advance(101);await until(()=>f.room.data.state.phase===(transition==='meeting'?'discussion':'paused'),'phase transition');}
 assert.equal(f.captured.getCurrentView(),null,'originating generation cannot access a later view');
 f.release();await f.settled();assert.equal(f.apiCalls,1);assert.deepEqual(f.room.data.aiContext,f.before);
 assert.deepEqual(JSON.parse(await readFile(f.directory+'/ai-daily-budget.json','utf8')),f.ledger);
 assert(!Object.values(f.room.data.state.requests).flat().some(r=>r.id.startsWith('ai_')),'late proposal must never reach engine');
 const publicView=await f.request(f.route,undefined,f.host.cookie);assert(!JSON.stringify(publicView.body).includes('planProgress'));assert(!JSON.stringify(publicView.body).includes('memories'));
});

test('real strategic transport: room closure aborts pending work without refund or late context mutation',{timeout:10000},async t=>{
 const f=await fixture(t);await f.game.close();f.release();await delay(20);assert(f.captured.signal.aborted);assert.deepEqual(f.room.data.aiContext,f.before);
 const saved=JSON.parse(await readFile(f.directory+`/room-${f.host.body.roomId}.json`,'utf8'));assert.deepEqual(saved.aiContext,f.before);
 assert.deepEqual(JSON.parse(await readFile(f.directory+'/ai-daily-budget.json','utf8')),f.ledger);assert.equal(f.apiCalls,1);
});

test('real strategic transport restart resumes after an uncertain request without replaying or refunding it',{timeout:10000},async t=>{
 const f=await fixture(t);await f.game.close();f.release();f.advance(500);
 const controller=createAiController({config:f.config});
 // Scope recovery to the actor with the uncertain request; other actors would
 // legitimately make their own first calls and are covered by complete matches.
 const aiController={describe:controller.describe,decide:args=>args.player.id===f.captured.player.id?controller.decide(args):null};
 const recovered=await createGameServer(f.config,{engine:f.engine,aiController});
 try{
  const room=recovered.rooms.get(f.host.body.roomId);assert.deepEqual(room.data.aiContext,f.before);
  await until(()=>room.data.aiContext.matches[`match:${f.host.body.roomId}`].memories[`actor:${f.captured.player.id}`].lastDecisionAt>1000,'recovered actor progresses');
  assert.equal(controller.describe(room.data.aiContext).calls,1);assert.equal(f.apiCalls,1);assert.equal(controller.describe(room.data.aiContext).mode,'live');
  assert.deepEqual(JSON.parse(await readFile(f.directory+'/ai-daily-budget.json','utf8')),f.ledger);
 }finally{await recovered.close();}
});
