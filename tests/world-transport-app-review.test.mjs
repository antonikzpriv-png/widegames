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
 const requests=[],scenes=[],stored=[];let now=100000;
 const feedback={children:[],attributes:{},classList:{toggle(){}},replaceChildren(...nodes){this.children=nodes;},append(node){this.children.push(node);},setAttribute(key,value){this.attributes[key]=value;},get textContent(){return this.children.map(node=>node.text||'').join(' ');}};
 const main={replaceChildren(){},querySelectorAll(){return [];}};
 const body={};
 const context={AbortController,DOMException,crypto,clearTimeout,setTimeout,Date:class extends Date{static now(){return now;}},document:{hidden:false,body,activeElement:body,querySelector:selector=>selector==='#feedback'?feedback:main},history:{replaceState(){},pushState(){}},sessionStorage:{setItem:(...args)=>stored.push(args),removeItem(){}},h:(tag,attributes,text)=>({tag,attributes,text}),button:(text,click)=>({text,click}),...apiModule,worldInputEnvelope,
  request:(route,options)=>new Promise((resolve,reject)=>requests.push({route,options,resolve,reject})),
  createWorldExperience(_host,callbacks){const scene={callbacks,updates:[],disposed:false,update(...args){this.updates.push(args);},dispose(){this.disposed=true;}};scenes.push(scene);return scene;}};
 context.globalThis=context;
 // Keep actual renderWorld and app ownership/network handlers; drawing and background IO are injected.
 vm.runInNewContext(prefix+`;render=()=>{if(roomId&&room)renderWorld();};saveFocus=()=>({});restoreFocus=()=>{};connect=()=>{};schedulePoll=()=>{};globalThis.audit={openRoom,accept,home,stop,getRoom:()=>room,getReady:()=>networkReady,getConnectionIssue:()=>connectionIssue};`,context);
 async function open(id,snapshot=state(id)){await context.audit.openRoom(id,snapshot);return scenes.at(-1);}
 return {api:context.audit,open,requests,scenes,stored,feedback,context,setNow(value){now=value;}};
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