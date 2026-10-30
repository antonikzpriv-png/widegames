import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionTrack} from '../public/world/movement.mjs';
import {getMap,PUBLIC_MAP_CATALOG,mapIdentity} from '../shared/maps/index.mjs';
import {normalisePregameDraft} from '../public/pregame-customization.mjs';

function view(speed){
 const position={x:650,y:300};
 return {matchId:'configured-movement',version:1,worldVersion:1,map:{id:'beacon',version:1},phase:'roam',settings:{speed},self:{id:'p15',alive:true,inputSeq:0,moving:false,position},players:[{id:'p15',name:'Same name',color:'#aabbcc',badge:'15',alive:true,position},{id:'p10',name:'Same name',color:'#aabbcc',badge:'10',alive:true,position:{x:660,y:300},role:'saboteur',tasks:[{private:true}]}]};
}

test('independent movement tracks use each watch speed and preserve numbered identity without private actor data',()=>{
 const original=getMap({id:'beacon',version:1}).geometry.WORLD.speed,slow=new MotionTrack(),fast=new MotionTrack();
 slow.update(view(90),0);fast.update(view(300),0);
 for(const track of [slow,fast])assert(track.setIntent({seq:1,dx:1,dy:0},0));
 assert(Math.abs(slow.at('p15',100).x-659)<1e-8);assert(Math.abs(fast.at('p15',100).x-680)<1e-8);
 assert.equal(slow.samples.get('p15').player.badge,'15');assert.equal(fast.samples.get('p10').player.badge,'10');
 assert.equal(fast.samples.get('p10').player.role,undefined);assert.equal(fast.samples.get('p10').player.tasks,undefined);
 assert.equal(getMap({id:'beacon',version:1}).geometry.WORLD.speed,original);
 slow.clear();assert.equal(slow.intent,null);assert.equal(slow.speed,null);assert(Math.abs(fast.at('p15',100).x-680)<1e-8);
});

test('waiting-room drafts retain all current main destinations and distinct Beacon namespaces',()=>{
 assert.equal(PUBLIC_MAP_CATALOG.length,5);
 for(const entry of PUBLIC_MAP_CATALOG){const draft=normalisePregameDraft({mapId:entry.id,settings:{capacity:15,saboteurs:3}});assert.equal(draft.mapId,entry.id);assert.equal(draft.settings.capacity,15);assert.equal(draft.settings.saboteurs,3);}
 assert.notEqual(mapIdentity(getMap('beacon')),mapIdentity(getMap('beacon-illustrated')));
 assert.equal(getMap('beacon').geometry.WORLD.width,3200);
 assert.equal(getMap('beacon-illustrated').geometry.WORLD.width,1600);
});
