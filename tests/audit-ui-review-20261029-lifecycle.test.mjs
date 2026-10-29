import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const BASE='0842a0090f1cfd1ec43b898f16e8191e5b9c2497';
const candidate=process.env.AUDIT_UI_REVIEW_PIN;
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
if(candidate){assert.match(candidate,/^[a-f0-9]{40}$/);assert.equal(git('rev-parse',`${candidate}^{commit}`).trim(),candidate);}
const source=(pin,path)=>pin?git('show',`${pin}:${path}`):readFileSync(new URL(path,new URL('../',import.meta.url)),'utf8');
const strip=code=>code.replace(/^import .*$/gm,'').replace(/^export /gm,'');
const dataUrl=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const roomA='A'.repeat(24),roomB='B'.repeat(24);
const unauthorized=()=>Object.assign(new Error('Unauthorized fixture response'),{status:401,name:'ApiError'});

// Minimal DOM interface; actual saved UI reconciliation and app handlers run.
// Removing a focused node moves focus to BODY, as observed by Frontend's Chrome audit.
function domFixture(){
 let document;
 class NodeFixture{
  constructor(tag='',type=1,text=''){this.tagName=tag.toUpperCase();this.nodeType=type;this.nodeValue=text;this.parentNode=null;this.childNodes=[];this._attrs=new Map();this.style={};this.namespaceURI='http://www.w3.org/1999/xhtml';this._listeners=new Map();this.value='';this.selectionStart=0;this.selectionEnd=0;this.scrollTop=0;}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}get attributes(){return [...this._attrs].map(([name,value])=>({name,value}));}get lastChild(){return this.childNodes.at(-1);}
  get id(){return this.getAttribute('id')||'';}get className(){return this.getAttribute('class')||'';}set className(value){this.setAttribute('class',value);}
  get classList(){return {toggle:(name,on)=>{const names=new Set(this.className.split(/\s+/).filter(Boolean));if(on??!names.has(name))names.add(name);else names.delete(name);this.className=[...names].join(' ');}};}
  get disabled(){return this.hasAttribute('disabled');}set disabled(value){if(value)this.setAttribute('disabled','');else this.removeAttribute('disabled');}
  get hidden(){return this.hasAttribute('hidden');}set hidden(value){if(value)this.setAttribute('hidden','');else this.removeAttribute('hidden');}
  get isConnected(){return this===document.body||Boolean(this.parentNode?.isConnected);}
  setAttribute(name,value){this._attrs.set(name,String(value));}getAttribute(name){return this._attrs.get(name)??null;}hasAttribute(name){return this._attrs.has(name);}removeAttribute(name){this._attrs.delete(name);}
  contains(node){return this===node||this.childNodes.some(n=>n.contains(node));}
  insertBefore(node,before){node.remove();const index=before?this.childNodes.indexOf(before):this.childNodes.length;assert(index>=0);this.childNodes.splice(index,0,node);node.parentNode=this;return node;}
  append(...nodes){for(const node of nodes)this.insertBefore(node instanceof NodeFixture?node:new NodeFixture('',3,String(node)),null);}
  prepend(...nodes){for(const node of [...nodes].reverse())this.insertBefore(node,this.childNodes[0]||null);}
  replaceChildren(...nodes){for(const node of [...this.childNodes])node.remove();this.append(...nodes);}
  remove(){if(!this.parentNode)return;if(this.contains(document.activeElement))document.activeElement=document.body;const siblings=this.parentNode.childNodes;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}
  get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(n=>n.textContent).join('');}set textContent(value){this.replaceChildren(new NodeFixture('',3,String(value)));}
  addEventListener(name,handler){if(!this._listeners.has(name))this._listeners.set(name,new Set());this._listeners.get(name).add(handler);}removeEventListener(name,handler){this._listeners.get(name)?.delete(handler);}
  focus(){if(this.isConnected&&!this.disabled)document.activeElement=this;}setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
  matches(selector){
   const attr=selector.match(/^\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]$/);if(attr)return attr[2]===undefined?this.hasAttribute(attr[1]):this.getAttribute(attr[1])===attr[2];
   if(selector[0]==='#')return this.id===selector.slice(1);if(selector[0]==='.')return this.className.split(/\s+/).includes(selector.slice(1));return this.tagName===selector.toUpperCase();
  }
  querySelectorAll(selector){const all=[];const walk=node=>{for(const child of node.childNodes){if(child.nodeType===1&&child.matches(selector))all.push(child);walk(child);}};walk(this);return all;}querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
 }
 document={createElement:tag=>new NodeFixture(tag),createElementNS:(ns,tag)=>{const node=new NodeFixture(tag);node.namespaceURI=ns;return node;},createTextNode:text=>new NodeFixture('',3,String(text)),hidden:false};
 document.body=new NodeFixture('body');document.activeElement=document.body;
 for(const id of ['main','feedback','phase-status']){const node=new NodeFixture(id==='main'?'main':'div');node.setAttribute('id',id);document.body.append(node);}
 document.querySelector=selector=>document.body.querySelector(selector);document.querySelectorAll=selector=>document.body.querySelectorAll(selector);document.getElementById=id=>document.querySelector('#'+id);
 return {document,NodeFixture};
}
async function appFixture(pin,adapter){
 const requests=[],timers=new Map(),frames=[];let nextTimer=0;const dom=domFixture();
 const api=await import(dataUrl(source(pin,'public/api.mjs')));
 const context={console,AbortController,DOMException,crypto,Date,Node:dom.NodeFixture,document:dom.document,CSS:{escape:value=>value},history:{replaceState(){},pushState(){}},sessionStorage:{setItem(){},removeItem(){}},location:{href:'http://fixture/',protocol:'http:',host:'fixture'},navigator:{clipboard:{writeText:async()=>{}}},
  setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},queueMicrotask:fn=>frames.push(fn),
  roomPath:api.roomPath,roomFrom:api.roomFrom,actionEnvelope:api.actionEnvelope,roomIdFromPath:api.roomIdFromPath,
  request:(path,options={})=>{const entry={path,options};requests.push(entry);if(adapter)return adapter(path,options,entry);return new Promise((resolve,reject)=>Object.assign(entry,{resolve,reject}));}};
 context.globalThis=context;
 const app=source(pin,'public/app.mjs');assert(app.includes('const rulesToggle='));
 const code=strip(source(pin,'shared/contracts.mjs'))+'\n'+strip(source(pin,'public/ui.mjs'))+'\nconst h=element;\n'+strip(source(pin,'public/presentation.mjs'))+'\n'+strip(source(pin,'public/panels.mjs'))+'\n'+strip(app.slice(0,app.indexOf('const rulesToggle=')));
 vm.runInNewContext(code+';connect=()=>{};globalThis.audit={openRoom,stop,accept,render,getRoom:()=>room,getConfirm:()=>confirmTarget};',context,{filename:`ui-review-${pin}.mjs`});
 const find=key=>dom.document.querySelectorAll('[data-focus]').find(node=>node.getAttribute('data-focus')===key);
 return {api:context.audit,requests,document:dom.document,find,timers,frames,
  activate(node){assert(node,'missing fixture control');node.focus();const handlers=[...node._listeners.get('click')||[]];assert(handlers.length);return handlers[0]({currentTarget:node,target:node,preventDefault(){}});},
  async drainFrames(){for(let n=0;n<20;n++){const immediate=[...timers].find(([,timer])=>timer.ms<=1);if(!frames.length&&!immediate)return;if(frames.length)frames.shift()();else{timers.delete(immediate[0]);immediate[1].fn();}await flush();}assert.fail('UI callback queue did not drain');}};
}
function room(id,phase='roam'){
 return {roomId:id,mode:'human',isHost:true,seatId:'p1',phase,ai:{mode:'demo'},notices:[],game:{matchId:id,version:1,serverNow:100000,phase,deadlineAt:200000,
  self:{id:'p1',role:'saboteur',alive:true,roomId:'bridge',tasks:[],cooldowns:{},meetingsRemaining:1},players:[{id:'p1',name:'Iona',alive:true,roomId:'bridge'},{id:'p2',name:'Pax',alive:true,roomId:'bridge'}],tasks:{completed:0,total:15},events:[],sabotage:null,meeting:phase==='discussion'?{id:'m1',messages:[],votes:[],eligibleVoters:['p1','p2']}:null,availableActions:phase==='roam'?['move','eliminate','sabotage','meeting']:['say']}};
}
async function failInitialJoin(f){const opening=f.api.openRoom(roomA);f.requests[0].reject(unauthorized());await flush();assert.equal(f.requests[1].path,`/api/rooms/${roomA}/join`);f.requests[1].reject(new Error('Fixture pre-delivery join network failure'));await opening;assert(f.find('reconnect'));}

// Negative evidence remains exact-source historical, never repointed to a fix.
test('historical 0842: visible retry after failed initial join remains stuck',async()=>{
 const f=await appFixture(BASE);await failInitialJoin(f);const retry=f.activate(f.find('reconnect'));f.requests[2].reject(unauthorized());await retry;
 assert.equal(f.requests.filter(r=>r.path.endsWith('/join')).length,1);assert.equal(f.api.getRoom(),null);assert(f.find('reconnect'));
});
test('historical 0842: elimination Cancel loses focus to BODY',async()=>{
 const f=await appFixture(BASE);await f.api.openRoom(roomA,room(roomA));f.activate(f.find('eliminate-p2'));const cancel=f.document.querySelectorAll('button').find(n=>n.textContent==='Cancel');f.activate(cancel);await f.drainFrames();assert.equal(f.document.activeElement,f.document.body);
});
test('historical 0842: old deferred 401 issues join using the newer navigation signal',async()=>{
 const f=await appFixture(BASE),old=f.api.openRoom(roomA),oldRequest=f.requests[0];await f.api.openRoom(roomB,room(roomB));oldRequest.reject(unauthorized());await flush();
 assert.equal(f.requests[1].path,`/api/rooms/${roomA}/join`);assert.notEqual(f.requests[1].options.signal,oldRequest.options.signal);assert.equal(f.requests[1].options.signal.aborted,false);f.requests[1].resolve(room(roomA));await old;assert.equal(f.api.getRoom().roomId,roomB);
});

// Positives run by default on this checkout; an explicit pin reads committed objects.

test('candidate: visible retry performs GET before one new join and recovers after pre-delivery failure',async()=>{
 const f=await appFixture(candidate);await failInitialJoin(f);const retry=f.activate(f.find('reconnect'));assert.equal(f.requests[2].path,`/api/rooms/${roomA}`);f.requests[2].reject(unauthorized());await flush();
 assert.equal(f.requests.length,4);assert.equal(f.requests[3].path,`/api/rooms/${roomA}/join`);f.requests[3].resolve({...room(roomA),seatId:null,game:null});await retry;assert.equal(f.api.getRoom().seatId,null);assert(!f.find('reconnect'));
});
test('candidate: stale 401 cannot join or poison a later legitimate room attempt',async()=>{
 const f=await appFixture(candidate),old=f.api.openRoom(roomA),oldRequest=f.requests[0];await f.api.openRoom(roomB,room(roomB));oldRequest.reject(unauthorized());await flush();if(f.requests.length>1){f.requests.at(-1).resolve(room(roomA));await old;}
 assert.equal(f.requests.length,1);await old;assert.equal(f.api.getRoom().roomId,roomB);
 const back=f.api.openRoom(roomA);f.requests[1].reject(unauthorized());await flush();assert.equal(f.requests[2].path,`/api/rooms/${roomA}/join`);assert.notEqual(f.requests[2].options.signal,oldRequest.options.signal);f.requests[2].resolve({...room(roomA),seatId:null,game:null});await back;
});
test('candidate: late old join completion cannot overwrite current room or reuse its controller',async()=>{
 const f=await appFixture(candidate),old=f.api.openRoom(roomA),getSignal=f.requests[0].options.signal;f.requests[0].reject(unauthorized());await flush();const join=f.requests[1];assert.equal(join.options.signal,getSignal);
 await f.api.openRoom(roomB,room(roomB));assert.equal(join.options.signal.aborted,true);join.resolve({...room(roomA),seatId:null,game:null});await old;assert.equal(f.api.getRoom().roomId,roomB);
});
test('candidate: Cancel restores trigger focus without sending an action',async()=>{
 const f=await appFixture(candidate);await f.api.openRoom(roomA,room(roomA));f.activate(f.find('eliminate-p2'));const cancel=f.document.querySelectorAll('button').find(n=>n.textContent==='Cancel');f.activate(cancel);await f.drainFrames();assert(f.document.activeElement===f.find('eliminate-p2'),'Cancel must restore the elimination trigger');assert.equal(f.requests.length,0);
});
for(const change of ['room','phase'])test(`candidate: deferred Cancel focus cannot steal ownership after ${change} change`,async()=>{
 const f=await appFixture(candidate);await f.api.openRoom(roomA,room(roomA));f.activate(f.find('eliminate-p2'));const cancel=f.document.querySelectorAll('button').find(n=>n.textContent==='Cancel');f.activate(cancel);
 let opening;if(change==='room')opening=f.api.openRoom(roomB,room(roomB));else f.api.accept({...room(roomA,'discussion'),game:{...room(roomA,'discussion').game,version:2}});
 const stable=f.find('leave-room');assert(stable);stable.focus();if(opening)await opening;await f.drainFrames();assert(f.document.activeElement===stable,'stale Cancel must not steal or remove current focus');assert.equal(f.requests.length,0);
});

// Real local HTTP controls for uncertain-success join, never browser cookie emulation claims.
async function uncertainJoinControl(t,pin,recoverHost){
 const {createGameServer}=await import('../server/transport.mjs');
 const {mkdir,mkdtemp,rm}=await import('node:fs/promises');const path=(await import('node:path')).default;
 const {once}=await import('node:events');
 const parent=path.resolve(root,'_artifacts');await mkdir(parent,{recursive:true});const directory=await mkdtemp(path.join(parent,'audit-ui-review-20261029-'));
 const origin='http://ui-review.test';
 const game=await createGameServer({dataDir:directory,publicOrigin:origin,tickMs:60000,ai:{provider:'demo'}},{aiController:{describe:()=>({mode:'demo',provider:'inert-review-fixture'}),decide:async()=>null}});
 game.server.listen(0,'127.0.0.1');await once(game.server,'listening');const base=`http://127.0.0.1:${game.server.address().port}`;
 t.after(async()=>{await game.close();assert(path.resolve(directory).startsWith(parent+path.sep)&&path.basename(directory).startsWith('audit-ui-review-20261029-'));await rm(directory,{recursive:true,force:true});});
 const hostResponse=await fetch(base+'/api/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({mode:'human'})});
 assert.equal(hostResponse.status,201);const host=await hostResponse.json(),hostCookie=hostResponse.headers.get('set-cookie').split(';')[0];
 let cookie,joins=0,drop=true,firstGet=true;
 const f=await appFixture(pin,async(route,options)=>{
  const method=options.method||'GET';
  const response=await fetch(base+route,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(options.body?{'Content-Type':'application/json'}:{})},body:options.body?JSON.stringify(options.body):undefined,signal:options.signal});
  const received=response.headers.get('set-cookie');if(received)cookie=received.split(';')[0];const body=await response.json();
  if(route.endsWith('/join')){joins++;if(drop){drop=false;throw new Error('Fixture drops join result after real Set-Cookie was received');}}
  if(!response.ok){
   // Only fixture credentials: model a host cookie arriving while the old GET result is queued.
   if(firstGet&&recoverHost){cookie=hostCookie;firstGet=false;}
   throw Object.assign(new Error(body.error.message),{status:response.status,name:'ApiError'});
  }
  return body;
 });
 await f.api.openRoom(host.roomId);assert.equal(joins,1);assert(f.find('reconnect'));assert(cookie);
 const savedCookie=cookie,count=game.rooms.get(host.roomId).data.identities.length;
 await f.activate(f.find('reconnect'));
 assert.equal(f.api.getRoom().roomId,host.roomId);assert.equal(f.api.getRoom().seatId,recoverHost?'p1':null);assert.equal(joins,1,'retry must recover by GET without another join');assert.equal(cookie,savedCookie);assert.equal(game.rooms.get(host.roomId).data.identities.length,count);
 assert.equal(count,recoverHost?1:2);
 const last=f.requests.at(-1);assert.equal(last.path,`/api/rooms/${host.roomId}`);assert.equal(last.options.method??'GET','GET');
 await f.api.openRoom(host.roomId);assert.equal(joins,1);assert.equal(f.api.getRoom().seatId,recoverHost?'p1':null);
}
for(const recoverHost of [false,true]){
 const label=recoverHost?'existing host seat/cookie':'spectator identity/cookie';
 test(`baseline positive HTTP control: uncertain join success preserves ${label}`,async t=>uncertainJoinControl(t,BASE,recoverHost));
 test(`candidate HTTP: uncertain join success preserves ${label} through GET-first retry`,async t=>uncertainJoinControl(t,candidate,recoverHost));
}


test('candidate: background retry cannot repeatedly auto-join after a failed initial attempt',async()=>{
 const f=await appFixture(candidate);await failInitialJoin(f);const scheduled=[...f.timers.values()].find(timer=>timer.ms===2000);assert(scheduled);const polling=scheduled.fn();assert.equal(f.requests[2].path,`/api/rooms/${roomA}`);f.requests[2].reject(unauthorized());await polling;assert.equal(f.requests.filter(r=>r.path.endsWith('/join')).length,1);assert.equal(f.api.getRoom(),null);
});


test('candidate: acknowledged successful join remains bounded after later unauthorized reopen',async()=>{
 const f=await appFixture(candidate),opening=f.api.openRoom(roomA);f.requests[0].reject(unauthorized());await flush();f.requests[1].resolve({...room(roomA),seatId:null,game:null});await opening;
 const reopened=f.api.openRoom(roomA);f.requests[2].reject(unauthorized());await reopened;assert.equal(f.requests.length,3);assert.equal(f.requests.filter(r=>r.path.endsWith('/join')).length,1);
});

for(const change of ['room','phase'])test(`candidate: queued old Cancel handler is inert after ${change} ownership changes`,async()=>{
 const f=await appFixture(candidate);await f.api.openRoom(roomA,room(roomA));f.activate(f.find('eliminate-p2'));const cancel=f.document.querySelectorAll('button').find(n=>n.textContent==='Cancel');const oldHandler=[...cancel._listeners.get('click')][0];
 if(change==='room'){await f.api.openRoom(roomB,room(roomB));f.activate(f.find('eliminate-p2'));}else f.api.accept({...room(roomA,'discussion'),game:{...room(roomA,'discussion').game,version:2}});
 const stable=change==='room'?f.document.querySelectorAll('button').find(n=>n.textContent==='Cancel'):f.find('leave-room');stable.focus();oldHandler({currentTarget:cancel,target:cancel,preventDefault(){}});await f.drainFrames();assert(f.document.activeElement===stable,'stale Cancel must preserve current focus');assert.equal(f.requests.length,0);if(change==='room')assert.equal(f.api.getConfirm(),'p2');
});


test('candidate: canceled room-open unauthorized completion cannot start a join',async()=>{
 const f=await appFixture(candidate),opening=f.api.openRoom(roomA),request=f.requests[0];f.api.stop();assert.equal(request.options.signal.aborted,true);request.reject(unauthorized());await flush();if(f.requests.length>1){f.requests.at(-1).resolve(room(roomA));await opening;}assert.equal(f.requests.length,1);await opening;assert.equal(f.api.getRoom(),null);
});

test('candidate: queued Cancel cannot focus a now-disabled elimination trigger',async()=>{
 const f=await appFixture(candidate);await f.api.openRoom(roomA,room(roomA));f.activate(f.find('eliminate-p2'));const cancel=f.document.querySelectorAll('button').find(n=>n.textContent==='Cancel'),handler=[...cancel._listeners.get('click')][0];
 const next=room(roomA);next.game.version=2;next.game.availableActions=['move'];f.api.accept(next);const stable=f.find('leave-room');stable.focus();handler({currentTarget:cancel,target:cancel,preventDefault(){}});await f.drainFrames();assert(f.find('eliminate-p2').disabled);assert(f.document.activeElement===stable,'disabled return target must not steal focus');assert.equal(f.requests.length,0);
});
