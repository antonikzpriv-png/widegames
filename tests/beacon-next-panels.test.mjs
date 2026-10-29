import test from 'node:test';
import assert from 'node:assert/strict';
import {createPanelRegistry} from '../public/features/panels.mjs';
import {createWatchPanels} from '../public/features/watch-panels.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function dom(t){const previous=globalThis.document,listeners=new Map();const document={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),createElement(){return {textContent:'',setAttribute(){},remove(){this.removed=true;}};}};globalThis.document=document;t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});return {document,host:{children:[],append(node){this.children.push(node);}},hide(){document.hidden=true;listeners.get('visibilitychange')?.();},listeners};}

test('actual registry revokes older snapshots, replaced room/actor/phase, hidden updates and unregister',async t=>{
 const d=dom(t),errors=[],contexts=[],panels=createPanelRegistry(d.host,{onError:e=>errors.push(e.message)}),node=d.document.createElement('section');let reject;
 const remove=panels.register({id:'sample',node,update(view,ctx){contexts.push({view,...ctx});return new Promise((_,r)=>{reject=r;});}});assert.throws(()=>panels.register({id:'sample',node,update(){}}));
 const view={roomId:'A',game:{matchId:'m',phase:'roam',self:{id:'captain'}}};panels.update(view);const first=contexts.at(-1);assert(first.isCurrent());panels.update({...view,game:{...view.game,version:2}});assert(first.signal.aborted);assert.equal(first.isCurrent(),false);const second=contexts.at(-1);panels.update({roomId:'B',game:{matchId:'new',phase:'discussion',self:null}});assert(second.signal.aborted);const third=contexts.at(-1);d.hide();assert(third.signal.aborted);panels.update(view);assert.equal(contexts.length,3);d.document.hidden=false;panels.update(view);const fourth=contexts.at(-1);remove();assert(fourth.signal.aborted);assert.equal(fourth.isCurrent(),false);reject(new Error('obsolete update'));await flush();assert.deepEqual(errors,[]);assert(node.removed);panels.dispose();assert.equal(d.listeners.size,0);
});

test('current panel errors remain visible and disposal is idempotent',async t=>{
 const d=dom(t),errors=[],panels=createPanelRegistry(d.host,{onError:e=>errors.push(e.message)});let disposed=0;const node=d.document.createElement('section');panels.register({id:'current',node,update(){throw new Error('current source failure');},dispose(){disposed++;}});panels.update({roomId:'A'});assert.deepEqual(errors,['current source failure']);panels.dispose();panels.dispose();assert.equal(disposed,1);assert(node.removed);assert.throws(()=>panels.register({id:'new',node,update(){}}));
});

test('actual app registered summary uses all five safe feature models and no other actor details',t=>{
 const d=dom(t),panels=createWatchPanels(d.host);const room={roomId:'A',roster:[{id:'captain'},{id:'signal'},{id:'crew-3'},{id:'crew-4'}],game:{beaconVersion:1,phase:'roam',self:{id:'captain',destination:{x:100,y:100},tasks:[{completed:false},{completed:true}]},abilities:{notes:[{id:'own-note'}]},tasks:{completed:1,total:2},interactions:[]}};panels.update(room);assert.match(d.host.children[0].textContent,/4 keepers.*1 own tasks.*Walking.*1 private field notes.*Replay remains locked/);panels.update({...room,game:{...room.game,phase:'ended',self:null,abilities:{notes:[]}}});assert.match(d.host.children[0].textContent,/0 own tasks.*Ended replay available/);panels.dispose();assert(d.host.children[0].removed);
});
