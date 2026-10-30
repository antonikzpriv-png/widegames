import test from 'node:test';
import assert from 'node:assert/strict';
import {createTaskPuzzle} from '../public/world/puzzles.mjs';
import {captchaChallenge,CAPTCHA_KINDS} from '../shared/captcha.mjs';
// Controlled DOM with actual ESM imports. Explicit safe-view progress fixtures;
// does not claim engine/server or native browser qualification.
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


const totals={glyphs:3,count:2,order:4,rotate:3,oddity:2,code:1,wires:3,tuning:1,sequence:4,pressure:2,repair:4};
function progress(kind,index=0){return {v:2,kind,target:48,sequence:[2,4,1,3],pressure:2,total:totals[kind],index,readyAt:0};}
function fixture(kind){const d=domFixture(),calls=[],task={id:'explicit-job',label:'Explicit taskStep job',roomId:'bridge',kind,completed:false,progress:progress(kind)},p=createTaskPuzzle({id:'latest',task,onSubmit:v=>calls.push(v),onClose(){}});d.host.append(p.node);const nodes=()=>p.node.querySelectorAll('button,input');const find=fn=>nodes().find(fn);const click=node=>{assert(node,'required control');if(!node.disabled)node.emit('click');};return {...d,p,task,calls,nodes,find,click,dispose(){p.dispose();d.dispose();}};}
function answer(f){const c=f.task.progress,d=captchaChallenge(c);switch(c.kind){
 case 'glyphs':for(const [i,t]of d.tiles.entries())if(t===d.target)f.click(f.find(n=>n.dataset.captchaIndex===String(i)));f.click(f.find(n=>n.dataset.captchaSubmit==='glyphs'));return d.tiles.flatMap((t,i)=>t===d.target?[i]:[]).join(',');
 case 'count':{const a=String(d.tiles.filter(t=>t===d.target).length);f.click(f.find(n=>n.dataset.captchaAnswer===a));return a;}
 case 'order':{const a=String([...d.items].sort((a,b)=>a-b)[c.index]);f.click(f.find(n=>n.dataset.captchaAnswer===a));return a;}
 case 'rotate':{const a={north:'aligned',east:'left',south:'half',west:'right'}[d.direction];f.click(f.find(n=>n.dataset.captchaAnswer===a));return a;}
 case 'oddity':{const a=String(d.tiles.findIndex(t=>d.tiles.filter(x=>x===t).length===1));f.click(f.find(n=>n.dataset.captchaIndex===a));return a;}
 case 'code':{const input=f.find(n=>n.getAttribute('data-captcha-code')!==null);input.value=d.code.toLowerCase();input.emit('keydown',{key:'Enter'});return d.code;}
}}
for(const kind of CAPTCHA_KINDS)test(`actual ESM ${kind} sends semantic taskStep values, preserves pending and rejects retained old controls`,()=>{const f=fixture(kind);try{for(let i=0;i<totals[kind];i++){const expected=answer(f);assert.deepEqual(f.calls.at(-1),{step:i,input:expected});const old=f.nodes().find(n=>n!==f.nodes()[0]);f.p.setPending(true);f.task={...f.task,progress:progress(kind,i+1)};f.p.update(f.task);assert(f.nodes().every(n=>n.disabled));f.p.setPending(false);const count=f.calls.length;old.emit('click');assert.equal(f.calls.length,count);}const done=f.find(n=>n.textContent==='Send completed task');assert(done);f.click(done);assert.equal(f.calls.at(-1),undefined);}finally{f.dispose();}});
test('retained taskStep control never revives across progress ABA, same-stage drafts do survive',()=>{const f=fixture('code');try{const old=f.find(n=>n.dataset.captchaSubmit==='code'),input=f.find(n=>n.tagName==='INPUT');input.value='ABCDEF';f.p.update(structuredClone(f.task));assert.equal(f.find(n=>n.tagName==='INPUT'),input);assert.equal(input.value,'ABCDEF');f.p.update({...f.task,progress:progress('code',1)});f.p.update(f.task);old.emit('click');assert.equal(f.calls.length,0);f.p.dispose();f.find(n=>n.dataset.captchaSubmit==='code')?.emit('click');assert.equal(f.calls.length,0);}finally{f.dispose();}});
test('order confirmed tags remain disabled; current rejected code retains text, focus and IME',()=>{const f=fixture('order');try{const first=String([...captchaChallenge(f.task.progress).items].sort((a,b)=>a-b)[0]);answer(f);f.p.update({...f.task,progress:progress('order',1)});f.p.setPending(true);f.p.setPending(false);assert(f.find(n=>n.dataset.captchaAnswer===first).disabled);}finally{f.dispose();}const c=fixture('code');try{const input=c.find(n=>n.tagName==='INPUT');input.value='WRONGX';input.focus();input.emit('keydown',{key:'Enter',isComposing:true});assert.equal(c.calls.length,0);input.emit('keydown',{key:'Enter'});c.p.setPending(true);c.p.feedback('Incorrect signal');c.p.setPending(false);assert.equal(input.value,'WRONGX');assert.equal(c.document.activeElement,input);assert.match(c.p.node.textContent,/Incorrect signal/);}finally{c.dispose();}});
for(const kind of ['wires','tuning','sequence','pressure','repair'])test(`explicit v2 ${kind} keeps the existing step controls`,()=>{const f=fixture(kind);try{assert(!f.p.node.querySelector('.lw-captcha'));assert(f.nodes().length>=2);assert(!f.find(n=>n.textContent==='Send completed task'));f.p.focus();assert.equal(f.document.activeElement.textContent,'Close station');}finally{f.dispose();}});
