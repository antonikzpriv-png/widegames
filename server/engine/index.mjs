import {getWorld,parseMapId} from '../../shared/world.mjs';
import {TASK_KINDS,taskProgress,stepError,advanceTask,interruptTasks} from './tasks.mjs';
import { randomBytes, createHash } from 'node:crypto';
import { CHARACTERS, ROOM_LAYOUT, DEFAULT_RULES } from '../../shared/contracts.mjs';
import {initializeFeatures,isGhost,nextEffectAt,clearEffects,featureDenial,activateFeature,safeEffects} from './features.mjs';
import {worldRuntime} from './world-runtime.mjs';
import {checkpointReplay,replayMetadata} from './replay-history.mjs';
import {copyState} from './state-copy.mjs';
const defaultRuntime=worldRuntime(await import(process.env.WORLD_ENGINE_GEOMETRY_MODULE||'../../shared/world.mjs'));
const runtimes=new Map([['beacon:1',defaultRuntime]]);
function worldFor(state){const id=state.mapId??'beacon',revision=state.mapRevision??1,key=`${id}:${revision}`;if(!runtimes.has(key))runtimes.set(key,worldRuntime(getWorld(id,revision)));return runtimes.get(key);}
const layoutFor=state=>state.mapId||state.mapRevision===2?getWorld(state.mapId,state.mapRevision??1).ROOM_LAYOUT:ROOM_LAYOUT;
const isWorld=state=>state.schemaVersion===2&&state.worldVersion===1;

const MAX_REQUESTS = 2048;
const MAX_EVENTS = 256;
const MAX_REPLAY = 12000;
const roomIds = ROOM_LAYOUT.map(r => r.id);
const fields = {move:['roomId'],task:['taskId'],taskStep:['taskId','step','input'],eliminate:['targetId'],report:['bodyId'],say:['text'],vote:['targetId'],sabotage:[],repair:[],meeting:[],wait:[],navigate:['x','y'],ghostSay:['text'],protect:['targetId'],decoy:['x','y']};
const clone = value => structuredClone(value);
const fail = (code, message) => ({code,message});
const finiteTime = n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
function publicEvent(state,type,at,data={}) {
  const event={type,at,...data,id:`e${++state.sequence}`};
  state.events.push(event);
  if (state.events.length>MAX_EVENTS) state.events.shift();
}
function record(state,type,at,data={}) {
  const sequence=++state.replaySequence;
  state.replay.push({id:`r${sequence}`,type,at,...data,sequence});
  state.replayBytes=(state.replayBytes??state.replay.slice(0,-1).reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e)),0))+Buffer.byteLength(JSON.stringify(state.replay.at(-1)));
  while(state.replay.length>MAX_REPLAY||state.replayBytes>2*1024*1024)state.replayBytes-=Buffer.byteLength(JSON.stringify(state.replay.shift()));
}
function end(state,winner,reason,at) {
  clearEffects(state,at,'ended',record);
  if(isWorld(state))worldFor(state).stopAll(state,at,'ended',record);
  state.phase='ended'; state.deadlineAt=null; state.outcome={winner,reason,at};
  publicEvent(state,'ended',at,{winner,reason}); record(state,'ended',at,{winner,reason});
  record(state,'role_reveal',at,{players:state.players.map(p=>({id:p.id,role:p.role}))});
}
function victory(state,at) {
  if (state.phase==='ended' || state.phase==='paused') return;
  const living=state.players.filter(p=>p.alive);
  if (!living.some(p=>p.role==='saboteur')) return end(state,'crew','ejection',at);
  if (living.filter(p=>p.role==='saboteur').length >= living.filter(p=>p.role==='crew').length) return end(state,'saboteur','parity',at);
  const tasks=state.players.flatMap(p=>p.tasks);
  if (tasks.length && tasks.every(t=>t.completed)) end(state,'crew','tasks',at);
}
function startMeeting(state,calledBy,reason,bodyId,at) {
  clearEffects(state,at,'meeting',record);
  interruptTasks(state);
  if(isWorld(state))worldFor(state).stopAll(state,at,'meeting',record);
  state.phase='discussion'; state.deadlineAt=at+state.rules.discussionMs;
  state.meeting={id:`m${++state.meetingCount}`,calledBy,reason,bodyId,deadlineAt:state.deadlineAt,messages:[],votes:[],eligibleVoters:state.players.filter(p=>p.alive).map(p=>p.id),tallied:false};
  publicEvent(state,'meeting',at,{calledBy,reason,bodyId}); record(state,'meeting',at,{calledBy,reason,bodyId});
}
function resume(state,at) {
  state.phase='roam'; state.deadlineAt=at+state.rules.roamDeadlineMs;
  for (const p of state.players) p.cooldowns.meetingAt=Math.max(p.cooldowns.meetingAt,at+state.rules.meetingCooldownMs);
}
function transferTasks(state,victim,at) {
  clearEffects(state,at,'death',record,e=>e.playerId===victim.id||e.targetId===victim.id);
  interruptTasks({players:[victim]});
  if(isGhost(state,victim))return;
  const crew=state.players.filter(p=>p.alive && p.role==='crew');
  if (!crew.length) return;
  const unfinished=victim.tasks.filter(t=>!t.completed);
  victim.tasks=victim.tasks.filter(t=>t.completed);
  for(const t of unfinished)if(t.progress?.kind==='repair'&&t.progress.index===3){t.progress.index=2;t.progress.readyAt=0;}
  unfinished.forEach((t,i)=>crew[i%crew.length].tasks.push(t));
  record(state,'tasks_reassigned',at,{playerId:victim.id,assignments:unfinished.map(t=>({taskId:t.id,playerId:crew.find(p=>p.tasks.includes(t)).id}))});
}
function tally(state,at) {
  state.meeting.tallied=true;
  const counts=new Map();
  for (const v of state.meeting.votes) counts.set(v.targetId,(counts.get(v.targetId)||0)+1);
  const sorted=[...counts].sort((a,b)=>b[1]-a[1]);
  const target=sorted.length && (sorted.length===1 || sorted[0][1]>sorted[1][1]) ? sorted[0][0] : null;
  const ejectedId=target && target!=='skip'?target:null;
  publicEvent(state,'vote_result',at,{votes:clone(state.meeting.votes),ejectedId});
  record(state,'vote_result',at,{votes:clone(state.meeting.votes),ejectedId});
  if (ejectedId) {
    const p=state.players.find(p=>p.id===target); p.alive=false;
    if(isWorld(state))worldFor(state).stop(state,p,at,'death',record);
    transferTasks(state,p,at);
    publicEvent(state,'ejected',at,{playerId:p.id}); record(state,'ejected',at,{playerId:p.id,role:p.role});
  }
  resume(state,at); victory(state,at);
}
function advance(state,now) {
  if (now<state.updatedAt || ['ended','paused'].includes(state.phase)) return false;
  let changed=false;
  // Process elapsed deadlines chronologically; late ticks do not extend any deadline.
  while (!['ended','paused'].includes(state.phase)) {
    const critical=state.sabotage?.active ? state.sabotage.deadlineAt : Infinity;
    const max=state.startedAt+state.rules.maxMatchMs;
    const effectAt=nextEffectAt(state);
    const deadline=Math.min(critical,max,state.deadlineAt ?? Infinity,effectAt);
    if(isWorld(state))changed=worldFor(state).settle(state,Math.min(deadline,now),record)||changed;
    if (deadline>now) break;
    changed=true;
    if(effectAt===deadline){clearEffects(state,deadline,'expired',record,e=>e.expiresAt<=deadline);continue;}
    if (critical===deadline) end(state,'saboteur','critical',deadline);
    else if (max===deadline) {
      if(isWorld(state))worldFor(state).stopAll(state,deadline,'paused',record);
      clearEffects(state,deadline,'paused',record);
      state.phase='paused'; state.deadlineAt=null; state.pauseReason='maximum_duration';
      publicEvent(state,'paused',deadline,{reason:'maximum_duration'}); record(state,'paused',deadline,{reason:'maximum_duration'});
    } else if (state.phase==='roam') startMeeting(state,null,'timeout',null,deadline);
    else if (state.phase==='discussion') {
      state.phase='voting'; state.deadlineAt=deadline+state.rules.votingMs; state.meeting.deadlineAt=state.deadlineAt;
      publicEvent(state,'voting',deadline,{meetingId:state.meeting.id}); record(state,'voting',deadline,{meetingId:state.meeting.id});
    } else if (state.phase==='voting') tally(state,deadline);
    else break;
  }
  if (changed) state.updatedAt=now;
  return changed;
}

export function createMatch({id,mode='human',humanPlayerId='p1',now=Date.now(),seed,config={},world=false,features,mapId,mapRevision=1}={}) {
  const selectedMap=parseMapId(mapId);
  if(![1,2].includes(mapRevision)||(!world&&mapRevision!==1))throw new TypeError('Invalid map revision');
  if(!world&&selectedMap!=='beacon')throw new TypeError('Maps require world mode');
  const layout=selectedMap==='beacon'&&mapRevision===1?ROOM_LAYOUT:getWorld(selectedMap,mapRevision).ROOM_LAYOUT,taskRooms=layout.map(r=>r.id);
  if (typeof world!=='boolean')throw new TypeError('Invalid world option');
  if (typeof id!=='string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id) || !['human','spectator'].includes(mode) || !finiteTime(now) || humanPlayerId!=='p1') throw new TypeError('Invalid match options');
  if (!config || typeof config!=='object' || Array.isArray(config)) throw new TypeError('Invalid rules');
  const rules={...DEFAULT_RULES,...(selectedMap!=='beacon'?{tasksPerCrew:getWorld(selectedMap,mapRevision).metadata.tasksPerCrew,roamDeadlineMs:480000,maxMatchMs:1800000}: {})};
  for (const [key,value] of Object.entries(config)) {
    if (!Object.hasOwn(rules,key) || !Number.isSafeInteger(value) || value<1 || value>86400000) throw new TypeError('Invalid rules');
    rules[key]=value;
  }
  if (rules.tasksPerCrew>20 || rules.meetingsPerPlayer>10 || rules.messagesPerDiscussion>20 || rules.messageMaxLength>2000) throw new TypeError('Invalid rules');
  if (seed!==undefined && !['string','number'].includes(typeof seed)) throw new TypeError('Invalid seed');
  const secret=seed===undefined?randomBytes(32).toString('hex'):String(seed);
  let counter=0;
  const random=n=>createHash('sha256').update(`${secret}:${counter++}`).digest().readUInt32BE(0)%n;
  const saboteurIndex=random(6);

  const players=CHARACTERS.map((p,i)=>({id:p.id,name:p.name,color:p.color,role:i===saboteurIndex?'saboteur':'crew',alive:true,roomId:'bridge',human:mode==='human'&&p.id===humanPlayerId,
    tasks:i===saboteurIndex?[]:Array.from({length:rules.tasksPerCrew},(_,j)=>{const roomId=selectedMap==='beacon'?roomIds[random(roomIds.length)]:taskRooms[(i+j)%taskRooms.length];return {...(selectedMap!=='beacon'?{kind:TASK_KINDS[(i+j)%TASK_KINDS.length]}:{}),id:`t${createHash('sha256').update(`${secret}:task:${i}:${j}`).digest('hex').slice(0,20)}`,label:`Service ${layout.find(r=>r.id===roomId).name} relay`,roomId,completed:false};}),
    cooldowns:{moveAt:now,taskAt:now,killAt:now+rules.initialKillCooldownMs,sabotageAt:now+rules.sabotageCooldownMs,meetingAt:now+rules.meetingCooldownMs},meetingsRemaining:rules.meetingsPerPlayer}));
  const state={...(selectedMap!=='beacon'?{mapId:selectedMap}:{}),...(mapRevision===2?{mapRevision}:{}),schemaVersion:1,id,mode,version:1,phase:'roam',startedAt:now,updatedAt:now,deadlineAt:now+rules.roamDeadlineMs,rules,players,bodies:[],sabotage:null,meeting:null,meetingCount:0,outcome:null,sequence:0,events:[],replaySequence:0,replay:[],requests:Object.fromEntries(players.map(p=>[p.id,[]]))};
  if(world)worldFor(state).initialize(state,now);
  initializeFeatures(state,features,random);
  publicEvent(state,'started',now); record(state,'started',now,{...(world?{worldVersion:1,positions:players.map(p=>({id:p.id,position:clone(p.position)}))}:{}),roles:players.map(p=>({id:p.id,role:p.role})),tasks:players.map(p=>({id:p.id,tasks:clone(p.tasks)}))});
  checkpointReplay(state);
  return state;
}

function validateEnvelope(action) {
  if (!action || typeof action!=='object' || Array.isArray(action) || ![Object.prototype,null].includes(Object.getPrototypeOf(action))) return fail('INVALID_ACTION','Invalid action envelope.');
  if (typeof action.id!=='string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(action.id) || !Object.hasOwn(fields,action.type)) return fail('INVALID_ACTION','Invalid action envelope.');
  const keys=['id','type',...fields[action.type]];
  if (Object.keys(action).some(k=>!keys.includes(k)) || keys.some(k=>!Object.hasOwn(action,k))) return fail('INVALID_ACTION','Invalid action fields.');
  if(action.type==='taskStep'){if(typeof action.taskId!=='string'||action.taskId.length>100||!Number.isInteger(action.step)||action.step<0||action.step>4||typeof action.input!=='string'||action.input.length>40)return fail('INVALID_ACTION','Invalid task step.');return null;}
  if (['navigate','decoy'].includes(action.type) ? fields[action.type].some(k=>!Number.isFinite(action[k])) : fields[action.type].some(k=>typeof action[k]!=='string' || action[k].length>(k==='text'?2000:100))) return fail('INVALID_ACTION','Invalid action fields.');
  return null;
}
function denial(state,p,a,now,hint=false) {
  if (['ended','paused'].includes(state.phase)) return fail('MATCH_INACTIVE','This match is not active.');
  const feature=featureDenial(state,p,a,now,worldFor(state));
  if(feature!==undefined)return feature;
  if (!p.alive&&!(isGhost(state,p)&&['wait','move','navigate','task','taskStep'].includes(a.type))) return fail('PLAYER_DEAD','Eliminated keepers cannot act.');
  if (a.type==='wait') return null;
  if (a.type==='say') {
    if (state.phase!=='discussion') return fail('WRONG_PHASE','Discussion is closed.');
    if (!a.text.trim() || a.text.length>state.rules.messageMaxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(a.text)) return fail('INVALID_TEXT','Invalid message.');
    if (state.meeting.messages.filter(m=>m.playerId===p.id).length>=state.rules.messagesPerDiscussion) return fail('MESSAGE_LIMIT','Discussion message limit reached.');
    return null;
  }
  if (a.type==='vote') {
    if (state.phase!=='voting') return fail('WRONG_PHASE','Voting is closed.');
    if (a.targetId!=='skip' && !state.meeting.eligibleVoters.includes(a.targetId)) return fail('INVALID_TARGET','Invalid vote target.');
    if (state.meeting.votes.some(v=>v.playerId===p.id)) return fail('ALREADY_VOTED','Vote already cast.');
    return null;
  }
  if (state.phase!=='roam') return fail('WRONG_PHASE','Action requires roaming.');
  if (a.type==='navigate') {
    if(!isWorld(state)||!worldFor(state).walkable(a))return fail('INVALID_DESTINATION','Choose a walkable world destination.');
  } else if (a.type==='move') {
    if (!layoutFor(state).find(r=>r.id===p.roomId)?.neighbors.includes(a.roomId)) return fail('INVALID_ROOM','Choose an adjacent room.');
    if (now<p.cooldowns.moveAt) return fail('COOLDOWN','Movement is cooling down.');
  } else if (a.type==='task'||a.type==='taskStep') {
    const t=p.tasks.find(t=>t.id===a.taskId);
    if (p.role!=='crew' || !t || t.completed || (isWorld(state)?!worldFor(state).nearby(p.position,worldFor(state).station(t.roomId),worldFor(state).WORLD.interactionRadius):t.roomId!==p.roomId)) return fail('INVALID_TASK','No available task here.');
    if (now<p.cooldowns.taskAt) return fail('COOLDOWN','Task equipment is cooling down.');
    if(a.type==='taskStep'){if(!isWorld(state))return fail('INVALID_ACTION','World equipment only.');const error=stepError(t,a,now);if(error)return error;}
    if(isWorld(state)&&a.type==='task'&&!hint&&taskProgress(t).index<taskProgress(t).total)return fail('TASK_INCOMPLETE','Complete the station steps first.');
  } else if (a.type==='eliminate') {
    const target=state.players.find(t=>t.id===a.targetId);
    if (p.role!=='saboteur' || !target || !target.alive || target.role!=='crew' || (isWorld(state)?!worldFor(state).nearby(p.position,target.position,worldFor(state).WORLD.killRadius):target.roomId!==p.roomId)) return fail('INVALID_TARGET','No valid target here.');
    if (now<p.cooldowns.killAt) return fail('COOLDOWN','Elimination is cooling down.');
  } else if (a.type==='sabotage') {
    if (p.role!=='saboteur' || state.sabotage?.active) return fail('UNAVAILABLE','Sabotage is unavailable.');
    if (now<p.cooldowns.sabotageAt) return fail('COOLDOWN','Sabotage is cooling down.');
  } else if (a.type==='repair') {
    if (p.role!=='crew' || !state.sabotage?.active || (isWorld(state)?!worldFor(state).nearby(p.position,worldFor(state).station(state.sabotage.roomId),worldFor(state).WORLD.interactionRadius):p.roomId!==state.sabotage.roomId) || state.sabotage.repairers.includes(p.id)) return fail('UNAVAILABLE','No repair available here.');
  } else if (a.type==='report') {
    if (!state.bodies.some(b=>b.id===a.bodyId && !b.reported && (isWorld(state)?worldFor(state).nearby(p.position,b.position,worldFor(state).WORLD.reportRadius):b.roomId===p.roomId))) return fail('INVALID_BODY','No reportable body here.');
  } else if (a.type==='meeting') {
    if ((isWorld(state)?!worldFor(state).nearby(p.position,worldFor(state).bell,worldFor(state).WORLD.interactionRadius):p.roomId!=='bridge') || p.meetingsRemaining<1 || state.sabotage?.active) return fail('UNAVAILABLE','Emergency bell unavailable.');
    if (now<p.cooldowns.meetingAt) return fail('COOLDOWN','Emergency bell is cooling down.');
  }
  return null;
}

export function tick(input,now=Date.now()) {
  if (!finiteTime(now) || now<input.updatedAt) return {state:input,events:[]};
  if (['ended','paused'].includes(input.phase)) return {state:input,events:[]};
  const deadline=Math.min(input.sabotage?.active?input.sabotage.deadlineAt:Infinity,input.startedAt+input.rules.maxMatchMs,input.deadlineAt??Infinity,nextEffectAt(input));
  if(deadline>now&&(!isWorld(input)||!worldFor(input).pending(input,Math.min(deadline,now))))return {state:input,events:[]};
  const state=copyState(input),seq=state.sequence;
  if (!advance(state,now)) return {state:input,events:[]};
  state.version++;
  checkpointReplay(state);
  return {state,events:clone(state.events.filter(e=>Number(e.id.slice(1))>seq))};
}

export function applyAction(input,playerId,action,now=Date.now()) {
  const timed=tick(input,now); let state=timed.state;
  const reject=error=>({state,events:timed.events,accepted:false,error});
  if (!finiteTime(now) || now<input.updatedAt) return reject(fail('INVALID_TIME','Invalid server time.'));
  if (typeof playerId!=='string' || !state.players.some(p=>p.id===playerId)) return reject(fail('INVALID_PLAYER','Unknown keeper.'));
  const invalid=validateEnvelope(action); if (invalid) return reject(invalid);
  if(action.type==='navigate'&&!isWorld(state))return reject(fail('INVALID_ACTION','Invalid action envelope.'));
  const fingerprint=JSON.stringify(Object.fromEntries(['type',...fields[action.type]].map(k=>[k,action[k]])));
  const prior=state.requests[playerId].find(r=>r.id===action.id);
  if (prior) {
    if (prior.fingerprint!==fingerprint) return reject(fail('REQUEST_CONFLICT','Request ID already used for another action.'));
    return {state,events:timed.events,accepted:prior.accepted,...(prior.error?{error:clone(prior.error)}:{}),duplicate:true};
  }
  if(state.requests[playerId].length>=MAX_REQUESTS)return reject(fail('REQUEST_LIMIT','This keeper has reached the match request limit. Existing requests remain idempotent.'));
  if(state===input)state=copyState(state);
  const p=state.players.find(p=>p.id===playerId);
  let error=denial(state,p,action,now);
  let path,target;
  if(!error&&isWorld(state)&&['navigate','move'].includes(action.type)){
    target=action.type==='move'?worldFor(state).station(action.roomId):action;path=worldFor(state).navigation(p,target,now);
    if(path===null)error=fail('UNREACHABLE','No walkable route reaches that destination.');
  }
  // Persist both success and rule denials, bounded per actor. Never save malformed envelopes.
  state.requests[playerId].push({id:action.id,fingerprint,accepted:!error,...(error?{error}: {})});
  state.version++; state.updatedAt=now;
  if (error) return {state,events:timed.events,accepted:false,error};
  const seq=state.sequence;
  activateFeature(state,p,action,now,record);
  const privateAction=action.type==='ghostSay';
  if (action.type==='move'||action.type==='navigate') {
    if(isWorld(state)){interruptTasks({players:[p]});worldFor(state).navigate(p,target,path,now);}else p.roomId=action.roomId;
    p.cooldowns.moveAt=now+state.rules.moveCooldownMs;
  }
  if(action.type==='taskStep')advanceTask(p.tasks.find(t=>t.id===action.taskId),now);
  if (action.type==='task') {p.tasks.find(t=>t.id===action.taskId).completed=true;p.cooldowns.taskAt=now+state.rules.taskCooldownMs;}
  if (action.type==='sabotage') {
    state.sabotage={active:true,roomId:'engine',deadlineAt:now+state.rules.criticalDurationMs,repairsCompleted:0,repairsRequired:2,repairers:[]};
    p.cooldowns.sabotageAt=now+state.rules.sabotageCooldownMs;
    publicEvent(state,'sabotage',now,{roomId:'engine',deadlineAt:state.sabotage.deadlineAt});
  }
  if (action.type==='repair') {
    state.sabotage.repairers.push(p.id);state.sabotage.repairsCompleted++;
    publicEvent(state,'repair',now,{repairsCompleted:state.sabotage.repairsCompleted});
    if (state.sabotage.repairsCompleted>=state.sabotage.repairsRequired) {state.sabotage.active=false;publicEvent(state,'repaired',now);}
  }
  if (action.type==='eliminate') {
    const target=state.players.find(t=>t.id===action.targetId);
    const shield=state.effects?.find(e=>e.kind==='ward'&&e.targetId===target.id);
    if(shield){
      clearEffects(state,now,'blocked',record,e=>e.id===shield.id);
      p.cooldowns.killAt=now+state.rules.killCooldownMs;
      record(state,'attack_blocked',now,{playerId:p.id,targetId:target.id});
      checkpointReplay(state);
      return {state,events:timed.events,accepted:true};
    }
    target.alive=false;
    p.cooldowns.killAt=now+state.rules.killCooldownMs;
    if(isWorld(state))worldFor(state).stop(state,target,now,'death',record);
    state.bodies.push({id:`body-${target.id}`,playerId:target.id,roomId:target.roomId,reported:false,...(isWorld(state)?{position:clone(target.position),at:now}:{})});
    transferTasks(state,target,now);
    // Attribution is private to actual eyewitnesses; never enters the public timeline.
    record(state,'witness',now,{playerId:p.id,targetId:target.id,roomId:p.roomId,...(isWorld(state)?{position:clone(target.position)}:{}),visibleTo:state.players.filter(w=>w.alive&&(isWorld(state)?worldFor(state).sees(w.position,p.position)&&worldFor(state).sees(w.position,target.position):w.roomId===p.roomId)).map(w=>w.id)});
    publicEvent(state,'eliminated',now,{playerId:target.id});
  }
  if (action.type==='report') {
    const body=state.bodies.find(b=>b.id===action.bodyId);body.reported=true;
    startMeeting(state,p.id,'report',body.id,now);
    for (const b of state.bodies) b.reported=true;
  }
  if (action.type==='meeting') {p.meetingsRemaining--;startMeeting(state,p.id,'emergency',null,now);}
  if (action.type==='say') {
    const message={id:`${state.meeting.id}-s${state.meeting.messages.length+1}`,playerId:p.id,text:action.text.trim(),at:now};
    state.meeting.messages.push(message);publicEvent(state,'said',now,message);
  }
  if (action.type==='vote') state.meeting.votes.push({playerId:p.id,targetId:action.targetId});
  if(!privateAction)record(state,'action',now,{playerId:p.id,action:clone(action),...(['taskStep','task'].includes(action.type)&&isWorld(state)?{taskProgress:clone(taskProgress(p.tasks.find(t=>t.id===action.taskId)))}:{}),...(isWorld(state)?{position:clone(p.position),...(['navigate','move'].includes(action.type)&&path.length<=128?{route:clone(path),speed:worldFor(state).WORLD.speed}:{})}:{})});
  victory(state,now);
  checkpointReplay(state);
  return {state,events:[...timed.events,...clone(state.events.filter(e=>Number(e.id.slice(1))>seq))],accepted:true};
}

export function getPlayerView(state,playerIdOrNull,now=Date.now()) {
  const p=state.players.find(p=>p.id===playerIdOrNull);
  const ended=state.phase==='ended';
  const visible=q=>q.id===p?.id || (!(isGhost(state,q)&&(!p||p.alive))&&(!p || ended || (isWorld(state)?worldFor(state).sees(p.position,q.position):q.roomId===p.roomId)));
  const bodyVisible=b=>!p||(isWorld(state)?worldFor(state).sees(p.position,b.position):b.roomId===p.roomId);
  const bodyEvent=b=>({id:b.id,type:'body',bodyId:b.id,playerId:b.playerId,roomId:b.roomId,at:isWorld(state)?b.at:state.updatedAt,...(isWorld(state)?{position:clone(b.position)}:{})});
  const events=clone(state.events);
  if (p) {
    for (const e of state.replay.filter(e=>e.type==='witness' && e.visibleTo.includes(p.id)).slice(-30)) events.push({id:e.id,type:'witness',at:e.at,playerId:e.playerId,targetId:e.targetId,roomId:e.roomId,...(isWorld(state)?{position:clone(e.position)}:{})});
    // The frozen view has no bodies field: local sightings are safe timeline entries.
    for (const b of state.bodies.filter(b=>!b.reported&&bodyVisible(b))) events.push(bodyEvent(b));
  } else for (const b of state.bodies.filter(b=>!b.reported)) events.push(bodyEvent(b));
  const hints=[];
  if (p) for (const type of [...new Set([...Object.keys(fields).filter(type=>type!=='navigate'),...(isWorld(state)?['navigate']:[])])]) {
    let candidates=[{id:'hint',type}];
    if(type==='navigate')candidates=[{id:'hint',type,x:p.position.x,y:p.position.y}];
    if (type==='move') candidates=layoutFor(state).map(r=>r.id).map(roomId=>({id:'hint',type,roomId}));
    if(type==='taskStep')continue;
    if (type==='task') candidates=p.tasks.map(t=>({id:'hint',type,taskId:t.id}));
    if (type==='decoy')candidates=[{id:'hint',type,x:p.position?.x,y:p.position?.y}];
    if (type==='protect')candidates=state.players.map(q=>({id:'hint',type,targetId:q.id}));
    if (type==='ghostSay')candidates=[{id:'hint',type,text:'x'}];
    if (type==='eliminate') candidates=state.players.map(q=>({id:'hint',type,targetId:q.id}));
    if (type==='report') candidates=state.bodies.map(b=>({id:'hint',type,bodyId:b.id}));
    if (type==='say') candidates=[{id:'hint',type,text:'x'}];
    if (type==='vote') candidates=[{id:'hint',type,targetId:'skip'}];
    if (candidates.some(a=>!denial(state,p,a,now,true))) hints.push(type);
  }
  return {...(state.mapId?{mapId:state.mapId}:{}),...(state.mapRevision===2?{mapRevision:2}:{}),matchId:state.id,...(isWorld(state)?{worldVersion:1}:{}),...(state.features?{features:clone(state.features),effects:safeEffects(state,p,worldFor(state),now),...(isGhost(state,p)?{ghostChat:clone(state.ghostChat)}:{})}:{}),version:state.version,phase:state.phase,serverNow:now,deadlineAt:state.deadlineAt,
    rooms:clone(layoutFor(state)),players:state.players.map(q=>({id:q.id,name:q.name,color:q.color,alive:q.alive,roomId:visible(q)?q.roomId:null,...(isWorld(state)?{position:visible(q)?clone(q.position):null}:{}),...(ended?{role:q.role}:{})})),
    self:p?{id:p.id,role:p.role,alive:p.alive,...(state.features?{ghost:isGhost(state,p),...(p.ability?{ability:clone(p.ability)}:{})}: {}),roomId:p.roomId,...(isWorld(state)?{position:clone(p.position),inputSeq:p.motion.seq,moving:worldFor(state).moving(state,p,now),destination:clone(p.motion.destination)}:{}),tasks:isWorld(state)?p.tasks.map(t=>({...clone(t),progress:clone(taskProgress(t))})):clone(p.tasks),cooldowns:clone(p.cooldowns),meetingsRemaining:p.meetingsRemaining}:null,
    tasks:{completed:state.players.flatMap(q=>q.tasks).filter(t=>t.completed).length,total:state.players.flatMap(q=>q.tasks).length},
    sabotage:state.sabotage?{active:state.sabotage.active,roomId:state.sabotage.roomId,deadlineAt:state.sabotage.deadlineAt,repairsCompleted:state.sabotage.repairsCompleted,repairsRequired:state.sabotage.repairsRequired}:null,
    meeting:state.meeting?{id:state.meeting.id,calledBy:state.meeting.calledBy,reason:state.meeting.reason,bodyId:state.meeting.bodyId,deadlineAt:state.meeting.deadlineAt,messages:clone(state.meeting.messages),votes:state.meeting.votes.map(v=>state.meeting.tallied?clone(v):{playerId:v.playerId}),eligibleVoters:clone(state.meeting.eligibleVoters)}:null,
    outcome:clone(state.outcome),events:events.sort((a,b)=>a.at-b.at).slice(-MAX_EVENTS),availableActions:hints};
}

export const getReplayMetadata=replayMetadata;

export function getReplay(state) {
  // Settle may append an earlier arrival after another keeper's later sample.
  // Stable numeric sorting preserves causal append order for equal timestamps.
  return state.phase==='ended'?clone(state.replay).sort((a,b)=>a.at-b.at):null;
}

/** Steer only the authenticated actor; sequence state is separate from action IDs. */
export function applyInput(input,playerId,request,now=Date.now()) {
  const timed=tick(input,now);let state=timed.state;
  const reject=error=>({state,events:timed.events,accepted:false,error});
  if(!finiteTime(now)||now<input.updatedAt)return reject(fail('INVALID_TIME','Invalid server time.'));
  if(!isWorld(state))return reject(fail('WORLD_REQUIRED','Movement input requires a world match.'));
  if(typeof playerId!=='string'||!state.players.some(p=>p.id===playerId))return reject(fail('INVALID_PLAYER','Unknown keeper.'));
  if(!request||typeof request!=='object'||Array.isArray(request)||![Object.prototype,null].includes(Object.getPrototypeOf(request))||Object.keys(request).some(k=>!['seq','dx','dy'].includes(k))||!['seq','dx','dy'].every(k=>Object.hasOwn(request,k))||!Number.isSafeInteger(request.seq)||request.seq<=0||![request.dx,request.dy].every(n=>Number.isInteger(n)&&n>=-1&&n<=1))return reject(fail('INVALID_INPUT','Input requires a positive sequence and integer axes -1..1.'));
  const actor=state.players.find(p=>p.id===playerId),motion=actor.motion;
  if(request.seq<motion.seq)return reject(fail('STALE_INPUT','A newer movement input is already recorded.'));
  if(request.seq===motion.seq){
    if(request.dx!==motion.dx||request.dy!==motion.dy)return reject(fail('INPUT_CONFLICT','Sequence already used for a different direction.'));
    return {state,events:timed.events,accepted:!motion.error,...(motion.error?{error:clone(motion.error)}:{}),duplicate:true};
  }
  const error=['ended','paused'].includes(state.phase)?fail('MATCH_INACTIVE','This match is not active.'):!actor.alive&&!isGhost(state,actor)?fail('PLAYER_DEAD','Eliminated keepers cannot move.'):state.phase!=='roam'?fail('WRONG_PHASE','Movement requires roaming.'):null;
  if(state===input)state=copyState(state);const p=state.players.find(p=>p.id===playerId);
  if(error){p.motion.seq=request.seq;p.motion.dx=request.dx;p.motion.dy=request.dy;p.motion.error=error;state.version++;state.updatedAt=now;return {state,events:timed.events,accepted:false,error:clone(error)};}
  if(request.dx||request.dy)interruptTasks({players:[p]});
  if(worldFor(state).input(p,request,now))record(state,'direction',now,{playerId:p.id,dx:request.dx,dy:request.dy,position:clone(p.position)});
  state.version++;state.updatedAt=now;
  checkpointReplay(state);
  return {state,events:timed.events,accepted:true};
}
