import {taskProgress,taskInput} from '../server/engine/tasks.mjs';
import assert from 'node:assert/strict';
import * as engine from '../server/engine/index.mjs';
import {WORLD,WORLD_STATIONS,distance} from '../shared/world.mjs';

/** Authoritative actions and clocks; private role inspection selects demo fixtures only. */
export function spatialFixture(id='spatial_fixture_room_0001',{mode='human'}={}){
 let state,now=1000,serial=0;
 for(let seed=0;seed<100;seed++){state=engine.createMatch({id,mode,world:true,seed,now,config:{initialKillCooldownMs:1,killCooldownMs:1,sabotageCooldownMs:1,meetingCooldownMs:1,taskCooldownMs:1,discussionMs:10000,votingMs:10000,criticalDurationMs:120000,roamDeadlineMs:600000,maxMatchMs:1800000}});if(state.players[5].role==='saboteur')break;}
 const initial=structuredClone(state);
 function act(actor,type,fields={}){
  if(type==='task')while(true){
   const task=state.players.find(p=>p.id===actor).tasks.find(t=>t.id===fields.taskId),progress=taskProgress(task);
   if(progress.index>=progress.total)break;
   if(progress.kind==='repair'&&progress.index===3&&now<progress.readyAt)tick(progress.readyAt);
   act(actor,'taskStep',{taskId:fields.taskId,step:progress.index,input:taskInput(task)});
  }
  const r=engine.applyAction(state,actor,{id:'spatial:'+ ++serial,type,...fields},++now);assert(r.accepted,JSON.stringify(r.error));state=r.state;return state.replay.at(-1);
 }
 function tick(at){now=at;state=engine.tick(state,now).state;}
 function navigate(actor,target){act(actor,'navigate',target);const p=state.players.find(p=>p.id===actor);let length=0,prior=p.position;for(const q of p.motion.path){length+=distance(prior,q);prior=q;}tick(now+Math.ceil(length/WORLD.speed*1000)+5);}
 act('p6','sabotage');
 navigate('p1',WORLD_STATIONS.engine);act('p1','repair');navigate('p4',WORLD_STATIONS.engine);act('p4','repair');
 const task=state.players[0].tasks[0];navigate('p1',WORLD_STATIONS[task.roomId]);act('p1','task',{taskId:task.id});
 act('p6','eliminate',{targetId:'p3'});act('p2','report',{bodyId:'body-p3'});
 act('p6','say',{text:'I stayed in the Archive. Nobody saw me.'});act('p2','say',{text:'I saw a fallen keeper near the Bridge.'});
 tick(state.deadlineAt);act('p2','vote',{targetId:'p6'});act('p4','vote',{targetId:'p6'});tick(state.deadlineAt);
 assert.equal(state.phase,'ended');
 return {initial,state,now,replay:engine.getReplay(state),metadata:engine.getReplayMetadata(state),game:engine.getPlayerView(state,null,now),envelope:{roomId:id,matchId:id,replay:engine.getReplay(state),metadata:engine.getReplayMetadata(state),ai:{mode:'demo',strategy:'demo',calls:0,tokens:0,costUsd:0}}};
}
