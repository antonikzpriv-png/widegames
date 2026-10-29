import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldExperience} from '../public/world/experience.mjs';
import * as world from '../shared/world.mjs';
import {createLobbyMapSelector} from '../public/world/lobby-map.mjs';
import {getMap} from '../shared/maps/index.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const externalMaps=process.env.TACTICAL_CLIENT_MAP_ROOT?await import(pathToFileURL(resolve(process.env.TACTICAL_CLIENT_MAP_ROOT,'shared/maps/index.mjs'))):{getMap};
let annex;try{annex=externalMaps.getMap('stormbreak-annex');}catch{}
import {mapKey,resolveViewMap} from '../public/world/map-model.mjs';

// Actual imported UI, inert canvas/timers and safe-view fixtures. No HTTP mocks,
// engine workflow, native layout or browser keyboard scheduling is claimed.
function fixture({settings,mapResolver=externalMaps.getMap}={}){
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
 const host=new Node('main');document.body.append(host);const calls=[],inputs=[];
 let action=async(type,fields)=>calls.push({type,fields});
 const experience=createWorldExperience(host,{action:(...args)=>action(...args),input:async fields=>inputs.push(fields),start:async()=>{},leave(){},settings,loadReplay:async()=>({replay:[]})},{mapResolver});
 const click=node=>{assert(node,'missing button');if(!node.disabled)node.emit('click');};
 const find=selector=>host.querySelector(selector),button=text=>host.querySelectorAll('button').find(n=>n.visible&&n.textContent===text);
 const update=(r,options={})=>experience.update(r,{now:1000,connected:true,pending:false,...options});
 return {document,win,host,calls,inputs,experience,click,find,button,update,setAction(fn){action=fn;},enter(r){update(r);click(button('Enter the beacon')||host.querySelector('.lw-role-scene').querySelector('button'));},dispose(){experience.dispose();for(const [k,v]of saved)if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}
const roster=()=>Array.from({length:8},(_,i)=>({id:`keeper-${20+i}`,name:`Keeper ${20+i}`,color:'#aabbcc'}));
function room(){const players=roster().map(p=>({...p,status:'unknown',alive:true,position:null})),self={...players[7],role:'crew',alive:true,roomId:'bridge',position:{...world.WORLD_STATIONS.bridge},tasks:[],inputSeq:41};players[7]={...players[7],status:'alive',position:self.position};return {roomId:'custom-roster',roster:roster(),isHost:true,ai:{mode:'demo'},notices:[],game:{beaconVersion:1,worldVersion:1,matchId:'custom-match',phase:'roam',serverNow:1000,deadlineAt:90000,self,players,tasks:{completed:0,total:21},availableActions:[],interactions:[{id:'security-read',type:'investigate',fields:{deviceId:'security'},label:'Read security cameras',enabled:true}],systems:{lights:{active:false},communications:{active:false},doors:[],selfTransit:null},investigation:{devices:[],session:null,observations:[],status:'available'},events:[]}};}


// Catalog metadata here tests the settings callback protocol, not Annex geometry.
const catalog=[{id:'beacon',version:1,name:'Lantern Beacon',description:'Original beacon'},{id:'stormbreak-annex',version:1,name:'Stormbreak Annex',description:'Annex catalog fixture'}];
const lobby=()=>({roomId:'tactical-lobby',game:null,isHost:true,roster:roster(),map:{id:'beacon',version:1},availableMaps:catalog,settingsRevision:0,ai:{mode:'demo'}});
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('legacy and explicit beacon references resolve the same immutable geometry',()=>{assert.equal(resolveViewMap({}),getMap());assert.equal(resolveViewMap({map:{id:'beacon',version:1}}),getMap());assert.equal(mapKey(undefined),mapKey({id:'beacon',version:1}));assert(Object.isFrozen(getMap().geometry));assert.equal(getMap().geometry.WORLD_STATIONS.bridge.x,930);assert.throws(()=>resolveViewMap({map:{id:'beacon',version:99}}),/Unsupported/);});
test('lobby uses supplied maps and waits for actual server selection before changing the displayed value',async()=>{
 let resolve;const calls=[],f=fixture({settings:mapId=>{calls.push(mapId);return new Promise(done=>resolve=done);}});try{const r=lobby();f.update(r);const select=f.find('select'),start=f.button('Begin the watch');select.focus();select.value='stormbreak-annex';select.emit('change');assert.deepEqual(calls,['stormbreak-annex']);assert.equal(select.value,'beacon','selection must remain server-confirmed');assert(select.disabled);assert(start.disabled);assert.match(f.find('.lw-map-settings-status').textContent,/Saving/);resolve();await settle();assert(!select.disabled);assert.equal(select.value,'beacon');assert.match(f.find('.lw-map-settings-status').textContent,/Waiting for server confirmation/);assert.equal(f.document.activeElement,select);}finally{f.dispose();}
});
test('settings denial remains useful and a later attempt stays possible',async()=>{
 const f=fixture({settings:async()=>{throw Error('Host authorization expired');}});try{f.update(lobby());const select=f.find('select');select.value='stormbreak-annex';select.emit('change');await settle();assert.equal(select.value,'beacon');assert(!select.disabled);assert.match(f.find('.lw-map-settings-status').textContent,/Host authorization expired/);}finally{f.dispose();}
});
for(const boundary of ['room','revision','started','permission','hidden','dispose'])test('old settings rejection is inert after '+boundary,async()=>{
 let reject;const f=fixture({settings:()=>new Promise((_,fail)=>reject=fail)});try{const r=lobby();f.update(r);const select=f.find('select');select.value='stormbreak-annex';select.emit('change');const next=structuredClone(r);if(boundary==='room')next.roomId='new-lobby';if(boundary==='revision')next.settingsRevision++;if(boundary==='permission')next.isHost=false;if(boundary==='started')next.game=room().game;if(boundary==='hidden'){f.document.hidden=true;f.document.emit('visibilitychange');f.document.hidden=false;}if(boundary==='dispose')f.dispose();else f.update(next);reject(Error('OBSOLETE SETTINGS FAILURE'));await settle();assert.doesNotMatch(f.host.textContent,/OBSOLETE SETTINGS FAILURE/);}finally{if(boundary!=='dispose')f.dispose();}
});
test('non-host, offline, pending and unwired lobbies cannot send settings',()=>{
 for(const mode of ['nonhost','offline','pending','unwired']){let calls=0;const f=fixture(mode==='unwired'?{}:{settings:async()=>calls++});try{const r=lobby();if(mode==='nonhost')r.isHost=false;f.update(r,{connected:mode!=='offline',pending:mode==='pending'});const select=f.find('select');assert(select.disabled);select.value='stormbreak-annex';select.emit('change');assert.equal(calls,0);if(mode==='unwired')assert.match(f.find('.lw-map-settings-status').textContent,/unavailable in this client/);}finally{f.dispose();}}
});

test('actual Annex lobby selection and map version are displayed only after a server update',{skip:!annex&&'Actual Annex registry absent'},async()=>{
 let finish;const calls=[],f=fixture({settings:id=>{calls.push(id);return new Promise(resolve=>finish=resolve);}});try{const r=lobby();f.update(r);const select=f.find('select');select.value=annex.id;select.emit('change');const accepted={...r,map:{id:annex.id,version:annex.version},settingsRevision:1};f.update(accepted);finish();await settle();assert.equal(select.value,annex.id);assert.match(f.find('.lw-map-settings-status').textContent,/Selected map: Stormbreak Annex/);assert.equal(f.find('.lw-map-pane').querySelector('h2').textContent,'Stormbreak Annex map');assert.deepEqual(calls,[annex.id]);}finally{f.dispose();}
});
test('unsupported map version fails visibly with canvas/controls stopped and Exit retained',()=>{
 const f=fixture();try{const r=room();for(const reference of [{id:'beacon',version:999},'unregistered-map']){r.game.map=reference;assert.doesNotThrow(()=>f.update(r));}assert.equal(f.find('.lw-world-canvas').hidden,true);assert.equal(f.find('.lw-map-unavailable').hidden,false);assert.match(f.find('.lw-map-unavailable').textContent,/Unsupported/);assert(f.button('Exit'));f.win.emit('keydown',{key:'e',target:f.document.body});assert.equal(f.calls.length,0);}finally{f.dispose();}
});
for(const boundary of ['room','match','map','phase-return','death','access'])test('solved equipment and deferred rejection cannot resurrect after '+boundary,{skip:boundary==='map'&&!annex&&'Annex registry absent'},async()=>{
 const f=fixture();try{const r=room();r.game.self.tasks=[{id:'wire-task',label:'Relay wiring',roomId:'bridge',completed:false}];r.game.interactions=[{id:'wire-task',type:'task',fields:{taskId:'wire-task'},label:'Relay wiring',enabled:true}];f.enter(r);f.win.emit('keydown',{key:'e',target:f.find('.lw-world-canvas')});for(const n of [1,2,3]){f.click(f.host.querySelectorAll('button').find(b=>b.getAttribute('aria-label')?.startsWith(`Left cable ${n}`)));f.click(f.host.querySelectorAll('button').find(b=>b.getAttribute('aria-label')?.startsWith(`Right socket ${n}`)));}const submit=f.button('Send completed task');let reject;f.setAction((type,fields)=>{f.calls.push({type,fields});return new Promise((_,fail)=>reject=fail);});f.click(submit);let next=structuredClone(r);if(boundary==='room')next.roomId='next-room';if(boundary==='match')next.game.matchId='next-match';if(boundary==='map')next.game.map={id:annex.id,version:annex.version};if(boundary==='death')next.game.self.alive=false;if(boundary==='access')next.game.interactions=[];if(boundary==='phase-return'){next.game.phase='discussion';next.game.meeting={id:'next-council',messages:[],votes:[],eligibleVoters:[]};}f.update(next);if(boundary==='phase-return')f.update(r);f.update(boundary==='phase-return'?r:next,{feedback:'CURRENT TACTICAL NOTICE'});reject(Error('OLD EQUIPMENT FAILURE'));await settle();assert.equal(f.find('.lw-feedback').textContent,'CURRENT TACTICAL NOTICE');assert(!f.find('.lw-task-modal')?.visible);assert.equal(f.calls.length,1);}finally{f.dispose();}
});
test('camera cards preserve focus and label historical owner frames even after moving away',()=>{
 const f=fixture();try{const r=room(),map=getMap(),camera=map.fixtures.cameras[0];r.game.investigation={status:'unavailable',devices:[{id:'security',available:false,reason:'Approach console'}],observations:[{id:'dated-1',deviceId:'security',kind:'cameras',at:1000,data:{frames:[{cameraId:camera.id,limited:true,players:[{id:'keeper-20',position:{x:camera.position.x+10,y:camera.position.y}}]}]}}]};f.enter(r);f.click(f.button('Systems & evidence'));const feed=f.find('.lw-camera-feed'),button=f.button('Close systems');button.focus();assert.match(feed.getAttribute('aria-label'),/Historical camera frame/);assert.match(f.find('.lw-camera-card').textContent,/1970-01-01.*limited sample.*Keeper 20/);assert.match(f.find('.lw-camera-card').textContent,/unavailable now.*Approach console/);r.game.players[0].position={x:1400,y:1000};f.update(r);assert.equal(f.find('.lw-camera-feed'),feed);assert.equal(f.document.activeElement,button);assert.doesNotMatch(f.find('.lw-camera-card').textContent,/1400|1000.0/);}finally{f.dispose();}
});
class AudioFixture{
 static instances=[];
 constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.starts=0;this.stops=0;AudioFixture.instances.push(this);}
 resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
 createOscillator(){const owner=this;return {frequency:{setValueAtTime(){}},connect(){},disconnect(){},start(){owner.starts++;},stop(){owner.stops++;}};}
 createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
}
test('local sound is default-muted, gesture-enabled, muteable and stopped hidden/disposed',async()=>{
 AudioFixture.instances=[];const f=fixture();try{f.win.AudioContext=AudioFixture;const r=room();f.enter(r);const button=f.find('.lw-sound-toggle');assert.match(button.textContent,/off/);assert.equal(AudioFixture.instances.length,0);f.click(button);await settle();assert.equal(button.getAttribute('aria-pressed'),'true');const audio=AudioFixture.instances[0];assert.equal(audio.starts,0);r.game.phase='discussion';r.game.meeting={id:'sound-council',messages:[],votes:[],eligibleVoters:[]};f.update(r);assert.equal(audio.starts,2);f.document.hidden=true;f.document.emit('visibilitychange');assert.equal(audio.state,'suspended');assert(audio.stops>=4);f.document.hidden=false;f.click(button);assert.equal(button.getAttribute('aria-pressed'),'false');f.update(r);assert.equal(audio.starts,2);f.dispose();assert.equal(audio.state,'closed');}finally{if(f.host.children.length)f.dispose();}
});
test('deferred audio resume cannot unmute a new map/room or disposed experience',async()=>{
 for(const boundary of ['room','dispose']){let finish;class DeferredAudio extends AudioFixture{resume(){return new Promise(resolve=>finish=resolve);}}const f=fixture();try{f.win.AudioContext=DeferredAudio;const r=room();f.enter(r);const button=f.find('.lw-sound-toggle');f.click(button);if(boundary==='dispose')f.dispose();else f.update({...r,roomId:'new-room'});finish();await settle();assert.equal(button.getAttribute('aria-pressed'),'false');}finally{if(boundary!=='dispose')f.dispose();}}
});

test('new world controls preserve IME discussion draft, typing keys and focus during updates',()=>{
 const f=fixture();try{const r=room();r.game.phase='discussion';r.game.availableActions=['say'];r.game.meeting={id:'ime-council',messages:[],votes:[],eligibleVoters:[r.game.self.id]};f.update(r);const chat=f.find('textarea');chat.value='My storm observation';chat.focus();chat.emit('compositionstart');const count=f.inputs.length,event=f.win.emit('keydown',{key:'w',target:chat,isComposing:true});assert.equal(event.defaultPrevented,false);for(let i=0;i<10;i++)f.update(r,{now:1000+i*100});assert.equal(f.find('textarea'),chat);assert.equal(chat.value,'My storm observation');assert.equal(f.document.activeElement,chat);assert.equal(f.inputs.length,count);assert.equal(f.calls.length,0);}finally{f.dispose();}
});
test('optional audio device failures mute safely without breaking council controls',async()=>{
 class BrokenAudio extends AudioFixture{createOscillator(){throw Error('Audio device closed');}}
 const f=fixture();try{f.win.AudioContext=BrokenAudio;const r=room();f.enter(r);f.click(f.find('.lw-sound-toggle'));await settle();r.game.phase='discussion';r.game.meeting={id:'audio-council',messages:[],votes:[],eligibleVoters:[]};assert.doesNotThrow(()=>f.update(r));assert.equal(f.find('.lw-sound-toggle').getAttribute('aria-pressed'),'false');assert.match(f.find('.lw-feedback').textContent,/Local sound stopped/);assert(f.find('textarea'));}finally{f.dispose();}
});

test('full Annex experience uses real room/task/repair metadata with the original equipment controls',{skip:!annex&&'Actual Annex registry absent'},()=>{
 const f=fixture();try{const r=room(),spawn=annex.geometry.WORLD_SPAWN_ROOM,station=annex.geometry.WORLD_STATIONS[spawn];r.map=r.game.map={id:annex.id,version:annex.version};r.game.self.roomId=spawn;r.game.self.position={x:station.x,y:station.y};r.game.players.at(-1).position={...r.game.self.position};r.game.self.tasks=[{id:'annex-task',label:'Service Muster Hall relay',roomId:spawn,completed:false}];r.game.interactions=[{id:'annex-task',type:'task',fields:{taskId:'annex-task'},enabled:true,label:'Service Muster Hall relay'}];f.enter(r);assert.equal(f.find('.lw-location').textContent,'Muster Hall');assert.match(f.find('.lw-assignment').textContent,/Muster Hall/);assert.doesNotMatch(f.find('.lw-assignment').textContent,/Bridge/);f.win.emit('keydown',{key:'e',target:f.find('.lw-world-canvas')});assert(f.find('.lw-task-modal').visible);f.click(f.button('Close station'));r.game.sabotage={active:true,kind:'power',deadlineAt:9000,repairsCompleted:0,repairsRequired:2,sites:annex.fixtures.repairs.power.map(site=>({...site,progress:0}))};f.update(r);assert.match(f.find('.lw-critical').textContent,/Condenser regulator.*Rivet power coupler/);assert.match(f.find('.lw-critical-clock').textContent,/0:08/);assert(f.button('Exit'));}finally{f.dispose();}
});

test('deferred base-action failure cannot overwrite feedback after a map context leaves and returns',{skip:!annex&&'Actual Annex registry absent'},async()=>{
 const f=fixture();try{const r=room();r.game.interactions=[{id:'report-current',type:'report',fields:{bodyId:'body-current'},label:'Report fallen keeper',enabled:true}];f.enter(r);let reject;f.setAction(()=>new Promise((_,fail)=>reject=fail));f.win.emit('keydown',{key:'r',target:f.find('.lw-world-canvas')});const next=structuredClone(r);next.game.map={id:annex.id,version:annex.version};next.game.self.roomId=annex.geometry.WORLD_SPAWN_ROOM;f.update(next);f.update(r,{feedback:'CURRENT MAP NOTICE'});reject(Error('OBSOLETE BASE ACTION FAILURE'));await settle();assert.equal(f.find('.lw-feedback').textContent,'CURRENT MAP NOTICE');}finally{f.dispose();}
});

for(const settleAs of ['failure','success'])test('a revoked submission releases still-legal solved equipment without old feedback: '+settleAs,async()=>{
 const f=fixture();try{const r=room();r.game.self.tasks=[{id:'still-current-task',label:'Relay wiring',roomId:'bridge',completed:false}];r.game.interactions=[{id:'still-current-task',type:'task',fields:{taskId:'still-current-task'},label:'Relay wiring',enabled:true}];f.enter(r);f.win.emit('keydown',{key:'e',target:f.find('.lw-world-canvas')});for(const n of [1,2,3]){f.click(f.host.querySelectorAll('button').find(b=>b.getAttribute('aria-label')?.startsWith(`Left cable ${n}`)));f.click(f.host.querySelectorAll('button').find(b=>b.getAttribute('aria-label')?.startsWith(`Right socket ${n}`)));}const submit=f.button('Send completed task'),modal=f.find('.lw-task-modal');let done,fail;f.setAction(()=>new Promise((resolve,reject)=>{done=resolve;fail=reject;}));f.click(submit);const next=structuredClone(r);next.game.interactions.push({id:'new-report',type:'report',fields:{bodyId:'observed-body'},label:'Report body',enabled:true});f.update(next,{feedback:'CURRENT EQUIPMENT NOTICE'});if(settleAs==='failure')fail(new DOMException('Revoked root request','AbortError'));else done();await settle();assert.equal(f.find('.lw-task-modal'),modal);assert(modal.visible);assert(!submit.disabled,'legal solved equipment must not remain permanently pending');assert.equal(f.find('.lw-feedback').textContent,'CURRENT EQUIPMENT NOTICE');}finally{f.dispose();}
});

test('a still-current task failure keeps solved equipment and useful retry feedback',async()=>{
 const f=fixture();try{const r=room();r.game.self.tasks=[{id:'retry-task',label:'Relay wiring',roomId:'bridge',completed:false}];r.game.interactions=[{id:'retry-task',type:'task',fields:{taskId:'retry-task'},label:'Relay wiring',enabled:true}];f.enter(r);f.win.emit('keydown',{key:'e',target:f.find('.lw-world-canvas')});for(const n of [1,2,3]){f.click(f.host.querySelectorAll('button').find(b=>b.getAttribute('aria-label')?.startsWith(`Left cable ${n}`)));f.click(f.host.querySelectorAll('button').find(b=>b.getAttribute('aria-label')?.startsWith(`Right socket ${n}`)));}const submit=f.button('Send completed task'),modal=f.find('.lw-task-modal');f.setAction(async()=>{throw Error('Station response unavailable; try again');});f.click(submit);await settle();assert.equal(f.find('.lw-task-modal'),modal);assert(modal.visible);assert(!submit.disabled);assert.match(f.find('.lw-feedback').textContent,/Station response unavailable/);assert.equal(f.host.querySelectorAll('.lw-connected-wire').length,3);}finally{f.dispose();}
});
