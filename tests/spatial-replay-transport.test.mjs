import nodePath from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {createGameServer} from '../server/transport.mjs';
import {spatialFixture} from './spatial-replay-fixture.mjs';

test('replay API binds exact completed match to room authorization, denies live/paused/archive mismatches and excludes private context',async t=>{
 const parent=new URL('../_artifacts/test-temp/',import.meta.url);await mkdir(parent,{recursive:true});const directory=await mkdtemp(new URL('spatial-http-',parent));
 let origin;const service=await createGameServer({dataDir:directory,publicOrigin:'http://localhost:3000',worldMode:true,tickMs:60000,now:()=>1000,ai:{provider:'demo'}},{aiController:{describe:()=>({mode:'demo',strategy:'demo',calls:2,tokens:40,costUsd:.01}),async decide(){return null;}}});
 t.after(async()=>{await service.close();assert.equal(nodePath.dirname(directory),nodePath.resolve(fileURLToPath(parent)));await rm(directory,{recursive:true,force:true});});await new Promise(r=>service.server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+service.server.address().port;
 async function req(path,{cookie,body}={}){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:'http://localhost:3000',...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 const host=await req('/api/rooms',{body:{mode:'human'}}),other=await req('/api/rooms',{body:{mode:'human'}}),path='/api/rooms/'+host.body.roomId+'/replay';
 await req('/api/rooms/'+host.body.roomId+'/start',{cookie:host.cookie,body:{id:'spatial-start'}});
 assert.equal((await req(path,{cookie:host.cookie})).status,409);const entry=service.rooms.get(host.body.roomId),f=spatialFixture(host.body.roomId);entry.data.state={...f.state,phase:'paused',outcome:null};
 assert.equal((await req(path,{cookie:host.cookie})).status,409);entry.data.state=f.state;entry.data.aiContext={memories:{secret:'private-memory'},apiKey:'secret-provider-key',providerError:'private-provider-error'};
 assert.equal((await req(path)).status,401);assert.equal((await req(path,{cookie:other.cookie})).status,401);
 assert.equal((await req(path+'?matchId=archived-generation',{cookie:host.cookie})).status,404);
 assert.equal((await req(path+'?matchId='+other.body.roomId,{cookie:host.cookie})).status,404);
 assert.equal((await req(path+'?matchId='+host.body.roomId+'&matchId='+host.body.roomId,{cookie:host.cookie})).status,400);
 const result=await req(path+'?matchId='+host.body.roomId,{cookie:host.cookie});assert.equal(result.status,200);assert.equal(result.body.roomId,host.body.roomId);assert.equal(result.body.matchId,host.body.roomId);assert(Array.isArray(result.body.replay));assert.equal(result.body.metadata.version,1);assert.equal(result.body.ai.calls,2);
 for(const sentinel of ['private-memory','secret-provider-key','private-provider-error','aiContext','requests','cooldowns'])assert(!JSON.stringify(result.body).includes(sentinel));
 const legacy=await req(path,{cookie:host.cookie});assert.deepEqual(legacy.body.replay,result.body.replay);
 const guest=await req('/api/rooms/'+host.body.roomId+'/join',{body:{}});assert.equal((await req(path,{cookie:guest.cookie})).status,200);
});
