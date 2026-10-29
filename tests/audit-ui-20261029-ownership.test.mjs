import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const PIN='0842a0090f1cfd1ec43b898f16e8191e5b9c2497';
const flush=()=>new Promise(resolve=>setImmediate(resolve));

// Explicitly synthetic queued-completion boundary. Real workflows live in fixes.mjs.
async function fixture(historical=false){
 const source=historical?execFileSync('git',['show',`${PIN}:public/app.mjs`],{cwd:root,encoding:'utf8'}):await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
 const requests=[],main={nodes:[],querySelectorAll(){return this.nodes;}};
 const feedback={replaceChildren(){},classList:{toggle(){}},append(){}};
 const context={AbortController,clearTimeout,setTimeout,history:{replaceState(){}},sessionStorage:{setItem(){},removeItem(){}},document:{querySelector:selector=>selector==='#feedback'?feedback:main},h:(_tag,_attrs,text)=>({text}),button:()=>({}),roomFrom:data=>data.room||data,roomPath:(id,suffix='')=>`/api/rooms/${id}${suffix}`,request:(path,options)=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}))};
 context.globalThis=context;
 vm.runInNewContext(source.slice(0,source.indexOf('const rulesToggle=')).replace(/^import .*$/gm,'')+`;render=()=>{};saveFocus=()=>({});restoreFocus=()=>{};connect=()=>{};schedulePoll=()=>{};globalThis.audit={openRoom,accept,getRoom:()=>room,getEpoch:()=>epoch,setConfirmation:typeof setConfirmation==='function'?setConfirmation:null};`,context);
 return {requests,main,api:context.audit};
}
const unauthorized=()=>Object.assign(new Error('Unauthorized completion'),{status:401,name:'ApiError'});
const room=(id,seatId=null)=>({roomId:id,seatId,game:null});

test('queued obsolete 401 cannot issue a fallback join under a newer controller',async()=>{
 const f=await fixture(),old=f.api.openRoom('A'),oldRequest=f.requests[0],current=f.api.openRoom('B');
 assert.equal(oldRequest.options.signal.aborted,true);assert.notEqual(oldRequest.options.signal,f.requests[1].options.signal);
 f.requests[1].resolve(room('B'));await current;oldRequest.reject(unauthorized());await old;
 assert.equal(f.requests.length,2);assert.equal(f.api.getRoom().roomId,'B');assert.equal(f.requests[1].options.signal.aborted,false);
});
test('late successful old room and mismatched snapshots cannot overwrite the current room',async()=>{
 const f=await fixture(),old=f.api.openRoom('A'),current=f.api.openRoom('B');f.requests[1].resolve(room('B'));await current;
 f.requests[0].resolve(room('A'));await old;f.api.accept({roomId:'A',game:{version:999,self:{role:'saboteur'}}});assert.equal(f.api.getRoom().roomId,'B');
});
test('failed initial join permits a new open to GET first and retry with its own signal',async()=>{
 const f=await fixture(),first=f.api.openRoom('A');f.requests[0].reject(unauthorized());await flush();
 assert.equal(f.requests[1].path,'/api/rooms/A/join');assert.equal(f.requests[1].options.signal,f.requests[0].options.signal);
 f.requests[1].reject(new TypeError('Connection reset before delivery'));await first;
 const retried=f.api.openRoom('A');assert.equal(f.requests[2].path,'/api/rooms/A');assert.equal(f.requests[0].options.signal.aborted,true);
 f.requests[2].reject(unauthorized());await flush();assert.equal(f.requests[3].path,'/api/rooms/A/join');assert.equal(f.requests[3].options.signal,f.requests[2].options.signal);
 f.requests[3].resolve(room('A'));await retried;assert.equal(f.api.getRoom().seatId,null);
});
test('uncertain join success resolves through existing cookies without a second POST or seat downgrade',async()=>{
 const f=await fixture(),first=f.api.openRoom('A');f.requests[0].reject(unauthorized());await flush();f.requests[1].reject(new TypeError('Response lost after cookie headers'));await first;
 const retried=f.api.openRoom('A');f.requests[2].resolve(room('A','p1'));await retried;
 assert.equal(f.requests.length,3);assert.equal(f.api.getRoom().seatId,'p1');
});
test('acknowledged join does not automatically join again after later unauthorized response',async()=>{
 const f=await fixture(),first=f.api.openRoom('A');f.requests[0].reject(unauthorized());await flush();f.requests[1].resolve(room('A'));await first;
 const reopened=f.api.openRoom('A');f.requests[2].reject(unauthorized());await reopened;assert.equal(f.requests.length,3);
});
test('cancel focus returns only to connected enabled triggers owned by the same room epoch',async()=>{
 const f=await fixture();let focuses=0;const trigger={isConnected:true,disabled:false,getAttribute:()=> 'eliminate-p2',focus(){focuses++;}};f.main.nodes=[trigger];
 const owner=f.api.getEpoch();f.api.setConfirmation(null,'p2',owner);assert.equal(focuses,1);
 trigger.disabled=true;f.api.setConfirmation(null,'p2',owner);assert.equal(focuses,1);
 trigger.disabled=false;trigger.isConnected=false;f.api.setConfirmation(null,'p2',owner);assert.equal(focuses,1);
 trigger.isConnected=true;const changed=f.api.openRoom('B');f.api.setConfirmation(null,'p2',owner);assert.equal(focuses,1);f.requests[0].resolve(room('B'));await changed;
});
test('historical negative control: saved source starts the obsolete POST using the newer signal',async()=>{
 const f=await fixture(true),old=f.api.openRoom('A'),current=f.api.openRoom('B');f.requests[1].resolve(room('B'));await current;f.requests[0].reject(unauthorized());await flush();
 assert.equal(f.requests.length,3);assert.equal(f.requests[2].path,'/api/rooms/A/join');assert.equal(f.requests[2].options.signal,f.requests[1].options.signal);
 f.requests[2].resolve(room('A'));await old;
});
test('historical negative control: saved source cannot repeat a failed initial join',async()=>{
 const f=await fixture(true),first=f.api.openRoom('A');f.requests[0].reject(unauthorized());await flush();f.requests[1].reject(new TypeError('Connection reset'));await first;
 const retry=f.api.openRoom('A');f.requests[2].reject(unauthorized());await retry;assert.equal(f.requests.length,3);assert.equal(f.api.getRoom(),null);
});
