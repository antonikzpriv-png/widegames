import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,applyAction,applyInput,tick,getPlayerView,getReplay} from '../server/engine/index.mjs';
const {WORLD,WORLD_STATIONS,worldSpawn,isWalkable,distance}=await import(process.env.WORLD_ENGINE_GEOMETRY_MODULE||'../shared/world.mjs');
const fresh=options=>createMatch({id:'world-engine',seed:'world-core',now:0,world:true,...options});
const actor=(s,id='p1')=>s.players.find(p=>p.id===id);
function accepted(result){assert.equal(result.accepted,true,JSON.stringify(result.error));return result.state;}

test('world opt-in has serializable private motion and legacy shape stays exact',()=>{
 const world=fresh(),legacy=fresh({world:false});assert.equal(world.schemaVersion,2);assert.equal(world.worldVersion,1);assert.deepEqual(world,JSON.parse(JSON.stringify(world)));
 assert.equal(legacy.schemaVersion,1);assert.equal('worldVersion' in legacy,false);assert.equal('position' in actor(legacy),false);
 assert.deepEqual(world.players.map(p=>p.position),world.players.map(p=>worldSpawn(p.id)));
 assert.equal(applyInput(legacy,'p1',{seq:1,dx:1,dy:0},0).error.code,'WORLD_REQUIRED');
 assert.equal('worldVersion' in getPlayerView(legacy,'p1',0),false);
 assert.equal(applyAction(legacy,'p1',{id:'legacy-nav',type:'navigate',x:800,y:300},0).error.code,'INVALID_ACTION');assert.equal(legacy.requests.p1.length,0);
});
test('server speed, normalized diagonal and 600ms lease hold across delayed ticks',()=>{
 const start=fresh(),before=structuredClone(start);let straight=accepted(applyInput(start,'p1',{seq:1,dx:1,dy:0},0));
 assert.deepEqual(start,before);straight=tick(straight,1000).state;
 const diagonal=tick(accepted(applyInput(start,'p1',{seq:1,dx:-1,dy:1},0)),1000).state;
 assert.ok(Math.abs(distance(actor(start).position,actor(straight).position)-108)<1e-6);
 assert.ok(Math.abs(distance(actor(start).position,actor(diagonal).position)-108)<1e-6);
 assert.equal(getPlayerView(straight,'p1',1000).self.moving,false);assert.deepEqual(tick(straight,10000).state.players,straight.players);
});
test('input retransmission cannot extend lease, stale sequence cannot override, requests stay separate',()=>{
 let s=accepted(applyInput(fresh(),'p1',{seq:4,dx:1,dy:0},0));const repeated=applyInput(s,'p1',{seq:4,dx:1,dy:0},400);assert.equal(repeated.duplicate,true);s=repeated.state;
 assert.equal(actor(s).motion.leaseUntil,600);assert.equal(applyInput(s,'p1',{seq:4,dx:-1,dy:0},400).error.code,'INPUT_CONFLICT');assert.equal(applyInput(s,'p1',{seq:3,dx:-1,dy:0},400).error.code,'STALE_INPUT');
 s=tick(JSON.parse(JSON.stringify(s)),1000).state;assert.ok(Math.abs(actor(s).position.x-worldSpawn('p1').x-108)<1e-6);assert.equal(s.requests.p1.length,0);
 for(let seq=5;seq<400;seq++)s=accepted(applyInput(s,'p1',{seq,dx:0,dy:0},1000));assert.equal(s.requests.p1.length,0);assert.equal(getPlayerView(s,'p1',1000).self.inputSeq,399);
});
test('navigate and legacy room move in world route physically rather than teleport',()=>{
 let s=fresh();const target=WORLD_STATIONS.archive,initial=actor(s).position;
 s=accepted(applyAction(s,'p1',{id:'route',type:'move',roomId:'archive'},0));assert.deepEqual(actor(s).position,initial);assert.deepEqual(getPlayerView(s,'p1',0).self.destination,{x:target.x,y:target.y});
 s=tick(s,100).state;assert.ok(distance(initial,actor(s).position)<=18.00001);assert.equal(isWalkable(actor(s).position),true);
 s=tick(s,15000).state;assert.ok(distance(actor(s).position,target)<1e-5);assert.equal(actor(s).roomId,'archive');assert.equal(getPlayerView(s,'p1',15000).self.destination,null);
 let legacy=fresh({world:false});legacy=accepted(applyAction(legacy,'p1',{id:'old',type:'move',roomId:'archive'},0));assert.equal(actor(legacy).roomId,'archive');
});
test('WASD replaces private navigation and forbidden envelopes cannot steer anyone',()=>{
 let s=accepted(applyAction(fresh(),'p1',{id:'nav',type:'navigate',x:WORLD_STATIONS.archive.x,y:WORLD_STATIONS.archive.y},0));
 s=accepted(applyInput(s,'p1',{seq:1,dx:1,dy:0},0));assert.equal(actor(s).motion.path.length,0);assert.equal(getPlayerView(s,'p1',0).self.destination,null);
 for(const input of [null,{}, {seq:0,dx:0,dy:0},{seq:1.5,dx:0,dy:0},{seq:2,dx:.5,dy:0},{seq:2,dx:2,dy:0},{seq:2,dx:0,dy:0,speed:999},{seq:2,dx:0,dy:0,playerId:'p2'}])assert.equal(applyInput(s,'p1',input,0).accepted,false);
 assert.equal(applyInput(s,'unknown',{seq:1,dx:0,dy:0},0).error.code,'INVALID_PLAYER');
});
test('world safe views never expose another actor input, navigation or hidden position',()=>{
 let s=accepted(applyAction(fresh(),'p1',{id:'nav',type:'navigate',x:WORLD_STATIONS.archive.x,y:WORLD_STATIONS.archive.y},0));s=tick(s,15000).state;
 const view=getPlayerView(s,'p1',15000),spectator=getPlayerView(s,null,15000);
 assert.equal(view.worldVersion,1);assert.ok(view.players.filter(p=>p.id!=='p1').every(p=>p.position===null&&p.roomId===null));
 assert.ok(spectator.players.every(p=>p.position));assert.equal(spectator.self,null);assert.equal(getReplay(s),null);
 for(const p of view.players)for(const key of ['motion','inputSeq','destination','path','leaseUntil','role'])assert.equal(key in p,false);
 const original=structuredClone(s);view.self.position.x=0;view.players[0].position=null;assert.deepEqual(s,original);
});
