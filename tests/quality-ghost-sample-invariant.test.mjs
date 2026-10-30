import test from 'node:test';
import assert from 'node:assert/strict';
import {ActorSamples} from '../public/world/model.mjs';
import {MotionTrack} from '../public/world/movement.mjs';
import {getMap} from '../shared/maps/index.mjs';
const map=getMap({id:'beacon',version:1}),position=map.geometry.worldSpawn('p1');
test('authoritative ghost samples retain the shared received-history structure across updates',()=>{
 const samples=new ActorSamples({world:true}),game={matchId:'ghost-samples',map:{id:'beacon',version:1},worldVersion:1,version:1,phase:'roam',self:{id:'p1',alive:false,ghost:true,position:{...position}},players:[{id:'p1',alive:false,position:{...position}}],events:[]};
 for(const at of [0,100,200]){game.version++;samples.update(game,at);const sample=samples.samples.get('p1');assert.equal(sample.receivedAt,at);assert.equal(sample.history.length,1);assert.deepEqual(sample.history[0].position,position);assert.deepEqual(samples.at('p1',at),position);}
 samples.clear();assert.equal(samples.samples.size,0);
});
test('a held sample without historical entries cannot crash the next received frame',()=>{
 const track=new MotionTrack({timelineDelayMs:100}),game={matchId:'held-sample',map:{id:'beacon',version:1},worldVersion:1,version:1,phase:'roam',self:null,players:[{id:'p1',alive:true,position:{...position}}]};
 track.update(game,0);track.samples.set('p1',{from:{...position},to:{...position},at:0,player:{id:'p1'}});game.version++;game.players[0].position.x+=10;
 assert.doesNotThrow(()=>track.update(game,100));assert(track.samples.get('p1').history.length<=8);assert(map.geometry.isWalkable(track.at('p1',200)));
});
