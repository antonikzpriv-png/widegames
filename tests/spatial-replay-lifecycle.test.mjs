import test from 'node:test';
import assert from 'node:assert/strict';
import {createResults} from '../public/world/phases.mjs';
import {spatialFixture} from './spatial-replay-fixture.mjs';
const f=spatialFixture();
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.listeners=new Map();this.attrs={};this.hidden=false;this.disabled=false;this.value='';this.text='';}
 set textContent(s){this.text=String(s);this.children=[];}get textContent(){return this.text+this.children.map(c=>c.textContent||'').join('');}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;this.text='';}
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}
 addEventListener(k,fn){this.listeners.set(k,fn);}removeEventListener(k){this.listeners.delete(k);}dispatch(k){return this.listeners.get(k)?.({target:this});}
 getContext(){return new Proxy({},{get:()=>()=>{}});}getBoundingClientRect(){return {width:0,height:0};}focus(){}
}
function dom(){
 const listeners=new Map(),frames=new Map();let serial=0;
 globalThis.document={hidden:false,createElement:tag=>new Element(tag),addEventListener:(key,fn)=>{if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);},removeEventListener:(key,fn)=>listeners.get(key)?.delete(fn)};
 globalThis.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 return {frames,hide(){document.hidden=true;for(const fn of listeners.get('visibilitychange')||[])fn();},get listeners(){return [...listeners.values()].reduce((n,s)=>n+s.size,0);}};
}
const walk=n=>[n,...n.children.flatMap(walk)];
const button=(root,text)=>walk(root).find(n=>n.tagName==='button'&&n.textContent===text);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('room/match change and disposal abort pending replay requests and ignore stale fulfillment or error',async()=>{
 for(const kind of ['room','match','dispose']){
  const env=dom(),pending=deferred(),errors=[],requests=[];const results=createResults({id:'lifecycle',feedback:e=>errors.push(e),isCurrent:()=>true,loadReplay:options=>{requests.push(options);return pending.promise;}});
  results.update(f.game,{roomId:f.state.id});const load=button(results.node,'Open the role-revealed replay'),task=load.dispatch('click');assert(load.disabled);
  if(kind==='dispose')results.dispose();else results.update(kind==='match'?{...f.game,matchId:'new-match'}:f.game,{roomId:kind==='room'?'new-room':f.state.id});
  assert(requests[0].signal.aborted);pending.resolve(f.envelope);await task;assert.equal(walk(results.node).some(n=>n.className==='lw-replay-canvas'),false);assert.equal(errors.length,0);
  results.dispose();assert.equal(env.frames.size,0);assert.equal(env.listeners,0);
 }
});

test('a stale rejection cannot change the loading state of a replacement request',async()=>{
 dom();const old=deferred(),fresh=deferred(),requests=[old,fresh],errors=[];const results=createResults({id:'lifecycle',feedback:e=>errors.push(e),isCurrent:()=>true,loadReplay:()=>requests.shift().promise});
 results.update(f.game,{roomId:f.state.id});const load=button(results.node,'Open the role-revealed replay'),first=load.dispatch('click');results.update({...f.game,matchId:'second-match'},{roomId:f.state.id});const second=load.dispatch('click');old.reject(new Error('obsolete'));await first;assert.equal(load.disabled,true);assert.deepEqual(errors,[]);
 results.dispose();fresh.reject(new DOMException('Disposed','AbortError'));await second;assert.deepEqual(errors,[]);
});

test('playback has no action/input callbacks, pauses on hidden, and disposes animation/listeners',async()=>{
 const env=dom();let network=0;const results=createResults({id:'lifecycle',feedback:e=>{throw new Error(e);},isCurrent:()=>true,loadReplay:async()=>{network++;return f.envelope;}});
 results.update(f.game,{roomId:f.state.id});await button(results.node,'Open the role-revealed replay').dispatch('click');assert.equal(network,1);
 const play=button(results.node,'Play');assert(play);play.dispatch('click');assert.equal(env.frames.size,1);env.hide();assert.equal(env.frames.size,0);assert.equal(play.textContent,'Play');
 document.hidden=false;play.dispatch('click');assert.equal(env.frames.size,1);results.dispose();assert.equal(env.frames.size,0);assert.equal(env.listeners,0);assert.equal(network,1);
});

test('hiding during fetch aborts it and ignores a response even when its promise ignores abort',async()=>{
 const env=dom(),pending=deferred();let signal;const results=createResults({id:'lifecycle',feedback:()=>assert.fail('stale feedback'),isCurrent:()=>true,loadReplay:options=>{signal=options.signal;return pending.promise;}});
 results.update(f.game,{roomId:f.state.id});const task=button(results.node,'Open the role-revealed replay').dispatch('click');env.hide();assert(signal.aborted);document.hidden=false;pending.resolve(f.envelope);await task;assert(!walk(results.node).some(n=>n.className==='lw-replay-canvas'));results.dispose();assert.equal(env.listeners,0);
});

test('equal-time event selection survives clock callbacks, camera/perspective toggles and resize refresh',async t=>{
 const env=dom();const results=createResults({id:'audit-ties',feedback:e=>assert.fail(e),isCurrent:()=>true,loadReplay:async()=>f.envelope});
 t.after(()=>results.dispose());results.update(f.game,{roomId:f.state.id});await button(results.node,'Open the role-revealed replay').dispatch('click');
 const pane=walk(results.node).find(n=>n.className==='lw-replay'),range=walk(pane).find(n=>n.tagName==='input'&&n.className!=='lw-replay-seek');
 const index=f.replay.findIndex(e=>e.type==='vote_result');assert.equal(f.replay[index].at,f.replay.at(-1).at);
 range.value=String(index);range.dispatch('input');
 assert.equal(Number(range.value),index,'A clock seek must not replace the selected event with the last event at that time');
 assert.equal(pane.dataset.replayPhase,'roam','The terminal outcome has not occurred at this causal event prefix');
 const follow=walk(pane).find(n=>n.attrs['aria-label']==='Follow keeper');follow.value='p2';follow.dispatch('change');assert.equal(Number(range.value),index);
 const perspective=walk(pane).find(n=>n.attrs['aria-label']==='Historical character perspective');perspective.value='p2';perspective.dispatch('change');assert.equal(Number(range.value),index);
 for(const title of ['Overview','Postgame roles']){button(pane,title).dispatch('click');assert.equal(Number(range.value),index);assert.equal(pane.dataset.replayPhase,'roam');}
 button(pane,'Next event').dispatch('click');assert.equal(Number(range.value),index+1);button(pane,'Previous event').dispatch('click');assert.equal(Number(range.value),index);
 button(pane,'Play').dispatch('click');assert.equal(Number(range.value),f.replay.length-1,'Playing the remaining terminal tie should finish it before restarting');assert.equal(pane.dataset.replayPhase,'ended');assert.equal(env.frames.size,0);
});
