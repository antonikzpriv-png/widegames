import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const PIN='0842a0090f1cfd1ec43b898f16e8191e5b9c2497';

// Boundary fixture only: no browser or fake claims about native fetch cancellation.
// A completed request's deferred 401 delivery intentionally cannot be canceled.
async function ownershipFixture(){
 const saved=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
 assert.equal(execFileSync('git',['hash-object','public/app.mjs'],{cwd:root,encoding:'utf8'}).trim(),execFileSync('git',['rev-parse',`${PIN}:public/app.mjs`],{cwd:root,encoding:'utf8'}).trim());
 const requests=[];
 const feedback={messages:[],replaceChildren(...nodes){this.messages=nodes;},classList:{toggle(){}},append(){}};
 const context={AbortController,console,clearTimeout,setTimeout,history:{replaceState(){}},sessionStorage:{setItem(){},removeItem(){}},document:{querySelector:selector=>selector==='#feedback'?feedback:{}},h:(_tag,_attrs,text)=>({text}),button:()=>({}),roomFrom:data=>data.room||data,roomPath:(id,suffix='')=>`/api/rooms/${id}${suffix}`,
  request:(path,options)=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}))};
 context.globalThis=context;
 const code=saved.slice(0,saved.indexOf('const rulesToggle=')).replace(/^import .*$/gm,'');
 vm.runInNewContext(code+`;render=()=>{};saveFocus=()=>({});restoreFocus=()=>{};connect=()=>{};globalThis.audit={openRoom,accept,getRoom:()=>room,getEpoch:()=>epoch};`,context,{filename:'saved-public-app-ownership-fixture.mjs'});
 return {requests,api:context.audit};
}

test('KNOWN P3: stale 401 room-open completion starts a join using the new room abort owner',async t=>{
 const f=await ownershipFixture(),roomA='A'.repeat(24),roomB='B'.repeat(24);
 const old=f.api.openRoom(roomA);assert.equal(f.requests.length,1);const oldRequest=f.requests[0];
 const current=f.api.openRoom(roomB);assert.equal(oldRequest.options.signal.aborted,true);
 f.requests[1].resolve({roomId:roomB,game:null});await current;
 oldRequest.reject(Object.assign(new Error('Completed unauthorized response delivered late'),{status:401,name:'ApiError'}));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.requests.length,3);const staleJoin=f.requests[2];
 assert.equal(staleJoin.path,`/api/rooms/${roomA}/join`);assert.equal(staleJoin.options.signal,f.requests[1].options.signal);assert.equal(staleJoin.options.signal.aborted,false);
 staleJoin.resolve({roomId:roomA,seatId:null,game:null});await old;
 assert.equal(f.api.getRoom().roomId,roomB,'late A data must still be discarded');
 t.diagnostic('New P3 source/lifecycle finding: missing epoch guard before auto-join. Deferred unabortable 401 fixture reproduces an obsolete POST with current controller; no native-browser race frequency claim.');
});

test('positive stale-owner controls discard late successful room and websocket-equivalent snapshots',async()=>{
 const f=await ownershipFixture(),roomA='C'.repeat(24),roomB='D'.repeat(24);
 const old=f.api.openRoom(roomA),current=f.api.openRoom(roomB);f.requests[1].resolve({roomId:roomB,game:null});await current;
 f.requests[0].resolve({roomId:roomA,game:null});await old;assert.equal(f.api.getRoom().roomId,roomB);assert.equal(f.requests.length,2);
 f.api.accept({roomId:roomA,game:{version:99999,self:{role:'saboteur'}}});assert.equal(f.api.getRoom().roomId,roomB);
});
