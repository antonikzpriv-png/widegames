import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto as crypto} from 'node:crypto';
import {worldInputEnvelope} from '../public/world-input-envelope.mjs';
const source=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
class Node{
 constructor(){this.children=[];this.textContent='';this.hidden=false;this.attrs=new Map();this.classList={toggle(){}};}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(k,v){this.attrs.set(k,v);}getAttribute(k){return this.attrs.get(k);}querySelector(){return null;}querySelectorAll(){return [];}focus(){}addEventListener(){}
}
function fixture(){
 const body=new Node(),nodes=new Map(['main','feedback','rules','rules-toggle','rules-close','phase-status'].map(k=>[k,new Node()])),scenes=[],requests=[];
 const document={body,activeElement:body,hidden:false,querySelector:s=>nodes.get(s.slice(1))||new Node(),addEventListener(){}};
 const context={document,console,Date,crypto,AbortController,DOMException,setTimeout,clearTimeout,window:{addEventListener(){}},history:{replaceState(){},pushState(){}},sessionStorage:{setItem(){},removeItem(){}},h:()=>new Node(),button:()=>new Node(),phaseLabel:p=>p,roomFrom:x=>x,roomPath:(id,s='')=>'/api/rooms/'+id+s,actionEnvelope:(type,fields)=>({id:'request',type,...fields}),worldInputEnvelope,
 createWorldExperience(host,callbacks){const scene={callbacks,updates:[],disposed:false,update(room){this.updates.push(room);},dispose(){this.disposed=true;}};scenes.push(scene);return scene;},request:(path,options)=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}))};
 vm.runInNewContext(source.slice(0,source.indexOf('const initial=roomIdFromPath')).replace(/^import .*$/gm,'')+`;globalThis.api={accept,seed:view=>{roomId=view.roomId;room=view;controller=new AbortController();networkReady=true;render();},state:()=>({room,retry,draft,replay,worldSession,pending}),markDraft:()=>{draft='OLD DRAFT';replay=['old'];}};`,context);
 return {api:context.api,scenes,requests};
}
function view(generation=1,version=10){return {roomId:'same-invitation',generation,revision:version,isHost:true,seatId:'p1',game:{matchId:generation===1?'match':'match_g'+generation,worldVersion:1,version,serverNow:10000+version,phase:'roam',self:{id:'p1',alive:true,inputSeq:0,moving:false,position:{x:728,y:272},roomId:'bridge',tasks:[]},players:[]}};}

test('actual client accepts fresh-generation lobby/lower versions, resets controllers, rejects late old frames',()=>{
 const f=fixture();f.api.seed(view());const old=f.scenes.at(-1);f.api.markDraft();
 f.api.accept({...view(2,1),game:null});assert.equal(f.api.state().room.game,null);assert.equal(f.api.state().draft,'');assert.equal(f.api.state().replay,null);assert(old.disposed);
 f.api.accept(view(2,1));assert.equal(f.api.state().room.game.version,1);const fresh=f.scenes.at(-1);assert.notEqual(fresh,old);
 f.api.accept(view(1,9999));assert.equal(f.api.state().room.generation,2);assert.equal(f.api.state().room.game.version,1);
 f.api.accept({...view(2,0),revision:0});assert.equal(f.api.state().room.game.version,1);
 f.api.accept({...view(2,2),game:null});assert(f.api.state().room.game,'same-generation game-to-lobby frames rejected');
});

test('old input responses and action retries cannot regain a rematch controller',async()=>{
 const f=fixture();f.api.seed(view());const old=f.scenes.at(-1);
 const movement=old.callbacks.input({seq:1,dx:1,dy:0});const input=f.requests.at(-1);assert.equal(input.options.body.generation,1);assert.equal(input.options.body.matchId,'match');
 const action=old.callbacks.action('wait',{});const pending=f.requests.at(-1);f.api.accept({...view(2,1),game:null});
 input.resolve(view(1,999));pending.reject(new Error('Uncertain old provider response'));
 await assert.rejects(movement,e=>e.name==='AbortError');await assert.rejects(action,e=>e.name==='AbortError');assert.equal(f.api.state().room.generation,2);assert.equal(f.api.state().retry,null);
 f.api.accept(view(2,1));await assert.rejects(old.callbacks.input({seq:2,dx:1,dy:0}),e=>e.name==='AbortError');
 const fresh=f.scenes.at(-1),next=fresh.callbacks.input({seq:1,dx:1,dy:0}),wire=f.requests.at(-1);assert.equal(wire.options.body.generation,2);assert.equal(wire.options.body.matchId,'match_g2');assert.equal(wire.options.body.seq,1);wire.resolve(view(2,2));await next;
});


test('audit: completing an old mutation cannot clear the next generation pending operation',async()=>{
 const f=fixture();f.api.seed(view());const old=f.scenes.at(-1);
 const previous=old.callbacks.action('wait',{}),oldRequest=f.requests.at(-1),rejected=assert.rejects(previous,e=>e.name==='AbortError');
 f.api.accept({...view(2,1),game:null});f.api.accept(view(2,1));
 const current=f.scenes.at(-1).callbacks.action('wait',{}),newRequest=f.requests.at(-1);
 assert.equal(f.api.state().pending,true);oldRequest.reject(new Error('late old failure'));await rejected;
 assert.equal(f.api.state().pending,true,'the new action must still own the pending state');
 newRequest.resolve(view(2,2));await current;assert.equal(f.api.state().pending,false);
});


for(const transition of ['rematch','start'])test(`audit: late ${transition} acknowledgement cannot remove a current retry`,async()=>{
 const f=fixture(),initial=view();if(transition==='start'){initial.game=null;initial.revision=0;}else initial.game.phase='ended';f.api.seed(initial);
 const old=f.scenes.at(-1),previous=old.callbacks[transition](),oldRequest=f.requests.at(-1),rejected=assert.rejects(previous,e=>e.name==='AbortError');
 const generation=transition==='rematch'?2:1;
 if(transition==='rematch')f.api.accept({...view(2,1),game:null});f.api.accept(view(generation,1));
 const current=f.scenes.at(-1).callbacks.action('wait',{}),newRequest=f.requests.at(-1),uncertain=assert.rejects(current);
 newRequest.reject(new Error('new uncertain write'));await uncertain;const retry=f.api.state().retry;assert(retry);
 oldRequest.resolve(transition==='rematch'?{...view(2,1),game:null}:view(1,1));await rejected;
 assert.equal(f.api.state().retry,retry,'a superseded acknowledgement must not clear the current retry');
});


test('audit: revoked movement authorization disables controls until a valid resynchronization',async()=>{
 const f=fixture();f.api.seed(view());const scene=f.scenes.at(-1),movement=scene.callbacks.input({seq:1,dx:1,dy:0}),wire=f.requests.at(-1),denied=assert.rejects(movement);
 wire.reject(Object.assign(new Error('Identity revoked'),{status:401}));await denied;
 await assert.rejects(scene.callbacks.input({seq:2,dx:1,dy:0}),/Resynchronizing/);
});
