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
 return {map,get state(){return state;},get now(){return now;},view(actor='p1'){return engine.getPlayerView(state,actor,now);},act(actor,type,fields={}){const r=engine.applyAction(state,actor,{id:'quality:'+ ++seq,type,...fields},now);assert.equal(r.accepted,true,JSON.stringify({type,error:r.error}));state=r.state;return r;},tick(at){now=at;state=engine.tick(state,at).state;},walk(target,actor='p1'){this.act(actor,'navigate',{x:target.x,y:target.y});let length=0,last=state.players.find(p=>p.id===actor).position;for(const point of state.players.find(p=>p.id===actor).motion.path){length+=map.geometry.distance(last,point);last=point;}this.tick(now+Math.ceil(length/map.geometry.WORLD.speed*1000)+1);assert(map.geometry.distance(state.players.find(p=>p.id===actor).position,target)<.01);return this.view(actor);}};
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
