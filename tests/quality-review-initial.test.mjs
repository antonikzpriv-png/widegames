import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.QUALITY_REVIEW_ROOT?pathToFileURL(resolve(process.env.QUALITY_REVIEW_ROOT)+'/'):new URL('../',import.meta.url);
const engine=await import(new URL('server/engine/index.mjs',root));
const {getMap}=await import(new URL('shared/maps/index.mjs',root));
const {ActorSamples}=await import(new URL('public/world/model.mjs',root));
const {createWorldScene}=await import(new URL('public/world/scene.mjs',root));
function fixture(mapId='beacon'){
 const map=getMap({id:mapId,version:1});let state=engine.createMatch({id:'quality-native-fixture',tactical:true,map:{id:map.id,version:map.version},mode:'spectator',now:1000,seed:'quality-walking',config:{initialKillCooldownMs:1,moveCooldownMs:1,roamDeadlineMs:600000,maxMatchMs:900000}}),now=1000,seq=0;assert.equal(state.schemaVersion,4);
 return {map,get state(){return state;},get now(){return now;},view(actor='p1'){return engine.getPlayerView(state,actor,now);},act(actor,type,fields={}){const r=engine.applyAction(state,actor,{id:'quality:'+ ++seq,type,...fields},now);assert.equal(r.accepted,true,JSON.stringify({type,error:r.error}));state=r.state;return r;},tick(at){now=at;state=engine.tick(state,at).state;},restore(){state=JSON.parse(JSON.stringify(state));},input(packet,actor='p1',accepted=true){const r=engine.applyInput(state,actor,packet,now);assert.equal(r.accepted,accepted,JSON.stringify(r.error));state=r.state;return r;},walk(target,actor='p1'){this.act(actor,'navigate',{x:target.x,y:target.y});let length=0,last=state.players.find(p=>p.id===actor).position;for(const point of state.players.find(p=>p.id===actor).motion.path){length+=map.geometry.distance(last,point);last=point;}this.tick(now+Math.ceil(length/map.geometry.WORLD.speed*1000)+1);assert(map.geometry.distance(state.players.find(p=>p.id===actor).position,target)<.01);return this.view(actor);}};
}
// Actual draw logic with a no-op native Canvas2D fixture. Measures camera
// transforms only: no Chrome, GPU timing, screenshot or FPS claim is implied.
function canvas(){const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get(o,k){return k in o?o[k]:()=>{};}});return {width:900,height:650,getContext:()=>ctx,getBoundingClientRect:()=>({width:900,height:650,left:0,top:0})};}

test('rendered samples of a real accepted detour must never enter its solid chart table',()=>{
 const f=fixture(),first=f.walk({x:700,y:200}),last=f.walk({x:900,y:200});assert(f.map.geometry.isWalkable(first.self.position));assert(f.map.geometry.isWalkable(last.self.position));const samples=new ActorSamples();samples.update(first,0);samples.update(last,1000);const displayed=samples.at('p1',1070);assert(displayed);assert(f.map.geometry.isWalkable(displayed),'Rendered actor is inside a solid collider: '+JSON.stringify({first:first.self.position,last:last.self.position,displayed}));
});

test('camera position after equal elapsed time should agree across 30 and 120 render cadences',()=>{
 const f=fixture(),first=f.walk({x:700,y:300}),last=f.walk({x:900,y:300});const atCadence=fps=>{const scene=createWorldScene(canvas());scene.update({roomId:'quality-native-fixture',map:first.map,game:first},0);scene.draw(0);scene.update({roomId:'quality-native-fixture',map:last.map,game:last},1000);for(let frame=1;frame<=fps/5;frame++)scene.draw(1000+frame*1000/fps);const camera=scene.toWorld(450,325);scene.dispose();return camera;},slow=atCadence(30),fast=atCadence(120),gap=f.map.geometry.distance(slow,fast);assert(gap<=1,'Same 200ms produced different camera positions; one-world-unit integration tolerance: '+JSON.stringify({slow,fast,gap}));
});


test('real direction leases keep cardinal/diagonal speed bounded and expire without further input',()=>{
 const straight=fixture();straight.walk({x:650,y:300});const start={...straight.view().self.position},at=straight.now;straight.input({seq:1,dx:1,dy:0});straight.tick(at+200);assert(Math.abs(straight.map.geometry.distance(start,straight.view().self.position)-36)<1e-6);straight.tick(at+1000);assert(Math.abs(straight.map.geometry.distance(start,straight.view().self.position)-108)<1e-6);assert.equal(straight.view().self.moving,false);
 const diagonal=fixture();diagonal.walk({x:650,y:300});const origin={...diagonal.view().self.position},time=diagonal.now;diagonal.input({seq:1,dx:1,dy:1});diagonal.tick(time+200);assert(Math.abs(diagonal.map.geometry.distance(origin,diagonal.view().self.position)-36)<1e-6);assert(diagonal.map.geometry.isWalkable(diagonal.view().self.position));
});

test('sparse and dense collision ticks cannot enter the chart table or exceed the active lease distance',()=>{
 for(const step of [10,600]){const f=fixture();f.walk({x:700,y:150});const start={...f.view().self.position},at=f.now;f.input({seq:1,dx:1,dy:1});for(let elapsed=step;elapsed<=600;elapsed+=step){f.tick(at+elapsed);const p=f.view().self.position;assert(f.map.geometry.isWalkable(p),JSON.stringify({step,elapsed,p}));assert(f.map.geometry.distance(start,p)<=f.map.geometry.WORLD.speed*elapsed/1000+1e-6);assert(p.x<=740-f.map.geometry.WORLD.bodyRadius+1e-6,'Cannot pass the table face before clearing its corner');}assert.equal(f.view().self.moving,false);}
});

test('relay baseline still requires real station range and ownership, with durable same-ID completion',()=>{
 const f=fixture(),actor=f.state.players.find(p=>p.role==='crew'),task=actor.tasks.find(t=>t.roomId!==actor.roomId);assert(task);const action={id:'quality:relay-once',type:'task',taskId:task.id};assert.equal(engine.applyAction(f.state,actor.id,action,f.now).accepted,false);f.walk(f.map.geometry.WORLD_STATIONS[task.roomId],actor.id);const stranger=f.state.players.find(p=>p.id!==actor.id&&p.role==='crew');assert.equal(engine.applyAction(f.state,stranger.id,{...action,id:'quality:foreign-task'},f.now).accepted,false);const done=engine.applyAction(f.state,actor.id,action,f.now);assert.equal(done.accepted,true);assert.equal(done.state.players.find(p=>p.id===actor.id).tasks.find(t=>t.id===task.id).completed,true);const restarted=JSON.parse(JSON.stringify(done.state)),again=engine.applyAction(restarted,actor.id,action,f.now);assert.equal(again.accepted,true);assert.equal(again.duplicate,true);assert.deepEqual(again.state.players.find(p=>p.id===actor.id).tasks,restarted.players.find(p=>p.id===actor.id).tasks);
 // This is intentional legacy relay authority, not schema5 puzzle qualification.
});

test('a higher-sequence stop cancels an accepted route; restored stale/duplicate packets cannot revive it',()=>{
 const f=fixture();f.walk({x:650,y:300});const start={...f.view().self.position};f.input({seq:1,dx:1,dy:0});f.act('p1','navigate',{x:900,y:300});assert(f.view().self.moving);f.input({seq:2,dx:0,dy:0});f.restore();assert.equal(f.view().self.moving,false);assert.equal(f.input({seq:1,dx:1,dy:0},'p1',false).error.code,'STALE_INPUT');assert.equal(f.input({seq:2,dx:0,dy:0}).duplicate,true);f.tick(f.now+1000);assert.deepEqual(f.view().self.position,start);assert.equal(f.view().self.inputSeq,2);
});

test('renderer forgets a previously observed keeper immediately after the real safe view hides it',()=>{
 const f=fixture(),observer=f.state.players.find(p=>p.role==='crew').id,target=f.state.players.find(p=>p.id!==observer&&p.role==='crew').id,samples=new ActorSamples(),before=f.view(observer);assert(before.players.find(p=>p.id===target).position);samples.update(before,0);assert(samples.at(target,0));f.walk(f.map.geometry.WORLD_STATIONS.engine,target);const hidden=f.view(observer);assert.equal(hidden.players.find(p=>p.id===target).position,null);samples.update(hidden,1000);assert.equal(samples.at(target,1001),null);assert.equal(samples.samples.has(target),false);assert(hidden.players.every(p=>!Object.hasOwn(p,'role')&&!Object.hasOwn(p,'motion')));
});

test('every current map task station is physically reachable; native route observations are measured without FPS claims',t=>{
 const timings=[];for(const mapId of ['beacon','stormbreak-annex']){const f=fixture(mapId);for(const location of f.map.roomLayout){const started=performance.now(),before=f.now;f.walk(f.map.geometry.WORLD_STATIONS[location.id]);const nativeMs=performance.now()-started;assert(f.map.geometry.isWalkable(f.view().self.position));assert.equal(f.view().self.moving,false);timings.push({map:mapId,version:1,room:location.id,nativeRouteAndSettleMs:Number(nativeMs.toFixed(3)),simulatedTravelMs:f.now-before});}}t.diagnostic(JSON.stringify({fixture:'Sequential real engine routes, Node timing only; not browser/GPU/render performance',observations:timings}));
});
