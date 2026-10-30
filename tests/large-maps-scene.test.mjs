import test from 'node:test';
import assert from 'node:assert/strict';
import {getWorld} from '../shared/world.mjs';
import {createWorldScene} from '../public/world/scene.mjs';

function canvasFixture(){
 const labels=[],rects=[];
 const gradient=()=>({addColorStop(){}});
 const ctx=new Proxy({fillText:(value)=>labels.push(value),roundRect:(...args)=>rects.push(args),createLinearGradient:gradient,createRadialGradient:gradient},{get:(target,key)=>key in target?target[key]:()=>{}});
 const canvas={width:0,height:0,getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})};
 return {canvas,labels,rects};
}
function spectatorRoom(mapId){return {roomId:'scene-'+mapId,game:{mapId,matchId:'scene',phase:'roam',players:[],self:null,events:[],effects:[],tasks:{total:60,completed:0}}};}

test('each large-map overview uses its actual dimensions, names and collision prop footprints',()=>{
 for(const mapId of ['storm-foundry','tidal-observatory']){
  const geometry=getWorld(mapId),fixture=canvasFixture(),scene=createWorldScene(fixture.canvas,{reduced:true});
  scene.update(spectatorRoom(mapId),0);scene.draw(0,{overview:true});
  assert.deepEqual(scene.toWorld(400,300),{x:geometry.WORLD.width/2,y:geometry.WORLD.height/2});
  for(const room of geometry.WORLD_ROOMS)assert.equal(fixture.labels.filter(label=>label===room.name.toUpperCase()).length,1,room.name+' should be labeled exactly once');
  for(const prop of geometry.WORLD_OBSTACLES)assert(fixture.rects.some(([x,y,w,h])=>x===prop.x&&y===prop.y&&w===prop.width&&h===prop.height),prop.id+' should be illustrated at its collider');
  scene.dispose();
 }
});

test('two concurrent map canvases retain independent geometry and overview cameras',()=>{
 const a=createWorldScene(canvasFixture().canvas,{reduced:true}),b=createWorldScene(canvasFixture().canvas,{reduced:true});
 a.update(spectatorRoom('storm-foundry'),0);b.update(spectatorRoom('tidal-observatory'),0);
 a.draw(0,{overview:true});b.draw(0,{overview:true});a.draw(100,{overview:true});
 assert.deepEqual(a.toWorld(400,300),{x:1500,y:1100});assert.deepEqual(b.toWorld(400,300),{x:1600,y:1250});a.dispose();b.dispose();
});
