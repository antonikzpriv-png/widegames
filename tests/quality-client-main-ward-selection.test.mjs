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

function wardFixture({legacy=false}={}){
 const f=domFixture();let state=engine.createMatch({id:'ward-boundary-'+(legacy?'legacy':'beacon'),...(legacy?{world:true}:{tactical:true,stationTasks:true,map:{id:'beacon',version:2}}),features:{abilities:true},now:1000,seed:'ward-selector'});const owner=state.players.find(p=>p.ability?.type==='ward'),calls=[];let api;
 const view=()=>engine.getPlayerView(state,owner.id,state.updatedAt);
 api=createWorldExperience(f.host,{input:async()=>{},leave(){},start:async()=>{},loadReplay:async()=>({replay:[]}),action:async(type,fields)=>{calls.push({type,fields});const result=engine.applyAction(state,owner.id,{id:'ward-boundary-'+calls.length,type,...fields},state.updatedAt+1);assert.equal(result.accepted,true,JSON.stringify(result.error));state=result.state;return {room:{roomId:state.id,game:view(),ai:{mode:'demo'},notices:[]}};}});
 const update=(game=view(),options={})=>api.update({roomId:state.id,game,ai:{mode:'demo'},notices:[]},{connected:true,pending:false,now:state.updatedAt,...options});update();f.host.querySelectorAll('button').find(b=>b.textContent==='Enter the beacon').emit('click');const select=f.host.querySelector('.lw-ward-target'),ward=f.host.querySelector('.lw-action-protect');
 return {...f,owner,calls,view,update,select,ward,get state(){return state;},choose(id){select.value=id;select.emit('change');},dispose(){api.dispose();f.dispose();}};
}
test('beacon initial Ward selection and applied default match the first exact self descriptor',async()=>{
 const f=wardFixture();try{const hint=f.view().interactions.find(h=>h.type==='protect'&&h.enabled);assert.equal(f.select.value,hint.fields.targetId);assert.equal(f.select.value,f.owner.id);f.ward.emit('click');await flush();assert.deepEqual(f.calls[0].fields,hint.fields);assert.equal(f.state.effects[0].targetId,f.select.value);}finally{f.dispose();}
});
test('revoked Ward choice fails closed across permission ABA until a deliberate new selection',async()=>{
 const f=wardFixture();try{const original=f.view(),other=original.interactions.find(h=>h.type==='protect'&&h.fields.targetId!==f.owner.id&&h.enabled);assert.ok(other);f.choose(other.fields.targetId);
 // Adversarial projected permission updates, not a claimed HTTP workflow.
 const revoked=structuredClone(original);revoked.interactions=revoked.interactions.filter(h=>h.id!==other.id);assert.equal(revoked.availableActions.includes('protect'),true);f.update(revoked);assert.equal(f.select.value,'');assert.equal(f.ward.getAttribute('aria-disabled'),'true');assert.equal(f.select.querySelectorAll('option').some(o=>o.value===other.fields.targetId),false);f.ward.emit('click');await flush();assert.equal(f.calls.length,0);assert.match(f.host.querySelector('.lw-feedback').textContent,/currently permitted Ward target/);
 f.update(original);assert.equal(f.select.value,'','returning permission must not silently change the blank choice');f.ward.emit('click');await flush();assert.equal(f.calls.length,0);f.choose(other.fields.targetId);f.ward.emit('click');await flush();assert.equal(f.calls[0].fields.targetId,other.fields.targetId);assert.equal(f.state.effects[0].targetId,other.fields.targetId);
 }finally{f.dispose();}
});
test('nearby roster and availableActions never synthesize Ward options when exact descriptors are absent',async()=>{
 const f=wardFixture();try{const v=f.view();v.interactions=v.interactions.filter(h=>h.type!=='protect');assert.ok(v.players.some(p=>p.id!==f.owner.id&&p.position));assert.equal(v.availableActions.includes('protect'),true);f.update(v);assert.equal(f.select.querySelectorAll('option').filter(o=>o.value!=='').length,0);assert.equal(f.select.disabled,true);assert.equal(f.ward.getAttribute('aria-disabled'),'true');f.ward.emit('click');await flush();assert.equal(f.calls.length,0);}finally{f.dispose();}
});
test('Ward target node, focus and selection survive ordinary reordering of exact permissions',async()=>{
 const f=wardFixture();try{const v=f.view(),other=v.interactions.find(h=>h.type==='protect'&&h.fields.targetId!==f.owner.id&&h.enabled);assert.ok(other);f.choose(other.fields.targetId);f.select.focus();const node=f.select.querySelectorAll('option').find(o=>o.value===other.fields.targetId),changed=structuredClone(v);changed.interactions.reverse();f.update(changed);assert.equal(f.document.activeElement,f.select);assert.equal(f.select.value,other.fields.targetId);assert.equal(f.select.querySelectorAll('option').find(o=>o.value===other.fields.targetId),node);f.ward.emit('click');await flush();assert.equal(f.calls[0].fields.targetId,other.fields.targetId);}finally{f.dispose();}
});
test('pending and disconnected Ward cannot send and reconnect retains the explicit current choice',async()=>{
 const f=wardFixture();try{const v=f.view(),other=v.interactions.find(h=>h.type==='protect'&&h.fields.targetId!==f.owner.id&&h.enabled);assert.ok(other);f.choose(other.fields.targetId);for(const options of [{pending:true},{connected:false}]){f.update(v,options);assert.equal(f.select.disabled,true);f.ward.emit('click');await flush();assert.equal(f.calls.length,0);}f.update(v);assert.equal(f.select.value,other.fields.targetId);f.ward.emit('click');await flush();assert.equal(f.calls[0].fields.targetId,other.fields.targetId);}finally{f.dispose();}
});
test('legacy schema2 Ward retains its selected target through the original capability path',async()=>{
 const f=wardFixture({legacy:true});try{assert.notEqual(f.view().beaconVersion,1);const other=f.select.querySelectorAll('option').find(o=>o.value&&o.value!==f.owner.id);assert.ok(other);f.choose(other.value);f.ward.emit('click');await flush();assert.equal(f.calls[0].fields.targetId,other.value);assert.equal(f.state.effects[0].targetId,other.value);}finally{f.dispose();}
});
test('disposed Ward controls cannot submit an action from their old owner',async()=>{
 const f=wardFixture();f.dispose();f.ward.emit('click');await flush();assert.equal(f.calls.length,0);
});
