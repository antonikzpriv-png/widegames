import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldExperience} from '../public/world/experience.mjs';
import * as world from '../shared/world.mjs';

// Actual imported UI, inert canvas/timers and safe-view fixtures. No HTTP mocks,
// engine workflow, native layout or browser keyboard scheduling is claimed.
function fixture(){
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
 const experience=createWorldExperience(host,{action:async(type,fields)=>calls.push({type,fields}),input:async fields=>inputs.push(fields),start:async()=>{},leave(){},loadReplay:async()=>({replay:[]})});
 const click=node=>{assert(node,'missing button');if(!node.disabled)node.emit('click');};
 const find=selector=>host.querySelector(selector),button=text=>host.querySelectorAll('button').find(n=>n.visible&&n.textContent===text);
 const update=(r,options={})=>experience.update(r,{now:1000,connected:true,pending:false,...options});
 return {document,win,host,calls,inputs,experience,click,find,button,update,enter(r){update(r);click(button('Enter the beacon'));},dispose(){experience.dispose();for(const [k,v]of saved)if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}
const roster=()=>Array.from({length:8},(_,i)=>({id:`keeper-${20+i}`,name:`Keeper ${20+i}`,color:'#aabbcc'}));
function room(){const players=roster().map(p=>({...p,status:'unknown',alive:true,position:null})),self={...players[7],role:'crew',alive:true,roomId:'bridge',position:{...world.WORLD_STATIONS.bridge},tasks:[],inputSeq:41};players[7]={...players[7],status:'alive',position:self.position};return {roomId:'custom-roster',roster:roster(),isHost:true,ai:{mode:'demo'},notices:[],game:{beaconVersion:1,worldVersion:1,matchId:'custom-match',phase:'roam',serverNow:1000,deadlineAt:90000,self,players,tasks:{completed:0,total:21},availableActions:[],interactions:[{id:'security-read',type:'investigate',fields:{deviceId:'security'},label:'Read security cameras',enabled:true}],systems:{lights:{active:false},communications:{active:false},doors:[],selfTransit:null},investigation:{devices:[],session:null,observations:[],status:'available'},events:[]}};}

test('eight supplied noncanonical lobby keepers and renamed identities render without fixed six/p1 claims',()=>{
 const f=fixture();try{const r={...room(),game:null};f.update(r);assert.equal(f.host.querySelectorAll('.lw-seat').length,8);assert.match(f.find('.lw-lobby-note').textContent,/8 keepers/);assert.doesNotMatch(f.find('.lw-lobby').textContent,/six|one hidden/i);const first=f.host.querySelectorAll('.lw-seat')[0];r.roster[0].name='Renamed keeper';f.update(r);assert.equal(f.host.querySelectorAll('.lw-seat')[0],first);assert.match(first.textContent,/Renamed keeper/);f.enter(room());assert.match(f.find('.lw-location').textContent,/Bridge/);assert.equal(f.find('.lw-role').textContent,'Crew');assert.equal(f.document.head.children.length,1,'one same-origin stylesheet');}finally{f.dispose();}
});
test('frequent schema3 updates retain canvas/equipment focus and exact descriptor controls',async()=>{
 const f=fixture();try{const r=room();f.enter(r);const canvas=f.find('.lw-world-canvas');f.click(f.button('Systems & evidence'));const action=f.button('Read security cameras');action.focus();for(let i=0;i<10;i++)f.update(r,{now:1000+i*100});assert.equal(f.find('.lw-world-canvas'),canvas);assert.equal(f.button('Read security cameras'),action);assert.equal(f.document.activeElement,action);const space=f.win.emit('keydown',{key:' ',target:action});assert.equal(space.defaultPrevented,false,'Space keeps native button activation');f.click(action);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.calls,[{type:'investigate',fields:{deviceId:'security'}}]);assert(f.inputs.some(input=>input.seq>41&&input.dx===0&&input.dy===0));}finally{f.dispose();}
});
test('USE presents hatch destination choices and never auto-selects a route',()=>{
 const f=fixture();try{const r=room();r.game.interactions=[{id:'hatch-archive',type:'vent',fields:{entryId:'workshop-hatch',exitId:'archive-hatch'},label:'Travel to Archive',enabled:true},{id:'hatch-lantern',type:'vent',fields:{entryId:'workshop-hatch',exitId:'lantern-hatch'},label:'Travel to Lantern',enabled:true}];f.enter(r);f.win.emit('keydown',{key:'e',target:f.find('.lw-world-canvas')});assert(f.button('Travel to Archive'));assert(f.button('Travel to Lantern'));assert.deepEqual(f.calls,[]);}finally{f.dispose();}
});
test('unknown roster status is explicit even when a stale alive field says false',()=>{
 const f=fixture();try{const r=room();r.game.phase='discussion';r.game.players[0].alive=false;r.game.players[1].status='dead';r.game.players[1].alive=false;r.game.availableActions=['say'];r.game.meeting={id:'meeting-fixture',reason:'timeout',eligibleVoters:[r.game.self.id],messages:[],votes:[]};f.update(r);const rows=f.host.querySelectorAll('.lw-council-keeper');assert.equal(rows[0].dataset.alive,'unknown');assert.match(rows[0].textContent,/Status unknown/);assert.doesNotMatch(rows[0].textContent,/Fallen/);assert.match(rows[1].textContent,/Fallen/);const chat=f.find('textarea');chat.value='My permitted observation';chat.focus();f.update(r);assert.equal(f.find('textarea'),chat);assert.equal(chat.value,'My permitted observation');assert.equal(f.document.activeElement,chat);}finally{f.dispose();}
});
test('critical site/countdown remains truthful across council and transit suppresses walking guidance',()=>{
 const f=fixture();try{const r=room();r.game.sabotage={active:true,kind:'flood',deadlineAt:9000,repairsCompleted:1,repairsRequired:2,sites:[{id:'pump-galley',completed:true},{id:'pump-archive',completed:false}]};f.enter(r);assert.match(f.find('.lw-critical').textContent,/FLOOD WARNING.*0:08/);assert.match(f.find('.lw-critical').textContent,/Galley pump.*Archive pressure valve/);r.game.self.transit={entryId:'workshop-hatch',exitId:'archive-hatch',deadlineAt:2600};f.update(r);assert.doesNotMatch(f.find('.lw-help').textContent,/WASD|walk/);r.game.phase='discussion';r.game.meeting={id:'critical-meeting',reason:'report',eligibleVoters:[r.game.self.id],messages:[],votes:[]};f.update(r,{now:3000});assert.equal(f.find('.lw-critical').hidden,false);assert.match(f.find('.lw-critical').textContent,/0:06/);}finally{f.dispose();}
});
