/** Root session lifecycle tests. Scene drawing is injected; actual app handlers run. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {worldInputEnvelope} from '../public/world-input-envelope.mjs';

const state=(id,version=1,phase='roam')=>({roomId:id,mode:'human',seatId:'p1',isHost:true,phase,game:{worldVersion:1,matchId:id,version,serverNow:100000+version,phase,self:{id:'p1',role:'crew',alive:true,inputSeq:0,moving:false,position:{x:728,y:272}},players:[]}});
async function fixture(){
 const requests=[],instances=[];const feedback={children:[],attributes:{},classList:{toggle(){}},replaceChildren(...nodes){this.children=nodes;},append(node){this.children.push(node);},setAttribute(key,value){this.attributes[key]=value;},get textContent(){return this.children.map(node=>node.text||'').join(' ');}};
 const main={replaceChildren(){},querySelector(){return null;},querySelectorAll(){return [];}},body={};
 const context={console,AbortController,DOMException,crypto,Date,clearTimeout,setTimeout,worldInputEnvelope,document:{body,activeElement:body,hidden:false,querySelector:selector=>selector==='#feedback'?feedback:main},history:{replaceState(){},pushState(){}},sessionStorage:{setItem(){},removeItem(){}},
  h:(tag,attrs,text)=>({tag,attrs,text}),button:(text,click)=>({text,click}),roomFrom:data=>data.room||data,roomPath:(id,suffix='')=>`/api/rooms/${id}${suffix}`,actionEnvelope:(type,fields={})=>({...fields,type,id:crypto.randomUUID()}),
  createWorldExperience(_host,callbacks){const instance={callbacks,updates:[],disposed:false,update(...args){this.updates.push(args);},dispose(){this.disposed=true;}};instances.push(instance);return instance;},
  request:(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}))};
 context.globalThis=context;const source=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
 vm.runInNewContext(source.slice(0,source.indexOf('const rulesToggle=')).replace(/^import .*$/gm,'')+';render=()=>{};saveFocus=()=>({});restoreFocus=()=>{};connect=()=>{};globalThis.api={openRoom,mount:renderWorld,accept,home,stop,getRoom:()=>room};',context);
 async function open(id,version=1,phase='roam'){await context.api.openRoom(id,state(id,version,phase));context.api.mount();return instances.at(-1);}
 return {requests,instances,feedback,context,api:context.api,open};
}

test('actual root world callbacks cannot send after another room owns the scene',async()=>{
 const f=await fixture(),old=await f.open('A'),next=await f.open('B');assert(old.disposed);assert(!next.disposed);const count=f.requests.length;
 for(const call of [()=>old.callbacks.input({seq:1,dx:1,dy:0}),()=>old.callbacks.action('task',{taskId:'old'}),()=>old.callbacks.start(),()=>old.callbacks.loadReplay()])await assert.rejects(call(),error=>error.name==='AbortError');
 assert.equal(f.requests.length,count);assert(f.requests.every(r=>r.path==='/api/rooms/A/input'&&!r.options.body.dx&&!r.options.body.dy));assert.equal(f.api.getRoom().roomId,'B');
});

test('late old input response is discarded and each request retains its original controller',async()=>{
 const f=await fixture(),old=await f.open('A');const pending=old.callbacks.input({seq:1,dx:Math.SQRT1_2,dy:Math.SQRT1_2}),request=f.requests[0];assert.deepEqual(JSON.parse(JSON.stringify(request.options.body)),{seq:1,dx:1,dy:1});
 await f.open('B');assert(request.options.signal.aborted);request.resolve(state('A',999));await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(f.api.getRoom().roomId,'B');
});

test('reconnect preserves the same scene but replaces its network ownership',async()=>{
 const f=await fixture(),scene=await f.open('A');const pending=scene.callbacks.input({seq:1,dx:1,dy:0}),old=f.requests[0];
 await f.open('A',2);assert(!scene.disposed);assert.equal(f.instances.length,1);assert(old.options.signal.aborted);
 old.resolve(state('A',999));await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(f.api.getRoom().game.version,2);
 const fresh=scene.callbacks.input({seq:2,dx:0,dy:1}),request=f.requests.at(-1);assert.equal(request.options.body.seq,3,'Fresh control must follow the independently allocated lifecycle stop');assert(!request.options.signal.aborted);assert.notEqual(request.options.signal,old.options.signal);request.resolve(state('A',3));await fresh;assert.equal(f.api.getRoom().game.version,3);
});

test('lobbies, meetings and an already stopped actor do not emit redundant movement packets',async()=>{
 const f=await fixture(),scene=await f.open('A');await scene.callbacks.input({seq:1,dx:0,dy:0});assert.equal(f.requests.length,0);
 f.api.accept(state('A',2,'discussion'));await scene.callbacks.input({seq:2,dx:0,dy:0});await assert.rejects(scene.callbacks.input({seq:3,dx:1,dy:0}),error=>error.name==='AbortError');assert.equal(f.requests.length,0);
 f.context.document.hidden=true;await assert.rejects(scene.callbacks.action('say',{text:'old'}),error=>error.name==='AbortError');assert.equal(f.requests.length,0);
});

test('ambiguous world action exposes the same-ID retry and acknowledgement clears it',async()=>{
 const f=await fixture(),scene=await f.open('A',1,'discussion');const action=scene.callbacks.action('say',{text:'A signal check.'}),first=f.requests[0];first.reject(new Error('Lost acknowledgement'));await assert.rejects(action,/Lost acknowledgement/);
 assert.equal(f.feedback.attributes['data-retry'],'true');const retry=f.feedback.children.find(node=>node.text==='Retry same request');assert(retry);
 const resent=retry.click(),second=f.requests[1];assert.equal(second.path,first.path);assert.equal(second.options.body.id,first.options.body.id);assert.equal(second.options.body.text,'A signal check.');second.resolve(state('A',2,'discussion'));await resent;
 assert.equal(f.feedback.attributes['data-retry'],'false');assert(!f.feedback.children.some(node=>node.text==='Retry same request'));
});

test('a retained old retry control cannot run its action in a new room',async()=>{
 const f=await fixture(),scene=await f.open('A');const action=scene.callbacks.action('task',{taskId:'task-A'});f.requests[0].reject(new Error('Lost reply'));await assert.rejects(action);const retry=f.feedback.children.find(node=>node.text==='Retry same request');
 await f.open('B');const count=f.requests.length;retry.click();assert.equal(f.requests.length,count);assert.equal(f.requests.filter(request=>request.path.endsWith('/action')).length,1);assert.equal(f.api.getRoom().roomId,'B');
});

test('an old room retry cannot invoke a different uncertain action from the new room',async()=>{
 const f=await fixture(),a=await f.open('A');const first=a.callbacks.action('task',{taskId:'task-A'});f.requests.at(-1).reject(new Error('A lost reply'));await assert.rejects(first);const old=f.feedback.children.find(node=>node.text==='Retry same request');
 const b=await f.open('B'),second=b.callbacks.action('task',{taskId:'task-B'}),sent=f.requests.at(-1);sent.reject(new Error('B lost reply'));await assert.rejects(second);const current=f.feedback.children.find(node=>node.text==='Retry same request'),count=f.requests.length;
 old.click();assert.equal(f.requests.length,count,'Old control must not dispatch the current retry');const retried=current.click(),request=f.requests.at(-1);assert.equal(request.path,'/api/rooms/B/action');assert.equal(request.options.body.id,sent.options.body.id);assert.equal(request.options.body.taskId,'task-B');request.resolve(state('B',2));await retried;
});

test('a failed movement connection revokes readiness until resync, while stop remains best effort',async()=>{
 const f=await fixture(),scene=await f.open('A');const moving=scene.callbacks.input({seq:1,dx:1,dy:0});f.requests[0].reject(new TypeError('Synthetic connection reset'));await assert.rejects(moving,/connection reset/);
 f.api.mount();assert.equal(scene.updates.at(-1)[1].connected,false);
 await assert.rejects(scene.callbacks.input({seq:2,dx:1,dy:0}),error=>error.name==='AbortError');assert.equal(f.requests.length,1);
 const stopped=scene.callbacks.input({seq:3,dx:0,dy:0});assert.equal(f.requests[1].options.body.dx,0);f.requests[1].resolve(state('A',2));await stopped;f.api.mount();assert.equal(scene.updates.at(-1)[1].connected,true);
 const fresh=scene.callbacks.input({seq:4,dx:0,dy:1});f.requests[2].resolve(state('A',3));await fresh;
});

test('ordinary rule rejection does not masquerade as lost connectivity',async()=>{
 const f=await fixture(),scene=await f.open('A');const pending=scene.callbacks.input({seq:1,dx:1,dy:0});f.requests[0].reject(Object.assign(new Error('Stale sequence'),{status:409,code:'STALE_INPUT'}));await assert.rejects(pending,/Stale sequence/);f.api.mount();assert.equal(scene.updates.at(-1)[1].connected,true);
});

test('hidden or closed world sends a bounded old-room stop before aborting normal requests',async()=>{
 const f=await fixture(),scene=await f.open('A');const moving=scene.callbacks.input({seq:1,dx:1,dy:0}),old=f.requests[0];f.context.document.hidden=true;f.api.stop();
 const stop=f.requests.at(-1);assert.equal(stop.path,'/api/rooms/A/input');assert.equal(stop.options.keepalive,true);assert.equal(stop.options.timeoutMs,1500);assert.equal(stop.options.signal,undefined);assert.equal(stop.options.body.seq,2);assert.equal(stop.options.body.dx,0);assert.equal(stop.options.body.dy,0);assert(old.options.signal.aborted);
 old.resolve(state('A',999));await assert.rejects(moving,error=>error.name==='AbortError');stop.resolve(state('A',1000));await new Promise(resolve=>setImmediate(resolve));assert.equal(f.api.getRoom().game.version,1,'Final stop acknowledgements cannot revive hidden views');
});

test('fresh controls allocate after lifecycle stops while duplicate/stale client intents stay inert',async()=>{
 const f=await fixture(),scene=await f.open('A');const first=scene.callbacks.input({seq:5,dx:1,dy:0});f.requests[0].resolve(state('A',2));await first;
 const duplicate=scene.callbacks.input({seq:5,dx:1,dy:0});assert.equal(f.requests[1].options.body.seq,5);f.requests[1].resolve(state('A',2));await duplicate;
 await assert.rejects(scene.callbacks.input({seq:4,dx:0,dy:1}),error=>error.name==='AbortError');await assert.rejects(scene.callbacks.input({seq:5,dx:0,dy:1}),/sequence already used/i);
});

test('late root task failures cannot overwrite a newer council or moved-away context',async()=>{
 for(const change of ['phase','position','phase-return']){
  const f=await fixture(),scene=await f.open('A');const pending=scene.callbacks.action('task',{taskId:'task-A'}),request=f.requests.at(-1);const newer=state('A',2,change==='phase'?'discussion':'roam');if(change==='position')newer.game.self.position.x+=100;f.api.accept(newer);
  if(change==='phase-return'){f.api.accept(state('A',3,'discussion'));f.api.accept(state('A',4,'roam'));}
  request.reject(new Error('OLD TASK FAILURE'));await assert.rejects(pending,error=>error.name==='AbortError');assert(!f.feedback.textContent.includes('OLD TASK FAILURE'));assert(!f.feedback.children.some(node=>node.text==='Retry same request'));
 }
});

test('an unavailable remembered watch returns to the menu without altering explicit share links',async()=>{
 const remembered=await fixture(),opening=remembered.api.openRoom('old',undefined,{remembered:true});remembered.requests[0].reject(Object.assign(new Error('Room unavailable'),{status:404}));await opening;assert.equal(remembered.api.getRoom(),null);assert.match(remembered.feedback.textContent,/previous watch is unavailable/);
 const explicit=await fixture(),link=explicit.api.openRoom('shared');explicit.requests[0].reject(Object.assign(new Error('Room unavailable'),{status:404}));await link;assert.equal(explicit.api.getRoom(),null);assert.equal(explicit.feedback.textContent,'Room unavailable');
});

test('late remembered-room failure cannot send a current room back to the menu',async()=>{
 const f=await fixture(),old=f.api.openRoom('old',undefined,{remembered:true}),request=f.requests[0];await f.open('B');request.reject(Object.assign(new Error('Old room unavailable'),{status:404}));await old;assert.equal(f.api.getRoom().roomId,'B');
});
