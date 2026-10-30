import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {captchaChallenge,CAPTCHA_KINDS} from '../shared/captcha.mjs';
import {challenge,taskInput,advanceTask} from '../server/engine/tasks.mjs';

// Controlled DOM unit fixture; real browser/HTTP qualification is separate.
function fixture(task){
 const document={activeElement:null};
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.attrs=new Map();this.dataset={};this.handlers=new Map();this.style={setProperty(){}};this.disabled=false;this.hidden=false;this.value='';this.text='';this.ownerDocument=document;}
  get textContent(){return this.text+this.children.map(n=>n.textContent).join('');}set textContent(value){this.replaceChildren();this.text=String(value);}
  get className(){return this.attrs.get('class')||'';}set className(value){this.attrs.set('class',value);}
  get classList(){return {add:(...values)=>{this.className=[...new Set([...this.className.split(' '),...values])].join(' ');}};}
  setAttribute(name,value){this.attrs.set(name,String(value));}getAttribute(name){return this.attrs.get(name)??null;}
  addEventListener(name,fn){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(fn);}
  append(...nodes){for(const node of nodes){node.remove();this.children.push(node);node.parentNode=this;}}
  replaceChildren(...nodes){for(const child of [...this.children])child.remove();this.text='';this.append(...nodes);}
  remove(){if(this.contains(document.activeElement))document.activeElement=document.body;if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
  contains(node){return node===this||this.children.some(n=>n.contains(node));}
  get isConnected(){return this===document.body||!!this.parentNode?.isConnected;}
  focus(){if(this.isConnected&&!this.disabled)document.activeElement=this;}
  getClientRects(){return this.hidden||!this.isConnected?[]:[{}];}
  querySelectorAll(selector){const out=[],selectors=selector.split(',');const matches=node=>selectors.some(s=>s.startsWith('.')?node.className.split(' ').includes(s.slice(1)):s.startsWith('[')?node.getAttribute(s.slice(1,-1))!==null:node.tagName===s.toUpperCase());const walk=node=>{for(const child of node.children){if(matches(child))out.push(child);walk(child);}};walk(this);return out;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 }
 document.createElement=tag=>new Node(tag);document.body=new Node('body');document.activeElement=document.body;
 const context=vm.createContext({document,captchaChallenge,console});const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/^\uFEFF/,'').replace(/^import .*$/gm,'').replace(/^export /gm,'');
 const load=(file,names)=>Object.assign(context,vm.runInContext(`(()=>{${source(file)};return {${names}};})()`,context));
 load('public/world/dom.mjs','dom,control,setText,trapDialog');load('public/world/puzzles.mjs','createTaskPuzzle');
 const calls=[];let closed=0;const puzzle=context.createTaskPuzzle({id:'captcha-test',task:structuredClone(task),onSubmit:value=>calls.push(value===undefined?undefined:JSON.parse(JSON.stringify(value))),onClose:()=>closed++});document.body.append(puzzle.node);
 const nodes=selector=>puzzle.node.querySelectorAll(selector),find=fn=>nodes('button,input').find(fn),button=label=>find(n=>n.tagName==='BUTTON'&&n.textContent===label);
 const event=(node,type,details={})=>{for(const fn of node.handlers.get(type)||[])fn({target:node,key:'',preventDefault(){},...details});};
 const click=node=>{assert(node,'Missing native puzzle control');if(!node.disabled)event(node,'click');};
 return {puzzle,document,calls,nodes,find,button,event,click,get closed(){return closed;}};
}
function make(kind){const task={id:'t23456789abcdef01234567',label:'Original game puzzle',roomId:'bridge',kind,completed:false};task.progress=challenge(task);return task;}
function chooseCorrect(f,task){
 const c=task.progress,display=captchaChallenge(c),expected=taskInput(task);
 if(c.kind==='glyphs'){for(const [index,tile]of display.tiles.entries())if(tile===display.target)f.click(f.find(n=>n.dataset.captchaIndex===String(index)));f.click(f.find(n=>n.dataset.captchaSubmit==='glyphs'));}
 else if(c.kind==='oddity')f.click(f.find(n=>n.dataset.captchaIndex===expected));
 else if(c.kind==='code'){const input=f.find(n=>n.getAttribute('data-captcha-code')!==null);input.value=expected.toLowerCase();f.event(input,'keydown',{key:'Enter'});}
 else f.click(f.find(n=>n.dataset.captchaAnswer===expected));
 return expected;
}

for(const kind of CAPTCHA_KINDS)test(`CAPTCHA UI ${kind}: native semantic inputs wait for authoritative acknowledgment through completion`,()=>{
 const task=make(kind),f=fixture(task),total=task.progress.total;
 for(let step=0;step<total;step++){
  const expected=chooseCorrect(f,task);assert.deepEqual(f.calls.at(-1),{step,input:expected});assert.equal(f.calls.length,step+1);
  assert.equal(f.button('Send completed task'),undefined,'client choice alone cannot complete the equipment');
  const prior=f.nodes('button').find(n=>n.dataset.captchaAnswer===expected||n.dataset.captchaSubmit||n.dataset.captchaIndex===expected);
  prior?.focus();f.puzzle.setPending(true);const count=f.calls.length;chooseCorrect(f,task);assert.equal(f.calls.length,count,'pending puzzle cannot send another request');
  advanceTask(task,1000+step*100);f.puzzle.update(structuredClone(task));assert(f.nodes('button,input').every(n=>n.disabled),'snapshot cannot enable controls before the pending request finishes');
  f.puzzle.setPending(false);assert.equal(f.document.activeElement.disabled,false,'focus returns to an available control after server acknowledgment');
  if(prior){f.event(prior,'click');assert.equal(f.calls.length,count,'a retained old control cannot send against a different stage');}
 }
 assert(f.button('Send completed task'));f.click(f.button('Send completed task'));assert.equal(f.calls.length,total+1);assert.equal(f.calls.at(-1),undefined);f.puzzle.dispose();
});

test('CAPTCHA glyph selection supports correction, readable names and a bounded nonempty submission',()=>{
 const task=make('glyphs'),f=fixture(task),first=f.find(n=>n.dataset.captchaIndex==='0'),submit=f.find(n=>n.dataset.captchaSubmit==='glyphs');
 assert.match(first.getAttribute('aria-label'),/^Tile 1: (SUN|WAVE|STAR|MOON)$/);assert.equal(first.getAttribute('aria-pressed'),'false');
 f.click(submit);assert.equal(f.calls.length,0);f.click(first);assert.equal(first.getAttribute('aria-pressed'),'true');f.click(first);assert.equal(first.getAttribute('aria-pressed'),'false');f.click(submit);assert.equal(f.calls.length,0);
 f.click(first);f.click(submit);assert.deepEqual(f.calls[0],{step:0,input:'0'});assert.equal(f.nodes('button').filter(n=>n.dataset.captchaIndex!==undefined).length,9);
});

test('CAPTCHA code preserves drafts on rule rejection, avoids composing Enter, and ignores controls after disposal',()=>{
 const task=make('code'),f=fixture(task),input=f.find(n=>n.getAttribute('data-captcha-code')!==null),submit=f.find(n=>n.dataset.captchaSubmit==='code');
 assert.equal(input.maxLength,6);input.value='abc';f.click(submit);assert.equal(f.calls.length,0);input.value='wrongx';f.event(input,'keydown',{key:'Enter',isComposing:true});assert.equal(f.calls.length,0);
 input.focus();f.click(submit);assert.deepEqual(f.calls[0],{step:0,input:'WRONGX'});f.puzzle.setPending(true);f.puzzle.feedback('Incorrect. Read the signal again.');f.puzzle.setPending(false);assert.equal(input.value,'wrongx');assert.equal(f.document.activeElement,input);
 f.puzzle.dispose();f.event(submit,'click');assert.equal(f.calls.length,1);
});

test('CAPTCHA order keeps previously confirmed tags disabled after a pending request',()=>{
 const task=make('order'),f=fixture(task),first=taskInput(task);chooseCorrect(f,task);advanceTask(task,1000);f.puzzle.update(structuredClone(task));f.puzzle.setPending(true);f.puzzle.setPending(false);
 const confirmed=f.find(n=>n.dataset.captchaAnswer===first);assert(confirmed.disabled);assert.equal(confirmed.dataset.confirmed,'true');
});

test('all CAPTCHA dialogs preserve native Escape and focus trapping',()=>{
 const f=fixture(make('count'));f.puzzle.focus();assert.equal(f.document.activeElement,f.button('Close station'));let prevented=false;f.event(f.puzzle.node,'keydown',{key:'Tab',shiftKey:true,preventDefault(){prevented=true;}});assert(prevented);assert.notEqual(f.document.activeElement,f.button('Close station'));
 f.event(f.puzzle.node,'keydown',{key:'Escape'});assert.equal(f.closed,1);
});
