import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createWorldScene} from '../public/world/scene.mjs';
import {getMap} from '../shared/maps/index.mjs';
import {followCamera} from '../public/world/camera.mjs';
import {environmentPlan,paintEnvironment} from '../public/world/environment.mjs';
import {createStaticLayer} from '../public/world/static-layer.mjs';
const root=new URL('../',import.meta.url);
function surface(width=390,height=844,counts={calls:0}){
 const ctx=new Proxy({}, {get:(target,key)=>key in target?target[key]:(...args)=>{counts.calls++;if(String(key).startsWith('create'))return {addColorStop(){counts.calls++;}};},set:(target,key,value)=>{target[key]=value;counts.calls++;return true;}});
 return {width,height,getContext:()=>ctx,getBoundingClientRect:()=>({width,height,left:0,top:0}),counts};
}
function view(map){const p=map.geometry.WORLD_VIEWPOINT,self={id:'custom-self',alive:true,role:'crew',roomId:map.geometry.WORLD_SPAWN_ROOM,position:{...p},tasks:[],inputSeq:1};return {roomId:'render-fixture',map:{id:map.id,version:map.version},game:{matchId:'render-match',beaconVersion:1,phase:'roam',map:{id:map.id,version:map.version},self,players:[{...self,name:'Safe keeper',color:'#eab66c',status:'alive'}],vision:{origin:{...p},radius:360},systems:{doors:[],lights:{active:false},communications:{active:false}},events:[],interactions:[]}};}

test('time-based camera has the same elapsed response at30/60/120Hz and bounds resume',()=>{
 const run=rate=>{let at={x:0,y:0};for(let i=0;i<rate;i++)at=followCamera(at,{x:100,y:200},1000/rate);return at;};
 for(const rate of [30,120]){assert(Math.abs(run(rate).x-run(60).x)<1e-9);assert(Math.abs(run(rate).y-run(60).y)<1e-9);}
 assert.deepEqual(followCamera({x:0,y:0},{x:10,y:20},50000),followCamera({x:0,y:0},{x:10,y:20},100));assert.deepEqual(followCamera({x:0,y:0},{x:10,y:20},1,true),{x:10,y:20});
});

test('environment solids follow real colliders and reject invented blocking props',()=>{
 for(const map of [getMap({id:'beacon',version:1}),getMap('stormbreak-annex')]){
  const room=map.geometry.WORLD_ROOMS[0],invalid={id:'unbacked-solid',kind:'crate',x:room.x+40,y:room.y+140,width:20,height:20,solid:true};
  const candidate={...map,art:{rooms:{[room.id]:{theme:'bridge',props:[invalid]}}}},plan=environmentPlan(candidate);
  assert(!plan.props.some(p=>p.id===invalid.id));for(const prop of plan.props.filter(p=>p.solid))assert(map.geometry.WORLD_OBSTACLES.some(o=>['x','y','width','height'].every(k=>o[k]===prop[k])));
  assert(plan.thresholds.length>0);assert.equal(environmentPlan(candidate),plan,'immutable descriptor plan is reused');
 }
});

test('static cache is bounded, warm-reused, map-scoped and released on disposal',()=>{
 const map=getMap(),counts={calls:0},cache=createStaticLayer({paint:paintEnvironment,makeCanvas:(w,h)=>surface(w,h,counts),maxTiles:8}),ctx=surface().getContext('2d'),bounds={x:600,y:100,width:400,height:400};
 cache.draw(ctx,map,bounds);const first=cache.stats();assert(first.builds>0);const commands=counts.calls;cache.draw(ctx,map,bounds);assert.equal(cache.stats().builds,first.builds);assert.equal(counts.calls,commands);
 for(let i=0;i<20;i++)cache.draw(ctx,map,{x:i*60,y:i*30,width:200,height:200});assert(cache.stats().tiles<=8);assert(cache.stats().bytes<=8*256*256*4);
 const before=cache.stats().builds;cache.draw(ctx,getMap('stormbreak-annex'),bounds);assert(cache.stats().builds>before);cache.dispose();assert.equal(cache.stats().bytes,0);
});

test('measured actual draw dispatch vs frozen941e baseline, not FPS or native pixel performance',async()=>{
 let source=execFileSync('git',['show','941e857f046ef7cc9bae25f0fcad27cf6ab7578a:public/world/scene.mjs'],{cwd:fileURLToPath(root),encoding:'utf8'});
 source=source.replace(/from '([^']+)'/g,(_,path)=>`from '${new URL(path,new URL('public/world/scene.mjs',root))}'`);
 const baseline=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),map=getMap({id:'beacon',version:1}),saved=globalThis.OffscreenCanvas,measure=[];
 try{
  for(const [width,height]of [[320,740],[390,844],[1440,1000]])for(const [label,create]of [['baseline',baseline.createWorldScene],['candidate',createWorldScene]]){
   const counts={calls:0};globalThis.OffscreenCanvas=class{constructor(w,h){Object.assign(this,surface(w,h,counts));}};
   const canvas=surface(width,height,counts),scene=create(canvas,{reduced:true});scene.update(view(map),0);for(let i=0;i<3;i++)scene.draw(i*16.67);const warm=counts.calls,built=scene.stats?.().builds,start=performance.now();for(let i=3;i<123;i++)scene.draw(i*16.67);const elapsed=performance.now()-start,commands=counts.calls-warm,stats=scene.stats?.();
   if(stats){assert.equal(stats.builds,built,'stationary warm camera must not rebuild tiles');assert(stats.bytes<=8*1024*1024);}
   measure.push({label,width,height,frames:120,commands,dispatchMs:elapsed,cache:stats||null});scene.dispose();
  }
 }finally{if(saved===undefined)delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas=saved;}
 for(const width of [320,390,1440]){const a=measure.find(m=>m.width===width&&m.label==='baseline'),b=measure.find(m=>m.width===width&&m.label==='candidate');assert(b.commands<a.commands*.65,'actual command reduction at '+width);}
 const output=new URL('_artifacts/quality-client-20261030/render-benchmark.json',root);mkdirSync(new URL('.',output),{recursive:true});writeFileSync(output,JSON.stringify({baselineCommit:'941e857f046ef7cc9bae25f0fcad27cf6ab7578a',candidateSha256:createHash('sha256').update(readFileSync(new URL('public/world/scene.mjs',root))).digest('hex'),measure,limits:'Actual JS canvas command dispatch with counting surfaces; no GPU/native paint or FPS/mobile hardware claim.'},null,2));
});
