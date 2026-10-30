import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldScene} from '../public/world/scene.mjs';
import * as world from '../shared/world.mjs';

function surface({bitmap=false,playback=false}={}){
 const calls=[],staticCalls=[],gradient={addColorStop(){}};
 const context=trace=>new Proxy({}, {get:(_,key)=>String(key).startsWith('create')?(...args)=>{trace.push([key,...args]);return gradient;}:(...args)=>trace.push([key,...args]),set:()=>true});
 const ctx=context(calls),image={getContext:()=>context(staticCalls)};
 const canvas={dataset:{},getContext:()=>ctx,getBoundingClientRect:()=>({left:13,top:27,width:900,height:700}),...(bitmap?{ownerDocument:{createElement:()=>image}}:{})};
 const scene=createWorldScene(canvas,{reduced:true,playback});
 const view={roomId:'room-one',game:{matchId:'watch-one',phase:'roam',self:null,players:[{id:'p1',name:'Iona',color:'#abc',alive:true,position:{x:720,y:300}}],events:[{type:'body',bodyId:'body-one',playerId:'p2',position:{x:700,y:750}}],effects:[{id:'effect-one',kind:'echo',position:{x:920,y:760}}]}};
 scene.update(view,0);
 return {scene,view,canvas,calls,staticCalls,image,click(point){const screen=scene.worldToScreen(point);return scene.pick(screen.x,screen.y);}};
}

test('free spectator camera crosses walls locally, clamps only world extent and preserves match coordinates',()=>{
 const f=surface(),original=structuredClone(f.view);
 try{
  const camera={x:780,y:200};assert.equal(world.isWalkable(camera),false);
  f.scene.draw(10,{camera,spectatorGhost:true});
  assert.deepEqual(f.scene.getCamera(),camera);assert.equal(f.canvas.dataset.cameraMode,'free');
  assert.deepEqual(f.view,original);
  f.scene.draw(20,{camera:{x:-200,y:1600},spectatorGhost:true});assert.deepEqual(f.scene.getCamera(),{x:0,y:1200});
  const point={x:500,y:710},screen=f.scene.worldToScreen(point);assert.deepEqual(f.scene.screenToWorld(screen.x,screen.y),point);
 }finally{f.scene.dispose();}
});

test('spectator map picks drawn agents and typed interactive scenery without reading hidden actors',()=>{
 const f=surface();
 try{
  f.scene.draw(10,{overview:true});
  assert.deepEqual(f.click({x:720,y:280}),{type:'player',id:'p1'});
  assert.deepEqual(f.click(world.WORLD_STATIONS.engine),{type:'station',id:'station-engine',roomId:'engine'});
  assert.deepEqual(f.click(world.WORLD_BELL),{type:'bell',id:'bell',roomId:'bridge'});
  assert.deepEqual(f.click({x:780,y:190}),{type:'prop',id:'chart-table',roomId:'bridge'});
  assert.deepEqual(f.click({x:700,y:750}),{type:'body',id:'body-one',playerId:'p2'});
  assert.deepEqual(f.click({x:920,y:760}),{type:'effect',id:'effect-one',kind:'echo'});
  assert.deepEqual(f.click({x:100,y:400}),{type:'room',id:'archive',roomId:'archive'});
  assert.equal(f.click({x:30,y:600}),null);
  // A stale painted position is no longer pickable as soon as the safe view hides it.
  f.view.game.players[0].position=null;f.scene.update(f.view,20);
  assert.notEqual(f.click({x:720,y:280})?.type,'player');
  assert.equal(f.scene.pick(-100,-100),null);
 }finally{f.scene.dispose();}
 assert.equal(f.scene.pick(450,350),null);assert.equal(f.scene.screenToWorld(450,350),null);
});

test('replay keeps gameplay conversion disabled while allowing readonly scenery inspection',()=>{
 const f=surface({playback:true});
 try{f.scene.draw(10,{overview:true});const screen=f.scene.worldToScreen({x:720,y:280});assert.equal(f.scene.toWorld(screen.x,screen.y),null);assert.deepEqual(f.scene.pick(screen.x,screen.y),{type:'player',id:'p1'});}finally{f.scene.dispose();}
});

test('static map is rasterized once and shared while actors and signal overlays redraw',()=>{
 const f=surface({bitmap:true});
 try{
  f.scene.draw(10,{overview:true});const built=f.staticCalls.length;
  assert(built>100,'original room and doorway illustration is retained in the cached bitmap');
  assert(f.calls.some(([method,image])=>method==='drawImage'&&image===f.image));
  f.view.game.players[0].position={x:900,y:500};f.scene.update(f.view,20);f.scene.draw(20,{overview:true});
  assert.equal(f.staticCalls.length,built,'the map is not repainted on each animation frame');
  assert.deepEqual(f.click({x:900,y:480}),{type:'player',id:'p1'});
  const minimap=surface({bitmap:true});try{minimap.scene.draw(30,{overview:true});assert.equal(minimap.staticCalls.length,0,'another scene reuses the same immutable map');assert(minimap.calls.some(([method,image])=>method==='drawImage'&&image===f.image));}finally{minimap.scene.dispose();}
 }finally{f.scene.dispose();}
});


test('human visibility mask and task glow reuse cached rasters across movement frames',()=>{
 const f=surface({bitmap:true});f.view.game.self={...f.view.game.players[0],tasks:[{roomId:'bridge',completed:false}]};
 try{
  f.scene.update(f.view,0);f.scene.draw(10);
  const built=f.staticCalls.length;assert(f.staticCalls.some(([method,...args])=>method==='createRadialGradient'&&args[0]===world.WORLD.visibilityRadius));
  assert.equal(f.calls.filter(([method])=>method==='drawImage').length,3,'map, task glow and same-radius visibility mask are rasterized independently');
  assert.equal(f.calls.filter(([method])=>method==='createRadialGradient').length,0,'the expensive fog gradient stays off the animation canvas');
  f.view.game.self.position={x:730,y:300};f.view.game.players[0].position={x:730,y:300};f.scene.update(f.view,20);f.scene.draw(20);
  assert.equal(f.staticCalls.length,built,'movement does not rebuild task shadows or visibility gradient');
 }finally{f.scene.dispose();}
});
