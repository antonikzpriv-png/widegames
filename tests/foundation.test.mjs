import test from 'node:test';
import assert from 'node:assert/strict';
import {loadConfig} from '../server/config.mjs';
import {ROOM_LAYOUT,CHARACTERS} from '../shared/contracts.mjs';
import http from 'node:http';
import {serveStatic} from '../server/static.mjs';
test('map is connected, symmetric and contains six distinct characters',()=>{assert.equal(new Set(CHARACTERS.map(p=>p.id)).size,6);for(const room of ROOM_LAYOUT)for(const neighbor of room.neighbors)assert(ROOM_LAYOUT.find(r=>r.id===neighbor)?.neighbors.includes(room.id));const seen=new Set(['bridge']);for(let i=0;i<6;i++)for(const room of ROOM_LAYOUT)if(seen.has(room.id))room.neighbors.forEach(id=>seen.add(id));assert.equal(seen.size,6);});
test('config bounds spending and concurrency without exposing credentials to shared constants',()=>{assert.equal(loadConfig({}).ai.provider,'demo');assert.throws(()=>loadConfig({MAX_AI_COST_USD:'Infinity'}));assert.throws(()=>loadConfig({MAX_ACTIVE_ROOMS:'0'}));assert.throws(()=>loadConfig({PORT:'abc'}));assert.throws(()=>loadConfig({AI_PROVIDER:'unknown'}));});
test('static service serves the room shell but never source/config/data traversal',async t=>{const server=http.createServer(serveStatic);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));const base=`http://127.0.0.1:${server.address().port}`;const page=await fetch(base+'/r/test-room');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);for(const suffix of ['/server/config.mjs','/.env','/data/room.json','/%2e%2e%2fserver%2fconfig.mjs','/shared/%2e%2e%2fserver/config.mjs'])assert.equal((await fetch(base+suffix)).status,404,suffix);});
