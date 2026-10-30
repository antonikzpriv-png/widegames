import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=process.env.QUALITY_CLIENT_WALK_ROOT?pathToFileURL(resolve(process.env.QUALITY_CLIENT_WALK_ROOT)+'/'):new URL('../',import.meta.url);
const {getMap}=await import(new URL('shared/maps/index.mjs',root));
const {ActorSamples}=await import(new URL('public/world/model.mjs',root));
const {createWorldScene}=await import(new URL('public/world/scene.mjs',root));
const {createWorldExperience}=await import(new URL('public/world/experience.mjs',root));
const {createTaskPuzzle}=await import(new URL('public/world/puzzles.mjs',root));
const cameraRecords=[];
const {MotionTrack}=await import(new URL('public/world/movement.mjs',root));
const map=getMap({id:'beacon',version:1});
const surface=()=>{const ctx=new Proxy({},{get:(_,key)=>String(key).startsWith('create')?()=>({addColorStop(){}}):()=>{}});return {getContext:()=>ctx,getBoundingClientRect:()=>({width:900,height:650,left:0,top:0})};};
function view(position={x:700,y:300}){return {matchId:'walking-default',version:1,worldVersion:1,beaconVersion:1,map:{id:map.id,version:1},phase:'roam',self:{id:'own-arbitrary',alive:true,role:'crew',roomId:'bridge',position:{...position},inputSeq:1,moving:false,tasks:[]},players:[{id:'own-arbitrary',name:'WALKING OWNER',alive:true,status:'alive',position:{...position}},{id:'remote-arbitrary',name:'Other',alive:true,status:'alive',position:{x:680,y:300}}],vision:{origin:{...position},radius:360,mode:'player',lights:false},systems:{doors:[],lights:{active:false},communications:{active:false}},events:[],interactions:[],tasks:{total:1,completed:0},availableActions:[]};}
function shifted(game,position){const next=structuredClone(game);next.version++;next.self.position={...position};next.players[0].position={...position};next.vision.origin={...position};return next;}
const envelope=game=>({roomId:'walking-default-room',map:game.map,mode:'human',ai:{mode:'demo'},isHost:true,notices:[],game});
// These are safe-view/layout fixtures with real shared geometry/helper. The
// unchanged independent tests separately drive actual engine detours.


test('default ActorSamples delegates all versioned world views to real Core collision checking',()=>{
 for(const worldVersion of [1,2,3,4,5]){const samples=new ActorSamples(),first=view({x:700,y:200});first.worldVersion=worldVersion;const next=shifted(first,{x:900,y:200});samples.update(first,0);samples.update(next,1000);for(let t=1000;t<=1200;t+=5){const p=samples.at(first.self.id,t);assert(p);assert(map.geometry.isWalkable(p),'default world '+worldVersion+' at '+t);}
  assert(samples.track instanceof MotionTrack);samples.clear();assert.equal(samples.samples.size,0);assert.equal(samples.setIntent({seq:2,dx:1,dy:0},1300),false);
 }
});

test('raw Cartesian fixtures alone retain old update/at/samples compatibility',()=>{
 const samples=new ActorSamples(),g={worldVersion:1,players:[{id:'math',alive:true,position:{x:100,y:100}}]};samples.update(g,0);g.players[0].position={x:200,y:100};samples.update(g,100);assert.deepEqual(samples.at('math',170),{x:150,y:100});assert.equal(samples.samples.size,1);samples.clear();assert.equal(samples.samples.size,0);
});

test('default scene forwards bounded intent, stops, and clears without an optional factory',()=>{
 const scene=createWorldScene(surface()),g=view({x:650,y:300});try{scene.update(envelope(g),0);assert.equal(scene.setIntent({seq:2,dx:1,dy:0},0),true);scene.draw(16);assert.equal(scene.setIntent({seq:3,dx:0,dy:0},20),true);scene.suspend();assert.equal(scene.setIntent({seq:4,dx:1,dy:0},30),false);scene.update(envelope(g),40);assert(scene.setIntent({seq:2,dx:1,dy:0},40));}finally{scene.dispose();}
});

test('full-scene camera is cadence-independent over gaps and moving/interpolating actor snapshots',()=>{
 const events=[{at:0,position:{x:700,y:300}},{at:1000,position:{x:900,y:300}},{at:1090,position:{x:850,y:300}},{at:1225,position:{x:920,y:300}}],results=[];
 for(const fps of [24,30,60,120,144]){const scene=createWorldScene(surface());try{let game=view(),i=0;scene.update(envelope(game),0);scene.draw(0);for(let frame=1;frame<=Math.ceil(1400*fps/1000);frame++){const time=Math.min(1400,frame*1000/fps);while(i+1<events.length&&events[i+1].at<=time){i++;game=shifted(game,events[i].position);scene.update(envelope(game),events[i].at);}scene.draw(time);}results.push(scene.toWorld(450,325));}finally{scene.dispose();}}
 for(const p of results)assert(map.geometry.distance(p,results[0])<1e-7,JSON.stringify(results));cameraRecords.push({cadences:[24,30,60,120,144],elapsedMs:1400,positions:results,maxGap:Math.max(...results.map(p=>map.geometry.distance(p,results[0])))});
});

test('suspension, owner changes, reduced motion and large observation jumps reset camera predictably',()=>{
 const scene=createWorldScene(surface()),g=view();try{scene.update(envelope(g),0);scene.draw(0);const later=shifted(g,{x:900,y:300});scene.update(envelope(later),1000);scene.draw(1050);assert(scene.toWorld(450,325).x<900);scene.suspend();scene.update(envelope(later),2000);scene.draw(2000);assert.deepEqual(scene.toWorld(450,325),later.self.position);const next=shifted(later,{x:800,y:500}),replacement={...envelope(next),roomId:'replacement-room'};scene.update(replacement,3000);scene.draw(3000);assert.deepEqual(scene.toWorld(450,325),next.self.position);const engine=map.geometry.WORLD_STATIONS.engine,far=shifted(next,{x:engine.x,y:engine.y});scene.update({...replacement,game:far},3100);scene.draw(3100);assert.deepEqual(scene.toWorld(450,325),far.self.position,'same-owner jump above600 world units snaps');}finally{scene.dispose();}
 const reduced=createWorldScene(surface(),{reduced:true});try{reduced.update(envelope(g),0);reduced.draw(0);const next=shifted(g,{x:900,y:300});reduced.update(envelope(next),100);reduced.draw(100);assert.deepEqual(reduced.toWorld(450,325),next.self.position);}finally{reduced.dispose();}
});

test('default samples never resurrect hidden actors from an older packet and revoke pending intent on a door change',()=>{
 const samples=new ActorSamples(),g=view();samples.update(g,0);assert(samples.setIntent({seq:2,dx:1,dy:0},0));const next=shifted(g,g.self.position);next.players[1].position=null;next.players[1].status='unknown';next.players[1].alive=null;next.systems.doors=[{id:map.fixtures.doors[0].id,closed:true}];samples.update(next,20);assert.equal(samples.intent,null);assert.equal(samples.at('remote-arbitrary',21),null);samples.update(g,30);assert.equal(samples.at('remote-arbitrary',31),null);
});

function domFixture(){
 const frames=new Map();let nextFrame=0,actorSamples=[],translation=null;
 const saved=new Map(['document','window','matchMedia','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,globalThis[k]]));
 const events=()=>({handlers:new Map(),addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(fn);},removeEventListener(type,fn){this.handlers.get(type)?.delete(fn);},emit(type,init={}){const e={key:'',target:this,button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...init};for(const fn of this.handlers.get(type)||[])fn(e);return e;}});
 const document={...events(),hidden:false,activeElement:null};
 const ctx=new Proxy({}, {get:(_,key)=>String(key).startsWith('create')?()=>({addColorStop(){}}):(...args)=>{if(key==='translate')translation=args;if(key==='fillText'&&args[0]==='WALKING OWNER')actorSamples.push([...translation]);},set:()=>true});
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
  getContext(){return ctx;}getBoundingClientRect(){return {width:this.className==='lw-world-canvas'?900:0,height:this.className==='lw-world-canvas'?650:0,left:0,top:0};}
 }
 document.createElement=tag=>new Node(tag);document.body=new Node('body');document.head=new Node('head');document.activeElement=document.body;document.querySelector=selector=>document.head.querySelector(selector)||document.body.querySelector(selector);
 const win={...events(),setInterval:()=>1,clearInterval(){}};Object.assign(globalThis,{document,window:win,matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{const id=++nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);}});
 const host=new Node('main');document.body.append(host);return {host,document,win,actorSamples,frame(at){const [id,fn]=frames.entries().next().value||[];if(!fn)return;frames.delete(id);actorSamples.length=0;fn(at);},dispose(){host.remove();for(const [k,v]of saved)if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}


test('normal experience keyboard entry reaches the default safety track and clears presentation on blur',()=>{
 const f=domFixture(),inputs=[],game=view({x:650,y:300}),experience=createWorldExperience(f.host,{input:async packet=>inputs.push(packet),action:async()=>{},start:async()=>{},leave(){},loadReplay:async()=>({replay:[]})});
 try{experience.update(envelope(game),{now:1000,connected:true,pending:false});const enter=f.host.querySelectorAll('button').find(n=>n.textContent==='Enter the beacon');enter.emit('click');const canvas=f.host.querySelector('.lw-world-canvas');f.win.emit('keydown',{key:'d',target:canvas});assert(inputs.some(p=>p.dx===1&&p.dy===0));f.frame(performance.now()+16);assert(f.actorSamples.some(([x,y])=>x>650&&x<=668.001&&y===300),'actual default scene draws bounded next-frame self motion');f.win.emit('blur');f.frame(performance.now()+32);assert.equal(f.actorSamples.length,0,'blur clears cached actors until a fresh owner update');assert(inputs.some(p=>p.dx===0&&p.dy===0));}
 finally{experience.dispose();f.dispose();}
});


for(const kind of ['wires','tuning','sequence'])test('legacy '+kind+' puzzle still submits only after its original local interactions',()=>{
 const f=domFixture();let calls=0;const puzzle=createTaskPuzzle({id:'legacy-'+kind,task:{id:'relay',kind:'relay',label:'Legacy relay'},kind,onClose(){},onSubmit(...args){assert.equal(args.length,0);calls++;}});f.host.append(puzzle.node);
 const click=label=>{const b=f.host.querySelectorAll('button').find(n=>n.getAttribute('aria-label')?.startsWith(label)||n.textContent===label);assert(b,label);if(!b.disabled)b.emit('click');};
 try{click('Send completed task');assert.equal(calls,0);if(kind==='wires'){for(const n of [1,2,3]){click('Left cable '+n);click('Right socket '+n);}}else if(kind==='tuning'){const slider=f.host.querySelector('input');slider.value='72';slider.emit('input');click('Lock frequency');}else for(const n of [2,4,1,3])click('Sequence tile '+n);click('Send completed task');assert.equal(calls,1);}
 finally{puzzle.dispose();f.dispose();}
});

after(()=>{if(process.env.QUALITY_CLIENT_WALK_RECEIPT)writeFileSync(process.env.QUALITY_CLIENT_WALK_RECEIPT,JSON.stringify({root:root.href,cameraRecords,limits:'Actual default scene and real MotionTrack/map dependency with controlled safe views and minimal DOM; unchanged Reviewer controls use actual engine detours. No Chrome/native FPS claim.'},null,2));});
