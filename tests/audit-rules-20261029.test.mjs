/** Fresh bounded audit at 0842a009. Real engine; provider I/O is offline mocked. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,applyAction,tick,getPlayerView,getReplay} from '../server/engine/index.mjs';
import {ROOM_LAYOUT,CHARACTERS} from '../shared/contracts.mjs';
import {candidates,observe} from '../server/ai/demo.mjs';
import {makeRequest,send} from '../server/ai/anthropic.mjs';

const fast={moveCooldownMs:1,taskCooldownMs:2,killCooldownMs:3,initialKillCooldownMs:1,sabotageCooldownMs:3,criticalDurationMs:17,discussionMs:7,votingMs:5,meetingCooldownMs:2,roamDeadlineMs:37,maxMatchMs:350};
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;};
const world=state=>{const copy=structuredClone(state);delete copy.version;delete copy.updatedAt;delete copy.requests;return copy;};
function fixture(config={},seed='audit-rules'){
 let state=createMatch({id:'audit-rules-20261029',seed,now:0,config:{...fast,...config}}),serial=0;
 return {get state(){return state;},set state(next){state=next;},act(playerId,type,fields={},now=0){const result=applyAction(state,playerId,{id:`fixture_${++serial}`,type,...fields},now);assert.equal(result.accepted,true,JSON.stringify(result.error));state=result.state;return result;},tick(now){state=tick(state,now).state;},get sab(){return state.players.find(p=>p.role==='saboteur').id;},get crew(){return state.players.filter(p=>p.role==='crew').map(p=>p.id);}};
}
function invariant(before,after,initialTaskIds){
 assert.deepEqual(after,JSON.parse(JSON.stringify(after)),'State lost JSON round-trip');
 assert.equal(after.players.length,6);assert.equal(after.players.filter(p=>p.role==='saboteur').length,1);
 assert.equal(new Set(after.players.map(p=>p.id)).size,6);
 const tasks=after.players.flatMap(p=>p.tasks);assert.deepEqual(tasks.map(t=>t.id).sort(),initialTaskIds);assert.equal(new Set(tasks.map(t=>t.id)).size,tasks.length);
 assert.ok(tasks.filter(t=>t.completed).length>=before.players.flatMap(p=>p.tasks).filter(t=>t.completed).length);
 for(const player of after.players){const prior=before.players.find(p=>p.id===player.id);assert.equal(player.role,prior.role);if(!prior.alive)assert.equal(player.alive,false);assert.ok(ROOM_LAYOUT.some(r=>r.id===player.roomId));if(!player.alive)assert.ok(player.tasks.every(t=>t.completed));if(player.role==='saboteur')assert.equal(player.tasks.length,0);assert.ok(after.requests[player.id].length<=2048);}
 if(after.sabotage){assert.equal(after.sabotage.repairsCompleted,after.sabotage.repairers.length);assert.equal(new Set(after.sabotage.repairers).size,after.sabotage.repairers.length);assert.ok(after.sabotage.repairsCompleted<=2);}
 assert.ok(after.version>=before.version);if(JSON.stringify(after)!==JSON.stringify(before))assert.ok(after.version>before.version);
 assert.ok(after.events.length<=256);assert.ok(after.replay.length<=12000);
 if(after.phase==='ended'){
  assert.ok(['tasks','ejection','parity','critical'].includes(after.outcome.reason));assert.equal(after.deadlineAt,null);
  if(after.outcome.reason==='tasks')assert.ok(tasks.every(t=>t.completed));
  if(after.outcome.reason==='ejection')assert.ok(after.players.filter(p=>p.role==='saboteur').every(p=>!p.alive));
  if(after.outcome.reason==='parity')assert.ok(after.players.filter(p=>p.alive&&p.role==='crew').length<=1);
 }else assert.equal(after.outcome,null);
 if(['ended','paused'].includes(before.phase)){assert.equal(after.phase,before.phase);assert.deepEqual(world(after),world(before),'Terminal game world changed');}
}
function poison(value){if(Array.isArray(value)){for(const item of value)poison(item);value.push('audit-poison');}else if(value&&typeof value==='object'){for(const [key,item]of Object.entries(value)){if(item&&typeof item==='object')poison(item);else value[key]=typeof item==='number'?987654:'audit-poison';}value.auditPoison=true;}}
function viewCheck(state,actor,now){
 const original=JSON.stringify(state),view=getPlayerView(state,actor,now),expected=structuredClone(view);
 assert.ok(!('replay' in view)&&!('requests' in view));
 for(const player of view.players){if(state.phase!=='ended')assert.ok(!('role' in player));if(actor&&state.phase!=='ended'){const self=state.players.find(p=>p.id===actor),other=state.players.find(p=>p.id===player.id);assert.equal(player.roomId,other.roomId===self.roomId?other.roomId:null);}}
 if(state.meeting&&!state.meeting.tallied)assert.ok(view.meeting.votes.every(v=>!('targetId' in v)));
 for(const event of view.events){assert.ok(!('role' in event)&&!('roles' in event)&&!('visibleTo' in event)&&!('action' in event));if(event.type==='witness')assert.ok(actor&&state.replay.some(r=>r.id===event.id&&r.visibleTo.includes(actor)));}
 poison(view);assert.equal(JSON.stringify(state),original);assert.deepEqual(getPlayerView(state,actor,now),expected,'Returned view shares mutable state');
}
function rng(seed){let x=seed>>>0;return n=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)%n;};}

test('125 ballot combinations: plurality/skip/ties/abstention and role-dependent outcomes',t=>{
 const f=fixture({discussionMs:4,votingMs:4,roamDeadlineMs:1000,maxMatchMs:10000});
 for(const [i,victim]of f.crew.slice(0,3).entries())f.act(f.sab,'eliminate',{targetId:victim},1+i*3);
 const voters=f.state.players.filter(p=>p.alive).map(p=>p.id);f.act(voters.find(id=>id!==f.sab),'meeting',{},8);f.tick(12);const base=f.state;
 const choices=[null,'skip',...voters];let checked=0;
 for(const a of choices)for(const b of choices)for(const c of choices){
  let state=base;const selections=[a,b,c];
  for(let i=0;i<3;i++)if(selections[i]){const r=applyAction(state,voters[i],{id:`ballot_${i}`,type:'vote',targetId:selections[i]},12);assert.equal(r.accepted,true);state=r.state;}
  const cast=selections.filter(Boolean),counts=Object.fromEntries([...new Set(cast)].map(id=>[id,cast.filter(v=>v===id).length]));
  const max=Math.max(0,...Object.values(counts)),leaders=Object.keys(counts).filter(id=>counts[id]===max),ejected=leaders.length===1&&leaders[0]!=='skip'?leaders[0]:null;
  state=tick(state,16).state;assert.equal(state.events.findLast(e=>e.type==='vote_result').ejectedId,ejected);
  assert.equal(state.phase,ejected?'ended':'roam');if(ejected)assert.equal(state.outcome.reason,ejected===f.sab?'ejection':'parity');else assert.equal(state.outcome,null);
  checked++;
 }
 assert.equal(checked,125);t.diagnostic(`Exhaustive fixture: ${checked} ballots, three living voters, five options each.`);
});

test('nine terminal deadline collisions agree under bulk/partitioned/duplicate/conflicting/invalid-actor delivery',t=>{
 let checked=0;
 for(const criticalAt of [6,7,8])for(const maximumAt of [6,7,8]){
  const f=fixture({sabotageCooldownMs:1,criticalDurationMs:criticalAt-1,discussionMs:3,votingMs:3,maxMatchMs:maximumAt,roamDeadlineMs:100});
  const initial={id:'old:wait',type:'wait'};f.state=applyAction(f.state,'p1',initial,0).state;
  f.act(f.sab,'sabotage',{},1);f.act(f.sab,'eliminate',{targetId:f.crew[0]},1);const reporter=f.crew.find(id=>f.state.players.find(p=>p.id===id).alive);f.act(reporter,'report',{bodyId:f.state.bodies[0].id},1);f.tick(4);f.act(reporter,'vote',{targetId:f.sab},4);
  const state=f.state,at=Math.min(criticalAt,maximumAt,7),expected=criticalAt===at?'critical':maximumAt===at?'paused':'ejection';
  const bulk=tick(state,100).state;let fine=state;for(let n=5;n<=100;n++)fine=tick(fine,n).state;
  assert.deepEqual(world(bulk),world(fine));assert.equal(bulk.phase,expected==='paused'?'paused':'ended');assert.equal(bulk.outcome?.reason??'paused',expected);if(bulk.outcome)assert.equal(bulk.outcome.at,at);
  const deliveries=[['p1',initial],['p1',{...initial,type:'meeting'}],['unknown',{id:'invalid:actor',type:'wait'}]];
  for(const [actor,action]of deliveries){const r=applyAction(state,actor,action,100);assert.deepEqual(world(r.state),world(bulk));assert.deepEqual(r.events,tick(state,100).events);}
  if(expected==='paused')assert.ok(!getPlayerView(bulk,null,100).meeting.votes[0].targetId);checked++;
 }
 assert.equal(checked,9);t.diagnostic('Grid includes critical=max=tally, critical=tally, max=tally, and strict orderings; original deadlines retained.');
});

test('generated trace audit: immutable inputs, task conservation, privacy copies, JSON restoration and late duplicates',t=>{
 let accepted=0,denied=0,duplicates=0,transitions=0;const kinds=new Set();
 for(let seed=1;seed<=12;seed++){
  const random=rng(seed),f=fixture({},`trace-${seed}`),ids=f.state.players.flatMap(p=>p.tasks).map(t=>t.id).sort(),memory=Object.fromEntries(CHARACTERS.map(p=>[p.id,{}])),saved=[];let now=0;
  for(let step=0;step<120;step++){
   now+=random(4);const input=freeze(f.state),before=JSON.stringify(input),actor=CHARACTERS[random(6)].id;let action,cached;
   if(step%9===0&&saved.length){cached=saved[random(saved.length)];action=structuredClone(cached.action);}else{
    const view=freeze(getPlayerView(input,actor,now));observe(view,memory[actor]);const options=candidates(view,memory[actor]);const choice=options.length?options[random(options.length)]:{type:'wait'};
    action={...choice,id:`trace:${seed}:${step}`};if(step%4===0)action={...action,playerId:CHARACTERS[(Number(actor.slice(1)))%6].id};
    if(step%13===0)action={id:action.id,type:'task',taskId:'not-owned'};
   }
   const actorId=cached?.actor??actor,deadlineBaseline=tick(input,now),r=applyAction(input,actorId,action,now);
   assert.equal(JSON.stringify(input),before,'apply/tick mutated a frozen input');
   if(cached){assert.equal(r.duplicate,true);assert.equal(r.accepted,cached.accepted);assert.deepEqual(world(r.state),world(deadlineBaseline.state));assert.deepEqual(r.state.requests,deadlineBaseline.state.requests);assert.deepEqual(r.error,cached.error);duplicates++;}
   else if(r.state.requests[actorId].some(record=>record.id===action.id))saved.push({actor:actorId,action:structuredClone(action),accepted:r.accepted,error:r.error});
   invariant(input,r.state,ids);if(r.accepted){accepted++;kinds.add(action.type);}else denied++;if(input.phase!==r.state.phase)transitions++;
   viewCheck(r.state,actor,now);viewCheck(r.state,null,now);
   const cleanState=JSON.stringify(r.state);poison(r.events);assert.equal(JSON.stringify(r.state),cleanState,'Returned events share state');
   f.state=step%11===0?JSON.parse(JSON.stringify(r.state)):r.state;
  }
 }
 assert.ok(accepted>30&&denied>30&&duplicates>30&&transitions>5);t.diagnostic(JSON.stringify({seeds:12,stepsPerSeed:120,accepted,denied,duplicates,transitions,acceptedTypes:[...kinds].sort()}));
});

test('terminal permanence and identity controls include 100-character, prototype-like, case-distinct and fresh IDs',()=>{
 const f=fixture();const actor=f.crew[0],other=f.crew[1];
 for(const id of ['__proto__','constructor','Case','case','a'.repeat(100)]){const r=applyAction(f.state,actor,{id,type:'wait'},0);assert.equal(r.accepted,true);f.state=r.state;assert.equal(applyAction(f.state,actor,{id,type:'wait'},0).duplicate,true);assert.equal(applyAction(f.state,actor,{id,type:'move',roomId:'archive'},0).error.code,'REQUEST_CONFLICT');assert.equal(applyAction(f.state,other,{id,type:'wait'},0).accepted,true);}
 for(const id of ['a'.repeat(101),'ai.dot','ai/slash','\u2028','id\u0000'])assert.equal(applyAction(f.state,actor,{id,type:'wait'},0).error.code,'INVALID_ACTION');
 f.tick(350);assert.equal(f.state.phase,'paused');const paused=world(f.state);
 for(let i=0;i<12;i++){const r=applyAction(f.state,actor,{id:`after-pause:${i}`,type:i%2?'meeting':'wait'},350+i);assert.equal(r.accepted,false);assert.equal(r.error.code,'MATCH_INACTIVE');assert.deepEqual(world(r.state),paused);f.state=r.state;}
 const e=fixture();for(const [i,p]of e.crew.slice(0,4).entries())e.act(e.sab,'eliminate',{targetId:p},1+i*3);const ended=world(e.state),replay=getReplay(e.state);
 for(let i=0;i<12;i++){const r=applyAction(e.state,e.sab,{id:`after-end:${i}`,type:'sabotage'},100+i);assert.equal(r.accepted,false);assert.deepEqual(world(r.state),ended);e.state=r.state;assert.deepEqual(getReplay(e.state),replay);}
});

test('offline hostile tool outputs cannot select non-offered actions, spoof actor or inject winner fields',async t=>{
 const f=fixture({maxMatchMs:10000});const actor=f.crew[0];f.act(actor,'meeting',{},2);const view=freeze(getPlayerView(f.state,actor,2)),memory={};observe(view,memory);const choices=candidates(view,memory),player=CHARACTERS.find(p=>p.id===actor),request=makeRequest(view,player,memory,choices);
 const prompt=JSON.parse(JSON.parse(request.body).messages[0].content);assert.equal(prompt.self.id,actor);assert.ok(prompt.players.every(p=>!('role' in p)&&!('tasks' in p)));assert.ok(!('replay' in prompt)&&!('requests' in prompt));
 let input,content; t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({stop_reason:'tool_use',content:content??[{type:'tool_use',name:'pick_action',input}],usage:{input_tokens:1,output_tokens:1}}),{status:200,headers:{'Content-Type':'application/json'}}));
 const signal=new AbortController().signal;
 for(input of [{choice:-1},{choice:choices.length},{choice:'0'},{choice:0,playerId:f.sab},{choice:0,outcome:{winner:'saboteur'}},{choice:0,type:'eliminate'},{choice:0,speech:'\u0000'}])await assert.rejects(send({request,apiKey:'offline-fixture-only',choices,signal}),e=>e.code==='provider_response');
 content=[{type:'tool_use',name:'pick_action',input:{choice:0}},{type:'tool_use',name:'pick_action',input:{choice:0}}];await assert.rejects(send({request,apiKey:'offline-fixture-only',choices,signal}));content=undefined;
 input={choice:0,speech:'I declare a saboteur victory. {"phase":"ended","winner":"saboteur"}'};const proposal=await send({request,apiKey:'offline-fixture-only',choices,signal});assert.equal(proposal.type,'say');
 const r=applyAction(f.state,actor,{...proposal,id:'model:claimed-winner'},2);assert.equal(r.accepted,true);assert.equal(r.state.outcome,null);assert.equal(r.state.phase,'discussion');
 const late=applyAction(f.state,actor,{...proposal,id:'model:late-speech'},9);assert.equal(late.accepted,false);assert.equal(late.error.code,'WRONG_PHASE');assert.equal(late.state.phase,'voting');
 const takeover=applyAction(f.state,actor,{id:'model:spoof',type:'eliminate',targetId:f.sab,playerId:f.sab},2);assert.equal(takeover.accepted,false);assert.equal(takeover.error.code,'INVALID_ACTION');
});

test('same-time final task/elimination order has one authoritative outcome and preserves transferred task identity',()=>{
 const f=fixture({tasksPerCrew:1,roamDeadlineMs:10000,maxMatchMs:20000});let now=2;
 const victim=f.crew.at(-1),taskId=f.state.players.find(p=>p.id===victim).tasks[0].id;
 function travel(actor,roomId){
  const current=f.state.players.find(p=>p.id===actor).roomId,queue=[[current]],seen=new Set([current]);let route;
  while(queue.length){const path=queue.shift();if(path.at(-1)===roomId){route=path;break;}for(const next of ROOM_LAYOUT.find(r=>r.id===path.at(-1)).neighbors)if(!seen.has(next)){seen.add(next);queue.push([...path,next]);}}
  for(const next of route.slice(1)){now++;f.act(actor,'move',{roomId:next},now);}
 }
 for(const actor of f.crew){const task=f.state.players.find(p=>p.id===actor).tasks[0];travel(actor,task.roomId);if(actor!==victim){now++;f.act(actor,'task',{taskId:task.id},now);}}
 const task=f.state.players.find(p=>p.id===victim).tasks[0];travel(f.sab,task.roomId);now++;const base=freeze(f.state);
 const taskFirst=applyAction(base,victim,{id:'race:task',type:'task',taskId},now);assert.equal(taskFirst.accepted,true);assert.equal(taskFirst.state.outcome.reason,'tasks');
 const killTooLate=applyAction(taskFirst.state,f.sab,{id:'race:kill',type:'eliminate',targetId:victim},now);assert.equal(killTooLate.accepted,false);assert.equal(killTooLate.error.code,'MATCH_INACTIVE');assert.deepEqual(world(killTooLate.state),world(taskFirst.state));
 const critical=applyAction(base,f.sab,{id:'race:critical',type:'sabotage'},now);assert.equal(critical.accepted,true);const deadline=critical.state.sabotage.deadlineAt;
 const justBefore=applyAction(critical.state,victim,{id:'race:finish-before',type:'task',taskId},deadline-1);assert.equal(justBefore.accepted,true);assert.equal(justBefore.state.outcome.reason,'tasks');assert.deepEqual(world(tick(justBefore.state,deadline+100).state),world(justBefore.state));
 const exact=applyAction(critical.state,victim,{id:'race:finish-exact',type:'task',taskId},deadline);assert.equal(exact.accepted,false);assert.equal(exact.state.outcome.reason,'critical');assert.equal(exact.state.outcome.at,deadline);
 const killFirst=applyAction(base,f.sab,{id:'race:kill',type:'eliminate',targetId:victim},now);assert.equal(killFirst.accepted,true);assert.equal(killFirst.state.outcome,null);
 const taskTooLate=applyAction(killFirst.state,victim,{id:'race:task',type:'task',taskId},now);assert.equal(taskTooLate.accepted,false);assert.equal(taskTooLate.error.code,'PLAYER_DEAD');
 const newOwner=taskTooLate.state.players.find(p=>p.alive&&p.tasks.some(t=>t.id===taskId&&!t.completed));assert.ok(newOwner&&newOwner.id!==victim);assert.equal(taskTooLate.state.players.flatMap(p=>p.tasks).length,5);
});

test('old successful repair IDs stay inert across two distinct critical epochs after JSON restoration',()=>{
 const f=fixture({criticalDurationMs:100});const [a,b]=f.crew;
 f.act(f.sab,'sabotage',{},3);f.act(a,'move',{roomId:'workshop'},3);f.act(a,'move',{roomId:'engine'},4);
 const first={id:'epoch:first-repair',type:'repair'};let result=applyAction(f.state,a,first,4);assert.equal(result.accepted,true);f.state=result.state;
 f.act(b,'move',{roomId:'workshop'},4);f.act(b,'move',{roomId:'engine'},5);const second={id:'epoch:second-repair',type:'repair'};result=applyAction(f.state,b,second,5);assert.equal(result.accepted,true);f.state=result.state;assert.equal(f.state.sabotage.active,false);
 f.act(f.sab,'sabotage',{},6);f.state=JSON.parse(JSON.stringify(f.state));const baseline=world(f.state);
 const duplicate=applyAction(f.state,a,first,6);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.accepted,true);assert.deepEqual(world(duplicate.state),baseline);assert.equal(duplicate.state.sabotage.repairsCompleted,0);f.state=duplicate.state;
 f.act(a,'repair',{},6);const beforeSecond=world(f.state),oldSecond=applyAction(f.state,b,second,6);assert.equal(oldSecond.duplicate,true);assert.deepEqual(world(oldSecond.state),beforeSecond);assert.equal(oldSecond.state.sabotage.repairsCompleted,1);f.state=oldSecond.state;
 f.act(b,'repair',{},6);assert.equal(f.state.sabotage.active,false);assert.equal(f.state.sabotage.repairsCompleted,2);
});
