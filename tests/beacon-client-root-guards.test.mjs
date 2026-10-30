import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual root handlers, minimal DOM/scene and controlled request completions.
// These are source/VM counterexamples, not HTTP/browser qualification.
const root=path.resolve(process.env.BEACON_CLIENT_ROOT_REVIEW_ROOT||fileURLToPath(new URL('../',import.meta.url))),pin=process.env.BEACON_CLIENT_ROOT_REVIEW_PIN;
if(pin)assert.match(pin,/^[a-f0-9]{40}$/);
const source=()=>pin?execFileSync('git',['show',pin+':public/app.mjs'],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,'public/app.mjs'),'utf8');
const app=source(),sha=text=>crypto.createHash('sha256').update(text).digest('hex'),before=sha(app),ready=fs.existsSync(path.join(root,'public/features/watch-panels.mjs'));
const observedHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const options={skip:!ready&&'Foundation root registration absent; set BEACON_CLIENT_ROOT_REVIEW_ROOT to integrated source'};
class Node{
 constructor(tag){this.tagName=tag;this.children=[];this.attrs=new Map();this.hidden=false;this.text='';this.classes=new Set();this.classList={toggle:(name,value)=>value?this.classes.add(name):this.classes.delete(name),contains:name=>this.classes.has(name)};}
 setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k)||null;}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;this.text='';}
 get textContent(){return this.text+this.children.map(n=>typeof n==='string'?n:n.textContent).join('');}set textContent(v){this.text=String(v);this.children=[];}
 querySelector(){return null;}querySelectorAll(){return [];}focus(){}addEventListener(){}
}
function fixture(){
 const body=new Node('body'),ids=new Map(['main','feedback','rules','rules-toggle','rules-close','phase-status'].map(id=>[id,new Node(id)])),wordmark=new Node('a'),requests=[],scenes=[];ids.get('rules').hidden=true;
 const h=(tag,attrs={},...children)=>{const n=new Node(tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);n.append(...children.flat());return n;};
 const context={Date,AbortController,DOMException,crypto,clearTimeout,setTimeout,document:{body,activeElement:body,hidden:false,querySelector:selector=>selector==='.wordmark'?wordmark:ids.get(selector.slice(1)),addEventListener(){}},window:{addEventListener(){}},history:{replaceState(){},pushState(){}},sessionStorage:{setItem(){},removeItem(){}},h,button:(text,click,attrs)=>{const b=h('button',attrs,text);b.onclick=click;return b;},phaseLabel:p=>p,roomFrom:data=>data.room||data,roomPath:(id,suffix='')=>'/api/rooms/'+id+suffix,actionEnvelope:(type,fields)=>({...fields,type,id:crypto.randomUUID()}),createWatchPanels:()=>({update(){},dispose(){}}),createWorldExperience(host,callbacks){const scene={callbacks,updates:[],update(...args){this.updates.push(args);},dispose(){}};scenes.push(scene);return scene;},request:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}))};
 context.globalThis=context;const cut=app.indexOf('const initial=roomIdFromPath');assert(cut>0);
 vm.runInNewContext(app.slice(0,cut).replace(/^\uFEFF/,'').replace(/^import .*$/gm,'')+`;globalThis.api={accept,tell,getRoom:()=>room,seed:view=>{roomId=view.roomId;room=view;controller=new AbortController();networkReady=true;render();}};`,context);
 return {ids,requests,scenes,api:context.api};
}
function state(version=1){return {roomId:'root-beacon-room',mode:'human',isHost:true,seatId:'custom-77',game:{beaconVersion:1,worldVersion:1,matchId:'root-beacon-match',version,serverNow:100000+version,phase:'roam',self:{id:'custom-77',role:'crew',alive:true,roomId:'bridge',position:{x:930,y:310},inputSeq:41,moving:false,tasks:[{id:'own-task',completed:false,progress:0}]},players:[],systems:{selfTransit:null},vision:{radius:360},investigation:{session:null},abilities:{notes:[]},interactions:[{id:'read-security',type:'investigate',fields:{deviceId:'security'},enabled:true},{id:'field-note',type:'ability',fields:{abilityId:'field-note',targetId:'custom-77'},enabled:true}]}};}
const retry=f=>f.ids.get('feedback').children.find(n=>n.tagName==='button'&&n.textContent==='Retry same request');
function change(f,boundary){const next=state(2);if(boundary.startsWith('position'))next.game.self.position.x++;if(boundary==='transit')next.game.systems.selfTransit={entryId:'archive-hatch',exitId:'lantern-hatch',deadlineAt:102000};if(boundary==='session')next.game.investigation.session={deviceId:'security',status:'reading',startedAt:100000,deadlineAt:102000};if(boundary==='vision')next.game.vision.radius=110;if(boundary==='task-progress')next.game.self.tasks[0].progress=1;if(boundary==='task-completed')next.game.self.tasks[0].completed=true;if(boundary==='descriptor')next.game.interactions[0].fields.deviceId='vitals';if(boundary==='descriptor-enabled')next.game.interactions[0].enabled=false;f.api.accept(next);if(boundary==='position-return')f.api.accept(state(3));}
for(const boundary of ['position','position-return','transit','session','vision','task-progress','task-completed','descriptor','descriptor-enabled'])test('root permanently revokes old beacon failures after '+boundary,options,async()=>{
 for(const status of [409,undefined]){const f=fixture();f.api.seed(state());const action=f.scenes[0].callbacks.action('investigate',{deviceId:'security'});change(f,boundary);f.api.tell('CURRENT BEACON NOTICE');f.requests[0].reject(Object.assign(Error('OLD EQUIPMENT FAILURE'),{status}));await assert.rejects(action,e=>e.name==='AbortError');assert.equal(f.ids.get('feedback').textContent,'CURRENT BEACON NOTICE');assert.equal(f.scenes[0].updates.at(-1)[1].feedback,'CURRENT BEACON NOTICE');assert(!retry(f));assert.equal(f.scenes[0].updates.at(-1)[1].pending,false);}
});
test('root accepts a late authoritative success while preserving feedback after context left and returned',options,async()=>{
 const f=fixture();f.api.seed(state());const action=f.scenes[0].callbacks.action('investigate',{deviceId:'security'});change(f,'position-return');f.api.tell('CURRENT WATCH NOTICE');const acknowledged=state(4);acknowledged.game.investigation.session={deviceId:'security',status:'reading',startedAt:100000,deadlineAt:102000};f.requests[0].resolve(acknowledged);await assert.rejects(action,e=>e.name==='AbortError');assert.equal(f.api.getRoom().game.version,4);assert.equal(f.api.getRoom().game.investigation.session.deviceId,'security');assert.equal(f.ids.get('feedback').textContent,'CURRENT WATCH NOTICE');assert(!retry(f));
});
test('root current equipment failure remains useful through an unrelated version refresh',options,async()=>{
 const f=fixture();f.api.seed(state());const action=f.scenes[0].callbacks.action('investigate',{deviceId:'security'});f.api.accept(state(2));f.requests[0].reject(Object.assign(Error('Equipment cooling down'),{status:409}));await assert.rejects(action,e=>e.name!=='AbortError'&&e.message==='Equipment cooling down');assert.equal(f.ids.get('feedback').textContent,'Equipment cooling down');assert(!retry(f));
});
test('root current uncertain equipment failure retries the identical action ID and exact fields',options,async()=>{
 const f=fixture();f.api.seed(state());const action=f.scenes[0].callbacks.action('investigate',{deviceId:'security'}),first=f.requests[0];first.reject(Error('Lost acknowledgement'));await assert.rejects(action,/Lost acknowledgement/);const button=retry(f);assert(button);const pending=button.onclick(),second=f.requests[1];assert.equal(second.url,first.url);assert.equal(second.options.body.id,first.options.body.id);assert.equal(second.options.body.type,'investigate');assert.equal(second.options.body.deviceId,'security');const ack=state(2);ack.game.investigation.session={deviceId:'security',status:'reading',startedAt:100000,deadlineAt:102000};second.resolve(ack);await pending;assert(!retry(f));assert.equal(f.ids.get('feedback').textContent,'Action confirmed.');
});
test('root permission withdrawal removes an uncertain retry permanently, including its retained handler',options,async()=>{
 const f=fixture();f.api.seed(state());const action=f.scenes[0].callbacks.action('investigate',{deviceId:'security'});f.requests[0].reject(Error('Lost acknowledgement'));await assert.rejects(action);const retained=retry(f);assert(retained);change(f,'descriptor-enabled');f.api.accept(state(3));assert(!retry(f));retained.onclick();assert.equal(f.requests.length,1);
});
test('root current field-note success confirms normally and retains actual accepted notes',options,async()=>{
 const f=fixture();f.api.seed(state());const action=f.scenes[0].callbacks.action('ability',{abilityId:'field-note',targetId:'custom-77'}),ack=state(2);ack.game.abilities.notes=[{id:'own-note',at:100001,roomId:'bridge',position:{x:930,y:310}}];ack.game.interactions[1].enabled=false;f.requests[0].resolve(ack);await action;assert.equal(f.api.getRoom().game.abilities.notes.length,1);assert.equal(f.ids.get('feedback').textContent,'Action confirmed.');
});
after(()=>{
 assert.equal(sha(source()),before,'root source changed during the check');
 if(process.env.BEACON_CLIENT_ROOT_RECEIPT){const file=process.env.BEACON_CLIENT_ROOT_RECEIPT;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({root,pin:pin||null,headObservedBeforeRun:observedHead,appSha256:before,sourceStable:true,ready,limits:'Actual root source/VM handlers with controlled request completions; no native browser/HTTP qualification.'},null,2)+'\n');fs.writeFileSync(file+'.app.mjs',app);}
});
