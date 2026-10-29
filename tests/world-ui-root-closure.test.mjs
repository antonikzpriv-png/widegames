/** Closure of three retained root counterexamples. No browser or HTTP is used. */
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(process.env.WORLD_UI_ROOT_REVIEW_ROOT||fileURLToPath(new URL('../',import.meta.url)));
const pin=process.env.WORLD_UI_ROOT_REVIEW_PIN;
if(pin)assert.match(pin,/^[a-f0-9]{40}$/);
const source=rel=>pin?execFileSync('git',['show',pin+':'+rel],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,rel),'utf8');
const app=source('public/app.mjs'),css=source('public/styles.css'),gameCss=source('public/game.css');
// Scene drawing, DOM geometry and deferred request completions are injected.
class Node{
 constructor(tag){this.tagName=tag;this.children=[];this.attrs=new Map();this.hidden=false;this.text='';this.classes=new Set();this.classList={toggle:(name,value)=>value?this.classes.add(name):this.classes.delete(name),contains:name=>this.classes.has(name)};}
 setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k)||null;}
 append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;this.text='';}
 get textContent(){return this.text+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');}set textContent(value){this.text=String(value);this.children=[];}
 querySelector(){return null;}querySelectorAll(){return [];}focus(){}addEventListener(){}
}
function fixture(){
 const body=new Node('body'),ids=new Map(['main','feedback','rules','rules-toggle','rules-close','phase-status'].map(id=>[id,new Node(id)])),wordmark=new Node('a'),requests=[],scenes=[];ids.get('rules').hidden=true;
 const h=(tag,attrs={},...children)=>{const n=new Node(tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);n.append(...children.flat());return n;};
 const context={console,Date,AbortController,DOMException,crypto,clearTimeout,setTimeout,document:{body,activeElement:body,hidden:false,querySelector:selector=>selector==='.wordmark'?wordmark:ids.get(selector.slice(1)),addEventListener(){}},window:{addEventListener(){}},history:{replaceState(){},pushState(){}},sessionStorage:{setItem(){},removeItem(){}},h,button:(text,click,attrs)=>{const b=h('button',attrs,text);b.onclick=click;return b;},phaseLabel:p=>p,roomFrom:data=>data.room||data,roomPath:(id,suffix='')=>'/api/rooms/'+id+suffix,actionEnvelope:(type,fields)=>({...fields,type,id:crypto.randomUUID()}),createWorldExperience(host,callbacks){const scene={callbacks,updates:[],update(...args){this.updates.push(args);},dispose(){}};scenes.push(scene);return scene;},request:(path,options)=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}))};
 context.globalThis=context;const cut=app.indexOf('const initial=roomIdFromPath');assert(cut>0);
 vm.runInNewContext(app.slice(0,cut).replace(/^import .*$/gm,'')+`;globalThis.api={render,accept,tell,openRules:()=>rulesToggle.onclick(),seed:view=>{roomId=view.roomId;room=view;controller=new AbortController();networkReady=true;render();}};`,context);
 return {context,ids,body,requests,scenes,api:context.api};
}
const state=(phase='roam',version=1)=>({roomId:'audit-room',mode:'human',isHost:true,seatId:'p1',phase,game:{matchId:'audit-match',worldVersion:1,version,serverNow:1000+version,phase,self:{id:'p1',role:'crew',alive:true,inputSeq:0,moving:false,roomId:'bridge',position:{x:930,y:230},tasks:[{id:'audit-task',completed:false,roomId:'bridge'}]},players:[]}});


test('root closure: an open rules panel closes and resets aria before the viewport mounts',()=>{
 for(const phase of ['lobby','roam','discussion']){
  const f=fixture();f.api.openRules();assert.equal(f.ids.get('rules').hidden,false);
  const view=state(phase);if(phase==='lobby')view.game=null;f.api.seed(view);
  assert.equal(f.ids.get('rules').hidden,true);assert.equal(f.ids.get('rules-toggle').getAttribute('aria-expanded'),'false');
  assert(f.body.classList.contains('world-mode'));assert.equal(f.scenes.at(-1).updates.at(-1)[0].roomId,'audit-room');
 }
 assert(css.includes('body.world-mode #main{width:100%;height:100vh;height:100dvh;max-width:none;margin:0;padding:0;overflow:hidden}'));
 assert(css.includes('#world-host>.lw-world{height:100%;min-height:0;border-radius:0}'));
});

test('root closure: deferred old task rejection preserves current council feedback without retry',async()=>{
 for(const status of [409,undefined]){
  const f=fixture();f.api.seed(state());const action=f.scenes.at(-1).callbacks.action('task',{taskId:'audit-task'});
  assert.equal(f.requests.length,1);f.api.accept(state('discussion',2));f.api.tell('CURRENT COUNCIL NOTICE');
  f.requests[0].reject(Object.assign(new Error('OLD ROOT TASK FAILURE'),{status,code:'WRONG_PHASE'}));
  await assert.rejects(action,error=>error.name==='AbortError');assert.equal(f.ids.get('feedback').textContent,'CURRENT COUNCIL NOTICE');
  assert.equal(f.scenes.at(-1).updates.at(-1)[1].feedback,'CURRENT COUNCIL NOTICE');assert(!retryButton(f));
 }
});

const retryButton=f=>f.ids.get('feedback').children.find(node=>node.tagName==='button'&&node.textContent==='Retry same request');
test('root closure: a still-current rule failure remains useful and is not mislabeled stale',async()=>{
 const f=fixture();f.api.seed(state());const action=f.scenes.at(-1).callbacks.action('task',{taskId:'audit-task'});
 f.requests[0].reject(Object.assign(new Error('Task equipment cooling down'),{status:409,code:'COOLDOWN'}));
 await assert.rejects(action,error=>error.name!=='AbortError'&&error.message==='Task equipment cooling down');
 assert.equal(f.ids.get('feedback').textContent,'Task equipment cooling down');assert(!retryButton(f));assert.equal(f.scenes.at(-1).updates.at(-1)[1].pending,false);
});

test('root closure: a still-current uncertain task retains the exact request ID and fields when retried',async()=>{
 const f=fixture();f.api.seed(state());const action=f.scenes.at(-1).callbacks.action('task',{taskId:'audit-task'}),first=f.requests[0];
 first.reject(new Error('Lost task acknowledgement'));await assert.rejects(action,/Lost task acknowledgement/);
 const retry=retryButton(f);assert(retry);assert.equal(f.ids.get('feedback').getAttribute('data-retry'),'true');assert.match(f.ids.get('feedback').textContent,/same request ID/);
 const replayed=retry.onclick(),second=f.requests[1];assert.equal(second.path,first.path);assert.equal(second.options.body.id,first.options.body.id);assert.equal(second.options.body.type,'task');assert.equal(second.options.body.taskId,'audit-task');
 const acknowledged=state('roam',2);acknowledged.game.self.tasks[0].completed=true;second.resolve(acknowledged);await replayed;
 assert.equal(f.ids.get('feedback').getAttribute('data-retry'),'false');assert(!retryButton(f));assert.equal(f.requests.length,2);
});

test('root closure: task completion invalidates an old uncertain retry including its retained click handler',async()=>{
 const f=fixture();f.api.seed(state());const action=f.scenes.at(-1).callbacks.action('task',{taskId:'audit-task'});f.requests[0].reject(new Error('Lost reply'));await assert.rejects(action);
 const retained=retryButton(f);assert(retained);const completed=state('roam',2);completed.game.self.tasks[0].completed=true;f.api.accept(completed);
 assert.equal(f.ids.get('feedback').getAttribute('data-retry'),'false');assert(!retryButton(f));const count=f.requests.length;
 retained.onclick();assert.equal(f.requests.length,count);
});

// Small cascade fixture for the selectors affecting these four controls. It skips
// media/keyframe blocks and evaluates the unconditional desktop declarations only.
function rules(text){
 const clean=text.replace(/\/\*[\s\S]*?\*\//g,'');let index=0;const output=[];
 while(index<clean.length){const start=clean.indexOf('{',index);if(start<0)break;const selector=clean.slice(index,start).trim();let depth=1,end=start+1;
  while(end<clean.length&&depth){if(clean[end]==='{')depth++;if(clean[end]==='}')depth--;end++;}
  const body=clean.slice(start+1,end-1);index=end;if(selector.startsWith('@'))continue;
  for(const part of selector.split(','))output.push({selector:part.trim(),declarations:body.split(';').flatMap(entry=>{const found=entry.trim().match(/^([\w-]+)\s*:\s*([\s\S]*)$/);return found?[{property:found[1],value:found[2].replace(/\s*!important\s*$/,'').trim(),important:/!important\s*$/.test(found[2])}]:[];})});
 }
 return output;
}
function simpleMatches(selector,node){
 if(!node||selector.includes('::'))return false;
 let allowed=true;
 selector=selector.replace(/:not\(([^()]*)\)/g,(_,inner)=>{if(simpleMatches(inner,node))allowed=false;return '';});if(!allowed)return false;
 selector=selector.replace(/:([\w-]+)(?:\([^)]*\))?/g,(_,pseudo)=>{if(!(pseudo==='hover'&&node.hover||pseudo==='disabled'&&node.disabled))allowed=false;return '';});if(!allowed)return false;
 selector=selector.replace(/\[([^\]]+)\]/g,()=>{allowed=false;return '';});
 selector=selector.replace(/#([\w-]+)/g,(_,id)=>{if(node.id!==id)allowed=false;return '';});
 selector=selector.replace(/\.([\w-]+)/g,(_,name)=>{if(!node.classes.includes(name))allowed=false;return '';});
 return allowed&&(!selector||selector==='*'||selector.toLowerCase()===node.tag);
}
function matches(selector,node){
 const parts=selector.replace(/\s*>\s*/g,' > ').trim().split(/\s+/);
 function at(index,current){if(!simpleMatches(parts[index],current))return false;if(index===0)return true;if(parts[index-1]==='>')return at(index-2,current.parent);for(let parent=current.parent;parent;parent=parent.parent)if(at(index-1,parent))return true;return false;}
 return at(parts.length-1,node);
}
function specificity(selector){
 const expanded=selector.replace(/:not\(([^()]*)\)/g,'$1');
 const ids=(expanded.match(/#[\w-]+/g)||[]).length,classes=(expanded.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?/g)||[]).length;
 const rest=expanded.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?/g,'');
 return [ids,classes,rest.split(/[\s>+~]+/).filter(t=>t&&t!=='*').length];
}
function cascade(target){
 const winners={};const compare=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
 for(const [order,rule]of [...rules(css),...rules(gameCss)].entries())if(matches(rule.selector,target))for(const declaration of rule.declarations){
  if(!['background','color'].includes(declaration.property))continue;const rank=[Number(declaration.important),...specificity(rule.selector),order];
  const old=winners[declaration.property];if(!old||compare(rank,old.rank)>0)winners[declaration.property]={...declaration,selector:rule.selector,rank};
 }
 return winners;
}
const luminance=color=>{assert.match(color,/^#[\da-f]{6}$/i);const rgb=color.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
function buttonTarget(name,world){const body={tag:'body',classes:world?['world-mode']:[]},surface={tag:'section',classes:[world?'lw-world':'harbor'],parent:body},parent={tag:'div',classes:[world?'lw-task-modal':'harbor-actions'],parent:surface};return {tag:'button',classes:[name],hover:true,disabled:false,parent};}

test('root closure: the retained four hover controls resolve to pale, readable CSS pairs',(t)=>{
 for(const [name,world]of [['harbor-play',false],['harbor-watch',false],['lw-primary',true],['lw-secondary',true]]){
  const actual=cascade(buttonTarget(name,world)),background=actual.background.value,foreground=actual.color.value,ratio=contrast(background,foreground);
  t.diagnostic(JSON.stringify({control:name,background,foreground,contrast:ratio,backgroundSelector:actual.background.selector,foregroundSelector:actual.color.selector}));
  assert(luminance(background)>.5,`${name}: hover must keep a pale background`);assert(luminance(foreground)<.1,`${name}: hover must keep dark text`);assert(ratio>=4.5,`${name}: hover contrast ${ratio.toFixed(3)} is below 4.5:1`);
 }
});
