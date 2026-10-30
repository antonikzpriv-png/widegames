import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../server/engine/index.mjs';
import {createWorldExperience} from '../public/world/experience.mjs';
import {createSpatialWorld} from '../server/engine/world/index.mjs';
import {getMap} from '../shared/maps/index.mjs';
import {nextStationInput} from '../shared/station-challenges.mjs';
import {readFileSync} from 'node:fs';
const flush=()=>new Promise(done=>setImmediate(done));
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
  getContext(){return ctx;}getBoundingClientRect(){return {width:390,height:600,left:0,top:0};}
 }
 document.createElement=tag=>new Node(tag);document.body=new Node('body');document.head=new Node('head');document.activeElement=document.body;document.querySelector=selector=>document.head.querySelector(selector)||document.body.querySelector(selector);
 const win={...events(),setInterval:()=>1,clearInterval(){}};Object.assign(globalThis,{document,window:win,matchMedia:()=>({matches:true}),requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
 const host=new Node('main');document.body.append(host);return {host,document,win,dispose(){host.remove();for(const [k,v]of saved)if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}


// Real engine action fixtures explicitly position actors; no HTTP/native claim.
let serial=0;
function fixture(){
 const f=domFixture();let state=engine.createMatch({id:'fallen-channel',tactical:true,stationTasks:true,map:{id:'beacon',version:2},features:{deathPolicy:'ghost-tasks',abilities:true},seed:'fallen-ui',now:1000,config:{initialKillCooldownMs:1,taskCooldownMs:1}});const ownerId=state.players.find(p=>p.role==='crew'&&!p.ability).id,sab=state.players.find(p=>p.role==='saboteur');
 const place=(id,position)=>{const p=state.players.find(p=>p.id===id),g=getMap(state.map).geometry;createSpatialWorld(g).stop(state,p,state.updatedAt,'fixture',()=>{});p.position={...position};p.roomId=g.worldRoomAt(position)??p.roomId;};
 const act=(id,type,fields={},at=state.updatedAt+2)=>{const result=engine.applyAction(state,id,{id:'fallen-ui:'+ ++serial,type,...fields},at);assert.equal(result.accepted,true,JSON.stringify(result.error));state=result.state;};place(sab.id,state.players.find(p=>p.id===ownerId).position);act(sab.id,'eliminate',{targetId:ownerId});const own=state.players.find(p=>p.id===ownerId),task=own.tasks.find(t=>['circuit','sequence','glyphs'].includes(t.challenge.kind))??own.tasks[0];place(ownerId,getMap(state.map).geometry.WORLD_STATIONS[task.roomId]);
 const calls=[],inputs=[];let api,roomId=state.id,deferred=null;
 const room=()=>({roomId,game:engine.getPlayerView(state,ownerId,state.updatedAt),ai:{mode:'demo'},notices:[]});
 api=createWorldExperience(f.host,{leave(){},start:async()=>{},loadReplay:async()=>({replay:[]}),input:async value=>{inputs.push(value);const result=engine.applyInput(state,ownerId,value,state.updatedAt+1);assert.equal(result.accepted,true,JSON.stringify(result.error));state=result.state;},action:async(type,fields)=>{calls.push({type,fields});if(deferred)return await deferred;act(ownerId,type,fields,state.updatedAt+(type==='ghostSay'?2001:2));const returned=room();api.update(returned,{connected:true,now:state.updatedAt});return {room:returned};}});
 const update=(r=room(),options={})=>api.update(r,{connected:true,now:state.updatedAt,...options});update();const toggle=f.host.querySelector('.lw-ghost-toggle'),pane=f.host.querySelector('.lw-ghost-pane'),draft=pane.querySelector('textarea'),form=pane.querySelector('form');
 return {...f,api,ownerId,calls,inputs,toggle,pane,draft,form,room,update,get state(){return state;},taskId:task.id,defer(promise){deferred=promise;},dispose(){api.dispose();f.dispose();}};
}
function firstInput(panel,task){const next=nextStationInput(task.challenge),buttons=panel.querySelectorAll('button'),click=label=>{const b=buttons.find(b=>b.textContent===label||b.getAttribute('aria-label')===label);assert.ok(b,label);b.emit('click');};
 if(task.challenge.kind==='circuit'){const [l,r]=next.value.split(':');click('Cable '+task.challenge.puzzle.left.find(c=>c.id===l).symbol);click('Socket '+task.challenge.puzzle.right.find(c=>c.id===r).symbol);}else if(task.challenge.kind==='sequence')click('Record tile '+next.value);else if(task.challenge.kind==='glyphs'){const tile=task.challenge.puzzle.tiles.find(t=>t.id===next.value);click('Inspection tile '+(Number(tile.id.slice(1))+1)+': '+tile.symbol);}else if(task.challenge.kind==='signal'){panel.querySelector('input').value=next.value;click('Transmit frequency');}else if(task.challenge.kind==='manifolds'){const valve=task.challenge.puzzle.valves.find(v=>v.id===next.value);click('Pressure valve '+valve.value);}else{const [id,value]=next.value.split(':');panel.querySelectorAll('select').find(s=>s.id.endsWith('-'+id)).value=value;click('Lock rotor '+(Number(id.slice(1))+1));}
}

test('fallen channel starts collapsed; keyboard toggle/Escape restore focus and keep draft nodes',()=>{const f=fixture();try{assert.equal(f.pane.hidden,true);assert.equal(f.toggle.getAttribute('aria-expanded'),'false');f.toggle.focus();f.toggle.emit('click');assert.equal(f.pane.hidden,false);assert.equal(f.document.activeElement,f.draft);f.draft.value='private draft ??';const node=f.draft;f.update();assert.equal(f.draft,node);assert.equal(f.document.activeElement,node);assert.equal(node.value,'private draft ??');f.pane.emit('keydown',{key:'Escape'});assert.equal(f.pane.hidden,true);assert.equal(f.document.activeElement,f.toggle);f.toggle.emit('click');assert.equal(f.draft.value,'private draft ??');}finally{f.dispose();}});
test('ghost can steer with chat collapsed, open actual USE station, confirm an input and recover its chat draft',async()=>{const f=fixture();try{const canvas=f.host.querySelector('.lw-world-canvas');canvas.focus();f.win.emit('keydown',{key:'ArrowRight',target:canvas});await flush();assert.ok(f.inputs.some(v=>v.dx===1));f.win.emit('keyup',{key:'ArrowRight',target:canvas});f.toggle.emit('click');f.draft.value='retained around station';f.host.querySelector('.lw-action-use').emit('click');assert.equal(f.pane.hidden,true);assert.equal(f.toggle.disabled,true);const panel=f.host.querySelector('.lw-station-modal');assert.ok(panel);const task=f.state.players.find(p=>p.id===f.ownerId).tasks.find(t=>t.id===f.taskId);firstInput(panel,task);await flush();assert.equal(f.calls[0].type,'taskInteract');assert.ok(f.state.players.find(p=>p.id===f.ownerId).tasks.find(t=>t.id===f.taskId).challenge.progress.values.length);panel.querySelectorAll('button').find(b=>b.textContent==='Close station').emit('click');f.toggle.emit('click');assert.equal(f.pane.hidden,false);assert.equal(f.draft.value,'retained around station');}finally{f.dispose();}});
test('opened fallen channel submits real private chat with IME guard and returns owner-only text',async()=>{const f=fixture();try{f.toggle.emit('click');f.draft.value='ACTUAL FALLEN SEND';f.draft.emit('compositionstart');f.form.emit('submit',{isComposing:true});assert.equal(f.calls.length,0);f.draft.emit('compositionend');f.form.emit('submit');await flush();assert.equal(f.calls[0].type,'ghostSay');assert.equal(f.draft.value,'');assert.match(f.pane.textContent,/ACTUAL FALLEN SEND/);for(const id of [null,f.state.players.find(p=>p.alive&&p.role==='crew').id])assert.equal(JSON.stringify(engine.getPlayerView(f.state,id,f.state.updatedAt)).includes('ACTUAL FALLEN SEND'),false);assert.equal(JSON.stringify(f.state.replay).includes('ACTUAL FALLEN SEND'),false);}finally{f.dispose();}});
for(const boundary of ['phase','life','hidden'])test('fallen panel collapses on '+boundary+' while retaining current owner draft',()=>{const f=fixture();try{f.toggle.emit('click');f.draft.value='kept private';if(boundary==='hidden'){f.document.hidden=true;f.document.emit('visibilitychange');}else{const r=f.room();if(boundary==='phase'){r.game.phase='discussion';r.game.meeting={id:'council',messages:[],votes:[],eligibleVoters:[]};}if(boundary==='map')r.game.map={id:'stormbreak-annex',version:1};if(boundary==='life'){r.game.self.ghost=false;r.game.self.alive=true;}f.update(r);}assert.equal(f.pane.hidden,true);assert.equal(f.draft.value,'kept private');}finally{f.dispose();}});
test('room owner change clears private draft and disposed old toggle/form cannot send',async()=>{const f=fixture();f.toggle.emit('click');f.draft.value='old room';const next=f.room();next.roomId='other-room';f.update(next);assert.equal(f.pane.hidden,true);assert.equal(f.draft.value,'');f.dispose();f.toggle.emit('click');f.draft.value='late old room';f.form.emit('submit');await flush();assert.equal(f.calls.length,0);});
test('closing/reopening a pending channel revokes old rejection without losing replacement draft',async()=>{const f=fixture();let reject;try{f.toggle.emit('click');f.draft.value='same draft';f.defer(new Promise((_,fail)=>reject=fail));f.form.emit('submit');f.pane.emit('keydown',{key:'Escape'});f.toggle.emit('click');f.draft.value='replacement';reject(new Error('OLD CLOSED CHAT'));await flush();assert.equal(f.draft.value,'replacement');assert.doesNotMatch(f.host.querySelector('.lw-feedback').textContent,/OLD CLOSED CHAT/);}finally{f.dispose();}});

test('immutable map replacement retains the existing private-context reset',()=>{const f=fixture();try{f.toggle.emit('click');f.draft.value='old world draft';const next=f.room();next.game.map={id:'stormbreak-annex',version:1};f.update(next);assert.equal(f.pane.hidden,true);assert.equal(f.draft.value,'');}finally{f.dispose();}});

const game=readFileSync(new URL('../public/game.css',import.meta.url),'utf8'),scoped=readFileSync(new URL('../public/world/beacon.css',import.meta.url),'utf8');
let criticalState=false;
function rules(source,queries=[],output=[]){
 source=source.replace(/\/\*[\s\S]*?\*\//g,'');let at=0;
 while(at<source.length){const open=source.indexOf('{',at);if(open<0)break;let end=open+1,depth=1;while(depth&&end<source.length){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;end++;}
  const head=source.slice(at,open).trim(),body=source.slice(open+1,end-1);at=end;
  if(head.startsWith('@media')){rules(body,[...queries,head.slice(6).trim()],output);continue;}
  if(head.startsWith('@'))continue;
  const declarations=body.split(';').flatMap(item=>{const m=item.trim().match(/^([\w-]+)\s*:\s*(.*)$/s);return m?[[m[1],m[2].trim()]]:[];});
  for(const selector of head.split(','))output.push({selector:selector.trim(),queries,declarations});
 }return output;
}
const all=rules(game+'\n'+scoped);
function media(query,{width,height}){return query.split(',').some(branch=>branch.split(/\s+and\s+/).every(part=>{
 const m=part.trim().match(/^\((min|max)-(width|height):\s*(\d+)px\)$/);if(m){const value=m[2]==='width'?width:height;return m[1]==='min'?value>=+m[3]:value<=+m[3];}
 if(/\((?:hover:none|pointer:coarse)\)/.test(part))return true;
 if(/prefers-reduced-motion/.test(part))return false;
 throw Error('Unsupported media contract: '+part);
}));}
const node=(classes,parent=null)=>({classes:classes.split(' '),parent});
const world=node('lw-world'),stage=node('lw-stage',world),nodes=Object.fromEntries(['lw-sound-toggle','lw-joystick','lw-actions','lw-action','lw-beacon','lw-beacon-toggle','lw-beacon-pane','lw-scene-overlay','lw-role-scene','lw-topbar','lw-exit'].map(name=>[name,node(name,stage)]));
nodes['lw-ghost-chat']=node('lw-ghost-chat',stage);nodes['lw-ghost-toggle']=node('lw-ghost-toggle',nodes['lw-ghost-chat']);nodes['lw-ghost-pane']=node('lw-ghost-pane',nodes['lw-ghost-chat']);
nodes['lw-action'].parent=nodes['lw-actions'];nodes['lw-beacon-toggle'].parent=nodes['lw-beacon'];nodes['lw-beacon-pane'].parent=nodes['lw-beacon'];nodes['lw-exit'].parent=nodes['lw-topbar'];
function matches(selector,target){
 // The modeled nodes have no state attributes or pseudo-elements. Stateful
 // exceptions are reviewed by the dedicated contract assertions below.
 if(selector.includes('[data-critical=true]')){if(!criticalState)return false;selector=selector.replace('[data-critical=true]','');}
 if(/[\[:>#]/.test(selector))return false;
 const parts=selector.trim().split(/\s+/);let current=target;
 for(let i=parts.length-1;i>=0;i--){const simple=parts[i],accept=n=>simple==='*'||simple.split('.').filter(Boolean).every(c=>n.classes.includes(c));
  if(i===parts.length-1){if(!accept(current))return false;}else{current=current.parent;while(current&&!accept(current))current=current.parent;if(!current)return false;}
 }return true;
}
function style(name,view){const output={},rank={};for(const r of all){if(!r.queries.every(q=>media(q,view))||!matches(r.selector,nodes[name]))continue;
 const specificity=(r.selector.match(/\./g)||[]).length;for(const [key,raw]of r.declarations){const important=/!important$/.test(raw),score=(important?1000:0)+specificity;if(score<(rank[key]??-1))continue;rank[key]=score;output[key]=raw.replace(/\s*!important$/,'');}
 }return output;}
function length(value,view,axis){
 if(value===undefined||value==='auto')return null;if(value==='0')return 0;
 if(value.startsWith('min(')){const m=value.match(/^min\((\d+)px,calc\((\d+)(vw|%) - (\d+)px\)\)$/);assert(m,'unsupported min '+value);return Math.min(+m[1],length(m[2]+m[3],view,axis)-+m[4]);}
 if(value.startsWith('calc(')){const m=value.match(/^calc\((\d+)(dvh|vh|vw|%) - (\d+)px\)$/);assert(m,'unsupported calc '+value);return length(m[1]+m[2],view,axis)-+m[3];}
 const m=value.match(/^(-?[\d.]+)(px|dvh|vh|vw|%)$/);assert(m,'unsupported length '+value);return +m[1]*(m[2]==='px'?1:m[2]==='vw'?view.width/100:m[2]==='%'?axis/100:view.height/100);
}
function rect(css,view,{width,height}={}){
 const x=k=>length(css[k],view,view.width),y=k=>length(css[k],view,view.height);
 width=x('width')??width??(x('left')!==null&&x('right')!==null?view.width-x('left')-x('right'):null);
 height=y('height')??height??(y('top')!==null&&y('bottom')!==null?view.height-y('top')-y('bottom'):null);
 assert(width!==null&&height!==null,'rectangle needs explicit or fixture dimensions');
 const left=x('left')??view.width-x('right')-width,top=y('top')??view.height-y('bottom')-height;
 return {left,top,right:left+width,bottom:top+height,width,height};
}
function disjoint(a,b){return a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top;}
function overlayStyle(css){const inset=(css.inset||'0').split(/\s+/);assert.equal(inset.length,1);return {top:inset[0],right:inset[0],bottom:inset[0],left:inset[0],...css};}

for(const view of [{width:320,height:740},{width:390,height:844},{width:844,height:390},{width:1440,height:1000}])for(const active of [false,true])test(`actual fallen layout contract ${view.width}x${view.height} critical=${active}`,()=>{
 criticalState=active;const dock=style('lw-ghost-chat',view),paneStyle=style('lw-ghost-pane',view),toggleStyle=style('lw-ghost-toggle',view),pane=rect(paneStyle,view),toggle=rect(toggleStyle,view,{height:44});if(paneStyle['max-height']&&paneStyle['max-height']!=='none'){pane.height=Math.min(pane.height,length(paneStyle['max-height'],view,view.height));pane.bottom=pane.top+pane.height;}
 const stick=rect(style('lw-joystick',view),view),actions=style('lw-actions',view),action=style('lw-action',view),use=rect(actions,view,{width:length(action.width,view,view.width),height:length(action['min-height'],view,view.height)}),sound=rect(style('lw-sound-toggle',view),view,{width:88,height:44}),systems=rect({...style('lw-beacon',view),height:'44px',width:style('lw-beacon-toggle',view).width},view,{height:44,width:150});
 assert.equal(dock['pointer-events'],'none','full-stage owner dock must not intercept gameplay');assert.equal(paneStyle['pointer-events'],'auto');assert.equal(toggleStyle['pointer-events'],'auto');assert.equal(paneStyle.overflow,'auto');assert.equal(paneStyle['overscroll-behavior'],'contain');assert(toggle.width>=44&&toggle.height>=44);assert(pane.height>=150,'open chat supports native controls with bounded scroll');assert(pane.left>=0&&pane.right<=view.width&&pane.bottom<=view.height);assert(pane.top>=length(style('lw-topbar',view)['min-height'],view,view.height));assert(toggle.top>=length(style('lw-topbar',view)['min-height'],view,view.height));
 for(const control of [stick,use,sound,systems]){assert(disjoint(pane,control),'open chat cannot cover joystick, USE, Sound or Systems');assert(disjoint(toggle,control),'toggle has its own hit target outside gameplay/rail controls');}
 if(view.width===390){const observedUse={left:315,top:684,right:380,bottom:764};assert(disjoint(pane,observedUse),'candidate must clear the exact independently observed native failure rectangle');assert(disjoint(toggle,observedUse));}
 if(view.width<=700||view.height<=540)assert(pane.bottom<=view.height-60,'open pane remains above the control rail');
});
