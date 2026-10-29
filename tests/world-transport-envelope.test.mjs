import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import * as legacy from '../server/engine/index.mjs';
import {createGameServer} from '../server/transport.mjs';
const temporary=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url)),origin='http://world-input.test';
const aiController={describe:()=>({mode:'demo',provider:'world-input-stub'}),decide:async()=>{throw new Error('No AI/provider decision expected in envelope fixture');}};
// Envelope-only engine injection. This does not qualify world movement/expiry.
function envelopeEngine(observed,override){return {...legacy,createMatch(options){observed.world=options.world;const state=legacy.createMatch({...options,world:false});state._transportPrivate='do-not-expose';return state;},applyInput(state,actor,input){observed.inputs.push({actor,input});if(override)return override(state,actor,input);const prior=state._transportTestInput||{seq:0};if(input.seq<=prior.seq){const duplicate=input.seq===prior.seq&&input.dx===prior.dx&&input.dy===prior.dy;return {state,events:[],accepted:duplicate,...(duplicate?{duplicate:true}:{error:{code:'STALE_INPUT',message:'Input sequence is stale or conflicting.'}})};}state._transportTestInput={...input};state.version++;return {state,events:[],accepted:true};}};}
async function fixture(t,options={}){
 await mkdir(temporary,{recursive:true});const directory=await mkdtemp(path.join(temporary,'world-transport-envelope-'));let now=100000;
 const config={publicOrigin:origin,dataDir:directory,tickMs:60000,now:()=>now,maxActiveRooms:12,roomTtlMs:3600000,ai:{provider:'demo'},...options.config};
 const observed={inputs:[],world:null},engine=options.engine||envelopeEngine(observed,options.override);
 const memory=options.memory?{load:async()=>[],save:async()=>{},remove:async()=>{},close:async()=>{}}:undefined;
 let game=await createGameServer(config,{engine,aiController,...(memory?{store:memory}:{})}),base;
 const listen=async()=>{game.server.listen(0,'127.0.0.1');await once(game.server,'listening');base=`http://127.0.0.1:${game.server.address().port}`;};await listen();
 t.after(async()=>{await game.close();assert(path.resolve(directory).startsWith(path.resolve(temporary)+path.sep));await rm(directory,{recursive:true,force:true});});
 async function request(route,data,cookie,headers={}){const res=await fetch(base+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(data===undefined?{}:{'Content-Type':'application/json'}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
 const create=async(mode='human')=>request('/api/rooms',{mode});
 const host=await create(),id=host.body.roomId,route=`/api/rooms/${id}`;assert.equal(host.status,201);
 const start=()=>request(route+'/start',{id:'start'},host.cookie);
 return {directory,host,id,route,request,create,start,observed,get game(){return game;},get base(){return base;},advance(ms){now+=ms;},async restart(){await game.close();game=await createGameServer(config,{engine,aiController});await listen();}};
}
const input=(seq,dx=1,dy=0)=>({seq,dx,dy});

test('world envelope: actor comes only from its human cookie; strict origin and spectator isolation',async t=>{
 const f=await fixture(t,{config:{worldMode:true}});assert.equal((await f.request(f.route+'/input',input(1),f.host.cookie)).status,409);await f.start();assert.equal(f.observed.world,true);
 assert.equal((await f.request(f.route+'/input',input(1))).status,401);
 const other=await f.create();assert.equal((await f.request(f.route+'/input',input(1),other.cookie)).status,401);
 const guest=await f.request(f.route+'/join',{},undefined);assert.equal((await f.request(f.route+'/input',input(1),guest.cookie)).status,403);
 const spectator=await f.create('spectator');await f.request(`/api/rooms/${spectator.body.roomId}/start`,{id:'s'},spectator.cookie);assert.equal((await f.request(`/api/rooms/${spectator.body.roomId}/input`,input(1),spectator.cookie)).status,403);
 assert.equal((await f.request(f.route+'/input',input(1),f.host.cookie,{Origin:'http://foreign.test'})).status,403);
 assert.equal((await f.request(f.route+'/input',input(1),f.host.cookie)).status,200);assert.deepEqual(f.observed.inputs,[{actor:'p1',input:input(1)}]);
});

test('world envelope: missing worldMode stays explicitly legacy on start',async t=>{const f=await fixture(t);await f.start();assert.equal(f.observed.world,false);});

test('world envelope: exact shape, safe positive sequences, integer directions and body bound',async t=>{
 const f=await fixture(t);await f.start();
 for(const bad of [{},{seq:1,dx:0},{...input(1),playerId:'p2'},{...input(1),role:'saboteur'},{...input(1),x:1},{...input(1),private:'hidden'},input(0),input(-1),input(1.5),input(Number.MAX_SAFE_INTEGER+1),input('1'),input(1,1.5),input(1,2),input(1,0,-2),input(1,0,'0'),[1,0,0]])assert.equal((await f.request(f.route+'/input',bad,f.host.cookie)).status,400,JSON.stringify(bad));
 assert.equal((await f.request(f.route+'/input',{...input(1),private:'x'.repeat(9000)},f.host.cookie)).status,413);assert.equal(f.observed.inputs.length,0);
 assert.equal((await f.request(f.route+'/input',input(1,0,0),f.host.cookie)).status,200);
});

test('world envelope: concurrent duplicate input is inert, conflict/stale rejects and sequence survives restart',async t=>{
 const f=await fixture(t);await f.start();const originalVersion=f.game.rooms.get(f.id).data.state.version;
 const results=await Promise.all([f.request(f.route+'/input',input(2),f.host.cookie),f.request(f.route+'/input',input(2),f.host.cookie)]);assert(results.every(result=>result.status===200));assert.equal(f.game.rooms.get(f.id).data.state.version,originalVersion+1);
 assert.equal((await f.request(f.route+'/input',input(1),f.host.cookie)).status,409);assert.equal((await f.request(f.route+'/input',input(2,-1),f.host.cookie)).status,409);
 await f.restart();assert.equal((await f.request(f.route+'/input',input(2),f.host.cookie)).status,200);assert.equal(f.game.rooms.get(f.id).data.state.version,originalVersion+1);assert.equal((await f.request(f.route+'/input',input(3),f.host.cookie)).status,200);
});

test('world envelope: movement and discrete quotas are separate',async t=>{
 const f=await fixture(t,{memory:true});await f.start();
 for(let seq=1;seq<=65;seq++)assert.equal((await f.request(f.route+'/input',input(seq),f.host.cookie)).status,200);
 for(let i=0;i<59;i++)assert.equal((await f.request(f.route+'/action',{id:`wait-${i}`,type:'wait'},f.host.cookie)).status,200);
 assert.equal((await f.request(f.route+'/action',{id:'over-action-cap',type:'wait'},f.host.cookie)).status,429);
 assert.equal((await f.request(f.route+'/input',input(66,0,0),f.host.cookie)).status,200);
});

test('world envelope: input traffic still obeys the overall 600 HTTP ceiling (memory store fixture)',async t=>{
 const f=await fixture(t,{memory:true});await f.start();
 for(let seq=1;seq<=598;seq++)assert.equal((await f.request(f.route+'/input',input(seq),f.host.cookie)).status,200,`sequence ${seq}`);
 assert.equal((await f.request(f.route+'/input',input(599),f.host.cookie)).status,429);assert.equal(f.observed.inputs.length,598);
});

test('world envelope: malformed engine result fails closed without memory/disk mutation',async t=>{
 const f=await fixture(t,{override(state){state.id='foreign-match';state.players=[];state.version++;return {state,accepted:true};}});await f.start();const before=structuredClone(f.game.rooms.get(f.id).data);
 assert.equal((await f.request(f.route+'/input',input(1),f.host.cookie)).status,503);assert.deepEqual(f.game.rooms.get(f.id).data,before);
 await f.game.close();assert.deepEqual(JSON.parse(await readFile(path.join(f.directory,`room-${f.id}.json`),'utf8')),before);
});

test('world envelope: real WebSocket broadcast uses each authenticated engine view',async t=>{
 const f=await fixture(t);await f.start();const guest=await f.request(f.route+'/join',{},undefined),ws=new WebSocket(f.base.replace('http:','ws:')+f.route+'/socket',{headers:{Origin:origin,Cookie:guest.cookie}});t.after(()=>ws.terminate());
 await once(ws,'message');const update=once(ws,'message');assert.equal((await f.request(f.route+'/input',input(1),f.host.cookie)).status,200);
 const [raw]=await update,payload=JSON.parse(raw.toString());assert.equal(payload.type,'state');assert.equal(payload.room.seatId,null);assert.equal(payload.room.game.self,null);assert(payload.room.game.players.every(player=>!Object.hasOwn(player,'role')));
 for(const privateField of ['_transportPrivate','_transportTestInput','aiContext','identities'])assert(!raw.toString().includes(privateField));
});
