import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import * as engine from '../server/engine/index.mjs';
import {getWorld,MAPS,WORLD} from '../shared/world.mjs';
import {createGameServer} from '../server/transport.mjs';
import {createRoomStore,validateRoomSnapshot} from '../server/store.mjs';
import {createAiController} from '../server/ai/index.mjs';
import {CHARACTERS} from '../shared/contracts.mjs';
import {taskProgress,taskInput} from '../server/engine/tasks.mjs';

const expansions=['storm-foundry','tidal-observatory'];
const captchaKinds=['glyphs','count','order','rotate','oddity','code'];
const point=p=>({x:p.x,y:p.y});
const roomFor=state=>({schema:1,id:state.id,mode:state.mode,createdAt:1000,updatedAt:state.updatedAt,identities:[{hash:'a'.repeat(64),host:true,seatId:state.mode==='human'?'p1':null}],state,startId:'start',aiContext:{},...(state.mapId?{mapId:state.mapId}:{})});
let request=0;
const act=(s,p,type,fields={},now=s.updatedAt)=>engine.applyAction(s,p.id,{id:`maps-${++request}`,type,...fields},now);

for(const mapId of expansions)test(`expanded geometry ${mapId}: detailed scale, colliders and station routes`,{timeout:60000},()=>{
 const w=getWorld(mapId),meta=MAPS.find(m=>m.id===mapId);assert(meta);assert.equal(w.metadata.id,mapId);
 assert(w.WORLD.width>WORLD.width&&w.WORLD.height>WORLD.height);assert(w.WORLD.width*w.WORLD.height>=WORLD.width*WORLD.height*2);
 assert(w.WORLD_ROOMS.length>=12);assert(w.WORLD_OBSTACLES.length>=w.WORLD_ROOMS.length*2);assert(w.WORLD_DECOR.length>=w.WORLD_ROOMS.length);
 const spawn=w.worldSpawn('p1');assert(w.isWalkable(spawn));for(const p of CHARACTERS)assert(w.isWalkable(w.worldSpawn(p.id)),`${p.id} spawn`);
 assert(w.isWalkable(w.WORLD_BELL));assert(w.findWorldPath(spawn,w.WORLD_BELL),'reachable emergency bell');
 for(const station of Object.values(w.WORLD_STATIONS)){
  assert(w.isWalkable(station),`walkable ${station.id}`);const route=w.findWorldPath(spawn,station);assert(route,`reachable ${station.id}`);assert(route.every(p=>w.isWalkable(p)));assert.deepEqual(route.at(-1)||spawn,point(station));
 }
 for(const obstacle of w.WORLD_OBSTACLES)assert(!w.isWalkable({x:obstacle.x+obstacle.width/2,y:obstacle.y+obstacle.height/2}),obstacle.id);
 assert(!w.isWalkable({x:0,y:0}));
});

test('map selection is isolated per match, validates identities and preserves old-map snapshots',async()=>{
 const matches=expansions.map((mapId,i)=>engine.createMatch({id:`isolated-map-${i}`.padEnd(24,'x'),world:true,mapId,mode:'human',now:1000,seed:'isolation'}));
 for(let i=0;i<matches.length;i++){
  const mapId=expansions[i],w=getWorld(mapId),s=matches[i],target=Object.values(w.WORLD_STATIONS)[1];assert.equal(s.mapId,mapId);assert.deepEqual(s.players[0].position,w.worldSpawn('p1'));
  const n=act(s,s.players[0],'navigate',point(target),1000);assert(n.accepted,JSON.stringify(n.error));matches[i]=n.state;
 }
 for(let n=0;n<10;n++)for(let i=0;i<matches.length;i++){matches[i]=engine.tick(matches[i],1250+n*250).state;assert.equal(matches[i].mapId,expansions[i]);assert(getWorld(expansions[i]).isWalkable(matches[i].players[0].position));await validateRoomSnapshot(roomFor(matches[i]));}
 for(const invalid of ['unknown-map',null,12,{}])assert.throws(()=>engine.createMatch({id:'invalid-map',world:true,mapId:invalid}));
 const old=engine.createMatch({id:'old-map'.padEnd(24,'x'),mode:'human',world:true,now:1000,seed:'old'});delete old.mapId;await validateRoomSnapshot(roomFor(old));assert.equal(getWorld().metadata.id,'beacon');assert(getWorld().isWalkable(old.players[0].position));
 const directory=await mkdtemp(path.join(os.tmpdir(),'maps-old-'));let store;
 try{store=await createRoomStore(directory);await store.save(roomFor(old));await store.close();store=await createRoomStore(directory);const restored=(await store.load())[0];assert(restored);assert.equal(restored.state.mapId,undefined);assert.deepEqual(restored.state.players[0].position,old.players[0].position);}finally{await store?.close();await rm(directory,{recursive:true,force:true});}
});

for(const mapId of expansions)test(`${mapId}: sixty unique tasks, all CAPTCHA kinds, private steps, wrong/duplicate inputs and durable progress`,async()=>{
 const w=getWorld(mapId);let s=engine.createMatch({id:`captcha-${mapId}`.padEnd(24,'x'),mode:'spectator',world:true,mapId,now:1000,seed:'captcha-coverage'});
 assert.equal(s.players.flatMap(p=>p.tasks).length,60);assert.equal(new Set(s.players.flatMap(p=>p.tasks).map(t=>t.id)).size,60);
 const crew=s.players.filter(p=>p.role==='crew');for(const p of crew){assert.equal(p.tasks.length,12);for(const kind of captchaKinds)assert(p.tasks.some(t=>taskProgress(t).kind===kind),`${p.id}: ${kind}`);}
 const owner=crew[0];let now=s.updatedAt;
 for(const kind of captchaKinds){
  let p=s.players.find(p=>p.id===owner.id),task=p.tasks.find(t=>taskProgress(t).kind===kind);p.position=point(w.WORLD_STATIONS[task.roomId]);p.roomId=task.roomId;
  const bad=act(s,p,'taskStep',{taskId:task.id,step:taskProgress(task).index,input:'wrong-input'},now);assert.equal(bad.accepted,false);assert.equal(bad.error.code,'WRONG_INPUT');s=bad.state;
  const c=taskProgress(task),a={id:`persist-${kind}`,type:'taskStep',taskId:task.id,step:c.index,input:taskInput(task)};let r=engine.applyAction(s,p.id,a,now);assert(r.accepted,JSON.stringify(r.error));s=JSON.parse(JSON.stringify(r.state));assert(engine.applyAction(s,p.id,a,now).duplicate);
  task=s.players.find(p=>p.id===owner.id).tasks.find(t=>t.id===task.id);while(taskProgress(task).index<taskProgress(task).total){const c=taskProgress(task);r=act(s,p,'taskStep',{taskId:task.id,step:c.index,input:taskInput(task)},now);assert(r.accepted);s=r.state;task=s.players.find(p=>p.id===owner.id).tasks.find(t=>t.id===task.id);}
  r=act(s,p,'task',{taskId:task.id},now);assert(r.accepted);s=r.state;await validateRoomSnapshot(roomFor(s));
  const other=engine.getPlayerView(s,crew[1].id,s.updatedAt),publicView=engine.getPlayerView(s,null,s.updatedAt);assert(other.players.every(p=>!Object.hasOwn(p,'tasks')));assert.equal(publicView.self,null);assert(!JSON.stringify(publicView).includes(task.id));
  now+=s.rules.taskCooldownMs;s=engine.tick(s,now).state;
 }
 const directory=await mkdtemp(path.join(os.tmpdir(),'maps-captcha-'));let store;
 try{store=await createRoomStore(directory);await store.save(roomFor(s));await store.close();store=await createRoomStore(directory);const restored=(await store.load())[0];assert.equal(restored.state.mapId,mapId);assert.deepEqual(restored.state.players.find(p=>p.id===owner.id).tasks,s.players.find(p=>p.id===owner.id).tasks);}finally{await store?.close();await rm(directory,{recursive:true,force:true});}
});

test('HTTP map configuration is host-authorized, immutable after start and restored per room',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'maps-http-')),origin='http://maps.test';const config={dataDir:directory,publicOrigin:origin,worldMode:true,tickMs:600000,now:()=>1000,ai:{provider:'demo'}};
 const idle={describe:()=>({mode:'demo',provider:'demo'}),decide:async()=>null};let game=await createGameServer(config,{aiController:idle});
 async function listen(){game.server.listen(0,'127.0.0.1');await once(game.server,'listening');return 'http://127.0.0.1:'+game.server.address().port;}let base=await listen();t.after(async()=>{await game.close();await rm(directory,{recursive:true,force:true});});
 async function req(route,{body,cookie}={}){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 for(const mapId of ['unknown-map',null,12])assert.equal((await req('/api/rooms',{body:{mode:'human',mapId}})).status,400);
 const rooms=[];for(const mapId of expansions){const host=await req('/api/rooms',{body:{mode:'human',mapId}});assert.equal(host.status,201);assert.equal(host.body.mapId,mapId);const route='/api/rooms/'+host.body.roomId,observer=await req(route+'/join',{body:{}});assert.equal((await req(route+'/start',{body:{id:'not-host',mapId},cookie:observer.cookie})).status,403);const started=await req(route+'/start',{body:{id:'start',mapId},cookie:host.cookie});assert.equal(started.status,200);assert.equal(started.body.game.mapId,mapId);assert.equal(started.body.game.tasks.total,60);const duplicate=await req(route+'/start',{body:{id:'start',mapId:mapId===expansions[0]?expansions[1]:expansions[0]},cookie:host.cookie});assert.equal(duplicate.status,200);assert.equal(duplicate.body.game.mapId,mapId);rooms.push({mapId,route,cookie:host.cookie});}
 await game.close();game=await createGameServer(config,{aiController:idle});base=await listen();for(const r of rooms){const restored=await req(r.route,{cookie:r.cookie});assert.equal(restored.body.game.mapId,r.mapId);assert.equal(restored.body.game.tasks.total,60);}
 const files=await import('node:fs/promises').then(fs=>fs.readdir(directory));assert.equal(files.filter(f=>/^room-.*\.json$/.test(f)).length,2);
});

for(const mapId of expansions)test(`${mapId}: complete safe-view demo with CAPTCHA work, ghost/ability presets and restart`,{timeout:240000},async t=>{
 const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('No provider calls allowed');});let state=engine.createMatch({id:`full-demo-${mapId}`.padEnd(24,'x'),world:true,mapId,mode:'spectator',now:1000,seed:7,features:{deathPolicy:'ghost-tasks',abilities:true},config:{discussionMs:6000,votingMs:4000}});
 let ai=createAiController({config:{provider:'demo',decisionIntervalMs:1000}}),context={},restarted=false;const kinds=new Set(),types=new Set();
 for(let now=1000;now<=state.startedAt+state.rules.maxMatchMs&&!['ended','paused'].includes(state.phase);now+=250){state=engine.tick(state,now).state;for(const player of CHARACTERS){const view=engine.getPlayerView(state,player.id,now),a=await ai.decide({view,player,context});if(!a)continue;if(a.type==='taskStep'){const task=view.self.tasks.find(t=>t.id===a.taskId);kinds.add(taskProgress(task).kind);}const r=engine.applyAction(state,player.id,a,now);assert(r.accepted,JSON.stringify({mapId,a,error:r.error}));state=r.state;types.add(a.type);await validateRoomSnapshot(roomFor(state));}if(!restarted&&types.has('taskStep')){state=JSON.parse(JSON.stringify(state));context=JSON.parse(JSON.stringify(context));ai=createAiController({config:{provider:'demo',decisionIntervalMs:1000}});restarted=true;}}
 assert(restarted);assert.equal(state.phase,'ended',JSON.stringify({mapId,outcome:state.outcome,types:[...types],kinds:[...kinds]}));assert(['tasks','ejection','critical','parity'].includes(state.outcome.reason));assert(kinds.size>0);assert.equal(state.players.flatMap(p=>p.tasks).length,60);assert.equal(fetch.mock.callCount(),0);assert.equal(ai.describe(context).calls,0);t.diagnostic(JSON.stringify({mapId,outcome:state.outcome,kinds:[...kinds],types:[...types]}));
});
