import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {TASK_ORDER,taskDisplay} from '../shared/task-catalog.mjs';
import {captchaChallenge} from '../shared/captcha.mjs';
import {challenge,taskInput,stepError,advanceTask} from '../server/engine/tasks.mjs';
const source=await readFile(new URL('../public/world/puzzles.mjs',import.meta.url),'utf8'),domSource=await readFile(new URL('../public/world/dom.mjs',import.meta.url),'utf8');
const strip=s=>s.replace(/^\uFEFF/,'').replace(/^import .*$/gm,'').replace(/^export /gm,'');
function fixture(kind,{index=0,readyAt=0}={}){
 const document={activeElement:null},timers=[],sent=[];
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.attrs=new Map();this.dataset={};this.style={setProperty(){}};this.handlers=new Map();this.disabled=false;this.hidden=false;this.text='';this.ownerDocument=document;}
  get className(){return this.attrs.get('class')||'';}set className(v){this.attrs.set('class',v);}get classList(){return {add:(...v)=>this.className+=' '+v.join(' ')};}
  setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k)||null;}
  addEventListener(k,fn){const list=this.handlers.get(k)||[];list.push(fn);this.handlers.set(k,list);}removeEventListener(){}
  append(...nodes){for(const n of nodes){n.remove();n.parentNode=this;this.children.push(n);}}
  replaceChildren(...nodes){for(const n of this.children)n.parentNode=null;this.children=[];this.text='';this.append(...nodes);}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
  get textContent(){return this.text+this.children.map(n=>n.textContent).join('');}set textContent(v){this.replaceChildren();this.text=String(v);}
  contains(n){return n===this||this.children.some(c=>c.contains(n));}querySelectorAll(query){const parts=query.split(','),out=[];const walk=node=>{for(const c of node.children){if(parts.some(p=>p.startsWith('.')?c.className.split(' ').includes(p.slice(1)):c.tagName===p.toUpperCase()))out.push(c);walk(c);}};walk(this);return out;}querySelector(q){return this.querySelectorAll(q)[0]||null;}
  focus(){if(!this.disabled)document.activeElement=this;}getClientRects(){return [{}];}
 }
 document.createElement=tag=>new Node(tag);document.body=new Node('body');document.activeElement=document.body;
 const context=vm.createContext({document,captchaChallenge,taskDisplay,Date,setTimeout:fn=>{timers.push(fn);return timers.length;}});
 const make=vm.runInContext(`(()=>{${strip(domSource)};${strip(source)};return createTaskPuzzle;})()`,context);
 let clock=100000,task={id:'detail-'+kind,roomId:'bridge',kind,edition:3,label:'Verify '+kind,completed:false};task.progress={...challenge(task),index,readyAt};
 const puzzle=make({task,id:'test',onSubmit:input=>sent.push(input),onClose(){},getServerNow:()=>clock});document.body.append(puzzle.node);
 const all=()=>puzzle.node.querySelectorAll('button,input'),find=(key,value)=>all().find(n=>n.dataset[key]===value),button=text=>all().find(n=>n.tagName==='BUTTON'&&n.textContent===text),click=node=>{assert(node,'control exists');if(!node.disabled)for(const fn of node.handlers.get('click')||[])fn({preventDefault(){}});};
 return {puzzle,task,sent,timers,find,button,click,advance(ms){clock+=ms;puzzle.update(task);},ack(){const next=structuredClone(task);advanceTask(next,clock);task=next;this.task=next;puzzle.update(next);}};
}

test('all25 server task families mount an identified instrument with progress and actionable controls',()=>{
 for(const kind of TASK_ORDER){const f=fixture(kind);assert.equal(f.puzzle.node.dataset.taskKind,kind);assert(f.puzzle.node.querySelector('progress'));assert(f.puzzle.node.querySelectorAll('button').length>1,kind+' has equipment controls');assert(!f.puzzle.node.textContent.includes('This equipment type is unavailable'),kind);f.puzzle.dispose();}
});
test('v3 wires match shuffled socket positions and never advance before acknowledgement; detached controls are fenced',()=>{
 const f=fixture('wires');let retained;
 for(let i=0;i<4;i++){const d=taskDisplay(f.task.progress),slot=d.wireOrder.indexOf(i);f.click(f.button(`Left cable ${i+1}`));const right=f.find('taskInput',String(slot));assert.equal(right.dataset.wireSymbol.includes(['SUN','WAVE','STAR','MOON'][i]),true);f.click(right);assert.equal(f.sent.at(-1).input,`${i}:${slot}`);assert.equal(stepError(f.task,f.sent.at(-1),100000),null);assert.equal(f.task.progress.index,i);retained??=right;f.ack();}
 assert.equal(f.sent.length,4);f.click(retained);assert.equal(f.sent.length,4,'old render callback cannot post into current step');f.click(f.button('Send completed task'));assert.equal(f.sent.length,5);assert.equal(f.sent.at(-1),undefined);f.puzzle.dispose();
});
test('multi-tile challenge keeps selections across pending failure and does not award local credit',()=>{
 const f=fixture('pairs'),d=taskDisplay(f.task.progress),duplicates=d.tiles.flatMap((v,i)=>d.tiles.filter(other=>other===v).length===2?[i]:[]);
 for(const i of duplicates)f.click(f.find('captchaIndex',String(i)));f.puzzle.setPending(true);f.puzzle.feedback('Try again: no reply received.');f.puzzle.setPending(false);
 for(const i of duplicates)assert.equal(f.find('captchaIndex',String(i)).getAttribute('aria-pressed'),'true');f.click(f.find('taskControl','selection-submit'));assert.equal(f.sent[0].input,taskInput(f.task));assert.equal(f.task.progress.index,0);f.puzzle.dispose();
});
test('timed diagnostic stays disabled during server wait and pending writes, then allows a legal verification',()=>{
 const f=fixture('repair',{index:3,readyAt:101500}),b=f.find('taskControl','repair-step');assert(b.disabled);f.click(b);assert.equal(f.sent.length,0);f.puzzle.setPending(true);f.advance(1500);assert(b.disabled);f.puzzle.setPending(false);assert(!b.disabled);f.click(b);assert.equal(f.sent[0].input,'test');f.puzzle.dispose();
});
test('increasing-memory round collects full prefix and accessible pattern bypasses visual flashing only',()=>{
 const f=fixture('sequence',{index:2});const input=taskInput(f.task);assert.equal(input.split(',').length,3);f.click(f.find('taskControl','memory-assist'));assert.match(f.puzzle.node.textContent,/PATTERN:/);
 const keys=input.split(',');for(let i=0;i<keys.length;i++){f.click(f.button(keys[i]));assert.equal(f.sent.length,i===keys.length-1?1:0);}assert.equal(f.sent[0].input,input);assert.equal(f.task.progress.index,2);f.puzzle.dispose();
});
test('disposed memory playback cannot focus, submit or mutate another task controller',()=>{
 const f=fixture('sequence',{index:3});f.click(f.find('taskControl','memory-playback'));assert(f.timers.length);f.puzzle.dispose();while(f.timers.length)f.timers.shift()();assert.equal(f.sent.length,0);
});
