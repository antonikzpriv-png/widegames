import { randomBytes, createHash } from 'node:crypto';
import { CHARACTERS, ROOM_LAYOUT, DEFAULT_RULES, ACTION_TYPES } from '../../shared/contracts.mjs';

const MAX_REQUESTS = 2048;
const MAX_EVENTS = 256;
const MAX_REPLAY = 12000;
const roomIds = ROOM_LAYOUT.map(r => r.id);
const fields = {move:['roomId'],task:['taskId'],eliminate:['targetId'],report:['bodyId'],say:['text'],vote:['targetId'],sabotage:[],repair:[],meeting:[],wait:[]};
const clone = value => structuredClone(value);
const fail = (code, message) => ({code,message});
const finiteTime = n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
function publicEvent(state,type,at,data={}) {
  const event={type,at,...data,id:`e${++state.sequence}`};
  state.events.push(event);
  if (state.events.length>MAX_EVENTS) state.events.shift();
}
function record(state,type,at,data={}) {
  state.replay.push({id:`r${++state.replaySequence}`,type,at,...data});
  if (state.replay.length>MAX_REPLAY) state.replay.shift();
}
function end(state,winner,reason,at) {
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
  state.phase='discussion'; state.deadlineAt=at+state.rules.discussionMs;
  state.meeting={id:`m${++state.meetingCount}`,calledBy,reason,bodyId,deadlineAt:state.deadlineAt,messages:[],votes:[],eligibleVoters:state.players.filter(p=>p.alive).map(p=>p.id),tallied:false};
  publicEvent(state,'meeting',at,{calledBy,reason,bodyId}); record(state,'meeting',at,{calledBy,reason,bodyId});
}
function resume(state,at) {
  state.phase='roam'; state.deadlineAt=at+state.rules.roamDeadlineMs;
  for (const p of state.players) p.cooldowns.meetingAt=Math.max(p.cooldowns.meetingAt,at+state.rules.meetingCooldownMs);
}
function transferTasks(state,victim,at) {
  const crew=state.players.filter(p=>p.alive && p.role==='crew');
  if (!crew.length) return;
  const unfinished=victim.tasks.filter(t=>!t.completed);
  victim.tasks=victim.tasks.filter(t=>t.completed);
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
    const deadline=Math.min(critical,max,state.deadlineAt ?? Infinity);
    if (deadline>now) break;
    changed=true;
    if (critical===deadline) end(state,'saboteur','critical',deadline);
    else if (max===deadline) {
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

export function createMatch({id,mode='human',humanPlayerId='p1',now=Date.now(),seed,config={}}={}) {
  if (typeof id!=='string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id) || !['human','spectator'].includes(mode) || !finiteTime(now) || humanPlayerId!=='p1') throw new TypeError('Invalid match options');
  if (!config || typeof config!=='object' || Array.isArray(config)) throw new TypeError('Invalid rules');
  const rules={...DEFAULT_RULES};
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
    tasks:i===saboteurIndex?[]:Array.from({length:rules.tasksPerCrew},(_,j)=>{const roomId=roomIds[random(roomIds.length)];return {id:`t${createHash('sha256').update(`${secret}:task:${i}:${j}`).digest('hex').slice(0,20)}`,label:`Service ${ROOM_LAYOUT.find(r=>r.id===roomId).name} relay`,roomId,completed:false};}),
    cooldowns:{moveAt:now,taskAt:now,killAt:now+rules.initialKillCooldownMs,sabotageAt:now+rules.sabotageCooldownMs,meetingAt:now+rules.meetingCooldownMs},meetingsRemaining:rules.meetingsPerPlayer}));
  const state={schemaVersion:1,id,mode,version:1,phase:'roam',startedAt:now,updatedAt:now,deadlineAt:now+rules.roamDeadlineMs,rules,players,bodies:[],sabotage:null,meeting:null,meetingCount:0,outcome:null,sequence:0,events:[],replaySequence:0,replay:[],requests:Object.fromEntries(players.map(p=>[p.id,[]]))};
  publicEvent(state,'started',now); record(state,'started',now,{roles:players.map(p=>({id:p.id,role:p.role})),tasks:players.map(p=>({id:p.id,tasks:clone(p.tasks)}))});
  return state;
}

function validateEnvelope(action) {
  if (!action || typeof action!=='object' || Array.isArray(action) || ![Object.prototype,null].includes(Object.getPrototypeOf(action))) return fail('INVALID_ACTION','Invalid action envelope.');
  if (typeof action.id!=='string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(action.id) || !ACTION_TYPES.includes(action.type)) return fail('INVALID_ACTION','Invalid action envelope.');
  const keys=['id','type',...fields[action.type]];
  if (Object.keys(action).some(k=>!keys.includes(k)) || keys.some(k=>!Object.hasOwn(action,k))) return fail('INVALID_ACTION','Invalid action fields.');
  if (fields[action.type].some(k=>typeof action[k]!=='string' || action[k].length>(k==='text'?2000:100))) return fail('INVALID_ACTION','Invalid action fields.');
  return null;
}
function denial(state,p,a,now) {
  if (['ended','paused'].includes(state.phase)) return fail('MATCH_INACTIVE','This match is not active.');
  if (!p.alive) return fail('PLAYER_DEAD','Eliminated keepers cannot act.');
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
  if (a.type==='move') {
    if (!ROOM_LAYOUT.find(r=>r.id===p.roomId).neighbors.includes(a.roomId)) return fail('INVALID_ROOM','Choose an adjacent room.');
    if (now<p.cooldowns.moveAt) return fail('COOLDOWN','Movement is cooling down.');
  } else if (a.type==='task') {
    const t=p.tasks.find(t=>t.id===a.taskId);
    if (p.role!=='crew' || !t || t.completed || t.roomId!==p.roomId) return fail('INVALID_TASK','No available task here.');
    if (now<p.cooldowns.taskAt) return fail('COOLDOWN','Task equipment is cooling down.');
  } else if (a.type==='eliminate') {
    const target=state.players.find(t=>t.id===a.targetId);
    if (p.role!=='saboteur' || !target || !target.alive || target.role!=='crew' || target.roomId!==p.roomId) return fail('INVALID_TARGET','No valid target here.');
    if (now<p.cooldowns.killAt) return fail('COOLDOWN','Elimination is cooling down.');
  } else if (a.type==='sabotage') {
    if (p.role!=='saboteur' || state.sabotage?.active) return fail('UNAVAILABLE','Sabotage is unavailable.');
    if (now<p.cooldowns.sabotageAt) return fail('COOLDOWN','Sabotage is cooling down.');
  } else if (a.type==='repair') {
    if (p.role!=='crew' || !state.sabotage?.active || p.roomId!==state.sabotage.roomId || state.sabotage.repairers.includes(p.id)) return fail('UNAVAILABLE','No repair available here.');
  } else if (a.type==='report') {
    if (!state.bodies.some(b=>b.id===a.bodyId && !b.reported && b.roomId===p.roomId)) return fail('INVALID_BODY','No reportable body here.');
  } else if (a.type==='meeting') {
    if (p.roomId!=='bridge' || p.meetingsRemaining<1 || state.sabotage?.active) return fail('UNAVAILABLE','Emergency bell unavailable.');
    if (now<p.cooldowns.meetingAt) return fail('COOLDOWN','Emergency bell is cooling down.');
  }
  return null;
}

export function tick(input,now=Date.now()) {
  if (!finiteTime(now) || now<input.updatedAt) return {state:input,events:[]};
  const state=clone(input),seq=state.sequence;
  if (!advance(state,now)) return {state:input,events:[]};
  state.version++;
  return {state,events:clone(state.events.filter(e=>Number(e.id.slice(1))>seq))};
}

export function applyAction(input,playerId,action,now=Date.now()) {
  const timed=tick(input,now); let state=timed.state;
  const reject=error=>({state,events:timed.events,accepted:false,error});
  if (!finiteTime(now) || now<input.updatedAt) return reject(fail('INVALID_TIME','Invalid server time.'));
  if (typeof playerId!=='string' || !state.players.some(p=>p.id===playerId)) return reject(fail('INVALID_PLAYER','Unknown keeper.'));
  const invalid=validateEnvelope(action); if (invalid) return reject(invalid);
  const fingerprint=JSON.stringify(Object.fromEntries(['type',...fields[action.type]].map(k=>[k,action[k]])));
  const prior=state.requests[playerId].find(r=>r.id===action.id);
  if (prior) {
    if (prior.fingerprint!==fingerprint) return reject(fail('REQUEST_CONFLICT','Request ID already used for another action.'));
    return {state,events:timed.events,accepted:prior.accepted,...(prior.error?{error:clone(prior.error)}:{}),duplicate:true};
  }
  if(state.requests[playerId].length>=MAX_REQUESTS)return reject(fail('REQUEST_LIMIT','This keeper has reached the match request limit. Existing requests remain idempotent.'));
  state=clone(state);
  const p=state.players.find(p=>p.id===playerId);
  const error=denial(state,p,action,now);
  // Persist both success and rule denials, bounded per actor. Never save malformed envelopes.
  state.requests[playerId].push({id:action.id,fingerprint,accepted:!error,...(error?{error}: {})});
  state.version++; state.updatedAt=now;
  if (error) return {state,events:timed.events,accepted:false,error};
  const seq=state.sequence;
  if (action.type==='move') {p.roomId=action.roomId;p.cooldowns.moveAt=now+state.rules.moveCooldownMs;}
  if (action.type==='task') {p.tasks.find(t=>t.id===action.taskId).completed=true;p.cooldowns.taskAt=now+state.rules.taskCooldownMs;}
  if (action.type==='sabotage') {
    state.sabotage={active:true,roomId:'engine',deadlineAt:now+state.rules.criticalDurationMs,repairsCompleted:0,repairsRequired:2,repairers:[]};
    p.cooldowns.sabotageAt=now+state.rules.sabotageCooldownMs;
    publicEvent(state,'sabotage',now,{roomId:'engine',deadlineAt:state.sabotage.deadlineAt});
  }
  if (action.type==='repair') {
    state.sabotage.repairers.push(p.id);state.sabotage.repairsCompleted++;
    publicEvent(state,'repair',now,{playerId:p.id,repairsCompleted:state.sabotage.repairsCompleted});
    if (state.sabotage.repairsCompleted>=state.sabotage.repairsRequired) {state.sabotage.active=false;publicEvent(state,'repaired',now);}
  }
  if (action.type==='eliminate') {
    const target=state.players.find(t=>t.id===action.targetId);target.alive=false;
    p.cooldowns.killAt=now+state.rules.killCooldownMs;
    state.bodies.push({id:`body-${target.id}`,playerId:target.id,roomId:p.roomId,reported:false});
    transferTasks(state,target,now);
    // Attribution is private to actual eyewitnesses; never enters the public timeline.
    record(state,'witness',now,{playerId:p.id,targetId:target.id,roomId:p.roomId,visibleTo:state.players.filter(w=>w.alive&&w.roomId===p.roomId).map(w=>w.id)});
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
  record(state,'action',now,{playerId:p.id,action:clone(action)});
  victory(state,now);
  return {state,events:[...timed.events,...clone(state.events.filter(e=>Number(e.id.slice(1))>seq))],accepted:true};
}

export function getPlayerView(state,playerIdOrNull,now=Date.now()) {
  const p=state.players.find(p=>p.id===playerIdOrNull);
  const ended=state.phase==='ended';
  const visible=q=>!p || q.id===p.id || q.roomId===p.roomId || ended;
  const events=clone(state.events);
  if (p) {
    for (const e of state.replay.filter(e=>e.type==='witness' && e.visibleTo.includes(p.id)).slice(-30)) events.push({id:e.id,type:'witness',at:e.at,playerId:e.playerId,targetId:e.targetId,roomId:e.roomId});
    // The frozen view has no bodies field: local sightings are safe timeline entries.
    for (const b of state.bodies.filter(b=>!b.reported&&b.roomId===p.roomId)) events.push({id:b.id,type:'body',bodyId:b.id,playerId:b.playerId,roomId:b.roomId,at:state.updatedAt});
  } else for (const b of state.bodies.filter(b=>!b.reported)) events.push({id:b.id,type:'body',bodyId:b.id,playerId:b.playerId,roomId:b.roomId,at:state.updatedAt});
  const hints=[];
  if (p) for (const type of ACTION_TYPES) {
    let candidates=[{id:'hint',type}];
    if (type==='move') candidates=roomIds.map(roomId=>({id:'hint',type,roomId}));
    if (type==='task') candidates=p.tasks.map(t=>({id:'hint',type,taskId:t.id}));
    if (type==='eliminate') candidates=state.players.map(q=>({id:'hint',type,targetId:q.id}));
    if (type==='report') candidates=state.bodies.map(b=>({id:'hint',type,bodyId:b.id}));
    if (type==='say') candidates=[{id:'hint',type,text:'x'}];
    if (type==='vote') candidates=[{id:'hint',type,targetId:'skip'}];
    if (candidates.some(a=>!denial(state,p,a,now))) hints.push(type);
  }
  return {matchId:state.id,version:state.version,phase:state.phase,serverNow:now,deadlineAt:state.deadlineAt,
    rooms:clone(ROOM_LAYOUT),players:state.players.map(q=>({id:q.id,name:q.name,color:q.color,alive:q.alive,roomId:visible(q)?q.roomId:null,...(ended?{role:q.role}:{})})),
    self:p?{id:p.id,role:p.role,alive:p.alive,roomId:p.roomId,tasks:clone(p.tasks),cooldowns:clone(p.cooldowns),meetingsRemaining:p.meetingsRemaining}:null,
    tasks:{completed:state.players.flatMap(q=>q.tasks).filter(t=>t.completed).length,total:state.players.flatMap(q=>q.tasks).length},
    sabotage:state.sabotage?{active:state.sabotage.active,roomId:state.sabotage.roomId,deadlineAt:state.sabotage.deadlineAt,repairsCompleted:state.sabotage.repairsCompleted,repairsRequired:state.sabotage.repairsRequired}:null,
    meeting:state.meeting?{id:state.meeting.id,calledBy:state.meeting.calledBy,reason:state.meeting.reason,bodyId:state.meeting.bodyId,deadlineAt:state.meeting.deadlineAt,messages:clone(state.meeting.messages),votes:state.meeting.votes.map(v=>state.meeting.tallied?clone(v):{playerId:v.playerId}),eligibleVoters:clone(state.meeting.eligibleVoters)}:null,
    outcome:clone(state.outcome),events:events.sort((a,b)=>a.at-b.at).slice(-MAX_EVENTS),availableActions:hints};
}

export function getReplay(state) {return state.phase==='ended'?clone(state.replay):null;}
