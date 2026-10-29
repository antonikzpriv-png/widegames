import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {createGameServer} from '../server/transport.mjs';
import * as engine from '../server/engine/index.mjs';
import {WORLD,WORLD_STATIONS,distance,isWalkable} from '../shared/world.mjs';
import {worldInputEnvelope} from '../public/world-input-envelope.mjs';
import {loadConfig} from '../server/config.mjs';

test('real world control: analogue bridge, authority, navigation, hidden coordinates and restart',async t=>{
 const parent=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url));await mkdir(parent,{recursive:true});
 const directory=await mkdtemp(path.join(parent,'world-control-'));let game,base,now=100000;
 const origin='http://world-control.test';
 const aiController={describe:()=>({mode:'demo',provider:'world-control-fixture',calls:0}),decide:async()=>null};
 let seed;for(let i=0;i<50;i++)if(engine.createMatch({id:'seed',seed:String(i)}).players[0].role==='crew'){seed=String(i);break;}
 const rules={initialKillCooldownMs:1000000,sabotageCooldownMs:1000000,roamDeadlineMs:1000000,maxMatchMs:1000000};
 const config={publicOrigin:origin,dataDir:directory,worldMode:true,tickMs:100000,now:()=>now,rules,ai:{provider:'demo'}};
 async function launch(){game=await createGameServer(config,{aiController,engine:{...engine,createMatch:options=>engine.createMatch({...options,seed})}});game.server.listen(0,'127.0.0.1');await once(game.server,'listening');base=`http://127.0.0.1:${game.server.address().port}`;}
 async function request(route,data,cookie){const response=await fetch(base+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 t.after(async()=>{await game?.close();assert(path.resolve(directory).startsWith(path.resolve(parent)+path.sep));await rm(directory,{recursive:true,force:true});});
 await launch();const host=await request('/api/rooms',{mode:'human'});assert.equal(host.status,201);const route=`/api/rooms/${host.body.roomId}`;
 const started=await request(route+'/start',{id:'world-start'},host.cookie);assert.equal(started.status,200);assert.equal(started.body.game.worldVersion,1);assert.equal(started.body.game.self.role,'crew');const spawn=started.body.game.self.position;
 await t.test('normalized renderer diagonals become legal integer input, while raw floats reject',async()=>{
  const raw={seq:1,dx:Math.SQRT1_2,dy:Math.SQRT1_2};assert.equal((await request(route+'/input',raw,host.cookie)).status,400);
  const moved=await request(route+'/input',worldInputEnvelope(raw),host.cookie);assert.equal(moved.status,200);
  now+=100;const stopped=await request(route+'/input',worldInputEnvelope({seq:2,dx:0,dy:0}),host.cookie);assert.equal(stopped.status,200);
  assert(Math.abs(distance(spawn,stopped.body.game.self.position)-WORLD.speed*.1)<.001);assert(isWalkable(stopped.body.game.self.position));
  assert.equal(game.rooms.get(host.body.roomId).data.state.requests.p1.length,0,'Movement must not consume discrete action IDs');
 });
 await t.test('real navigate walks through corridors, cancels on steering, and keeps remote state private',async()=>{
  const before=(await request(route,undefined,host.cookie)).body.game.self.position;
  const walking=await request(route+'/action',{id:'navigate-archive',type:'navigate',...pickPoint(WORLD_STATIONS.archive)},host.cookie);assert.equal(walking.status,200);assert.equal(walking.body.game.self.moving,true);assert.deepEqual(walking.body.game.self.position,before);
  const conflict=await request(route+'/action',{id:'navigate-archive',type:'navigate',...pickPoint(WORLD_STATIONS.engine)},host.cookie);assert.equal(conflict.status,409);assert.equal(conflict.body.error.code,'REQUEST_CONFLICT');
  assert.deepEqual((await request(route,undefined,host.cookie)).body.game.self.destination,pickPoint(WORLD_STATIONS.archive));
  now+=500;const canceled=await request(route+'/input',{seq:3,dx:0,dy:0},host.cookie);assert.equal(canceled.status,200);assert.equal(canceled.body.game.self.moving,false);assert(distance(before,canceled.body.game.self.position)<=90.001);
  const destination=await request(route+'/action',{id:'navigate-engine',type:'navigate',...pickPoint(WORLD_STATIONS.engine)},host.cookie);assert.equal(destination.status,200);
  now+=20000;const arrived=await request(route+'/input',{seq:4,dx:0,dy:0},host.cookie);assert.equal(arrived.status,200);assert(distance(arrived.body.game.self.position,WORLD_STATIONS.engine)<.01);
  for(const player of arrived.body.game.players){assert(!('role'in player));assert(!('motion'in player));assert(!('destination'in player));assert(!('inputSeq'in player));if(player.id!=='p1')assert.equal(player.position,null);}
 });
 await t.test('spectators cannot steer and a held direction expires across restart without duplication',async()=>{
  const visitor=await request(route+'/join',{});assert.equal(visitor.status,200);assert.equal((await request(route+'/input',{seq:1,dx:1,dy:0},visitor.cookie)).status,403);
  const held=await request(route+'/input',{seq:5,dx:-1,dy:0},host.cookie);assert.equal(held.status,200);const before=held.body.game.self.position;
  await game.close();now+=1000;await launch();const settled=await request(route+'/input',{seq:5,dx:-1,dy:0},host.cookie);assert.equal(settled.status,200);
  const after=settled.body.game.self.position;assert(distance(before,after)<=WORLD.speed*WORLD.inputLeaseMs/1000+.001);assert.equal(settled.body.game.self.moving,false);
  now+=1000;const repeat=await request(route+'/input',{seq:5,dx:-1,dy:0},host.cookie);assert.equal(repeat.status,200);assert.deepEqual(repeat.body.game.self.position,after);
  assert.equal((await request(route+'/input',{seq:4,dx:0,dy:0},host.cookie)).status,409);assert.equal((await request(route+'/input',{seq:5,dx:1,dy:0},host.cookie)).status,409);
 });
});

function pickPoint(p){return {x:p.x,y:p.y};}
test('local analogue encoding preserves request identity and rejects non-direction or hidden fields',()=>{
 assert.equal(loadConfig({}).worldMode,true,'Normal application startup must enable the physical world');
 assert.deepEqual(worldInputEnvelope({seq:8,dx:.99,dy:.05}),{seq:8,dx:1,dy:0});assert.deepEqual(worldInputEnvelope({seq:9,dx:-.8,dy:.6}),{seq:9,dx:-1,dy:1});
 for(const bad of [{seq:1,dx:Infinity,dy:0},{seq:1,dx:0,dy:0,playerId:'p2'},{seq:0,dx:0,dy:0},{seq:1,dx:2,dy:0},{seq:1,dx:'1',dy:0}])assert.throws(()=>worldInputEnvelope(bad));
});
