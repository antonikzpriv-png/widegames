import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,applyAction,tick,getPlayerView,getReplay} from '../server/engine/index.mjs';
import {ROOM_LAYOUT,DEFAULT_RULES} from '../shared/contracts.mjs';

const fast={moveCooldownMs:2,taskCooldownMs:3,killCooldownMs:7,initialKillCooldownMs:5,sabotageCooldownMs:10,criticalDurationMs:100,discussionMs:10,votingMs:10,meetingCooldownMs:5,roamDeadlineMs:5000,maxMatchMs:10000};
function game(config={}) {
 let state=createMatch({id:'rules',now:0,seed:'engine',config:{...fast,...config}}),serial=0,time=0;
 return {
  get state(){return state;}, get time(){return time;},set time(n){time=n;},
  get sab(){return state.players.find(p=>p.role==='saboteur').id;},
  get crew(){return state.players.filter(p=>p.role==='crew').map(p=>p.id);},
  act(p,type,fields={},expected=true){
   const before=structuredClone(state),r=applyAction(state,p,{id:`a${++serial}`,type,...fields},time);
   assert.deepEqual(state,before,'input state was mutated');
   assert.equal(r.accepted,expected,JSON.stringify(r.error));state=r.state;return r;
  },
  tick(now){const before=structuredClone(state),r=tick(state,now);assert.deepEqual(state,before);state=r.state;time=now;return r;},
  move(p,target){
   const start=state.players.find(q=>q.id===p).roomId;
   const queue=[[start]],seen=new Set([start]); let path;
   while(queue.length){const route=queue.shift(),last=route.at(-1);if(last===target){path=route;break;}for(const n of ROOM_LAYOUT.find(r=>r.id===last).neighbors)if(!seen.has(n)){seen.add(n);queue.push([...route,n]);}}
   for(const roomId of path.slice(1)){time=Math.max(time,state.players.find(q=>q.id===p).cooldowns.moveAt);this.act(p,'move',{roomId});}
  },
  meeting(p=this.crew[0]){time=Math.max(time,state.players.find(q=>q.id===p).cooldowns.meetingAt);this.act(p,'meeting');return state.meeting;},
  voting(){this.tick(state.deadlineAt);},
  tally(){this.tick(state.deadlineAt);},
 };
}

test('all four exact win conditions are reachable through legal actions',async t=>{
 await t.test('crew task victory, role reveal and defensive replay',()=>{
  const g=game();
  for(const id of g.crew){
   while(true){const task=g.state.players.find(p=>p.id===id).tasks.find(t=>!t.completed);if(!task)break;g.move(id,task.roomId);g.time=Math.max(g.time,g.state.players.find(p=>p.id===id).cooldowns.taskAt);g.act(id,'task',{taskId:task.id});}
  }
  assert.deepEqual(g.state.outcome,{winner:'crew',reason:'tasks',at:g.time});
  assert.equal(getPlayerView(g.state,null,g.time).players.filter(p=>p.role==='saboteur').length,1);
  const replay=getReplay(g.state);assert.ok(replay.some(e=>e.type==='role_reveal'));assert.ok(replay.some(e=>e.type==='action'&&e.action.type==='task'));
  replay[0].type='tampered';assert.notEqual(getReplay(g.state)[0].type,'tampered');
  g.act(g.sab,'wait',{},false);
 });
 await t.test('crew ejection at deadline, hidden ballots and no early tally',()=>{
  const g=game();g.meeting();assert.equal(g.state.phase,'discussion');
  g.voting();for(const p of g.state.players)g.act(p.id,'vote',{targetId:g.sab});
  assert.equal(g.state.phase,'voting');assert.equal(getReplay(g.state),null);
  for(const id of [null,...g.crew,g.sab])assert.ok(getPlayerView(g.state,id,g.time).meeting.votes.every(v=>Object.keys(v).join()==='playerId'));
  g.tally();assert.equal(g.state.outcome.reason,'ejection');assert.equal(g.state.outcome.winner,'crew');
  assert.ok(getPlayerView(g.state,null,g.time).events.find(e=>e.type==='vote_result').votes.every(v=>v.targetId===g.sab));
 });
 await t.test('saboteur parity after four eliminations',()=>{
  const g=game();const crew=g.crew;
  for(const victim of crew.slice(0,4)){g.time=Math.max(g.time,g.state.players.find(p=>p.id===g.sab).cooldowns.killAt);g.act(g.sab,'eliminate',{targetId:victim});}
  assert.equal(g.state.outcome.winner,'saboteur');assert.equal(g.state.outcome.reason,'parity');
 });
 await t.test('critical deadline wins and exact-deadline repair is too late',()=>{
  const g=game();g.time=10;g.act(g.sab,'sabotage');const p=g.crew[0];g.move(p,'engine');g.tick(109);assert.equal(g.state.outcome,null);
  g.time=110;g.act(p,'repair',{},false);assert.deepEqual(g.state.outcome,{winner:'saboteur',reason:'critical',at:110});
 });
});

test('critical repairs require two distinct living crew in Engine and honor cooldown',()=>{
 const g=game();g.time=10;g.act(g.sab,'sabotage');
 g.act(g.crew[0],'repair',{},false);g.act(g.sab,'repair',{},false);
 const [a,b]=g.crew;g.move(a,'engine');g.act(a,'repair');g.act(a,'repair',{},false);
 assert.equal(g.state.sabotage.repairsCompleted,1);
 g.move(b,'engine');g.act(b,'repair');assert.equal(g.state.sabotage.active,false);
 assert.equal(getPlayerView(g.state,a,g.time).sabotage.repairsRequired,2);
 assert.ok(!('repairers' in getPlayerView(g.state,a,g.time).sabotage));
 g.act(g.sab,'sabotage',{},false);g.time=20;g.act(g.sab,'sabotage');assert.equal(g.state.sabotage.repairsCompleted,0);
});

test('critical countdown continues through reporting, discussion, and voting',()=>{
 const g=game({criticalDurationMs:15});g.time=10;g.act(g.sab,'sabotage');g.act(g.sab,'eliminate',{targetId:g.crew[0]});
 const reporter=g.crew.find(id=>g.state.players.find(p=>p.id===id).alive);
 g.act(reporter,'meeting',{},false);g.act(reporter,'report',{bodyId:g.state.bodies[0].id});
 assert.equal(g.state.phase,'discussion');g.tick(20);assert.equal(g.state.phase,'voting');g.tick(25);assert.equal(g.state.outcome.reason,'critical');
});

test('body locality, eyewitness knowledge, task transfer, and dead actor restrictions',()=>{
 const g=game();const [victim,remote,witness]=g.crew;g.move(remote,'archive');g.time=5;
 const beforeTasks=getPlayerView(g.state,null,g.time).tasks;g.act(g.sab,'eliminate',{targetId:victim});
 const publicView=getPlayerView(g.state,null,g.time),remoteView=getPlayerView(g.state,remote,g.time),witnessView=getPlayerView(g.state,witness,g.time);
 assert.equal(publicView.events.some(e=>e.type==='witness'),false);assert.equal(remoteView.events.some(e=>e.type==='witness'),false);
 assert.equal(witnessView.events.find(e=>e.type==='witness').playerId,g.sab);
 assert.equal(remoteView.events.some(e=>e.type==='body'),false);assert.equal(witnessView.events.find(e=>e.type==='body').bodyId,`body-${victim}`);
 assert.ok(remoteView.players.filter(p=>p.id!==remote).every(p=>p.roomId===null));
 assert.equal(getPlayerView(g.state,null,g.time).tasks.total,beforeTasks.total);
 assert.equal(g.state.players.find(p=>p.id===victim).tasks.filter(t=>!t.completed).length,0);
 for(const type of ['move','task','eliminate','sabotage','repair','report','meeting','say','vote','wait']){
  const extra={move:{roomId:'archive'},task:{taskId:'t1'},eliminate:{targetId:remote},report:{bodyId:`body-${victim}`},say:{text:'dead'},vote:{targetId:'skip'}}[type]||{};
  assert.equal(g.act(victim,type,extra,false).error.code,'PLAYER_DEAD');
 }
 assert.equal(g.act(remote,'report',{bodyId:`body-${victim}`},false).error.code,'INVALID_BODY');
 g.move(remote,'bridge');g.act(remote,'report',{bodyId:`body-${victim}`});
 assert.equal(g.state.phase,'discussion');assert.ok(g.state.bodies.every(b=>b.reported));
 assert.equal(g.state.meeting.eligibleVoters.includes(victim),false);
});

test('skip plurality, ties, no votes, and missing voters have explicit tally semantics',async t=>{
 for(const kind of ['skip','tie','tie-skip','none','abstain'])await t.test(kind,()=>{
  const g=game();g.meeting();g.voting();const [a,b,c]=g.crew;
  if(kind==='skip'){g.act(a,'vote',{targetId:'skip'});g.act(b,'vote',{targetId:'skip'});g.act(c,'vote',{targetId:g.sab});}
  if(kind==='tie'){g.act(a,'vote',{targetId:g.sab});g.act(b,'vote',{targetId:a});}
  if(kind==='tie-skip'){g.act(a,'vote',{targetId:g.sab});g.act(b,'vote',{targetId:'skip'});}
  if(kind==='abstain')g.act(a,'vote',{targetId:g.sab});
  g.tally();assert.equal(g.state.phase,kind==='abstain'?'ended':'roam');
  if(kind!=='abstain')assert.equal(g.state.players.filter(p=>p.alive).length,6);
 });
});

test('emergency limits, cooldown, discussion limits, invalid ballots and phases',()=>{
 const g=game();const [a,b]=g.crew;
 assert.equal(g.act(a,'meeting',{},false).error.code,'COOLDOWN');
 g.act(a,'say',{text:'early'},false);g.act(a,'vote',{targetId:'skip'},false);
 g.move(b,'archive');g.time=5;g.act(b,'meeting',{},false);
 g.meeting(a);assert.equal(g.state.players.find(p=>p.id===a).meetingsRemaining,0);
 for(const [type,extra] of [['move',{roomId:'archive'}],['task',{taskId:'t1'}],['eliminate',{targetId:b}],['repair',{}],['sabotage',{}],['report',{bodyId:'body-p1'}],['meeting',{}]])assert.equal(g.act(a,type,extra,false).error.code,'WRONG_PHASE');
 g.act(a,'say',{text:' '},false);g.act(a,'say',{text:'x'.repeat(DEFAULT_RULES.messageMaxLength+1)},false);g.act(a,'say',{text:'bad\u0000text'},false);
 for(let i=0;i<3;i++){const r=g.act(a,'say',{text:'  Evidence <b>only</b>  '});assert.equal(r.events.at(-1).type,'said');}
 assert.equal(g.act(a,'say',{text:'fourth'},false).error.code,'MESSAGE_LIMIT');
 assert.equal(g.state.meeting.messages[0].text,'Evidence <b>only</b>');
 g.voting();g.act(a,'vote',{targetId:'p999'},false);g.act(a,'vote',{targetId:'skip'});assert.equal(g.act(a,'vote',{targetId:g.sab},false).error.code,'ALREADY_VOTED');
 g.act(a,'say',{text:'late'},false);g.tally();g.act(a,'meeting',{},false);g.move(b,'bridge');
 assert.equal(g.act(b,'meeting',{},false).error.code,'COOLDOWN');g.time=g.state.players.find(p=>p.id===b).cooldowns.meetingAt;g.act(b,'meeting');
});

test('movement, task ownership, role restrictions, elimination locality and cooldowns',()=>{
 const g=game();const [a,b]=g.crew;
 g.act(a,'move',{roomId:'engine'},false);g.act(a,'move',{roomId:'bridge'},false);g.act(a,'move',{roomId:'archive'});
 assert.equal(g.act(a,'move',{roomId:'bridge'},false).error.code,'COOLDOWN');
 g.time=2;g.act(a,'move',{roomId:'bridge'});
 g.act(a,'task',{taskId:g.state.players.find(p=>p.id===b).tasks[0].id},false);
 g.act(g.sab,'task',{taskId:g.state.players.find(p=>p.id===a).tasks[0].id},false);
 const task=g.state.players.find(p=>p.id===a).tasks[0];g.move(a,task.roomId);g.act(a,'task',{taskId:task.id});g.act(a,'task',{taskId:task.id},false);
 g.act(a,'sabotage',{},false);g.act(a,'eliminate',{targetId:b},false);g.act(g.sab,'eliminate',{targetId:g.sab},false);
 const remote=g.crew.find(id=>g.state.players.find(p=>p.id===id).roomId!=='bridge');if(remote)g.act(g.sab,'eliminate',{targetId:remote},false);
 g.time=Math.max(g.time,5);g.act(g.sab,'eliminate',{targetId:b});g.act(g.sab,'eliminate',{targetId:b},false);
 const alive=g.crew.find(id=>id!==b&&g.state.players.find(p=>p.id===id).roomId==='bridge');assert.equal(g.act(g.sab,'eliminate',{targetId:alive},false).error.code,'COOLDOWN');
});

test('deadline processing is chronological, deterministic and independent of browsers',()=>{
 const g=game({roamDeadlineMs:30,maxMatchMs:160});
 g.tick(29);assert.equal(g.state.phase,'roam');g.tick(30);assert.equal(g.state.phase,'discussion');assert.equal(g.state.meeting.reason,'timeout');
 g.time=40;assert.equal(g.act(g.crew[0],'say',{text:'late'},false).error.code,'WRONG_PHASE');assert.equal(g.state.phase,'voting');
 g.time=50;g.act(g.crew[0],'vote',{targetId:'skip'},false);assert.equal(g.state.phase,'roam');
 const starting=createMatch({id:'late',now:0,seed:'s',config:{...fast,roamDeadlineMs:30,maxMatchMs:160}});
 const bulk=tick(starting,160).state;let iterative=starting;for(let t=1;t<=160;t++)iterative=tick(iterative,t).state;
 assert.deepEqual(bulk.events,iterative.events);assert.equal(bulk.phase,'paused');assert.equal(bulk.outcome,null);
 assert.equal(getReplay(bulk),null);assert.equal(getPlayerView(bulk,null,160).availableActions.length,0);
 assert.ok(bulk.events.some(e=>e.type==='paused'&&e.reason==='maximum_duration'));
 assert.equal(tick(bulk,170).state,bulk);
});

test('safe views have exactly frozen fields, immutable copies, and private event boundaries',()=>{
 const g=game();g.move(g.crew[0],'archive');
 const expected=['matchId','version','phase','serverNow','deadlineAt','rooms','players','self','tasks','sabotage','meeting','outcome','events','availableActions'].sort();
 for(const id of [null,...g.crew,g.sab]){
  const view=getPlayerView(g.state,id,g.time);assert.deepEqual(Object.keys(view).sort(),expected);
  assert.ok(view.players.every(p=>!Object.hasOwn(p,'role')&&!Object.hasOwn(p,'tasks')&&!Object.hasOwn(p,'human')));
  const encoded=JSON.stringify(view);for(const name of ['requests','fingerprint','replay','schemaVersion','repairers','visibleTo'])assert.equal(encoded.includes(`"${name}"`),false);
  if(id){assert.equal(view.self.id,id);assert.equal(view.self.role,g.state.players.find(p=>p.id===id).role);}
  view.players[0].name='mutated';view.rooms[0].neighbors.length=0;if(view.self)view.self.tasks.length=0;
 }
 assert.notEqual(g.state.players[0].name,'mutated');assert.ok(getPlayerView(g.state,null,0).rooms[0].neighbors.length>0);
 assert.equal(getPlayerView(g.state,'unknown',0).self,null);
});

test('strict envelopes, bounded replay/idempotency, actor isolation, persisted denial results',()=>{
 let s=createMatch({id:'strict',now:0,seed:'s'});
 for(const action of [null,[],1,{}, {id:'x',type:'move'}, {id:'x',type:'wait',playerId:'p2'}, {id:'x',type:'wait',roomId:'bridge'}, {id:'x',type:'constructor'}, {id:'x',type:'move',roomId:2}, {id:'x'.repeat(101),type:'wait'}, {id:'x',type:'say',text:'x'.repeat(2001)}, JSON.parse('{"id":"x","type":"wait","__proto__":{}}')]){
  const r=applyAction(s,'p1',action,0);assert.equal(r.accepted,false);assert.equal(r.error.code,'INVALID_ACTION');assert.equal(r.state,s);
 }
 assert.equal(applyAction(s,'__proto__',{id:'x',type:'wait'},0).error.code,'INVALID_PLAYER');
 const denied=applyAction(s,'p1',{id:'denied',type:'move',roomId:'engine'},0);s=denied.state;assert.equal(denied.accepted,false);
 const repeated=applyAction(JSON.parse(JSON.stringify(s)),'p1',{id:'denied',type:'move',roomId:'engine'},1);assert.equal(repeated.duplicate,true);assert.deepEqual(repeated.error,denied.error);
 const own=applyAction(s,'p1',{id:'same',type:'move',roomId:'archive'},0);s=own.state;
 const other=applyAction(s,'p2',{id:'same',type:'move',roomId:'lantern'},0);s=other.state;assert.equal(other.accepted,true);
 assert.equal(s.players.find(p=>p.id==='p1').roomId,'archive');assert.equal(s.players.find(p=>p.id==='p2').roomId,'lantern');
 for(let i=0;i<300;i++)s=applyAction(s,'p1',{id:`wait${i}`,type:'wait'},0).state;
 assert.equal(s.requests.p1.length,302);assert.equal(s.requests.p2.length,1);
 const before=s.version;const d=applyAction(s,'p1',{id:'wait299',type:'wait'},0);assert.equal(d.state.version,before);assert.equal(d.duplicate,true);
 assert.equal(tick(s,1).state,s);assert.equal(applyAction(s,'p1',{id:'badtime',type:'wait'},-1).error.code,'INVALID_TIME');
});

test('create options reject unknown or unsafe rules and production roles ignore public ID',()=>{
 for(const options of [{id:''},{id:'x',mode:'other'},{id:'x',humanPlayerId:'p2'},{id:'x',now:NaN},{id:'x',config:{moveCooldownMs:0}},{id:'x',config:{unknown:5}},{id:'x',config:{tasksPerCrew:21}},{id:'x',seed:{}}])assert.throws(()=>createMatch(options),TypeError);
 const roles=new Set();for(let i=0;i<60;i++)roles.add(createMatch({id:'public-id',now:0}).players.find(p=>p.role==='saboteur').id);assert.ok(roles.size>1);
 assert.equal(createMatch({id:'s',mode:'spectator',now:0}).players.some(p=>p.human),false);
 assert.deepEqual(createMatch({id:'s',now:0}).players.filter(p=>p.human).map(p=>p.id),['p1']);
});

test('a maximum duration pause never exposes untallied ballots',()=>{
 const g=game({maxMatchMs:22});g.meeting();g.voting();g.act(g.crew[0],'vote',{targetId:g.sab});g.tick(22);
 assert.equal(g.state.phase,'paused');assert.equal(getReplay(g.state),null);
 for(const id of [null,...g.crew,g.sab]){
  const meeting=getPlayerView(g.state,id,22).meeting;
  assert.deepEqual(meeting.votes,[{playerId:g.crew[0]}]);assert.equal(Object.hasOwn(meeting,'tallied'),false);
 }
});

test('task IDs are opaque and do not disclose role assignment order',()=>{
 const s=createMatch({id:'opaque',now:0,seed:'engine'});
 const tasks=s.players.flatMap(p=>p.tasks);
 assert.equal(new Set(tasks.map(t=>t.id)).size,tasks.length);
 assert.ok(tasks.every(t=>/^t[a-f0-9]{20}$/.test(t.id)));
 assert.deepEqual(tasks,createMatch({id:'other-public-id',now:0,seed:'engine'}).players.flatMap(p=>p.tasks));
});

test('simultaneous terminal deadlines have deterministic precedence',()=>{
 const g=game({maxMatchMs:110,criticalDurationMs:100});g.time=10;g.act(g.sab,'sabotage');g.tick(110);
 assert.equal(g.state.outcome.reason,'critical');assert.equal(g.state.outcome.at,110);
 const h=game({maxMatchMs:30,roamDeadlineMs:30});h.tick(30);
 assert.equal(h.state.phase,'paused');assert.equal(h.state.meeting,null);assert.equal(h.state.outcome,null);
});

test('bounded replay retains final reveal and public history stays bounded',()=>{
 let s=createMatch({id:'bounded',now:0,seed:'s'});
 // Restored large log exercises the real append/trim path without quadratic setup.
 s.replay=Array.from({length:12000},(_,i)=>({id:`r${i+1}`,type:'action',at:0,playerId:'p1',action:{id:`w${i}`,type:'wait'}}));s.replaySequence=12000;
 s.events=Array.from({length:256},(_,i)=>({id:`e${i+1}`,type:'started',at:0}));s.sequence=256;
 const sab=s.players.find(p=>p.role==='saboteur').id;
 s=applyAction(s,sab,{id:'sabotage',type:'sabotage'},65000).state;
 assert.equal(s.replay.length,12000);assert.equal(s.events.length,256);
 s=tick(s,140000).state;
 const replay=getReplay(s);assert.equal(replay.length,12000);assert.equal(replay.at(-1).type,'role_reveal');
 assert.ok(getPlayerView(s,null,140000).events.length<=256);
});

test('single-character configured discussion limits preserve accurate action hints',()=>{
 const g=game({messageMaxLength:1});g.meeting();const p=g.crew[0];
 assert.ok(getPlayerView(g.state,p,g.time).availableActions.includes('say'));
 g.act(p,'say',{text:'x'});
});

test('ejecting crew can lose at parity and transferred tasks remain finishable',()=>{
 const g=game();const crew=g.crew;for(const victim of crew.slice(0,3)){g.time=Math.max(g.time,g.state.players.find(p=>p.id===g.sab).cooldowns.killAt);g.act(g.sab,'eliminate',{targetId:victim});}
 const voter=crew[3],ejected=crew[4];g.meeting(voter);g.voting();g.act(voter,'vote',{targetId:ejected});g.tally();
 assert.deepEqual(g.state.outcome,{winner:'saboteur',reason:'parity',at:g.time});
 const h=game();h.time=5;h.act(h.sab,'eliminate',{targetId:h.crew[0]});
 for(const id of h.crew.filter(id=>h.state.players.find(p=>p.id===id).alive)){
  while(true){const task=h.state.players.find(p=>p.id===id).tasks.find(t=>!t.completed);if(!task)break;h.move(id,task.roomId);h.time=Math.max(h.time,h.state.players.find(p=>p.id===id).cooldowns.taskAt);h.act(id,'task',{taskId:task.id});}
 }
 assert.equal(h.state.outcome.reason,'tasks');assert.deepEqual(getPlayerView(h.state,null,h.time).tasks,{completed:15,total:15});
});

test('action hints refresh as cooldowns expire without state changes',()=>{
 const g=game();const p=g.crew[0];g.act(p,'move',{roomId:'archive'});
 assert.equal(getPlayerView(g.state,p,0).availableActions.includes('move'),false);
 assert.equal(getPlayerView(g.state,p,2).availableActions.includes('move'),true);
 assert.equal(getPlayerView(g.state,g.sab,4).availableActions.includes('eliminate'),false);
 assert.equal(getPlayerView(g.state,g.sab,5).availableActions.includes('eliminate'),true);
});
