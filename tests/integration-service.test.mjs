/** Real HTTP/room/engine boundaries; explicitly stub only model decisions. */
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createGameServer} from '../server/transport.mjs';import {loadConfig} from '../server/config.mjs';
const origin='http://lantern.test';
async function service(t,extras={},dependencies={}){
 const directory=await mkdtemp(path.join(os.tmpdir(),'lantern-integration-'));
 const seen=new Set();let id=0;
 const aiController={describe:()=>({mode:'demo',provider:'demo',calls:0,tokens:0,costUsd:0}),async decide({view,player}){seen.add(player.id);assert.equal(view.self.id,player.id);assert(view.players.every(p=>!Object.hasOwn(p,'role')));return {id:'probe:'+id++,type:'wait'};}};
 // Historical scheduler/idempotency fixtures retain schema1 room-step movement.
 // Actual world/schema3 denial boundaries remain in world-* and beacon-* tests.
 const config={...loadConfig({DATA_DIR:directory,PUBLIC_ORIGIN:origin}),worldMode:false,systemsMode:false,tickMs:25,...extras};config.ai={...config.ai,decisionIntervalMs:100};
 const game=await createGameServer(config,{aiController,...dependencies});await new Promise(r=>game.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+game.server.address().port;
 t.after(async()=>{await game.close();await rm(directory,{recursive:true,force:true});});
 async function request(route,body,cookie){const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 return {request,seen};
}
test('real scheduler gives all six AI identities a turn when due times overlap',async t=>{
 const {request,seen}=await service(t);const made=await request('/api/rooms',{mode:'spectator'});assert.equal(made.status,201);
 const route='/api/rooms/'+made.body.roomId;assert.equal((await request(route+'/start',{id:'start'},made.cookie)).status,200);
 const end=Date.now()+10000;while(seen.size<6&&Date.now()<end)await new Promise(r=>setTimeout(r,30));
 assert.deepEqual([...seen].sort(),['p1','p2','p3','p4','p5','p6']);
});
test('HTTP denial state persists: a rejected request ID cannot become a different action',async t=>{
 let now=1000000;const {request}=await service(t,{now:()=>now});
 const made=await request('/api/rooms',{mode:'human'}),route='/api/rooms/'+made.body.roomId;
 await request(route+'/start',{id:'start'},made.cookie);
 assert.equal((await request(route+'/action',{id:'move',type:'move',roomId:'archive'},made.cookie)).status,200);
 const denied=await request(route+'/action',{id:'denied',type:'move',roomId:'engine'},made.cookie);assert.equal(denied.status,409);assert.equal(denied.body.error.code,'INVALID_ROOM');
 now+=2000;
 const replayed=await request(route+'/action',{id:'denied',type:'move',roomId:'bridge'},made.cookie);
 assert.equal(replayed.status,409);assert.equal(replayed.body.error.code,'REQUEST_CONFLICT');
 assert.equal((await request(route,undefined,made.cookie)).body.game.self.roomId,'archive');
});
test('reaching an inactive phase aborts pending AI work without waiting for browser disconnect',async t=>{
 let started=false,aborted=false,now=1000000;
 const aiController={describe:()=>({mode:'demo',provider:'test-stub'}),async decide({signal}){started=true;await new Promise(resolve=>{if(signal.aborted){aborted=true;resolve();return;}signal.addEventListener('abort',()=>{aborted=true;resolve();},{once:true});});return null;}};
 const {request}=await service(t,{now:()=>now,rules:{maxMatchMs:300}},{aiController});
 const made=await request('/api/rooms',{mode:'spectator'}),route='/api/rooms/'+made.body.roomId;await request(route+'/start',{id:'start'},made.cookie);
 const ready=Date.now()+10000;while(!started&&Date.now()<ready)await new Promise(r=>setTimeout(r,20));
 now+=300;
 const end=Date.now()+10000;while(!aborted&&Date.now()<end)await new Promise(r=>setTimeout(r,20));
 assert(started,'A real scheduled decision must be pending');assert(aborted,'No AI request may continue after the rules pause');
 assert.equal((await request(route,undefined,made.cookie)).body.game.phase,'paused');
});
