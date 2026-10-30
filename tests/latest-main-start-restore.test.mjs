import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {loadConfig} from '../server/config.mjs';
import {createGameServer} from '../server/transport.mjs';
import {createRoom,issueIdentity} from '../server/rooms.mjs';
import {createRoomStore} from '../server/store.mjs';
import * as engine from '../server/engine/index.mjs';
const listen=(server,port)=>new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
test('accepted start identity rejects a different map without changing the persisted match',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'latest-map-start-')),probe=net.createServer();await listen(probe,0);const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const origin='http://127.0.0.1:'+port,config=loadConfig({HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:origin,DATA_DIR:directory,AI_PROVIDER:'demo'});config.now=()=>1000;
 const game=await createGameServer(config,{aiController:{describe:()=>({mode:'demo',provider:'demo'}),decide:async()=>null}});
 try{
  await listen(game.server,port);const created=await fetch(origin+'/api/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({mode:'human',mapId:'storm-foundry'})});assert.equal(created.status,201);
  const cookie=created.headers.get('set-cookie').split(';')[0],room=await created.json(),url=origin+'/api/rooms/'+room.roomId+'/start';
  const post=mapId=>fetch(url,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({id:'same-start',mapId})});
  const first=await post('storm-foundry');assert.equal(first.status,200);const accepted=await first.json();assert.equal(accepted.game.mapId,'storm-foundry');
  const file=path.join(directory,'room-'+room.roomId+'.json'),before=await readFile(file);
  const conflict=await post('tidal-observatory');assert.equal(conflict.status,409);assert.equal((await conflict.json()).error.code,'START_CONFLICT');assert.deepEqual(await readFile(file),before);
  const repeat=await post('storm-foundry');assert.equal(repeat.status,200);const same=await repeat.json();assert.equal(same.game.matchId,accepted.game.matchId);assert.equal(same.game.mapId,'storm-foundry');
 }finally{await game.close();await rm(directory,{recursive:true,force:true});}
});
test('actual main schema1 expanded saves restore without bootstrapping unrelated fallback geometry',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'latest-map-restore-'));let store;
 try{
  const room=createRoom('human',1000);issueIdentity(room,true);room.mapId='tidal-observatory';room.startId='old-main-start';room.state=engine.createMatch({id:room.id,world:true,mapId:room.mapId,now:1000,seed:'old-main'});
  store=await createRoomStore(directory);await store.save(room);await store.close();const file=path.join(directory,'room-'+room.id+'.json'),before=await readFile(file);
  store=await createRoomStore(directory,{worldGeometry:{}});const restored=await store.load();assert.equal(restored.length,1);assert.equal(restored[0].schema,1);assert.equal(restored[0].state.schemaVersion,2);assert.equal(restored[0].state.mapId,'tidal-observatory');assert.equal(restored[0].state.players.flatMap(p=>p.tasks).length,60);assert.deepEqual(await readFile(file),before);
 }finally{await store?.close();await rm(directory,{recursive:true,force:true});}
});
