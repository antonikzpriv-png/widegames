import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldExperience} from '../public/world/experience.mjs';
import * as world from '../shared/world.mjs';
import {createLobbyMapSelector} from '../public/world/lobby-map.mjs';
import {getMap} from '../shared/maps/index.mjs';
import {mapKey,resolveViewMap} from '../public/world/map-model.mjs';

// Actual imported UI, inert canvas/timers and safe-view fixtures. No HTTP mocks,
// engine workflow, native layout or browser keyboard scheduling is claimed.
function fixture({settings}={}){
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
 const experience=createWorldExperience(host,{action:(...args)=>action(...args),input:async fields=>inputs.push(fields),start:async()=>{},leave(){},settings,loadReplay:async()=>({replay:[]})});
 const click=node=>{assert(node,'missing button');if(!node.disabled)node.emit('click');};
 const find=selector=>host.querySelector(selector),button=text=>host.querySelectorAll('button').find(n=>n.visible&&n.textContent===text);
 const update=(r,options={})=>experience.update(r,{now:1000,connected:true,pending:false,...options});
 return {document,win,host,calls,inputs,experience,click,find,button,update,setAction(fn){action=fn;},enter(r){update(r);click(button('Enter the beacon'));},dispose(){experience.dispose();for(const [k,v]of saved)if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
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
