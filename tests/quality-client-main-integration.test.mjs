import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.QUALITY_CLIENT_MERGE_ROOT?pathToFileURL(resolve(process.env.QUALITY_CLIENT_MERGE_ROOT)+'/'):new URL('../',import.meta.url);
const {createWorldExperience}=await import(new URL('public/world/experience.mjs',root));
const {createTaskPuzzle}=await import(new URL('public/world/puzzles.mjs',root));
const {ActorSamples,contexts,validTaskSession}=await import(new URL('public/world/model.mjs',root));
const {createReplayModel}=await import(new URL('public/world/replay-model.mjs',root));
const {getMap}=await import(new URL('shared/maps/index.mjs',root));
const {challenge,taskInput,stepError,advanceTask}=await import(new URL('server/engine/tasks.mjs',root));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
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

// Semantic main/quality composition controls. Real pure task transitions and UI
// callbacks; no browser, HTTP or full-match qualification is implied.
for(const [kind,roomId]of [['wires','bridge'],['tuning','lantern'],['sequence','archive'],['pressure','galley'],['repair','workshop']])test('main '+kind+' progress panel still submits every real validated step and completion',()=>{
 const f=domFixture(),t={id:'progress-'+kind,label:kind,roomId,completed:false};t.progress=challenge(t);let puzzle,at=2000;const calls=[];
 try{puzzle=createTaskPuzzle({id:'progress',task:structuredClone(t),kind,onClose(){},onSubmit:input=>{calls.push(input);if(input){assert.equal(stepError(t,input,at),null);advanceTask(t,at);puzzle.update(structuredClone(t));}else assert.equal(t.progress.index,t.progress.total);}});f.host.append(puzzle.node);
 const click=text=>{const b=puzzle.node.querySelectorAll('button').find(b=>b.textContent===text);assert.ok(b,text);b.emit('click');};
 while(t.progress.index<t.progress.total){const input=taskInput(t);if(kind==='wires'){click('Left cable '+(t.progress.index+1));click('Right socket '+(t.progress.index+1));}else if(kind==='tuning'){const slider=puzzle.node.querySelector('input');slider.value=input;click('Lock frequency');}else if(kind==='sequence')click(input);else if(kind==='pressure')click(t.progress.index===0?'Flow '+(input==='left-to-right'?'left to right':'right to left'):'Transfer '+input+' bar');else{if(t.progress.index===3)at=t.progress.readyAt;click(['Isolate power','Replace fuse','Start diagnostic','Verify diagnostic'][t.progress.index]);}}
 click('Send completed task');assert.equal(calls.length,t.progress.total+1);puzzle.dispose();const count=calls.length;puzzle.node.emit('keydown',{key:'Escape'});assert.equal(calls.length,count);
 }finally{puzzle?.dispose();f.dispose();}
});
function ghostView(){const position={...getMap({id:'beacon',version:1}).geometry.WORLD_STATIONS.bridge};return {matchId:'ghost-match',version:1,worldVersion:1,map:{id:'beacon',version:1},phase:'roam',self:{id:'captain',alive:false,ghost:true,role:'crew',roomId:'bridge',position,tasks:[{id:'ghost-task',roomId:'bridge',label:'Ghost station',completed:false}],inputSeq:2},players:[{id:'captain',name:'Captain',alive:false,position},{id:'unseen',name:'Unknown',alive:false,position:null}],availableActions:['task','navigate','input','ghostSay'],events:[],tasks:{completed:0,total:1}};}
test('safe ghost owner remains visible at held observations and only task access is enabled',()=>{
 const g=ghostView(),world=getMap(g.map).geometry,s=new ActorSamples({world:true});s.update(g,0);assert.deepEqual(s.at('captain',40),g.self.position);assert.equal(s.at('unseen',40),null);assert.equal(s.setIntent({seq:3,dx:1,dy:0},40),false);const c=contexts(g,world);assert.equal(c.use.enabled,true);for(const name of ['report','eliminate','protect','decoy','sabotage'])assert.equal(c[name].enabled,false);assert.equal(validTaskSession({taskId:'ghost-task',roomId:'r',matchId:g.matchId,location:'bridge'}, {roomId:'r',game:g},world),true);s.clear();assert.equal(s.at('captain',50),null);
});
test('ghost world keyboard and private IME channel retain lifecycle ownership',async()=>{
 const f=domFixture(),g=ghostView(),calls=[],inputs=[];let reject;const api=createWorldExperience(f.host,{input:async v=>inputs.push(v),action:(type,fields)=>{calls.push({type,fields});return new Promise((_,fail)=>reject=fail);},leave(){},start:async()=>{},loadReplay:async()=>({replay:[]})});try{
 const update=game=>api.update({roomId:'ghost-room',game,ai:{mode:'demo'},notices:[]},{connected:true,now:2000});update(g);const canvas=f.host.querySelector('.lw-world-canvas');canvas.focus();f.win.emit('keydown',{key:'ArrowRight',target:canvas});await flush();assert.ok(inputs.some(v=>v.dx===1));f.win.emit('keyup',{key:'ArrowRight',target:canvas});const chat=f.host.querySelector('.lw-ghost-chat'),draft=chat.querySelector('textarea'),form=chat.querySelector('form');draft.value='Fallen draft';draft.emit('compositionstart');form.emit('submit');assert.equal(calls.length,0);draft.emit('compositionend');form.emit('submit');assert.equal(calls[0].type,'ghostSay');const next=structuredClone(g);next.matchId='replacement';update(next);draft.value='Current draft';reject(new Error('OLD FALLEN FAILURE'));await flush();assert.doesNotMatch(f.host.textContent,/OLD FALLEN FAILURE/);assert.equal(draft.value,'Current draft');
 }finally{api.dispose();f.dispose();}
});
for(const ref of [{id:'beacon',version:2},{id:'stormbreak-annex',version:1}])test('replay uses exact '+ref.id+' geometry and custom roster without inventing hidden observations',()=>{
 const map=getMap(ref),[a,b]=Object.values(map.geometry.WORLD_STATIONS),players=[{id:'captain',name:'Captain',color:'#eab678'},{id:'other',name:'Other',color:'#98cabc'}];
 const response={matchId:'replay-map',roomId:'replay-room',replay:[{id:'r1',at:100,type:'started',worldVersion:1,positions:[{id:'captain',position:a},{id:'other',position:b}],roles:[{id:'captain',role:'crew'},{id:'other',role:'saboteur'}]},{id:'r2',at:200,type:'ended',winner:'crew',reason:'tasks'}]};
 const model=createReplayModel(response,{matchId:response.matchId,roomId:response.roomId,players,map:ref}),s=model.at(200);assert.deepEqual(s.map,ref);assert.deepEqual(s.players.map(p=>p.id),['captain','other']);assert.deepEqual(s.players[0].position,a);assert.deepEqual(model.perspective(s,'captain').observations,[]);assert.equal(model.at(100,0).phase,'roam');assert.equal(model.at(200).phase,'ended');assert.throws(()=>createReplayModel(response,{matchId:'wrong',map:ref}),/another match/);
});
test('beacon ability actions require exact owner-safe descriptors',()=>{
 const g={...ghostView(),beaconVersion:1};g.self.alive=true;g.self.ghost=false;g.self.ability={type:'ward'};g.interactions=[{id:'ward-other',type:'protect',fields:{targetId:'other'},enabled:true},{id:'echo-own',type:'decoy',fields:{x:g.self.position.x,y:g.self.position.y},enabled:true}];const c=contexts(g,getMap(g.map).geometry);assert.deepEqual(c.protect.fields,{targetId:'other'});assert.equal(c.protect.enabled,true);assert.equal(c.decoy.enabled,true);g.interactions=[];assert.equal(contexts(g,getMap(g.map).geometry).protect.enabled,false);
});
test('mobile equipment CSS reserves status/exit and scrolls all tall panel controls',()=>{
 const css=readFileSync(new URL('public/game.css',root),'utf8');const start=css.indexOf('/* Equipment stays below'),next=css.indexOf('/*',start+2);assert(start>=0);const tail=css.slice(start,next<0?undefined:next); // Scope this contract to equipment, not unrelated spectator hiding rules.
 assert.match(tail,/max-width:700px/);assert.match(tail,/max-height:540px/);assert.match(tail,/\.lw-scene-overlay:has\(\.lw-task-modal:not\(\[hidden\]\)\)\{display:block;padding-top:105px/);assert.match(tail,/max-height:calc\(100dvh - 181px\);overflow:auto/);assert.match(tail,/\.lw-modal-title\{position:sticky;top:0/);assert.doesNotMatch(tail,/display:none|visibility:hidden/);
 for(const [width,height]of [[320,740],[390,844],[844,390]]){const top=105,rail=60,gap=16,max=height-181;assert.ok(max>=180,`${width} panel remains usable`);assert.equal(top+max+rail+gap,height);assert.ok(top>=66);}
});

test('normal experience routes Group2 taskStep then completion separately from station taskInteract',async()=>{
 const f=domFixture(),g=ghostView();g.self.alive=true;g.self.ghost=false;g.players[0].alive=true;const t=g.self.tasks[0];t.progress=challenge(t);g.availableActions=['task','taskStep'];let current={roomId:'step-room',game:g,ai:{mode:'demo'},notices:[]},api;const calls=[];
 api=createWorldExperience(f.host,{input:async()=>{},leave(){},start:async()=>{},loadReplay:async()=>({replay:[]}),action:async(type,fields)=>{calls.push({type,fields});const next=structuredClone(current),task=next.game.self.tasks[0];if(type==='taskStep'){assert.equal(stepError(task,fields,2000),null);advanceTask(task,2000);}else{assert.equal(type,'task');assert.equal(task.progress.index,task.progress.total);task.completed=true;}next.game.version++;current=next;return {room:next};}});
 try{api.update(current,{connected:true,now:2000});const click=text=>{const b=f.host.querySelectorAll('button').find(b=>b.textContent===text);assert.ok(b,text);b.emit('click');};click('Enter the beacon');f.host.querySelector('.lw-action-use').emit('click');
 for(let n=0;n<3;n++){click('Left cable '+(n+1));click('Right socket '+(n+1));await flush();}
 assert.deepEqual(calls.map(c=>c.type),['taskStep','taskStep','taskStep']);click('Send completed task');await flush();assert.equal(calls.at(-1).type,'task');assert.equal(f.host.querySelector('.lw-task-modal'),null);
 }finally{api.dispose();f.dispose();}
});

test('station replay opening never means completion; only recorded task progress does',()=>{
 const position={x:800,y:285},events=[{id:'r1',type:'started',at:100,worldVersion:1,positions:[{id:'captain',position}],tasks:[{id:'captain',tasks:[{id:'station',kind:'station',roomId:'bridge',completed:false}]}]},{id:'r2',type:'action',at:200,playerId:'captain',action:{type:'task',taskId:'station'}},{id:'r3',type:'task_progress',at:300,playerId:'captain',taskId:'station',completed:false},{id:'r4',type:'task_progress',at:400,playerId:'captain',taskId:'station',completed:true}];const m=createReplayModel({replay:events},{players:[{id:'captain',name:'Captain'}]});assert.equal(m.at(200).players[0].tasks[0].completed,false);assert.equal(m.at(300).players[0].tasks[0].completed,false);assert.equal(m.at(400).players[0].tasks[0].completed,true);
});

for(const stale of [false,true])test('Group2 pending step '+(stale?'ABA cannot replace current council feedback':'rejection retains useful current equipment feedback'),async()=>{
 const f=domFixture(),g=ghostView();g.self.alive=true;g.self.ghost=false;g.players[0].alive=true;g.self.tasks[0].progress=challenge(g.self.tasks[0]);g.availableActions=['task','taskStep'];let reject;const api=createWorldExperience(f.host,{input:async()=>{},leave(){},start:async()=>{},loadReplay:async()=>({replay:[]}),action:()=>new Promise((_,fail)=>reject=fail)}),r={roomId:'step-error',game:g,ai:{mode:'demo'},notices:[]};
 try{const update=(next,feedback='')=>api.update(next,{connected:true,now:2000,feedback});const click=text=>f.host.querySelectorAll('button').find(b=>b.textContent===text).emit('click');update(r);click('Enter the beacon');f.host.querySelector('.lw-action-use').emit('click');click('Left cable 1');click('Right socket 1');if(stale){const newer=structuredClone(r);newer.game.self.tasks[0].progress.index=1;update(newer);update(r,'CURRENT EQUIPMENT');}reject(new Error('DEFERRED STEP FAILURE'));await flush();if(stale)assert.equal(f.host.querySelector('.lw-feedback').textContent,'CURRENT EQUIPMENT');else{assert.match(f.host.querySelector('.lw-feedback').textContent,/DEFERRED STEP FAILURE/);assert.match(f.host.querySelector('.lw-puzzle-status').textContent,/DEFERRED STEP FAILURE/);}assert.equal(f.host.querySelector('.lw-task-modal').querySelector('button').disabled,false);
 }finally{api.dispose();f.dispose();}
});
