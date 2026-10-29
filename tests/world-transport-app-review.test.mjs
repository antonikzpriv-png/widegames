/** Actual root app code; queued network completions and renderer are labelled VM fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Default is the tested checkout, never a sibling worktree or historical embedded app.
const sourceRoot=process.env.WORLD_TRANSPORT_APP_REVIEW_ROOT
 ?pathToFileURL(path.resolve(process.env.WORLD_TRANSPORT_APP_REVIEW_ROOT)+path.sep)
 :new URL('../',import.meta.url);
const source=await readFile(new URL('public/app.mjs',sourceRoot),'utf8');
const apiModule=await import(new URL('public/api.mjs',sourceRoot));
const {worldInputEnvelope}=await import(new URL('public/world-input-envelope.mjs',sourceRoot));
const boundary=source.indexOf('const rulesToggle=');
assert(boundary>0&&source.includes('async function worldInput('),'Review requires actual world app source');
const prefix=source.slice(0,boundary).replace(/^import .*$/gm,'');
const plain=value=>JSON.parse(JSON.stringify(value));
const state=(id,version=1,phase='roam')=>({roomId:id,mode:'human',seatId:'p1',isHost:true,phase,game:{worldVersion:1,matchId:'match-'+id,phase,version,serverNow:100000+version,self:{id:'p1',role:'crew',alive:true,inputSeq:0,moving:false,position:{x:728,y:272}},players:[]}});
function fixture(){
 const requests=[],cleanupRequests=[],allRequests=[],scenes=[],stored=[];let now=100000;
 const feedback={children:[],attributes:{},classList:{toggle(){}},replaceChildren(...nodes){this.children=nodes;},append(node){this.children.push(node);},setAttribute(key,value){this.attributes[key]=value;},get textContent(){return this.children.map(node=>node.text||'').join(' ');}};
 const main={replaceChildren(){},querySelectorAll(){return [];}};
 const body={};
 const context={AbortController,DOMException,crypto,clearTimeout,setTimeout,Date:class extends Date{static now(){return now;}},document:{hidden:false,body,activeElement:body,querySelector:selector=>selector==='#feedback'?feedback:main},history:{replaceState(){},pushState(){}},sessionStorage:{setItem:(...args)=>stored.push(args),removeItem(){}},h:(tag,attributes,text)=>({tag,attributes,text}),button:(text,click)=>({text,click}),...apiModule,worldInputEnvelope,
  request:(route,options)=>new Promise((resolve,reject)=>{
   const parent=context.audit?.getSignal(),record={route,options,resolve,reject,parentAbortedAtIssue:parent?.aborted};
   allRequests.push(record);(options.keepalive?cleanupRequests:requests).push(record);
  }),
  createWorldExperience(_host,callbacks){const scene={callbacks,updates:[],disposed:false,update(...args){this.updates.push(args);},dispose(){this.disposed=true;}};scenes.push(scene);return scene;}};
 context.globalThis=context;
 // Keep actual renderWorld and app ownership/network handlers; drawing and background IO are injected.
 vm.runInNewContext(prefix+`;render=()=>{if(roomId&&room)renderWorld();};saveFocus=()=>({});restoreFocus=()=>{};connect=()=>{};schedulePoll=()=>{};globalThis.audit={openRoom,accept,home,stop,getRoom:()=>room,getReady:()=>networkReady,getConnectionIssue:()=>connectionIssue,getSignal:()=>controller?.signal};`,context);
 async function open(id,snapshot=state(id)){await context.audit.openRoom(id,snapshot);return scenes.at(-1);}
 return {api:context.audit,open,requests,cleanupRequests,allRequests,scenes,stored,feedback,context,setNow(value){now=value;}};
}
const transportFailures=[['TypeError',()=>new TypeError('Synthetic reset')],['timeout',()=>new DOMException('Synthetic timeout','TimeoutError')],['HTTP500',()=>new apiModule.ApiError('Synthetic service failure',500,'SERVICE_UNAVAILABLE')],['HTTP503',()=>new apiModule.ApiError('Synthetic service failure',503,'SERVICE_UNAVAILABLE')]];
async function rejectMovement(f,scene,error,seq=1){
 const result=scene.callbacks.input({seq,dx:1,dy:0}),rejected=assert.rejects(result,e=>e===error);f.requests.at(-1).reject(error);await rejected;
}

test('WN1 original invariant and extended failures revoke readiness promptly, block steering, allow stop and recover',async t=>{
 for(const [label,makeError]of transportFailures)await t.test(label,async()=>{
  const f=fixture(),scene=await f.open('A');await rejectMovement(f,scene,makeError());
  assert.equal(f.api.getReady(),false);assert.equal(scene.updates.at(-1)[1].connected,false);assert.equal(f.api.getConnectionIssue(),true);
  await assert.rejects(scene.callbacks.input({seq:2,dx:1,dy:0}),{name:'AbortError'});assert.equal(f.requests.length,1);
  const stopped=scene.callbacks.input({seq:3,dx:0,dy:0});assert.equal(f.requests.length,2);assert.deepEqual(plain(f.requests[1].options.body),{seq:3,dx:0,dy:0});
  f.requests[1].resolve(state('A',2));await stopped;assert.equal(f.api.getReady(),true);assert.equal(scene.updates.at(-1)[1].connected,true);
  const fresh=scene.callbacks.input({seq:4,dx:0,dy:1});assert.equal(f.requests.length,3);f.requests[2].resolve(state('A',3));await fresh;
 });
});

test('failure inside five-second feedback throttle still revokes readiness and renders disconnected',async()=>{
 const f=fixture(),scene=await f.open('A');await rejectMovement(f,scene,new TypeError('First synthetic reset'));
 const notice=f.feedback.textContent;f.api.accept(state('A',2));assert.equal(f.api.getReady(),true);f.setNow(100001);
 await rejectMovement(f,scene,new DOMException('Second synthetic timeout','TimeoutError'),2);
 assert.equal(f.api.getReady(),false);assert.equal(scene.updates.at(-1)[1].connected,false);assert.equal(f.api.getConnectionIssue(),true);assert(!f.feedback.textContent.includes('Second synthetic timeout'));assert(notice.includes('First synthetic reset'));
});

test('only an accepted current snapshot restores readiness; foreign, older and earlier-time views do not',async()=>{
 const f=fixture(),scene=await f.open('A',state('A',10));await rejectMovement(f,scene,new TypeError('Synthetic reset'));
 const earlierTime=state('A',10);earlierTime.game.serverNow--;
 for(const ignored of [state('B',999),state('A',9),earlierTime,{roomId:'A',game:null}]){
  f.api.accept(ignored);assert.equal(f.api.getReady(),false);await assert.rejects(scene.callbacks.input({seq:2,dx:0,dy:1}),{name:'AbortError'});assert.equal(f.requests.length,1);
 }
 f.api.accept(state('A',11));assert.equal(f.api.getReady(),true);const fresh=scene.callbacks.input({seq:3,dx:0,dy:1});f.requests[1].resolve(state('A',12));await fresh;
});

test('ordinary409 is a rule denial, keeps a healthy connection ready, and cannot restore an existing outage',async()=>{
 const f=fixture(),scene=await f.open('A');await rejectMovement(f,scene,new apiModule.ApiError('Synthetic stale sequence',409,'STALE_INPUT'));
 assert.equal(f.api.getReady(),true);assert.equal(scene.updates.at(-1)[1].connected,true);
 await rejectMovement(f,scene,new TypeError('Synthetic reset'),2);assert.equal(f.api.getReady(),false);
 const stopped=scene.callbacks.input({seq:3,dx:0,dy:0}),rejected=assert.rejects(stopped,/Synthetic phase denial/);f.requests[2].reject(new apiModule.ApiError('Synthetic phase denial',409,'WRONG_PHASE'));await rejected;assert.equal(f.api.getReady(),false);
});

test('obsolete owner and same-room obsolete epoch failures never change current readiness or feedback',async()=>{
 for(const [label,makeError]of transportFailures)for(const newRoom of ['A','B']){
  const f=fixture(),scene=await f.open('A'),error=makeError(),pending=scene.callbacks.input({seq:1,dx:1,dy:0}),rejected=assert.rejects(pending,e=>e===error);
  const original=f.requests[0];await f.open(newRoom,state(newRoom,5));assert(original.options.signal.aborted,label);const notice=f.feedback.textContent;
  original.reject(error);await rejected;assert.equal(f.api.getReady(),true,label);assert.equal(f.feedback.textContent,notice);assert.equal(f.api.getRoom().roomId,newRoom);assert.equal(f.api.getRoom().game.version,5);
 }
});

test('non-roam, dead, spectator and already-idle zero input avoid unnecessary HTTP packets',async()=>{
 for(const phase of ['lobby','discussion','voting','paused','ended','dead','spectator','roam']){
  const f=fixture(),snapshot=state('A',1,phase);if(phase==='lobby')snapshot.game=null;if(phase==='dead'){snapshot.game.phase='roam';snapshot.game.self.alive=false;}if(phase==='spectator'){snapshot.game.phase='roam';snapshot.game.self=null;snapshot.seatId=null;}
  const scene=await f.open('A',snapshot);await scene.callbacks.input({seq:1,dx:0,dy:0});assert.equal(f.requests.length,0,phase);
  if(phase!=='roam'){await assert.rejects(scene.callbacks.input({seq:2,dx:1,dy:0}),{name:'AbortError'});assert.equal(f.requests.length,0,phase);}
 }
});

test('same-ID retry remains on original room route/body, and acknowledgement removes the overlay control',async()=>{
 const f=fixture(),scene=await f.open('A',state('A',1,'discussion')),action=scene.callbacks.action('say',{text:'Synthetic reply.'}),rejected=assert.rejects(action,/Synthetic lost acknowledgement/);f.requests[0].reject(new TypeError('Synthetic lost acknowledgement'));await rejected;
 assert.equal(f.feedback.attributes['data-retry'],'true');const retry=f.feedback.children.find(node=>node.text==='Retry same request');assert(retry);
 const resent=retry.click();assert.equal(f.requests[1].route,f.requests[0].route);assert.deepEqual(plain(f.requests[1].options.body),plain(f.requests[0].options.body));assert.equal(f.requests[1].route,'/api/rooms/A/action');
 f.requests[1].resolve(state('A',2,'discussion'));await resent;assert.equal(f.feedback.attributes['data-retry'],'false');assert(!f.feedback.children.some(node=>node.text==='Retry same request'));
});

test('old retry control is inert after entering another room before that room has a pending retry',async()=>{
 const f=fixture(),scene=await f.open('A'),action=scene.callbacks.action('task',{taskId:'task-A'}),rejected=assert.rejects(action,/Synthetic lost acknowledgement/);f.requests[0].reject(new TypeError('Synthetic lost acknowledgement'));await rejected;
 const retry=f.feedback.children.find(node=>node.text==='Retry same request');assert(retry);await f.open('B');await retry.click();assert.equal(f.requests.length,1);assert.equal(f.api.getRoom().roomId,'B');
});

test('old world callbacks and late responses cannot cross rooms or replace the current private view',async()=>{
 const f=fixture(),old=await f.open('A'),pending=old.callbacks.input({seq:1,dx:1,dy:0}),rejected=assert.rejects(pending,{name:'AbortError'});await f.open('B');
 for(const call of [()=>old.callbacks.input({seq:2,dx:1,dy:0}),()=>old.callbacks.action('task',{taskId:'task-A'}),()=>old.callbacks.start(),()=>old.callbacks.loadReplay()])await assert.rejects(call(),{name:'AbortError'});
 assert.equal(f.requests.length,1);const stale=state('A',999);stale.game.self.role='saboteur';f.requests[0].resolve(stale);await rejected;assert.equal(f.api.getRoom().roomId,'B');assert.equal(f.api.getRoom().game.self.role,'crew');assert.deepEqual(f.stored,[['lantern-room','A'],['lantern-room','B']]);
});
function assertCleanup(request,id){
 assert.equal(request.route,apiModule.roomPath(id,'/input'));assert.equal(request.options.method,'POST');assert.equal(request.options.keepalive,true);assert.equal(request.options.timeoutMs,1500);assert(!Object.hasOwn(request.options,'signal'));
 const body=plain(request.options.body);assert.deepEqual(Object.keys(body).sort(),['dx','dy','seq']);assert.equal(body.dx,0);assert.equal(body.dy,0);assert(Number.isSafeInteger(body.seq)&&body.seq>0);
}

test('WN2: retained A retry cannot invoke B uncertain retry, while current B sends exactly its body and request ID',async()=>{
 const f=fixture(),a=await f.open('A'),first=a.callbacks.action('task',{taskId:'task-A'}),firstRejected=assert.rejects(first,/Synthetic A reset/);f.requests[0].reject(new TypeError('Synthetic A reset'));await firstRejected;
 const retainedA=f.feedback.children.find(node=>node.text==='Retry same request');assert(retainedA);
 const b=await f.open('B');for(const request of f.cleanupRequests)assertCleanup(request,'A');
 const second=b.callbacks.action('task',{taskId:'task-B'}),secondRejected=assert.rejects(second,/Synthetic B reset/);f.requests[1].reject(new TypeError('Synthetic B reset'));await secondRejected;
 const currentB=f.feedback.children.find(node=>node.text==='Retry same request'),count=f.requests.length;assert(currentB);await retainedA.click();assert.equal(f.requests.length,count,'obsolete A control must not dispatch B retry');
 const resent=currentB.click();assert.equal(f.requests.length,count+1);const sent=f.requests.at(-1);assert.equal(sent.route,'/api/rooms/B/action');assert.deepEqual(plain(sent.options.body),plain(f.requests[1].options.body));assert.equal(sent.options.body.taskId,'task-B');assert.equal(sent.options.body.id,f.requests[1].options.body.id);sent.resolve(state('B',2));await resent;
});

test('retained retry identity and epoch also bind controls after a different same-room failure or reconnect',async()=>{
 const f=fixture(),a=await f.open('A');
 async function uncertain(taskId){const pending=a.callbacks.action('task',{taskId}),rejected=assert.rejects(pending,/Synthetic reset/);f.requests.at(-1).reject(new TypeError('Synthetic reset'));await rejected;return f.feedback.children.find(node=>node.text==='Retry same request');}
 const first=await uncertain('task-first'),second=await uncertain('task-second');const before=f.requests.length;await first.click();assert.equal(f.requests.length,before);
 const resent=second.click();assert.equal(f.requests.at(-1).options.body.taskId,'task-second');assert.deepEqual(plain(f.requests.at(-1).options.body),plain(f.requests[1].options.body));f.requests.at(-1).resolve(state('A',2));await resent;
 const beforeReconnect=await uncertain('task-before-reconnect');await f.open('A',state('A',3));const current=await uncertain('task-current'),count=f.requests.length;await beforeReconnect.click();assert.equal(f.requests.length,count);
 const currentResult=current.click();assert.equal(f.requests.at(-1).options.body.taskId,'task-current');f.requests.at(-1).resolve(state('A',4));await currentResult;
});

test('hide and exit issue only scoped zero cleanup before abort, detached from parent, and ignore all cleanup replies',async()=>{
 for(const leave of ['hide','exit','switch']){
  const f=fixture(),scene=await f.open('A'),moving=scene.callbacks.input({seq:50,dx:1,dy:0}),rejected=assert.rejects(moving,{name:'AbortError'}),active=f.requests[0];
  if(leave==='hide'){f.context.document.hidden=true;f.api.stop();}else if(leave==='exit'){f.api.home();}else await f.open('B');
  assert(f.cleanupRequests.length>0);for(const cleanup of f.cleanupRequests){assertCleanup(cleanup,'A');assert(cleanup.options.body.seq>50);assert.equal(cleanup.parentAbortedAtIssue,false);}
  assert(active.options.signal.aborted);const current=f.api.getRoom(),currentReady=f.api.getReady(),notice=f.feedback.textContent;
  const stale=state('A',999);stale.game.self.role='saboteur';active.resolve(stale);await rejected;
  for(const cleanup of f.cleanupRequests)cleanup.resolve(stale);await Promise.resolve();await Promise.resolve();assert.equal(f.api.getRoom(),current);assert.equal(f.api.getReady(),currentReady);assert.equal(f.feedback.textContent,notice);
 }
});

test('cleanup failure cannot mark the new room unavailable; non-roam/dead/spectator lifecycle needs no cleanup',async()=>{
 const f=fixture();await f.open('A');await f.open('B');assert(f.cleanupRequests.length>0);for(const cleanup of f.cleanupRequests){assertCleanup(cleanup,'A');cleanup.reject(new TypeError('Synthetic failed best-effort stop'));}await Promise.resolve();await Promise.resolve();assert.equal(f.api.getReady(),true);assert.equal(f.api.getRoom().roomId,'B');
 for(const phase of ['lobby','discussion','voting','paused','ended','dead','spectator']){
  const g=fixture(),snapshot=state('A',1,phase);if(phase==='lobby')snapshot.game=null;if(phase==='dead'){snapshot.game.phase='roam';snapshot.game.self.alive=false;}if(phase==='spectator'){snapshot.game.phase='roam';snapshot.game.self=null;snapshot.seatId=null;}await g.open('A',snapshot);g.api.stop();assert.equal(g.allRequests.length,0,phase);
 }
});

test('wire sequence follows issued UI and lifecycle stops; fresh reconnect controls avoid collisions, stale and duplicate intents cannot renew',async()=>{
 const f=fixture(),initial=state('A');initial.game.self.inputSeq=40;const scene=await f.open('A',initial);
 const first=scene.callbacks.input({seq:50,dx:1,dy:0});assert.equal(f.requests[0].options.body.seq,50);const firstView=state('A',2);firstView.game.self.inputSeq=50;f.requests[0].resolve(firstView);await first;
 const duplicate=scene.callbacks.input({seq:50,dx:1,dy:0});assert.deepEqual(plain(f.requests[1].options.body),plain(f.requests[0].options.body));f.requests[1].resolve(firstView);await duplicate;
 const count=f.requests.length;await assert.rejects(scene.callbacks.input({seq:49,dx:0,dy:1}),{name:'AbortError'});await assert.rejects(scene.callbacks.input({seq:50,dx:0,dy:1}),/sequence already used/i);assert.equal(f.requests.length,count);
 f.context.document.hidden=true;f.api.stop();const stop=f.cleanupRequests.at(-1);assertCleanup(stop,'A');assert.equal(stop.options.body.seq,51);
 f.context.document.hidden=false;const restored=state('A',3);restored.game.self.inputSeq=51;await f.open('A',restored);const latestStop=f.cleanupRequests.at(-1);assertCleanup(latestStop,'A');assert(latestStop.options.body.seq>=51);
 const staleDuplicate=scene.callbacks.input({seq:50,dx:1,dy:0});assert.equal(f.requests.at(-1).options.body.seq,50,'duplicate identity cannot allocate a new lease after lifecycle stop');const denied=assert.rejects(staleDuplicate,/Synthetic stale wire/);f.requests.at(-1).reject(new apiModule.ApiError('Synthetic stale wire',409,'STALE_INPUT'));await denied;
 const fresh=scene.callbacks.input({seq:51,dx:0,dy:1});const packet=f.requests.at(-1);assert(packet.options.body.seq>latestStop.options.body.seq);assert(packet.options.body.seq>restored.game.self.inputSeq);assert.deepEqual({dx:packet.options.body.dx,dy:packet.options.body.dy},{dx:0,dy:1});packet.resolve(state('A',4));await fresh;
});

test('actual API cleanup uses same-origin cookies, independent bounded timeout and zero wire payload',async()=>{
 const apiSource=await readFile(new URL('public/api.mjs',sourceRoot),'utf8'),timers=new Map(),calls=[];let timerId=0;
 const context={AbortController,AbortSignal,DOMException,setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},fetch(route,options){return new Promise((resolve,reject)=>{calls.push({route,options,resolve});options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});}};context.globalThis=context;
 vm.runInNewContext(apiSource.replace(/^export /gm,'')+';globalThis.reviewRequest=request;',context);
 const f=fixture(),scene=await f.open('A'),moving=scene.callbacks.input({seq:7,dx:1,dy:0}),rejected=assert.rejects(moving,{name:'AbortError'});f.context.document.hidden=true;f.api.stop();const cleanup=f.cleanupRequests.at(-1);assertCleanup(cleanup,'A');f.requests[0].resolve(state('A',999));await rejected;
 const result=context.reviewRequest(cleanup.route,cleanup.options),timeout=assert.rejects(result,{name:'TimeoutError'});assert.equal(calls.length,1);assert.equal(calls[0].route,'/api/rooms/A/input');assert.equal(calls[0].options.credentials,'same-origin');assert.equal(calls[0].options.keepalive,true);assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.method,'POST');assert.deepEqual(JSON.parse(calls[0].options.body),plain(cleanup.options.body));assert.equal(calls[0].options.signal.aborted,false);assert.deepEqual([...timers.values()].map(timer=>timer.ms),[1500]);
 timers.values().next().value.fn();await timeout;assert.equal(calls[0].options.signal.aborted,true);assert.equal(timers.size,0);
});
