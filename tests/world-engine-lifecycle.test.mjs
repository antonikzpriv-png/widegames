import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,applyAction,applyInput,tick,getPlayerView,getReplay} from '../server/engine/index.mjs';
const {WORLD,WORLD_STATIONS,WORLD_BELL,worldSpawn,worldRoomAt,isWalkable,findWorldPath,canSeeWorldPoint,distance}=await import(process.env.WORLD_ENGINE_GEOMETRY_MODULE||'../shared/world.mjs');
const rules={moveCooldownMs:1,taskCooldownMs:1,killCooldownMs:1,initialKillCooldownMs:1,sabotageCooldownMs:3,meetingCooldownMs:2,discussionMs:10,votingMs:10,maxMatchMs:300000};
const accept=r=>{assert.equal(r.accepted,true,JSON.stringify(r.error));return r.state;};
function game(config={}){
 let state,serial=0,now=0;for(let seed=0;seed<100;seed++){state=createMatch({id:'world-lifecycle',world:true,seed,now:0,config:{...rules,...config}});if(state.players.find(p=>p.role==='saboteur').id==='p6')break;}
 assert.equal(state.players.find(p=>p.role==='saboteur').id,'p6');
 return {get state(){return state;},set state(s){state=s;},get now(){return now;},set now(n){now=n;},p(id){return state.players.find(p=>p.id===id);},act(id,type,fields={},at=now){now=at;const r=applyAction(state,id,{id:`action_${++serial}`,type,...fields},now);state=r.state;return r;},input(id,seq,dx,dy,at=now){now=at;const r=applyInput(state,id,{seq,dx,dy},now);state=r.state;return r;},tick(at){now=at;state=tick(state,now).state;},travel(id,target){const p=state.players.find(p=>p.id===id),path=findWorldPath(p.position,target);assert.ok(path);let cost=0,last=p.position;for(const q of path){cost+=distance(last,q);last=q;}accept(this.act(id,'navigate',{x:target.x,y:target.y}));this.tick(now+Math.ceil(cost/WORLD.speed*1000)+1);assert.ok(distance(this.p(id).position,target)<.01);}};
}

test('meeting-denied sequence is acknowledged and cannot become movement after council',()=>{
 const g=game();accept(g.input('p2',1,1,0,0));accept(g.act('p2','meeting',{},10));
 const denied=g.input('p2',2,-1,0,11);assert.equal(denied.accepted,false);assert.equal(denied.error.code,'WRONG_PHASE');g.tick(31);assert.equal(g.state.phase,'roam');
 const position=structuredClone(g.p('p2').position),replayed=g.input('p2',2,-1,0,31);assert.equal(replayed.duplicate,true);assert.equal(replayed.accepted,false);assert.equal(replayed.error.code,'WRONG_PHASE');g.tick(1000);assert.deepEqual(g.p('p2').position,position);assert.equal(g.state.requests.p2.length,1);
});

test('manual movement collides with props and outer walls without tunneling',()=>{
 const prop=game();accept(prop.input('p1',1,0,-1,0));prop.tick(1000);assert.ok(isWalkable(prop.p('p1').position));assert.ok(prop.p('p1').position.y>230);assert.ok(prop.p('p1').position.y<272);
 const wall=game();accept(wall.input('p1',1,-1,0,0));wall.tick(600);accept(wall.input('p1',2,-1,0,600));wall.tick(1200);assert.ok(isWalkable(wall.p('p1').position));assert.ok(wall.p('p1').position.x>=600+WORLD.bodyRadius-1e-6);assert.ok(distance(wall.p('p1').position,worldSpawn('p1'))<=216.0001);
});

test('task station and emergency bell require real 92-unit proximity, not room labels',()=>{
 const g=game(),task=g.p('p1').tasks[0],station=WORLD_STATIONS[task.roomId];assert.equal(g.act('p1','task',{taskId:task.id}).accepted,false);
 g.travel('p1',{x:station.x,y:station.y+93});assert.equal(g.act('p1','task',{taskId:task.id}).accepted,false);
 g.travel('p1',{x:station.x,y:station.y+92});accept(g.act('p1','task',{taskId:task.id}));assert.equal(g.p('p1').tasks.find(t=>t.id===task.id).completed,true);assert.equal(g.act('p2','task',{taskId:task.id}).accepted,false);
 const bell=game();bell.travel('p1',{x:WORLD_BELL.x,y:WORLD_BELL.y+93});assert.equal(bell.p('p1').roomId,'bridge');assert.equal(bell.act('p1','meeting').accepted,false);
 bell.travel('p1',{x:WORLD_BELL.x,y:WORLD_BELL.y+92});accept(bell.act('p1','meeting'));assert.equal(bell.state.phase,'discussion');
});

test('two crew must physically reach Engine; public repair events retain no actor',()=>{
 const g=game();accept(g.act('p6','sabotage',{},3));assert.equal(g.act('p1','repair').accepted,false);assert.equal(g.act('p6','repair').accepted,false);
 g.travel('p1',WORLD_STATIONS.engine);accept(g.act('p1','repair'));assert.equal(g.state.sabotage.repairsCompleted,1);assert.equal(g.act('p1','repair').accepted,false);
 g.travel('p2',WORLD_STATIONS.engine);accept(g.act('p2','repair'));assert.equal(g.state.sabotage.active,false);assert.equal(g.state.sabotage.repairsCompleted,2);
 const view=getPlayerView(g.state,'p3',g.now);assert.equal(view.events.filter(e=>e.type==='repair').length,2);assert.ok(view.events.filter(e=>e.type==='repair').every(e=>!('playerId' in e)&&!('position' in e)));assert.equal('repairers' in view.sabotage,false);
});

test('kill radius is 70 and a close target behind a floor wall cannot be eliminated',()=>{
 const near=game();near.travel('p6',{x:worldSpawn('p1').x+71,y:worldSpawn('p1').y});assert.equal(near.act('p6','eliminate',{targetId:'p1'}).accepted,false);
 near.travel('p6',{x:worldSpawn('p1').x+70,y:worldSpawn('p1').y});accept(near.act('p6','eliminate',{targetId:'p1'}));assert.equal(near.p('p1').alive,false);
 const wall=game();wall.travel('p1',{x:425,y:550});wall.travel('p6',{x:460,y:515});assert.ok(distance(wall.p('p1').position,wall.p('p6').position)<70);assert.equal(canSeeWorldPoint(wall.p('p1').position,wall.p('p6').position),false);assert.equal(wall.act('p6','eliminate',{targetId:'p1'}).accepted,false);
});

test('bodies carry death position/time and report requires visibility as well as range',()=>{
 const g=game();g.travel('p1',{x:425,y:550});g.travel('p2',{x:460,y:515});g.travel('p6',{x:425,y:515});const killedAt=g.now;accept(g.act('p6','eliminate',{targetId:'p1'}));
 assert.equal(g.p('p1').alive,false);const remote=getPlayerView(g.state,'p2',g.now);assert.equal(remote.events.some(e=>e.type==='body'||e.type==='witness'),false);assert.equal(remote.players.find(p=>p.id==='p1').position,null);
 const publicBody=getPlayerView(g.state,null,g.now).events.find(e=>e.type==='body');assert.deepEqual(publicBody.position,{x:425,y:550});assert.equal(publicBody.at,killedAt);
 assert.ok(distance(g.p('p2').position,g.p('p1').position)<WORLD.reportRadius);assert.equal(g.act('p2','report',{bodyId:'body-p1'}).accepted,false);
 g.travel('p2',{x:425,y:515});const local=getPlayerView(g.state,'p2',g.now),body=local.events.find(e=>e.type==='body');assert.deepEqual(body.position,{x:425,y:550});assert.equal(body.at,killedAt);assert.ok(g.now>body.at);
 body.position.x=999;assert.deepEqual(g.state.bodies[0].position,{x:425,y:550});accept(g.act('p2','report',{bodyId:'body-p1'}));assert.equal(g.state.phase,'discussion');
 const range=game();accept(range.act('p6','eliminate',{targetId:'p3'},1));const at=range.state.bodies[0].position;range.travel('p2',{x:at.x-131,y:at.y});assert.equal(range.act('p2','report',{bodyId:'body-p3'}).accepted,false);range.travel('p2',{x:at.x-130,y:at.y});accept(range.act('p2','report',{bodyId:'body-p3'}));
});

test('corridor roomId stays last valid room and global navigation resolves the next room',()=>{
 const g=game();g.travel('p1',{x:800,y:420});assert.equal(worldRoomAt(g.p('p1').position),null);assert.equal(g.p('p1').roomId,'bridge');g.travel('p1',WORLD_STATIONS.workshop);assert.equal(g.p('p1').roomId,'workshop');
});

test('deadlines settle only prior roam movement; old navigation never resumes after a meeting',()=>{
 const g=game({roamDeadlineMs:100,discussionMs:50,votingMs:50,maxMatchMs:1000});accept(g.input('p1',1,1,0,0));const original=JSON.parse(JSON.stringify(g.state));g.tick(500);
 let partitioned=original;for(let at=25;at<=500;at+=25)partitioned=tick(partitioned,at).state;assert.deepEqual(g.p('p1').position,partitioned.players.find(p=>p.id==='p1').position);assert.ok(Math.abs(g.p('p1').position.x-worldSpawn('p1').x-18)<1e-6);assert.equal(getPlayerView(g.state,'p1',500).self.moving,false);
 const nav=game();accept(nav.act('p1','navigate',{x:WORLD_STATIONS.archive.x,y:WORLD_STATIONS.archive.y}));accept(nav.act('p2','meeting',{},100));const stopped=structuredClone(nav.p('p1').position);nav.tick(1000);assert.equal(nav.state.phase,'roam');assert.deepEqual(nav.p('p1').position,stopped);assert.equal(nav.p('p1').motion.destination,null);
});

test('critical beats maximum on a tie, while maximum pause and death freeze actual positions',()=>{
 const critical=game({criticalDurationMs:97,maxMatchMs:100});accept(critical.input('p1',1,1,0,0));accept(critical.act('p6','sabotage',{},3));critical.tick(1000);assert.equal(critical.state.outcome.reason,'critical');assert.equal(critical.state.outcome.at,100);assert.ok(Math.abs(critical.p('p1').position.x-worldSpawn('p1').x-18)<1e-6);const endPos=structuredClone(critical.p('p1').position);assert.equal(critical.input('p1',2,1,0,1000).accepted,false);critical.tick(2000);assert.deepEqual(critical.p('p1').position,endPos);
 const paused=game({maxMatchMs:100});accept(paused.input('p1',1,1,0,0));paused.tick(1000);assert.equal(paused.state.phase,'paused');assert.equal(paused.state.outcome,null);assert.equal(getReplay(paused.state),null);assert.ok(Math.abs(paused.p('p1').position.x-worldSpawn('p1').x-18)<1e-6);const pausedPos=structuredClone(paused.p('p1').position);paused.tick(5000);assert.deepEqual(paused.p('p1').position,pausedPos);
 const death=game();accept(death.input('p3',1,-1,0,0));accept(death.act('p6','eliminate',{targetId:'p3'},100));const deathPos=structuredClone(death.p('p3').position);assert.ok(Math.abs(deathPos.x-worldSpawn('p3').x+18)<1e-6);death.tick(2000);assert.deepEqual(death.p('p3').position,deathPos);assert.equal(death.input('p3',2,-1,0).error.code,'PLAYER_DEAD');
});

test('more than 2048 steering packets use bounded latest-sequence state and coarse replay',()=>{
 const g=game();for(let seq=1;seq<=2050;seq++)accept(g.input('p1',seq,1,0,(seq-1)*10));
 assert.equal(g.state.requests.p1.length,0);assert.equal(g.p('p1').motion.seq,2050);assert.ok(g.state.replay.length<40,`Unexpected per-frame replay log: ${g.state.replay.length}`);assert.ok(isWalkable(g.p('p1').position));
 const restored=JSON.parse(JSON.stringify(g.state));g.state=restored;g.tick(g.now+1000);assert.equal(getPlayerView(g.state,'p1',g.now).self.moving,false);assert.equal(g.input('p1',2049,-1,0).error.code,'STALE_INPUT');
});

test('world task, parity, and ejection victories are reachable through physical authoritative actions',()=>{
 const tasks=game({roamDeadlineMs:600000,maxMatchMs:700000});for(const id of ['p1','p2','p3','p4','p5'])while(true){const task=tasks.p(id).tasks.find(t=>!t.completed);if(!task)break;tasks.travel(id,WORLD_STATIONS[task.roomId]);accept(tasks.act(id,'task',{taskId:task.id}));}
 assert.equal(tasks.state.outcome.reason,'tasks');assert.equal(tasks.state.outcome.winner,'crew');assert.ok(getReplay(tasks.state).some(e=>e.type==='motion'));
 const parity=game();for(const id of ['p1','p2','p3','p4']){parity.travel('p6',parity.p(id).position);accept(parity.act('p6','eliminate',{targetId:id}));}assert.equal(parity.state.outcome.reason,'parity');
 const council=game();accept(council.act('p2','meeting',{},2));council.tick(12);for(const p of council.state.players)accept(council.act(p.id,'vote',{targetId:'p6'}));council.tick(22);assert.equal(council.state.outcome.reason,'ejection');assert.ok(getPlayerView(council.state,null,22).players.every(p=>p.role));
});

test('JSON restart resumes only remaining navigation distance and actions settle motion before proximity checks',()=>{
 const g=game(),task=g.p('p1').tasks[0],target=WORLD_STATIONS[task.roomId],route=findWorldPath(g.p('p1').position,target);let length=0,previous=g.p('p1').position;for(const p of route){length+=distance(previous,p);previous=p;}
 accept(g.act('p1','navigate',{x:target.x,y:target.y}));g.tick(100);const saved=JSON.parse(JSON.stringify(g.state)),finish=Math.ceil(length/WORLD.speed*1000)+2;
 const restored=applyAction(saved,'p1',{id:'restart:task',type:'task',taskId:task.id},finish);assert.equal(restored.accepted,true);assert.ok(distance(restored.state.players.find(p=>p.id==='p1').position,target)<.01);
 const uninterrupted=applyAction(g.state,'p1',{id:'restart:task',type:'task',taskId:task.id},finish);assert.deepEqual(restored,uninterrupted);
});

test('invalid navigation and client time/path fields are safely denied without mutation',()=>{
 const g=game();const before=structuredClone(g.state);
 for(const action of [{id:'n1',type:'navigate',x:-100,y:0},{id:'n2',type:'navigate',x:5000,y:5000},{id:'n3',type:'navigate',x:NaN,y:300},{id:'n4',type:'navigate',x:'800',y:300},{id:'n5',type:'navigate',x:800,y:300,path:[]},{id:'n6',type:'navigate',x:800,y:300,position:{x:800,y:300}}])assert.equal(applyAction(g.state,'p1',action,0).accepted,false);
 for(const input of [{seq:Number.MAX_SAFE_INTEGER+1,dx:1,dy:0},{seq:1,dx:1,dy:0,now:1e12},{seq:1,dx:1,dy:0,leaseUntil:1e12},{seq:1,dx:1,dy:0,distance:1e12}])assert.equal(applyInput(g.state,'p1',input,0).error.code,'INVALID_INPUT');
 assert.equal(applyInput(g.state,'p1',{seq:1,dx:1,dy:0},-1).error.code,'INVALID_TIME');assert.deepEqual(g.state,before);
});
