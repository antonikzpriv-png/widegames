import test from 'node:test';
import assert from 'node:assert/strict';
import {getMap,getLegacyMap} from '../shared/maps/index.mjs';
import {TASK_ORDER} from '../shared/task-catalog.mjs';
import {createStationChallenge} from '../shared/station-challenges.mjs';
import {validateReplayHistory,validateReplayMetadata} from '../shared/replay.mjs';
import {createReplayModel} from '../public/world/replay-model.mjs';
import {challenge} from '../server/engine/tasks.mjs';

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
