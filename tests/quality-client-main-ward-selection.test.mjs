import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.QUALITY_CLIENT_WARD_ROOT?pathToFileURL(resolve(process.env.QUALITY_CLIENT_WARD_ROOT)+'/'):new URL('../',import.meta.url);
const engine=await import(new URL('server/engine/index.mjs',root));
const {createWorldExperience}=await import(new URL('public/world/experience.mjs',root));
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

// Real generated engine permission descriptors + actual UI handlers. A minimal
// DOM receives callbacks, not HTTP mocks; this is not native browser approval.
test('beacon Ward uses the selected permitted target rather than silently choosing self',async()=>{
 const f=domFixture();let state=engine.createMatch({id:'ward-selection-selfcheck',tactical:true,stationTasks:true,map:{id:'beacon',version:2},features:{abilities:true},now:1000,seed:'ward-selector'});const owner=state.players.find(p=>p.ability?.type==='ward'),view=engine.getPlayerView(state,owner.id,state.updatedAt),targets=view.interactions.filter(h=>h.type==='protect'&&h.enabled===true),other=targets.find(h=>h.fields.targetId!==owner.id);assert.ok(other,'generated fixture must have another permitted Ward target');assert.equal(targets[0].fields.targetId,owner.id,'actual self-Ward-first contract');const calls=[];
 const api=createWorldExperience(f.host,{input:async()=>{},leave(){},start:async()=>{},loadReplay:async()=>({replay:[]}),action:async(type,fields)=>{calls.push({type,fields});const result=engine.applyAction(state,owner.id,{id:'selected-ward',type,...fields},state.updatedAt+1);assert.equal(result.accepted,true,JSON.stringify(result.error));state=result.state;return {room:{roomId:state.id,game:engine.getPlayerView(state,owner.id,state.updatedAt),ai:{mode:'demo'},notices:[]}};}});
 try{api.update({roomId:state.id,game:view,ai:{mode:'demo'},notices:[]},{connected:true,now:state.updatedAt});const enter=f.host.querySelectorAll('button').find(b=>b.textContent==='Enter the beacon');assert.ok(enter);enter.emit('click');const select=f.host.querySelector('.lw-ward-target');assert.equal(select.hidden,false);assert.ok(select.querySelectorAll('option').some(o=>o.value===other.fields.targetId),'the permitted target is actually offered');select.value=other.fields.targetId;select.emit('change');const ward=f.host.querySelector('.lw-action-protect');assert.equal(ward.hidden,false);assert.equal(ward.getAttribute('aria-disabled'),'false');ward.emit('click');await flush();assert.equal(calls.length,1);assert.equal(calls[0].type,'protect');assert.equal(calls[0].fields.targetId,select.value,'visible selection must match action target');assert.equal(state.effects[0].targetId,select.value);
 }finally{api.dispose();f.dispose();}
});
