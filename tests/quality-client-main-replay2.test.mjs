import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=process.env.QUALITY_CLIENT_REPLAY2_ROOT?pathToFileURL(resolve(process.env.QUALITY_CLIENT_REPLAY2_ROOT)+'/'):new URL('../',import.meta.url);
const engine=await import(new URL('server/engine/index.mjs',root));
const {createSpatialWorld}=await import(new URL('server/engine/world/index.mjs',root));
const {nextStationInput}=await import(new URL('shared/station-challenges.mjs',root));
const {getMap}=await import(new URL('shared/maps/index.mjs',root));
const {createReplayModel}=await import(new URL('public/world/replay-model.mjs',root));
const {createSpatialReplay}=await import(new URL('public/world/replay-viewer.mjs',root));
const {createWorldExperience}=await import(new URL('public/world/experience.mjs',root));
const dependencyFiles=['shared/replay.mjs','shared/replay-v2.mjs','shared/replay-common.mjs','shared/features.mjs','server/engine/index.mjs','server/engine/replay-history.mjs','public/world/replay-model.mjs','public/world/replay-viewer.mjs','public/world/experience.mjs'];
const digest=file=>createHash('sha256').update(readFileSync(new URL(file,root))).digest('hex');
const pins=Object.fromEntries(dependencyFiles.map(file=>[file,digest(file)]));
after(()=>{for(const [file,hash]of Object.entries(pins))assert.equal(digest(file),hash,'runtime changed during run: '+file);if(process.env.QUALITY_CLIENT_REPLAY2_RECEIPT)writeFileSync(process.env.QUALITY_CLIENT_REPLAY2_RECEIPT,JSON.stringify({root:root.href,sha256:pins},null,2));});
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
  getContext(){return ctx;}getBoundingClientRect(){return {width:390,height:600,left:0,top:0};}
 }
 document.createElement=tag=>new Node(tag);document.body=new Node('body');document.head=new Node('head');document.activeElement=document.body;document.querySelector=selector=>document.head.querySelector(selector)||document.body.querySelector(selector);
 const win={...events(),setInterval:()=>1,clearInterval(){}};Object.assign(globalThis,{document,window:win,matchMedia:()=>({matches:true}),requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
 const host=new Node('main');document.body.append(host);return {host,document,win,dispose(){host.remove();for(const [k,v]of saved)if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}

// Generated actual schema5 matches. Actors are explicitly positioned at stations
// to bound this pure engine/UI composition fixture; this is not HTTP walking.
const configs={initialKillCooldownMs:1,killCooldownMs:1,taskCooldownMs:1,meetingCooldownMs:1,roamDeadlineMs:600000,maxMatchMs:1800000};
let serial=0;
function make(ref,count){return engine.createMatch({id:'client-replay2-'+ref.id,tactical:true,stationTasks:true,map:ref,now:1000,seed:'client-replay2',features:{deathPolicy:'ghost-tasks',abilities:true},roster:Array.from({length:count},(_,i)=>({id:'sailor_'+i,name:'Sailor '+i,color:'#cda476',persona:'Careful keeper'})),saboteurCount:2,mode:'human',humanPlayerIds:['sailor_0'],config:configs});}
function place(s,id,position){const p=s.players.find(p=>p.id===id),g=getMap(s.map).geometry;createSpatialWorld(g).stop(s,p,s.updatedAt,'fixture',()=>{});p.position={...position};p.roomId=g.worldRoomAt(position)??p.roomId;}
function act(s,id,type,fields={},at=s.updatedAt+2){const result=engine.applyAction(s,id,{id:'client-replay2:'+ ++serial,type,...fields},at);assert.equal(result.accepted,true,`${type}: ${JSON.stringify(result.error)}`);return result.state;}
function ghostFixture(ref,count){let state=make(ref,count);const sab=state.players.find(p=>p.role==='saboteur'),victim=state.players.find(p=>p.role==='crew'&&!p.ability),other=state.players.find(p=>p.role==='crew'&&p.id!==victim.id);place(state,sab.id,victim.position);state=act(state,sab.id,'eliminate',{targetId:victim.id});const owner=state.players.find(p=>p.id===victim.id),task=owner.tasks.find(t=>t.challenge.kind!=='signal')??owner.tasks[0];place(state,owner.id,getMap(state.map).geometry.WORLD_STATIONS[task.roomId]);state=act(state,owner.id,'ghostSay',{text:'ACTUAL PRIVATE FALLEN MESSAGE'});return {state,ownerId:owner.id,otherId:other.id,taskId:task.id};}
const cache=new Map();
function complete(ref,count){const key=JSON.stringify(ref);if(cache.has(key))return cache.get(key);const f=ghostFixture(ref,count);let state=f.state;const live=structuredClone(state);
 for(const id of state.players.filter(p=>p.role==='crew').map(p=>p.id))for(const taskId of state.players.find(p=>p.id===id).tasks.map(t=>t.id)){
  const task=state.players.find(p=>p.id===id).tasks.find(t=>t.id===taskId);place(state,id,getMap(ref).geometry.WORLD_STATIONS[task.roomId]);
  for(let limit=0;limit<32;limit++){const current=state.players.find(p=>p.id===id).tasks.find(t=>t.id===taskId);if(current.completed)break;const input=nextStationInput(current.challenge);assert.ok(input);state=act(state,id,'taskInteract',{taskId,...input});if(state.phase==='ended')break;}
 }
 assert.equal(state.phase,'ended');assert.equal(state.outcome.winner,'crew');const response={roomId:state.id,matchId:state.id,metadata:engine.getReplayMetadata(state),replay:engine.getReplay(state)};assert.equal(response.metadata.version,2);assert.deepEqual(response.metadata.map,ref);assert.equal(response.map,undefined,'metadata-only map fixture');const result={...f,live,state,response};cache.set(key,result);return result;
}
const variants=[[{id:'beacon',version:2},12,14],[{id:'stormbreak-annex',version:1},8,8]];
for(const [ref,count,rooms]of variants){
 test('real '+ref.id+' metadata-only v2 resolves exact map/custom roster and supports backward seeks',()=>{
  const f=complete(ref,count),m=createReplayModel(f.response,{matchId:f.state.id,roomId:f.state.id,players:engine.getPlayerView(f.state,null).players}),start=m.at(m.coverage.from),end=m.at(m.coverage.through);assert.deepEqual(end.map,ref);assert.equal(getMap(end.map).roomLayout.length,rooms);assert.equal(end.players.length,count);assert.deepEqual(end.players.map(p=>p.id),f.state.players.map(p=>p.id));assert.equal(end.phase,'ended');assert.equal(start.phase,'roam');assert.deepEqual(m.at(m.coverage.from),start);assert.deepEqual(m.at(m.coverage.through),end);assert.equal(JSON.stringify(end).includes('ACTUAL PRIVATE FALLEN MESSAGE'),false);
 });
 test('real '+ref.id+' station action evidence retains final authoritative challenge and completion',()=>{
  const f=complete(ref,count),m=createReplayModel(f.response,{map:ref,players:engine.getPlayerView(f.state,null).players}),end=m.at(m.coverage.through);
  assert.ok(m.events.some(e=>e.action?.type==='taskInteract'&&e.stationChallenge&&e.completed===true));
  for(const p of f.state.players)for(const task of p.tasks){const seen=end.players.find(q=>q.id===p.id).tasks.find(t=>t.id===task.id);assert.equal(seen.completed,task.completed);assert.deepEqual(seen.challenge,task.challenge);}
 });
 test('real '+ref.id+' replay viewer consumes metadata2 and scrubs without live callbacks',()=>{
  const f=complete(ref,count),dom=domFixture(),game=engine.getPlayerView(f.state,null);delete game.map;let viewer;
  try{viewer=createSpatialReplay(dom.host,f.response,{game,roomId:f.state.id});assert.deepEqual(viewer.model.at(viewer.model.coverage.from).map,ref);const seek=dom.host.querySelector('.lw-replay-seek');seek.value=String(viewer.model.coverage.through);seek.emit('input');assert.equal(dom.host.dataset.replayPhase,'ended');seek.value=String(viewer.model.coverage.from);seek.emit('input');assert.equal(dom.host.dataset.replayPhase,'roam');viewer.refresh();assert.match(dom.host.textContent,/Recorded timestamp/);assert.doesNotMatch(dom.host.textContent,/ACTUAL PRIVATE FALLEN MESSAGE/);viewer.dispose();assert.equal(dom.host.children.length,0);}finally{viewer?.dispose();dom.dispose();}
 });
}
test('actual live and paused schema5 keep replay/metadata/private ghost content unavailable to other views',()=>{
 const {state,ownerId,otherId}=ghostFixture({id:'beacon',version:2},12);const paused=engine.tick(state,state.startedAt+state.rules.maxMatchMs).state;assert.equal(paused.phase,'paused');for(const candidate of [state,paused]){assert.equal(engine.getReplay(candidate),null);assert.equal(engine.getReplayMetadata(candidate),null);assert.equal(engine.getReplaySnapshots(candidate),null);}
 const owner=engine.getPlayerView(state,ownerId);assert.equal(owner.self.ghost,true);assert.equal(owner.ghostChat.at(-1).text,'ACTUAL PRIVATE FALLEN MESSAGE');
 for(const id of [otherId,null]){const view=engine.getPlayerView(state,id);assert.equal(view.ghostChat,undefined);assert.equal(view.players.find(p=>p.id===ownerId).position,null);assert.equal(JSON.stringify(view).includes('ACTUAL PRIVATE FALLEN MESSAGE'),false);assert.equal(view.players.find(p=>p.id===ownerId).tasks,undefined);}
});
test('owner ghost uses visible station control, receives real task progress and actual fallen chat only',async()=>{
 const dom=domFixture(),f=ghostFixture({id:'beacon',version:2},12);let state=f.state;const calls=[];
 const room=()=>({roomId:state.id,mode:'human',ai:{mode:'demo'},notices:[],game:engine.getPlayerView(state,f.ownerId)});
 const api=createWorldExperience(dom.host,{input:async input=>{const result=engine.applyInput(state,f.ownerId,input,state.updatedAt+2);assert.equal(result.accepted,true);state=result.state;},leave(){},start:async()=>{},loadReplay:async()=>{throw new Error('live replay forbidden');},action:async(type,fields)=>{calls.push({type,fields});state=act(state,f.ownerId,type,fields);return {room:room()};}});
 try{api.update(room(),{connected:true,now:state.updatedAt});const use=dom.host.querySelector('.lw-action-use');assert.equal(use.getAttribute('aria-disabled'),'false');assert.equal(use.closest('nav').hidden,false,'ghost USE action rail must be visible');use.emit('click');const panel=dom.host.querySelector('.lw-station-modal');assert.ok(panel,'Core must supply an enabled owner task descriptor; frontend cannot invent a ghost station permission');const task=state.players.find(p=>p.id===f.ownerId).tasks.find(t=>t.id===f.taskId),next=nextStationInput(task.challenge);const clickLabel=label=>{const b=panel.querySelectorAll('button').find(b=>b.textContent===label||b.getAttribute('aria-label')===label);assert.ok(b,label);b.emit('click');};
 if(task.challenge.kind==='circuit'){const [left,right]=next.value.split(':');const p=task.challenge.puzzle;clickLabel('Cable '+p.left.find(c=>c.id===left).symbol);clickLabel('Socket '+p.right.find(c=>c.id===right).symbol);}else if(task.challenge.kind==='sequence')clickLabel('Record tile '+next.value);else if(task.challenge.kind==='glyphs'){const tile=task.challenge.puzzle.tiles.find(t=>t.id===next.value);const index=task.challenge.puzzle.tiles.indexOf(tile);clickLabel('Inspection tile '+(index+1)+': '+tile.symbol);}else if(task.challenge.kind==='manifolds')clickLabel('Valve '+next.value);else if(task.challenge.kind==='alignment'){const control=panel.querySelector('select');control.value=next.value;control.emit('change');}else{const slider=panel.querySelector('input');slider.value=next.value;clickLabel('Transmit frequency');}
 await flush();assert.equal(calls[0].type,'taskInteract');assert.deepEqual(state.players.find(p=>p.id===f.ownerId).tasks.find(t=>t.id===f.taskId).challenge.progress.values.length>0,true);assert.match(dom.host.querySelector('.lw-ghost-chat').textContent,/ACTUAL PRIVATE FALLEN MESSAGE/);assert.ok(dom.host.querySelector('.lw-station-modal'));
 }finally{api.dispose();dom.dispose();}
});

test('real v2 metadata fixes geometry without caller context and rejects conflicting or future map claims',()=>{
 const f=complete({id:'beacon',version:2},12),m=createReplayModel(f.response);assert.deepEqual(m.at(m.coverage.from).map,{id:'beacon',version:2});assert.equal(m.at(m.coverage.from).players.length,12);assert.throws(()=>createReplayModel(f.response,{map:{id:'beacon',version:1}}),/another map/);const future=structuredClone(f.response);future.metadata.map.version=999;assert.throws(()=>createReplayModel(future));
});
test('real owner ghost action rail is visible while combat/repair actions remain hidden or absent',()=>{
 const dom=domFixture(),f=ghostFixture({id:'beacon',version:2},12),view=engine.getPlayerView(f.state,f.ownerId);const api=createWorldExperience(dom.host,{input:async()=>{},action:async()=>{},leave(){},start:async()=>{},loadReplay:async()=>({replay:[]})});try{api.update({roomId:f.state.id,game:view,ai:{mode:'demo'},notices:[]},{connected:true,now:f.state.updatedAt});assert.equal(dom.host.querySelector('.lw-actions').hidden,false);for(const name of ['eliminate','report','protect','decoy','sabotage'])assert.equal(dom.host.querySelector('.lw-action-'+name).hidden,true);assert.equal(dom.host.querySelector('.lw-action-use').hidden,false);}finally{api.dispose();dom.dispose();}
});

test('actual ghost chat submit renders the returned owner message and never appears for living/spectator views',async()=>{
 const dom=domFixture(),f=ghostFixture({id:'beacon',version:2},12);let state=f.state,api;const room=()=>({roomId:state.id,game:engine.getPlayerView(state,f.ownerId),ai:{mode:'demo'},notices:[]});
 api=createWorldExperience(dom.host,{input:async()=>{},leave(){},start:async()=>{},loadReplay:async()=>({replay:[]}),action:async(type,fields)=>{assert.equal(type,'ghostSay');state=act(state,f.ownerId,type,fields,state.updatedAt+2001);const returned=room();api.update(returned,{connected:true,now:state.updatedAt});return {room:returned};}});
 try{api.update(room(),{connected:true,now:state.updatedAt});const chat=dom.host.querySelector('.lw-ghost-chat'),draft=chat.querySelector('textarea');draft.value='ACTUAL UI FALLEN REPLY';chat.querySelector('form').emit('submit');await flush();assert.match(chat.textContent,/ACTUAL UI FALLEN REPLY/);assert.equal(draft.value,'');for(const id of [f.otherId,null])assert.equal(JSON.stringify(engine.getPlayerView(state,id)).includes('ACTUAL UI FALLEN REPLY'),false);assert.equal(JSON.stringify(state.replay).includes('ACTUAL UI FALLEN REPLY'),false);}finally{api.dispose();dom.dispose();}
});

test('actual ability owners receive exact enabled beacon protect/decoy descriptors',()=>{
 const state=make({id:'beacon',version:2},12);for(const type of ['ward','echo']){const owner=state.players.find(p=>p.ability?.type===type),view=engine.getPlayerView(state,owner.id,state.updatedAt),action=type==='ward'?'protect':'decoy';assert.equal(view.availableActions.includes(action),true);const fields=type==='ward'?{targetId:owner.id}:{x:owner.position.x,y:owner.position.y};assert.ok(view.interactions.some(h=>h.type===action&&h.enabled===true&&JSON.stringify(h.fields)===JSON.stringify(fields)),`Core must emit exact ${action} descriptor for ${owner.id}`);}
});

test('explicit partial v2 event fixture keeps unknown task history unknown while preserving validated station log evidence',()=>{
 const f=complete({id:'beacon',version:2},12),response=structuredClone(f.response),first=response.replay.findIndex(e=>e.action?.type==='taskInteract');response.replay=response.replay.slice(first);response.metadata.anchor=null;response.metadata.coverage.from=response.replay[0].at;response.metadata.coverage.partial=true;
 const m=createReplayModel(response,{players:engine.getPlayerView(f.state,null).players}),snapshot=m.at(m.coverage.through);assert.equal(m.coverage.partial,true);assert.ok(m.events.some(e=>e.stationChallenge));assert.equal(snapshot.players.flatMap(p=>p.tasks).length,0,'no invented earlier task assignments');assert.equal(snapshot.phase,'ended');
});
