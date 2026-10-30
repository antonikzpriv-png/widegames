import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import * as engine from '../server/engine/index.mjs';
import {validateRoomSnapshot} from '../server/store.mjs';
import {createGameServer} from '../server/transport.mjs';
import {createAiController} from '../server/ai/index.mjs';
import {CHARACTERS} from '../shared/contracts.mjs';
import {WORLD_STATIONS} from '../shared/world.mjs';

const origin='http://ghost.test',features={deathPolicy:'ghost-tasks',abilities:true};
const seed=Array.from({length:100},(_,i)=>String(i)).find(seed=>engine.createMatch({id:'probe',seed,world:true,features}).players[0].ability?.type==='ward');
const idle={describe:()=>({mode:'demo',provider:'demo'}),decide:async()=>null};
const fixtureEngine={...engine,createMatch:options=>engine.createMatch({...options,seed})};
async function serverFixture(t,extra={}){
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'ghost-integration-'));let now=1000;
 const config={dataDir,publicOrigin:origin,worldMode:true,features,tickMs:600000,now:()=>now,rules:{initialKillCooldownMs:1,killCooldownMs:1},ai:{provider:'demo'},...extra};
 let game=await createGameServer(config,{engine:fixtureEngine,aiController:idle});
 async function listen(){game.server.listen(0,'127.0.0.1');await once(game.server,'listening');return 'http://127.0.0.1:'+game.server.address().port;}
 let base=await listen();t.after(async()=>{await game.close();await rm(dataDir,{recursive:true,force:true});});
 const req=async(route,{method='GET',body,cookie}={})=>{
  const r=await fetch(base+route,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
 };
 return {req,config,get game(){return game;},get base(){return base;},setNow:n=>now=n,async restart(){await game.close();game=await createGameServer(config,{engine:fixtureEngine,aiController:idle});base=await listen();}};
}

test('real room start persists validated optional presets; host authorization, old defaults and invalid configuration',async t=>{
 const f=await serverFixture(t);
 for(const invalid of [null,{deathPolicy:'unknown'},{abilities:'true'},{ghostMode:true}])assert.equal((await f.req('/api/rooms',{method:'POST',body:{mode:'human',features:invalid}})).status,400);
 const host=await f.req('/api/rooms',{method:'POST',body:{mode:'human',features:{deathPolicy:'transfer',abilities:false}}});assert.equal(host.status,201);const route='/api/rooms/'+host.body.roomId;
 const observer=await f.req(route+'/join',{method:'POST',body:{}});
 assert.equal((await f.req(route+'/start',{method:'POST',body:{id:'denied',features},cookie:observer.cookie})).status,403);
 assert.equal((await f.req(route+'/start',{method:'POST',body:{id:'bad',features:{abilities:8}},cookie:host.cookie})).status,400);
 const started=await f.req(route+'/start',{method:'POST',body:{id:'start',features},cookie:host.cookie});assert.equal(started.status,200);assert.equal(started.body.game.features.deathPolicy,'ghost-tasks');
 const duplicate=await f.req(route+'/start',{method:'POST',body:{id:'start',features:{deathPolicy:'transfer'}},cookie:host.cookie});assert.equal(duplicate.body.game.features.deathPolicy,'ghost-tasks');
 const shield={id:'persistent-ward',type:'protect',targetId:'p1'};
 const ward=await f.req(route+'/action',{method:'POST',body:shield,cookie:host.cookie});assert.equal(ward.status,200);assert.equal(ward.body.game.effects.length,1);
 await f.restart();const restored=await f.req(route,{cookie:host.cookie});assert.equal(restored.body.game.features.abilities,true);assert.equal(restored.body.game.effects[0].kind,'ward');assert.equal(restored.body.game.self.ability.readyAt,36000);
 const receipt=await f.req(route+'/action',{method:'POST',body:shield,cookie:host.cookie});assert.equal(receipt.status,200);assert.equal(receipt.body.game.effects.length,1);
 f.setNow(9000);const expired=await f.req(route+'/action',{method:'POST',body:{id:'expiry',type:'wait'},cookie:host.cookie});assert.equal(expired.body.game.effects.length,0);assert.equal(expired.body.game.self.ability.readyAt,36000);

 const classic=await f.req('/api/rooms',{method:'POST',body:{mode:'human',features:{deathPolicy:'transfer',abilities:false}}});const cr='/api/rooms/'+classic.body.roomId;
 const cs=await f.req(cr+'/start',{method:'POST',body:{id:'classic'},cookie:classic.cookie});assert.equal(cs.status,200);assert.equal(cs.body.game.features,undefined);
});

test('HTTP/WS filter private fallen chat and coordinates; ghost input, effects and action receipts survive real restart',async t=>{
 const f=await serverFixture(t),host=await f.req('/api/rooms',{method:'POST',body:{mode:'human'}}),route='/api/rooms/'+host.body.roomId;
 await f.req(route+'/start',{method:'POST',body:{id:'start'},cookie:host.cookie});
 assert.equal((await f.req(route+'/action',{method:'POST',body:{id:'living-chat',type:'ghostSay',text:'probe'},cookie:host.cookie})).status,409);
 const observer=await f.req(route+'/join',{method:'POST',body:{}}),entry=f.game.rooms.get(host.body.roomId);let state=entry.data.state;
 const p1=state.players[0],sab=state.players.find(p=>p.role==='saboteur');for(const p of [p1,sab]){p.position={x:WORLD_STATIONS.bridge.x,y:WORLD_STATIONS.bridge.y};p.roomId='bridge';}
 let r=engine.applyAction(state,sab.id,{id:'kill-human',type:'eliminate',targetId:'p1'},1001);assert(r.accepted);entry.data.state=r.state;f.setNow(1002);
 const connect=async cookie=>{const ws=new WebSocket(f.base.replace('http:','ws:')+route+'/socket',{headers:{Origin:origin,Cookie:cookie}});t.after(()=>ws.terminate());const [data]=await once(ws,'message');return {ws,initial:JSON.parse(data).room};};
 const own=await connect(host.cookie),publicSocket=await connect(observer.cookie);assert(own.initial.game.self.ghost);assert.equal(publicSocket.initial.game.ghostChat,undefined);
 const ownNext=once(own.ws,'message'),publicNext=once(publicSocket.ws,'message');
 const chat={id:'ghost-chat',type:'ghostSay',text:'PRIVATE: I saw the killer <img src=x>'};const sent=await f.req(route+'/action',{method:'POST',body:chat,cookie:host.cookie});assert.equal(sent.status,200);
 const [ow]=await ownNext,[pu]=await publicNext;assert(JSON.parse(ow).room.game.ghostChat[0].text.startsWith('PRIVATE:'));
 assert(!String(pu).includes('PRIVATE:'));assert(!String(pu).includes('ghostChat'));
 const watched=await f.req(route,{cookie:observer.cookie});assert.equal(watched.body.game.players.find(p=>p.id==='p1').position,null);assert(!JSON.stringify(watched.body).includes('PRIVATE:'));
 const input=await f.req(route+'/input',{method:'POST',body:{seq:1,dx:1,dy:0},cookie:host.cookie});assert.equal(input.status,200);assert.equal(input.body.game.self.alive,false);assert.equal(input.body.game.self.moving,true);
 own.ws.terminate();publicSocket.ws.terminate();await f.restart();
 const rejoined=await f.req(route,{cookie:host.cookie});assert(rejoined.body.game.self.ghost);assert.equal(rejoined.body.game.self.inputSeq,1);assert.equal(rejoined.body.game.ghostChat.length,1);
 const duplicate=await f.req(route+'/action',{method:'POST',body:chat,cookie:host.cookie});assert.equal(duplicate.status,200);assert.equal(duplicate.body.game.ghostChat.length,1);
 const bytes=JSON.parse(await readFile(path.join(f.config.dataDir,'room-'+host.body.roomId+'.json'),'utf8'));assert.equal(bytes.state.players[0].alive,false);assert.equal(bytes.state.features.version,1);
});

test('transport schedules fallen demo actors with unfinished tasks',async t=>{
 let calls=0;const directory=await mkdtemp(path.join(os.tmpdir(),'ghost-schedule-'));let now=1000;
 const config={dataDir:directory,publicOrigin:origin,worldMode:true,features,tickMs:5,now:()=>now,ai:{provider:'demo',decisionIntervalMs:100},rules:{initialKillCooldownMs:1}};
 const ai={describe:idle.describe,async decide({view}){if(view.self.ghost)calls++;return null;}};
 const game=await createGameServer(config,{engine:fixtureEngine,aiController:ai});t.after(async()=>{await game.close();await rm(directory,{recursive:true,force:true});});
 game.server.listen(0,'127.0.0.1');await once(game.server,'listening');const base='http://127.0.0.1:'+game.server.address().port;
 const create=await fetch(base+'/api/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({mode:'spectator'})});const created=await create.json(),cookie=create.headers.get('set-cookie').split(';')[0];
 await fetch(base+'/api/rooms/'+created.roomId+'/start',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({id:'start'})});
 const entry=game.rooms.get(created.roomId),s=entry.data.state,sab=s.players.find(p=>p.role==='saboteur'),victim=s.players.find(p=>p.role==='crew');for(const p of [sab,victim]){p.position={x:728,y:272};p.roomId='bridge';}entry.data.state=engine.applyAction(s,sab.id,{id:'kill-bot',type:'eliminate',targetId:victim.id},1001).state;now=1002;
 for(let n=0;n<100&&calls===0;n++){now+=100;await new Promise(r=>setTimeout(r,10));}
 assert(calls>0,'dead bot must reach scheduler');
});

for(const deathPolicy of ['transfer','ghost-tasks'])for(const mode of ['spectator','human'])test(`full deterministic demo ${mode}, ${deathPolicy}, optional abilities, real rules win and JSON restart`,{timeout:180000},async t=>{
 const fetched=t.mock.method(globalThis,'fetch',()=>{throw Error('No live calls');});const summaries=[];
 for(const seed of [1,7,19]){
  let state=engine.createMatch({id:`feature-demo-${mode}-${seed}`.padEnd(24,'x'),seed,mode,world:true,now:1000,features:{deathPolicy,abilities:true},config:{discussionMs:6000,votingMs:4000}});
  const validate=state=>validateRoomSnapshot({schema:1,id:state.id,mode,createdAt:1000,updatedAt:state.updatedAt,identities:[{hash:'a'.repeat(64),host:true,seatId:mode==='human'?'p1':null}],state,startId:'start',aiContext:{},features:{deathPolicy,abilities:true}});
  let ai=createAiController({config:{provider:'demo',decisionIntervalMs:1800}}),context={},restarted=false;const types=new Set();
  for(let now=1000;now<=901000&&!['ended','paused'].includes(state.phase);now+=250){
   state=engine.tick(state,now).state;await validate(state);
   for(const player of CHARACTERS.filter(p=>mode==='spectator'||p.id!=='p1')){
    const view=engine.getPlayerView(state,player.id,now),a=await ai.decide({view,player,context});if(!a)continue;
    const r=engine.applyAction(state,player.id,a,now);assert(r.accepted,JSON.stringify({seed,mode,a,error:r.error}));state=r.state;await validate(state);types.add(a.type);
   }
   if(!restarted&&state.effects?.length){state=JSON.parse(JSON.stringify(state));context=JSON.parse(JSON.stringify(context));ai=createAiController({config:{provider:'demo',decisionIntervalMs:1800}});restarted=true;}
  }
  assert.equal(state.phase,'ended',JSON.stringify({seed,mode,deathPolicy,types:[...types]}));assert(restarted);assert.equal(ai.describe(context).calls,0);assert.equal(state.players.flatMap(p=>p.tasks).length,15);
  if(mode==='human')assert.equal(state.players[0].motion.seq,0);
  summaries.push({seed,outcome:state.outcome,types:[...types]});
 }
 assert.equal(fetched.mock.callCount(),0);t.diagnostic(JSON.stringify(summaries));
});

for(const order of ['ward-first','echo-first'])test(`audit: ward on saboteur coexists with echo through HTTP persistence and restart (${order})`,async t=>{
 const f=await serverFixture(t),host=await f.req('/api/rooms',{method:'POST',body:{mode:'human'}}),route='/api/rooms/'+host.body.roomId;
 assert.equal((await f.req(route+'/start',{method:'POST',body:{id:'start'},cookie:host.cookie})).status,200);
 const entry=f.game.rooms.get(host.body.roomId),sab=entry.data.state.players.find(p=>p.role==='saboteur');
 // Arrange a nearby legal target; subsequent abilities still use the real engine/HTTP authority.
 entry.data.state.players[0].position={...sab.position};entry.data.state.players[0].roomId=sab.roomId;
 const castWard=async()=>{const r=await f.req(route+'/action',{method:'POST',body:{id:'ward-saboteur',type:'protect',targetId:sab.id},cookie:host.cookie});assert.equal(r.status,200,JSON.stringify(r.body));};
 const castEcho=()=>{const r=engine.applyAction(entry.data.state,sab.id,{id:'bot-echo',type:'decoy',x:sab.position.x,y:sab.position.y},1000);assert(r.accepted);entry.data.state=r.state;};
 if(order==='ward-first'){await castWard();castEcho();}else{castEcho();await castWard();}
 // An authenticated real write forces the complete pair through both room/store validators.
 const saved=await f.req(route+'/action',{method:'POST',body:{id:'persist-both',type:'wait'},cookie:host.cookie});assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.game.effects.length,2);
 await f.restart();const restored=await f.req(route,{cookie:host.cookie});assert.equal(restored.body.game.effects.length,2);assert.equal(restored.body.game.self.ability.readyAt,36000);
 f.setNow(7000);const expired=await f.req(route+'/action',{method:'POST',body:{id:'expire-echo',type:'wait'},cookie:host.cookie});assert.equal(expired.status,200);assert.deepEqual(expired.body.game.effects.map(e=>e.kind),['ward']);
});
