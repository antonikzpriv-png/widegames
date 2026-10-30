import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createTaskPuzzle} from '../public/world/puzzles.mjs';
import {createWorldExperience} from '../public/world/experience.mjs';
const runtime=process.env.QUALITY_CLIENT_RUNTIME_ROOT?pathToFileURL(resolve(process.env.QUALITY_CLIENT_RUNTIME_ROOT)+'/'):new URL('../',import.meta.url);
const ready=existsSync(new URL('shared/station-challenges.mjs',runtime));
const station=ready?await import(new URL('shared/station-challenges.mjs',runtime)):null;
const enabled={skip:!ready&&'Coordinator station source absent; integrate it or set QUALITY_CLIENT_RUNTIME_ROOT'};
const sha=data=>createHash('sha256').update(data).digest('hex');
const pins=ready?Object.fromEntries(['shared/station-contract.mjs','shared/station-challenges.mjs'].map(f=>[f,sha(readFileSync(new URL(f,runtime)))])):{};
function sourceFiles(base,dir){return readdirSync(new URL(dir+'/',base),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sourceFiles(base,dir+'/'+entry.name):entry.name.endsWith('.mjs')?[dir+'/'+entry.name]:[]);}
const runtimePins=ready?Object.fromEntries(['server/engine','server/features','shared'].flatMap(dir=>sourceFiles(runtime,dir)).map(f=>[f,sha(readFileSync(new URL(f,runtime)))])):{};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
// Actual imported UI + actual pure challenge transitions, minimal DOM. Not a
// transport/native touch test and no API response/role/position mock workflow.
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

function fixture(task,onSubmit){const f=domFixture();let closed=0;const puzzle=createTaskPuzzle({task,kind:task.challenge.kind,id:'station-fixture',onSubmit:input=>onSubmit(input,puzzle),onClose:()=>closed++});f.host.append(puzzle.node);
 const buttons=()=>f.host.querySelectorAll('button'),button=label=>buttons().find(b=>b.getAttribute('aria-label')===label||b.textContent===label),click=b=>{assert(b,'missing station button');if(!b.disabled)b.emit('click');};
 return {...f,puzzle,button,click,get closed(){return closed;},dispose(){puzzle.dispose();f.dispose();}};
}
function activate(f,challenge,input){const p=challenge.puzzle;
 if(challenge.kind==='circuit'){const [l,r]=input.value.split(':');f.click(f.button('Cable '+p.left.find(x=>x.id===l).symbol));f.click(f.button('Socket '+p.right.find(x=>x.id===r).symbol));}
 else if(challenge.kind==='signal'){const slider=f.host.querySelector('input');slider.value=input.value;slider.emit('input');f.click(f.button('Transmit frequency'));}
 else if(challenge.kind==='sequence')f.click(f.button('Record tile '+input.value));
 else if(challenge.kind==='glyphs'){if(input.interactionId==='submit')f.click(f.button('Verify selected glyphs'));else{const tile=p.tiles.find(t=>t.id===input.value);f.click(f.button(`Inspection tile ${Number(tile.id.slice(1))+1}: ${tile.symbol}`));}}
 else if(challenge.kind==='alignment'){const [dial,value]=input.value.split(':'),index=Number(dial.slice(1));f.host.querySelectorAll('select')[index].value=value;f.click(f.button('Lock rotor '+(index+1)));}
 else if(challenge.kind==='manifolds')f.click(f.button('Pressure valve '+p.valves.find(v=>v.id===input.value).value));
}
for(const kind of ['circuit','signal','sequence','glyphs','alignment','manifolds'])test('real '+kind+' challenge progresses only from accepted projections',enabled,async()=>{
 let task={id:'station-'+kind,label:'Restore '+kind,kind:'station',roomId:'bridge',completed:false,challenge:station.createStationChallenge({kind,seed:'client-'+kind})};const calls=[];
 const f=fixture(task,async(input,puzzle)=>{assert.deepEqual(Object.keys(input).sort(),['interactionId','value']);calls.push(input);const next=station.applyStationInput(task.challenge,input);assert(next.accepted,next.error?.message);task={...task,challenge:station.projectStationChallenge(next.challenge),completed:next.completed};puzzle.update(task);});
 try{let count=0;while(!task.completed&&count++<12){const input=station.nextStationInput(task.challenge);activate(f,task.challenge,input);await flush();}assert(task.completed);assert(calls.length>0);assert.match(f.host.querySelector('.lw-puzzle-status').textContent,/Server confirmed/);assert.equal(f.host.querySelectorAll('.lw-station-control').filter(b=>!b.disabled).length,0);assert.equal(f.host.querySelectorAll('button').some(b=>b.textContent==='Send completed task'),false);}
 finally{f.dispose();}
});

test('station input remains unconfirmed while pending; current rejection preserves controls and native slider draft',enabled,async()=>{
 const task={id:'signal-focus',label:'Signal',kind:'station',completed:false,challenge:station.createStationChallenge({kind:'signal',seed:'focus'})};let reject;const f=fixture(task,()=>new Promise((_,fail)=>reject=fail));
 try{const slider=f.host.querySelector('input');slider.value=String(task.challenge.puzzle.target);slider.emit('input');slider.focus();const button=f.button('Transmit frequency');f.click(button);assert.equal(f.host.querySelector('progress').value,0);for(let i=0;i<10;i++)f.puzzle.update(structuredClone(task),{connected:true});assert.equal(f.host.querySelector('input'),slider);assert.equal(slider.value,String(task.challenge.puzzle.target));reject(new Error('Current station rejected'));await flush();assert.match(f.host.querySelector('.lw-puzzle-status').textContent,/Current station rejected/);assert.equal(button.disabled,false);assert.equal(slider.value,String(task.challenge.puzzle.target));assert.equal(task.completed,false);}
 finally{f.dispose();}
});

test('disposed station retained close/input handlers cannot affect replacement equipment or accept old failure',enabled,async()=>{
 const task={id:'old-signal',label:'Signal',kind:'station',completed:false,challenge:station.createStationChallenge({kind:'signal',seed:'old'})};let reject,calls=0;const f=fixture(task,()=>{calls++;return new Promise((_,fail)=>reject=fail);});const close=f.button('Close station'),send=f.button('Transmit frequency');f.click(send);f.puzzle.dispose();close.emit('click');send.emit('click');reject(new Error('OLD STATION FAILURE'));await flush();assert.equal(f.closed,0);assert.equal(calls,1);assert.equal(f.host.children.length,0);f.dispose();
});

test('glyph correction is projected, explicit and does not invent verification on local selection',enabled,async()=>{
 let task={id:'glyph-correction',label:'Inspect',kind:'station',completed:false,challenge:station.createStationChallenge({kind:'glyphs',seed:'correction'})};const f=fixture(task,async(input,puzzle)=>{const result=station.applyStationInput(task.challenge,input);if(!result.accepted)throw new Error(result.error.message);task={...task,challenge:result.challenge,completed:result.completed};puzzle.update(task);});
 try{const wrong=task.challenge.puzzle.tiles.find(t=>t.symbol!==task.challenge.puzzle.target);activate(f,task.challenge,{interactionId:'toggle',value:wrong.id});await flush();assert.deepEqual(task.challenge.progress.values,[wrong.id]);f.click(f.button('Verify selected glyphs'));await flush();assert.equal(task.completed,false);assert.match(f.host.querySelector('.lw-puzzle-status').textContent,/does not match/);activate(f,task.challenge,{interactionId:'toggle',value:wrong.id});await flush();assert.deepEqual(task.challenge.progress.values,[]);}
 finally{f.dispose();}
});

test('unsupported future station is closable but never becomes a legacy local completion puzzle',()=>{
 const f=fixture({id:'future',kind:'station',label:'Future',challenge:{version:99,kind:'signal',puzzle:{}}},()=>assert.fail('Future station dispatched'));
 try{assert.match(f.host.textContent,/version is unavailable/);assert.equal(f.button('Send completed task'),undefined);f.puzzle.node.emit('keydown',{key:'Escape'});assert.equal(f.closed,1);}
 finally{f.dispose();}
});


test('actual schema5 engine progress returns through the guarded experience; no local completion request',enabled,async()=>{
 const {createMatch,applyAction,getPlayerView}=await import(new URL('server/engine/index.mjs',runtime));let state;
 for(let seed=0;seed<30;seed++){state=createMatch({id:'quality-client-engine',mode:'human',tactical:true,stationTasks:true,map:{id:'beacon',version:1},now:1000,seed:'client-engine-'+seed});if(state.players.find(p=>p.id==='p1').role==='crew')break;}
 const actor=state.players.find(p=>p.id==='p1');assert.equal(actor.role,'crew');let task=actor.tasks[0];actor.roomId=task.roomId;const map=(await import(new URL('shared/maps/index.mjs',runtime))).getMap(state.map),position=map.geometry.WORLD_STATIONS[task.roomId];actor.position={x:position.x,y:position.y};
 const f=domFixture(),calls=[];let sequence=0,experience;
 const room=()=>({roomId:'engine-ui-room',isHost:true,mode:'human',ai:{mode:'demo'},notices:[],map:state.map,game:getPlayerView(state,actor.id,state.updatedAt)});
 experience=createWorldExperience(f.host,{input:async()=>{},start:async()=>{},leave(){},loadReplay:async()=>({replay:[]}),action:async(type,fields)=>{calls.push({type,fields});const result=applyAction(state,actor.id,{id:'client-step-'+(++sequence),type,...fields},state.updatedAt+1);assert(result.accepted,result.error?.message);state=result.state;return {room:room()};}});
 const click=button=>{assert(button,'missing actual experience button');if(!button.disabled)button.emit('click');},button=label=>f.host.querySelectorAll('button').find(n=>n.getAttribute('aria-label')===label||n.textContent===label);
 try{experience.update(room(),{now:1000,connected:true,pending:false});click(button('Enter the beacon'));click(f.host.querySelector('.lw-action-use'));assert(f.host.querySelector('.lw-station-modal'));let steps=0;
  while(!state.players.find(p=>p.id===actor.id).tasks[0].completed&&steps++<12){task=state.players.find(p=>p.id===actor.id).tasks[0];const c=getPlayerView(state,actor.id,state.updatedAt).self.tasks[0].challenge,input=station.nextStationInput(c);activate({host:f.host,button,click},c,input);await flush();}
  assert(state.players.find(p=>p.id===actor.id).tasks[0].completed);assert(calls.length>0);assert(calls.every(c=>c.type==='taskInteract'&&Object.keys(c.fields).sort().join(',')==='interactionId,taskId,value'));assert(!f.host.querySelector('.lw-station-modal'));assert.match(f.host.querySelector('.lw-feedback').textContent,/Task complete/);
 }finally{experience.dispose();f.dispose();}
});

for(const boundary of ['discussion','room','match','actor','map-return','challenge','hidden','death','transit','access'])test('deferred station failure cannot replace current feedback after '+boundary,enabled,async()=>{
 const f=domFixture(),task={id:'pending-task',label:'Signal task',kind:'station',completed:false,roomId:'bridge',challenge:station.createStationChallenge({kind:'signal',seed:'deferred'})},position={x:800,y:285};let reject;
 const base={roomId:'station-owner',mode:'human',ai:{mode:'demo'},notices:[],game:{matchId:'station-owner-match',worldVersion:1,beaconVersion:1,phase:'roam',map:{id:'beacon',version:1},serverNow:1000,self:{id:'owner-custom',role:'crew',alive:true,roomId:'bridge',position,tasks:[task],inputSeq:1},players:[{id:'owner-custom',name:'Owner',alive:true,status:'alive',position}],tasks:{total:1,completed:0},interactions:[{id:'task-hint',type:'task',fields:{taskId:task.id},enabled:true}],availableActions:['task','taskInteract'],systems:{doors:[],lights:{active:false},communications:{active:false}},events:[]}};
 const experience=createWorldExperience(f.host,{input:async()=>{},start:async()=>{},leave(){},loadReplay:async()=>({replay:[]}),action:()=>new Promise((_,fail)=>reject=fail)}),button=text=>f.host.querySelectorAll('button').find(b=>b.textContent===text),update=r=>experience.update(r,{now:1000,connected:true,pending:false,feedback:'CURRENT COUNCIL NOTICE'});
 try{update(base);button('Enter the beacon').emit('click');f.host.querySelector('.lw-action-use').emit('click');button('Transmit frequency').emit('click');assert(reject);
  const next=structuredClone(base);
  if(boundary==='discussion'){next.game.phase='discussion';next.game.meeting={id:'new-council',messages:[],votes:[],eligibleVoters:['owner-custom']};}
  if(boundary==='room')next.roomId='replacement-room';
  if(boundary==='match')next.game.matchId='replacement-match';
  if(boundary==='actor')next.game.self.id='replacement-actor';
  if(boundary==='transit')next.game.self.transit={deadlineAt:4000};
  if(boundary==='map-return'){next.game.map={id:'stormbreak-annex',version:1};update(next);}
  if(boundary==='challenge')next.game.self.tasks[0].challenge=station.createStationChallenge({kind:'signal',seed:'replacement-challenge'});
  if(boundary==='hidden'){f.document.hidden=true;f.document.emit('visibilitychange');}
  if(boundary==='death')next.game.self.alive=false;
  if(boundary==='access')next.game.interactions=[];
  update(boundary==='map-return'?base:next);const current=f.host.querySelector('.lw-feedback').textContent;reject(new Error('OLD STATION FAILURE'));await flush();assert.equal(f.host.querySelector('.lw-feedback').textContent,current);assert.doesNotMatch(f.host.textContent,/OLD STATION FAILURE/);
 }finally{experience.dispose();f.dispose();}
});

after(()=>{for(const [file,hash]of Object.entries(runtimePins))assert.equal(sha(readFileSync(new URL(file,runtime))),hash,'Runtime dependency changed during run: '+file);for(const [file,hash]of Object.entries(pins))assert.equal(sha(readFileSync(new URL(file,runtime))),hash,'Challenge dependency changed during run');if(process.env.QUALITY_CLIENT_STATION_RECEIPT)writeFileSync(process.env.QUALITY_CLIENT_STATION_RECEIPT,JSON.stringify({runtime:runtime.href,sha256:runtimePins,sourceStable:true,limits:'Imported UI and actual pure station transition modules, not HTTP/native browser.'},null,2));});
