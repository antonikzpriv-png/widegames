import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldExperience} from '../public/world/experience.mjs';
import * as engine from '../server/engine/index.mjs';

// The actual experience with a synchronous DOM and inert frame/timer scheduling.
// These cases supply one safe snapshot and never rely on another HTTP/WS update.
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
  matches(selector){if(selector.startsWith('link['))return this.tagName==='LINK'&&this.attrs.has(selector.slice(5,-1));if(selector.startsWith('.'))return this.className.split(' ').includes(selector.slice(1));if(selector.startsWith('[')){const m=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return m&&this.attrs.has(m[1])&&(m[2]===undefined||this.attrs.get(m[1])===m[2]);}return this.tagName===selector.toUpperCase();}
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

for(const mapId of ['beacon','storm-foundry','tidal-observatory'])for(const mode of ['human','spectator'])test(`${mapId} ${mode}: map toggles update controls and preserve focus immediately without another snapshot`,()=>{
 const f=domFixture(),actions=[],inputs=[],state=engine.createMatch({id:'map-local-'+mapId+'-'+mode,world:true,mapId,mapRevision:2,mode,seed:3,now:1000}),game=engine.getPlayerView(state,mode==='human'?'p1':null,1000);
 const api=createWorldExperience(f.host,{action:(...args)=>actions.push(args),input:async packet=>inputs.push(packet),start:async()=>{},leave(){},loadReplay:async()=>({})});
 try{
  api.update({roomId:state.id,mode,isHost:true,game,ai:{mode:'demo'}},{connected:true,now:1000});
  if(game.self)f.host.querySelector('.lw-role-scene').querySelector('button').emit('click');
  const canvas=f.host.querySelector('.lw-world-canvas'),joystick=f.host.querySelector('.lw-joystick'),trigger=f.host.querySelector('.lw-map-toggle'),pane=f.host.querySelector('.lw-map-pane');
  canvas.focus();const initialInputs=inputs.length;
  assert.equal(joystick.hidden,false);assert.equal(pane.hidden,true);
  f.win.emit('keydown',{key:'m',target:canvas});
  assert.equal(pane.hidden,false);assert.equal(trigger.getAttribute('aria-expanded'),'true');assert.equal(joystick.hidden,true,'opening the map immediately hides walking/camera controls');assert.equal(f.document.activeElement,canvas);
  f.win.emit('keydown',{key:'m',target:canvas});
  assert.equal(pane.hidden,true);assert.equal(trigger.getAttribute('aria-expanded'),'false');assert.equal(joystick.hidden,false,'closing the map immediately restores walking/camera controls');assert.equal(f.document.activeElement,canvas);
  trigger.focus();trigger.emit('click');assert.equal(pane.hidden,false);assert.equal(joystick.hidden,true);assert.equal(f.document.activeElement,trigger);
  f.win.emit('keydown',{key:'Escape',target:trigger});assert.equal(pane.hidden,true);assert.equal(joystick.hidden,false);assert.equal(f.document.activeElement,trigger);
  assert.equal(actions.length,0);assert.equal(inputs.length,initialInputs,'map transitions do not synthesize movement while idle');
  api.dispose();assert.equal(f.win.handlers.get('keydown').size,0);
 }finally{api.dispose();f.dispose();}
});
