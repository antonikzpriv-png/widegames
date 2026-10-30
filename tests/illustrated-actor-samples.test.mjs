import test from 'node:test';
import assert from 'node:assert/strict';
import {ActorSamples} from '../public/world/model.mjs';
import {getWorld} from '../shared/world.mjs';

const view=(position,mapRevision=2)=>({mapId:'tidal-observatory',mapRevision,worldVersion:1,phase:'roam',self:null,players:[{id:'p2',name:'Pax',alive:true,position}]});

test('revision-2 actor interpolation holds at a received endpoint across the stepped gallery cutout',()=>{
 const geometry=getWorld('tidal-observatory',2),legacy=getWorld('tidal-observatory'),from={x:2680,y:1245},to={x:2765,y:1320};
 const midpoint={x:(from.x+to.x)/2,y:(from.y+to.y)/2};
 assert(geometry.isWalkable(from));assert(geometry.isWalkable(to));
 assert(!geometry.isWalkable(midpoint),'The straight chord crosses a real clipped room corner');
 assert(!legacy.isWalkable(from),'Using revision 1 would incorrectly take the geometry-free fallback');
 const samples=new ActorSamples(),game=view(from);samples.update(game,0);game.players[0].position=to;samples.update(game,200);
 assert.deepEqual(samples.at('p2',200),from,'A missing route corner cannot become a visual shortcut through the new hull');
 assert.deepEqual(samples.at('p2',300),to,'Latest received coordinates remain authoritative');
 game.players[0].position=null;samples.update(game,350);assert.equal(samples.at('p2',351),null,'Hiding an actor still removes its history immediately');
});

test('switching map revision drops an old coordinate timeline even when map and actor IDs match',()=>{
 const legacy=getWorld('tidal-observatory'),modern=getWorld('tidal-observatory',2),samples=new ActorSamples();
 const first=legacy.worldSpawn('p2'),next=modern.worldSpawn('p2');assert.notDeepEqual(first,next);
 samples.update(view(first,1),0);samples.update(view(next,2),200);
 assert.deepEqual(samples.at('p2',200),next,'The former layout must not blend into the redesigned spawn');
 assert.equal(samples.samples.get('p2').history.length,1,'A new geometry revision starts a new received timeline');
 samples.update(view(first,1),400);assert.deepEqual(samples.at('p2',400),first,'Restoring a legacy recording also resets modern samples');
});
