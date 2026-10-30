import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.QUALITY_CLIENT_AUDIT_ROOT?pathToFileURL(resolve(process.env.QUALITY_CLIENT_AUDIT_ROOT)+'/'):new URL('../',import.meta.url);
const {createWorldExperience}=await import(new URL('public/world/experience.mjs',root));
const {createTaskPuzzle}=await import(new URL('public/world/puzzles.mjs',root));
const {createCouncil}=await import(new URL('public/world/phases.mjs',root));
const {createWorldInput}=await import(new URL('public/world/input.mjs',root));
const {createStationChallenge,applyStationInput,nextStationInput,stationProgress}=await import(new URL('shared/station-challenges.mjs',root));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
// Actual UI/controller modules and validated challenge projections. Deferred
// callbacks are adversarial unit fixtures, not HTTP/native browser workflows.
function domFixture(){
 const saved=new Map(['document','window','matchMedia','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,globalThis[k]]));
 const events=()=>({handlers:new Map(),addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(fn);},removeEventListener(type,fn){this.handlers.get(type)?.delete(fn);},emit(type,init={}){const e={key:'',target:this,button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...init};for(const fn of this.handlers.get(type)||[])fn(e);return e;}});
 const document={...events(),hidden:false,activeElement:null};
 const ctx=new Proxy({}, {get:(_,key)=>key.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:()=>true});
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.attrs=new Map();this.dataset={};this.style={setProperty(){}};this.hidden=false;this.disabled=false;this.text='';this.value='';this.ownerDocument=document;Object.assign(this,events());}
  setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k)??null;}
  set className(v){this.setAttribute('class',v);}get className(){return this.getAttribute('class')||'';}
  get classList(){return {add:(...v)=>this.className=[...new Set([...this.className.split(' '),...v])].join(' '),remove:(...v)=>this.className=this.className.split(' ').filter(s=>!v.includes(s)).join(' ')};}
  append(...nodes){for(const n of nodes){n.remove();this.children.push(n);n.parentNode=this;}}
  replaceChildren(...nodes){for(const child of [...this.children])child.remove();this.text='';this.append(...nodes);}
  remove(){if(this.parentNode){if(this.contains(document.activeElement))document.activeElement=document.body;this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}}
  get textContent(){return this.text+this.children.map(n=>n.textContent).join('');}set textContent(v){this.replaceChildren();this.text=String(v);}
  get isConnected(){return this===document.body||this===document.head||!!this.parentNode?.isConnected;}
  get visible(){return this.isConnected&&!this.hidden&&(!this.parentNode||this.parentNode.visible);}
  contains(node){return this===node||this.children.some(n=>n.contains(node));}
  matches(selector){if(selector==='link[data-beacon-style]')return this.tagName==='LINK'&&this.attrs.has('data-beacon-style');if(selector.startsWith('.'))return this.className.split(' ').includes(selector.slice(1));if(selector.startsWith('[')){const m=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return m&&this.attrs.has(m[1])&&(m[2]===undefined||this.attrs.get(m[1])===m[2]);}return this.tagName===selector.toUpperCase();}
  querySelectorAll(selector){const tests=selector.split(','),found=[];const walk=node=>{for(const child of node.children){if(tests.some(s=>child.matches(s)))found.push(child);walk(child);}};walk(this);return found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){return selector.split(',').some(s=>this.matches(s))?this:this.parentNode?.closest(selector);}
  focus(){if(this.visible&&!this.disabled)document.activeElement=this;}
  getClientRects(){return this.visible?[{}]:[];}
  getContext(){return ctx;}getBoundingClientRect(){return {width:0,height:0,left:0,top:0};}
 }
 document.createElement=tag=>new Node(tag);document.body=new Node('body');document.head=new Node('head');document.activeElement=document.body;document.querySelector=selector=>document.head.querySelector(selector)||document.body.querySelector(selector);
 const win={...events(),setInterval:()=>1,clearInterval(){}};Object.assign(globalThis,{document,window:win,matchMedia:()=>({matches:true}),requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
 const host=new Node('main');document.body.append(host);return {host,document,win,dispose(){host.remove();for(const [k,v]of saved)if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}

function task(kind='signal'){return {id:'owned-task',kind:'station',label:'Owned station',roomId:'bridge',completed:false,challenge:createStationChallenge({kind,seed:'regression-'+kind})};}
function room(t=task()){const position={x:800,y:285},self={id:'owner-arbitrary',alive:true,role:'crew',roomId:'bridge',position,tasks:[t],inputSeq:1};return {roomId:'audit-room',isHost:true,mode:'human',ai:{mode:'demo'},notices:[],game:{matchId:'audit-match',version:1,worldVersion:1,beaconVersion:1,map:{id:'beacon',version:1},phase:'roam',self,players:[{...self,name:'Owner',status:'alive'},{id:'target',name:'Target',alive:true,status:'alive',position:{x:810,y:285}}],interactions:[{id:'owned-station',type:'task',fields:{taskId:t.id},enabled:true}],availableActions:['task','taskInteract'],vision:{origin:position,radius:360},systems:{doors:[],lights:{active:false},communications:{active:false}},events:[],tasks:{total:3,completed:0}}};}
function fixture(t=task()){
 const f=domFixture(),calls=[];let resolveAction,rejectAction;
 const experience=createWorldExperience(f.host,{input:async()=>{},start:async()=>{},leave(){},loadReplay:async()=>({replay:[]}),action:(type,fields)=>{calls.push({type,fields});return new Promise((done,fail)=>{resolveAction=done;rejectAction=fail;});}});
 const button=text=>f.host.querySelectorAll('button').find(b=>b.textContent===text||b.getAttribute('aria-label')===text),click=b=>{assert(b,'missing button');if(!b.disabled)b.emit('click');},update=r=>experience.update(r,{now:1000,connected:true,pending:false});
 const r=room(t);update(r);click(button('Enter the beacon'));click(f.host.querySelector('.lw-action-use'));
 return {...f,experience,calls,r,button,click,update,resolve(data){resolveAction(data);},reject(error){rejectAction(error);},dispose(){experience.dispose();f.dispose();}};
}

test('cancelling a pending station returns keyboard focus to a valid world target',async()=>{
 const f=fixture();try{const send=f.button('Transmit frequency');send.focus();f.click(send);const close=f.button('Close station');close.focus();f.click(close);assert(!f.host.querySelector('.lw-station-modal'));assert.equal(f.document.activeElement,f.host.querySelector('.lw-world-canvas'),'pending USE is aria-disabled; cancellation still needs a valid focus target');f.reject(new Error('OLD CANCELLED FAILURE'));await flush();assert.doesNotMatch(f.host.textContent,/OLD CANCELLED FAILURE/);}
 finally{f.dispose();}
});

for(const boundary of ['death-return','room-return','completion'])test('pending station completion/failure ownership survives '+boundary,async()=>{
 const f=fixture();try{f.click(f.button('Transmit frequency'));const next=structuredClone(f.r);
  if(boundary==='death-return'){next.game.self.alive=false;f.update(next);f.update(f.r);}
  else if(boundary==='room-return'){next.roomId='different-room';f.update(next);f.update(f.r);}
  else{let c=next.game.self.tasks[0].challenge;while(!stationProgress(c).completed)c=applyStationInput(c,nextStationInput(c)).challenge;next.game.self.tasks[0]={...next.game.self.tasks[0],challenge:c,completed:true,...stationProgress(c)};next.game.tasks.completed=1;next.game.interactions=[];f.update(next);}
  const current=f.host.querySelector('.lw-feedback').textContent;assert(!f.host.querySelector('.lw-station-modal'));f.reject(new Error('OLD TASK COMPLETION FAILURE'));await flush();assert.equal(f.host.querySelector('.lw-feedback').textContent,current);assert(!f.host.querySelector('.lw-station-modal'));}
 finally{f.dispose();}
});

test('glyph selection pending ABA permanently revokes old failure while preserving current control identity',async()=>{
 const f=fixture(task('glyphs'));try{const tile=f.host.querySelectorAll('button').find(b=>b.getAttribute('aria-label')?.startsWith('Inspection tile 1:')),selected=structuredClone(f.r);f.click(tile);const next=applyStationInput(selected.game.self.tasks[0].challenge,{interactionId:'toggle',value:'g0'});selected.game.self.tasks[0].challenge=next.challenge;selected.game.self.tasks[0].progress=stationProgress(next.challenge).progress;f.update(selected);f.update(f.r);const before=f.host.querySelector('.lw-feedback').textContent;f.reject(new Error('OLD GLYPH ABA FAILURE'));await flush();assert.equal(f.host.querySelector('.lw-feedback').textContent,before);assert.doesNotMatch(f.host.textContent,/OLD GLYPH ABA FAILURE/);assert.equal(f.host.querySelectorAll('button').find(b=>b.getAttribute('aria-label')===tile.getAttribute('aria-label')),tile);assert.equal(tile.getAttribute('aria-pressed'),'false');assert.equal(tile.disabled,false);assert.equal(f.calls.length,1);}
 finally{f.dispose();}
});

test('current glyph rejection remains useful and does not change projected selection',async()=>{
 const f=fixture(task('glyphs'));try{f.click(f.button('Verify selected glyphs'));f.reject(new Error('Select every matching glyph'));await flush();assert.match(f.host.querySelector('.lw-puzzle-status').textContent,/Select every matching glyph/);assert.match(f.host.querySelector('.lw-feedback').textContent,/Select every matching glyph/);assert.equal(f.host.querySelector('.lw-station-modal').querySelectorAll('[aria-pressed="true"]').length,0);assert.equal(f.button('Verify selected glyphs').disabled,false);}
 finally{f.dispose();}
});

function councilGame(phase='discussion'){const g=room().game;g.phase=phase;g.availableActions=[phase==='discussion'?'say':'vote'];g.meeting={id:'meeting-local-1',reason:'report',eligibleVoters:g.players.map(p=>p.id),messages:[],votes:[]};return g;}
for(const kind of ['chat','vote'])test('old '+kind+' failure cannot overwrite a different match council',async()=>{
 const f=domFixture(),messages=[];let reject;const council=createCouncil({id:'audit-council',pending:()=>false,feedback:m=>messages.push(m),action:()=>new Promise((_,fail)=>reject=fail)});f.host.append(council.node);
 try{const g=councilGame(kind==='chat'?'discussion':'voting');council.update(g,{now:1000});if(kind==='chat'){council.chat.value='My current observation';f.host.querySelector('form').emit('submit');}else f.host.querySelectorAll('button').find(b=>b.textContent==='Skip ejection').emit('click');assert(reject);const next=structuredClone(g);next.matchId='other-match';council.update(next,{now:1001});council.chat.value='New council draft';messages.push('CURRENT COUNCIL NOTICE');reject(new Error('OLD COUNCIL FAILURE'));await flush();assert.deepEqual(messages,['CURRENT COUNCIL NOTICE']);assert.equal(council.chat.value,'New council draft');}
 finally{council.dispose?.();f.dispose();}
});

test('current chat failure retains its draft and useful feedback; IME cannot submit',async()=>{
 const f=domFixture(),messages=[];let reject,calls=0;const council=createCouncil({id:'current-council',pending:()=>false,feedback:m=>messages.push(m),action:()=>{calls++;return new Promise((_,fail)=>reject=fail);}});f.host.append(council.node);
 try{council.update(councilGame(),{now:1000});council.chat.value='Still composing';council.chat.emit('compositionstart');f.host.querySelector('form').emit('submit');assert.equal(calls,0);council.chat.emit('compositionend');f.host.querySelector('form').emit('submit');reject(new Error('Current message failed'));await flush();assert.deepEqual(messages,['Current message failed']);assert.equal(council.chat.value,'Still composing');}
 finally{council.dispose?.();f.dispose();}
});

test('disposed legacy puzzle close handlers cannot close replacement equipment',()=>{
 const f=domFixture();let closes=0;const puzzle=createTaskPuzzle({task:{id:'old-relay',label:'Relay'},kind:'wires',id:'legacy-disposal',onSubmit(){},onClose(){closes++;}});f.host.append(puzzle.node);const close=f.host.querySelectorAll('button').find(b=>b.textContent==='Close station');puzzle.dispose();close.emit('click');puzzle.node.emit('keydown',{key:'Escape'});assert.equal(closes,0);f.dispose();
});

test('touch pointer cancellation and dispose stop leases and remove all owned handlers/timers',()=>{
 const handlers=()=>({events:new Map(),addEventListener(k,f){if(!this.events.has(k))this.events.set(k,new Set());this.events.get(k).add(f);},removeEventListener(k,f){this.events.get(k)?.delete(f);},emit(k,extra={}){for(const f of this.events.get(k)||[])f({key:'',preventDefault(){},...extra});}}),win={...handlers(),setInterval:()=>1,clearInterval(){this.cleared=(this.cleared||0)+1;}},doc={...handlers(),hidden:false},target=handlers(),joy={...handlers(),setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})},packets=[],input=createWorldInput({target,joystick:joy,knob:{style:{}},getState:()=>({enabled:true,inputAllowed:true,inputSeq:0}),onInput:p=>packets.push(p),onClick(){},onShortcut(){},win,doc,clock:()=>0});
 joy.emit('pointerdown',{pointerId:7,clientX:90,clientY:50});assert.equal(packets.at(-1).dx,1);joy.emit('pointercancel',{pointerId:7});assert.deepEqual([packets.at(-1).dx,packets.at(-1).dy],[0,0]);const count=packets.length;joy.emit('pointermove',{pointerId:7,clientX:10,clientY:50});assert.equal(packets.length,count);input.dispose();const stopped=packets.length;joy.emit('pointerdown',{pointerId:7,clientX:90,clientY:50});assert.equal(packets.length,stopped);for(const owner of [win,doc,target,joy])assert([...owner.events.values()].every(s=>s.size===0));assert(win.cleared>0);
});


test('council pending ABA suppresses old success without clearing a current identical draft',async()=>{
 const f=domFixture(),messages=[];let finish;const council=createCouncil({id:'aba-council',pending:()=>false,feedback:m=>messages.push(m),action:()=>new Promise(resolve=>finish=resolve)});f.host.append(council.node);
 try{const original=councilGame();council.update(original,{now:1000});council.chat.value='Repeated draft';f.host.querySelector('form').emit('submit');const other=structuredClone(original);other.matchId='intermediate-match';council.update(other,{now:1001});council.update(original,{now:1002});council.chat.value='Repeated draft';finish();await flush();assert.equal(council.chat.value,'Repeated draft');assert.deepEqual(messages,[]);}
 finally{council.dispose?.();f.dispose();}
});

test('disposed or suspended council ignores a late abort while preserving current retry errors',async()=>{
 for(const boundary of ['suspend','dispose']){const f=domFixture(),messages=[];let reject;const council=createCouncil({id:'cancel-council',pending:()=>false,feedback:m=>messages.push(m),action:()=>new Promise((_,fail)=>reject=fail)});f.host.append(council.node);
  try{council.update(councilGame(),{now:1000});council.chat.value='Uncertain observation';f.host.querySelector('form').emit('submit');council[boundary]();reject(new DOMException('Old controller aborted','AbortError'));await flush();assert.deepEqual(messages,[]);assert.equal(council.chat.value,'Uncertain observation');}
  finally{council.dispose?.();f.dispose();}
 }
});
