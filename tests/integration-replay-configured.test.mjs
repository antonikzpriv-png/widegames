import test from 'node:test';
import assert from 'node:assert/strict';
import {getMap,getLegacyMap} from '../shared/maps/index.mjs';
import {TASK_ORDER} from '../shared/task-catalog.mjs';
import {createStationChallenge} from '../shared/station-challenges.mjs';
import {validateReplayHistory,validateReplayMetadata} from '../shared/replay.mjs';
import {createReplayModel} from '../public/world/replay-model.mjs';
import {challenge} from '../server/engine/tasks.mjs';
import * as engine from '../server/engine/index.mjs';
import {checkpointReplay,archiveReplayState} from '../server/engine/replay-history.mjs';
import {replaySequenceOf} from '../shared/replay.mjs';

// Controlled recording-reader fixtures. These validate bounded metadata and
// reconstruction; the engine/transport suites cover legal movement/recording.
function fixture({mapped=false,count=6,custom=false}={}){
 const map=mapped?getMap({id:'beacon',version:2}):getLegacyMap('beacon',1),position=map.geometry.worldSpawn('p1');
 const players=Array.from({length:count},(_,i)=>({id:custom?`watch_${i}`:`p${i+1}`,role:i<(count===15?3:1)?'saboteur':'crew',alive:true,roomId:'bridge',position:{...position},tasks:[],route:[]}));
 const anchor={at:1000,sequence:1,phase:'roam',outcome:null,features:null,effects:[],settings:{speed:300,vision:600},players,bodies:[],sabotage:null,meeting:null};
 const history={version:mapped?2:1,map:mapped?{id:'beacon',version:2}:'lantern-wake-v1',checkpoints:[anchor]};
 const metadata={version:history.version,map:history.map,matchId:'integration-replay',anchor,coverage:{startedAt:1000,from:1000,through:3000,partial:false}};
 return {map,anchor,history,metadata};
}
for(const count of [4,6,15])for(const mapped of [false,true])test(`integrated replay readers retain ${count} actors on ${mapped?'tactical':'historical'} maps`,()=>{
 const f=fixture({mapped,count}),copy=structuredClone(f.history);
 assert.deepEqual(validateReplayHistory(f.history),copy);assert.deepEqual(validateReplayMetadata(f.metadata,'integration-replay'),f.metadata);
 const profiles=f.anchor.players.map((p,i)=>({id:p.id,name:`Keeper ${i+1}`,badge:String(i+1),color:'#8fd3c1'}));
 const model=createReplayModel({metadata:f.metadata,replay:[]},{players:profiles}),frame=model.at(1500);
 assert.equal(frame.players.length,count);assert.deepEqual(frame.players.at(-1).position,f.anchor.players.at(-1).position);assert.equal(frame.players.at(-1).badge,String(count));assert.deepEqual(frame.settings,{speed:300,vision:600});
 frame.settings.speed=0;frame.players.at(-1).position.x=-1;assert.equal(model.at(1500).settings.speed,300);assert.notEqual(model.at(1500).players.at(-1).position.x,-1);assert.deepEqual(f.history,copy);
});

test('mapped replay retains all 25 modern task families beside native station challenges',()=>{
 const f=fixture({mapped:true,count:15}),owner=f.anchor.players.find(p=>p.role==='crew');
 owner.tasks=TASK_ORDER.map((kind,i)=>{const task={id:'t'+i.toString(16).padStart(20,'0'),roomId:'bridge',label:kind,completed:false,kind,edition:3};task.progress=challenge(task);return task;});
 owner.tasks.push({id:'tffffffffffffffffffff',roomId:'bridge',label:'Authored relay',completed:false,kind:'station',challenge:createStationChallenge({kind:'circuit',seed:'mixed-replay'})});
 assert.doesNotThrow(()=>validateReplayHistory(f.history));
 const frame=createReplayModel({metadata:f.metadata,replay:[]}).at(1000);assert.deepEqual(frame.players.find(p=>p.id===owner.id).tasks,owner.tasks);
 for(const mutate of [t=>t.edition=4,t=>t.progress.v=1,t=>t.progress.total++,t=>t.kind='invented',t=>t.secret='private']){const invalid=structuredClone(f.history);mutate(invalid.checkpoints[0].players.find(p=>p.id===owner.id).tasks[0]);assert.throws(()=>validateReplayHistory(invalid));}
 const duplicate=structuredClone(f.history);duplicate.checkpoints[0].players[4].tasks=[structuredClone(owner.tasks[0])];assert.throws(()=>validateReplayHistory(duplicate));
});

test('mapped historical custom identities remain readable without rewriting',()=>{
 const f=fixture({mapped:true,count:12,custom:true}),copy=structuredClone(f.history);validateReplayHistory(f.history);
 const frame=createReplayModel({metadata:f.metadata,replay:[]}).at(1000);assert.deepEqual(frame.players.map(p=>p.id),f.anchor.players.map(p=>p.id));assert.deepEqual(f.history,copy);
});

test('p15 bodies, ballots and roles reject missing or duplicate owners in both formats',()=>{
 for(const mapped of [false,true]){
  const f=fixture({mapped,count:15}),last=f.anchor.players.at(-1);last.alive=false;f.anchor.bodies=[{id:'body-p15',playerId:'p15',roomId:'bridge',position:{...last.position},at:1000,reported:false}];f.anchor.meeting={id:'meeting',eligibleVoters:['p1','p14'],votes:[{playerId:'p14',targetId:'p15'}],tallied:true};validateReplayHistory(f.history);
  for(const mutate of [a=>a.players.pop(),a=>a.bodies.push({...a.bodies[0]}),a=>a.meeting.votes.push({...a.meeting.votes[0]}),a=>a.meeting.eligibleVoters.push('p14'),a=>a.players[3].role='saboteur']){const invalid=structuredClone(f.history);mutate(invalid.checkpoints[0]);assert.throws(()=>validateReplayHistory(invalid));}
 }
});

test('full started rosters cannot contradict checkpoint membership',()=>{
 const f=fixture({count:6}),started={type:'started',at:1000,sequence:1,worldVersion:1,positions:f.anchor.players.map(p=>({id:p.id,position:{...p.position}}))};
 f.anchor.players.pop();assert.throws(()=>createReplayModel({metadata:f.metadata,replay:[started]}),/roster/);
});

test('mapped power-route records move the task station and preserve actor position',()=>{
 const f=fixture({mapped:true,count:15}),owner=f.anchor.players.find(p=>p.role==='crew'),task={id:'taaaaaaaaaaaaaaaaaaaa',roomId:'bridge',label:'Power',completed:false,kind:'power',edition:3};task.progress=challenge(task);owner.tasks=[task];
 const target=f.map.roomLayout.find(r=>r.id!=='bridge').id,event={type:'task_routed',at:1500,sequence:2,playerId:owner.id,taskId:task.id,roomId:target,label:'Accept routed power'};
 const model=createReplayModel({metadata:f.metadata,replay:[event]});assert.equal(model.at(1400).players.find(p=>p.id===owner.id).tasks[0].roomId,'bridge');const routed=model.at(1600).players.find(p=>p.id===owner.id);assert.equal(routed.tasks[0].roomId,target);assert.deepEqual(routed.position,owner.position);
});


test('anchorless archived profiles retain p15 identity without importing final positions or private fields',()=>{
 const f=fixture({mapped:true,count:15});f.metadata.anchor=null;f.metadata.coverage.partial=true;
 const profiles=f.anchor.players.map((p,i)=>({...p,name:`Archived ${i+1}`,color:'#8fd3c1',badge:String(i+1),position:{x:-1000,y:-1000},privateReasoning:'never copied'})),response={metadata:f.metadata,replay:[],players:profiles};
 const model=createReplayModel(response),frame=model.at(1500);assert.equal(frame.players.length,15);assert.equal(frame.players[14].name,'Archived 15');assert.equal(frame.players[14].badge,'15');assert(frame.players.every(p=>p.position===null&&p.role===null&&p.tasks.length===0));assert(!JSON.stringify(frame).includes('never copied'));
 for(const mutate of [p=>p.push({...p[0]}),p=>p[14].id='p1',p=>p[14].id='__proto__',p=>p[14].name={private:'never'},p=>p[14].color='url(private)',p=>p[14].badge='16']){const invalid=structuredClone(response);mutate(invalid.players);assert.throws(()=>createReplayModel(invalid),/profile|roster/);}
});

test('recorded complete starts own membership ahead of contradictory final profile rosters',()=>{
 const f=fixture({count:15});f.metadata.anchor=null;f.metadata.coverage.partial=true;
 const start={type:'started',at:1000,sequence:1,worldVersion:1,positions:f.anchor.players.map(p=>({id:p.id,position:{...p.position}})),roles:f.anchor.players.map(p=>({id:p.id,role:p.role})),tasks:[]};
 const model=createReplayModel({metadata:f.metadata,replay:[start],players:[{id:'unrecorded',name:'Final-only',color:'#8fd3c1'}]}),frame=model.at(1000);assert.equal(frame.players.length,15);assert(frame.players.some(p=>p.id==='p15'));assert(!frame.players.some(p=>p.id==='unrecorded'));
});


test('chronological archive eviction covers backdated higher-sequence motion or leaves its geometry unknown',()=>{
 let state,serial=0,now=1000;
 for(let seed=0;seed<100;seed++){state=engine.createMatch({id:'archive-backdated',world:true,now,seed,config:{meetingCooldownMs:1,discussionMs:10,votingMs:10}});if(state.players[5].role==='saboteur')break;}
 assert.equal(state.players[5].role,'saboteur');
 const capture=()=>{const source=structuredClone(state);delete source.replayHistory;checkpointReplay(source);return source.replayHistory.checkpoints[0];};
 const initial=capture();
 function action(id,type,fields={}){const result=engine.applyAction(state,id,{id:'backdated-'+ ++serial,type,...fields},now);assert(result.accepted,JSON.stringify(result.error));state=result.state;}
 let input=engine.applyInput(state,'p1',{seq:1,dx:-1,dy:0},now);assert(input.accepted);state=input.state;
 action('p2','navigate',{x:818.125,y:272});action('p3','navigate',{x:890,y:272});const before=capture();
 now=2000;state=engine.tick(state,now).state;const after=capture();
 const motions=state.replay.filter(e=>e.type==='motion');assert.deepEqual(motions.map(e=>e.playerId),['p1','p2','p3']);assert(motions[1].at<motions[0].at&&motions[2].at<motions[0].at,'real engine arrival records are backdated relative to append order');
 action('p2','meeting');now=state.deadlineAt;state=engine.tick(state,now).state;action('p2','vote',{targetId:'p6'});now=state.deadlineAt;state=engine.tick(state,now).state;assert.equal(state.phase,'ended');
 state.replayHistory={version:1,map:'lantern-wake-v1',checkpoints:[initial,before,after]};
 const full=engine.getReplay(state),cut=full.findIndex(e=>e.id===motions[0].id),retained=full.slice(cut),discarded=full.slice(0,cut),cutoff=Math.max(...discarded.map(e=>replaySequenceOf(e)??0)),unchanged=structuredClone(state);
 const naive=engine.getReplayMetadata({...state,replay:retained});assert(naive.anchor.sequence<cutoff,'first chronological event alone selects an incompatible old checkpoint');
 const source=archiveReplayState(state,retained,discarded),metadata=engine.getReplayMetadata(source);assert.equal(metadata.coverage.partial,true);assert(metadata.anchor.sequence>=cutoff);assert(metadata.anchor.at>=Math.max(...discarded.map(e=>e.at)));assert.equal(metadata.anchor.sequence,after.sequence);
 const model=createReplayModel({metadata,replay:retained}),frame=model.at(metadata.coverage.from);for(const p of after.players)assert.deepEqual(frame.players.find(q=>q.id===p.id).position,p.position);assert.deepEqual(state,unchanged);
 const withoutCover={...state,replayHistory:{...state.replayHistory,checkpoints:[initial,before]}},partial=engine.getReplayMetadata(archiveReplayState(withoutCover,retained,discarded));assert.equal(partial.anchor,null);assert.equal(partial.coverage.partial,true);assert.equal(partial.coverage.from,retained[0].at);
 const unknown=createReplayModel({metadata:partial,replay:retained,players:engine.getPlayerView(state,null).players}).at(partial.coverage.from);assert.equal(unknown.players.find(p=>p.id==='p3').position,null,'uncovered arrival must not become a fabricated checkpoint position');
});
