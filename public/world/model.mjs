import {canViewAct} from '../../shared/features.mjs';
import {MotionTrack} from './movement.mjs';
import {mapKey} from './map-model.mjs';
import {knowledge,descriptors,actionDescriptors,hasActionDescriptor} from './beacon-model.mjs';
/** Pure presentation rules. Inputs are redacted views, never engine state. */
export const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
export const distance = (a,b) => point(a)&&point(b)?Math.hypot(a.x-b.x,a.y-b.y):Infinity;
export const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
export function remaining(deadline,now){return Math.max(0,Math.ceil(((deadline||now)-now)/1000));}
export function clock(deadline,now){const n=remaining(deadline,now);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
export function visiblePlayers(game){return (game?.players||[]).filter(p=>((game?.beaconVersion===1?knowledge(game,p)==='alive':p.alive)||(game?.self?.ghost===true&&p.id===game.self.id))&&point(p.position));}
export function visibleBodies(game){return (game?.events||[]).filter(e=>e.type==='body'&&e.bodyId&&point(e.position));}
export function roleLabel(game){if(game?.self?.ghost)return 'Ghost · '+(game.self.role==='crew'?'Crew':'Saboteur');return !game?.self?'Spectator':game.self.role==='saboteur'?'Saboteur':'Crew';}
export function aiLabel(ai){return ai?.mode==='live'&&ai.strategy==='strategic'?'STRATEGIC · model plans / local execution':ai?.mode==='live'?'HYBRID · live council / local navigation':ai?.mode==='demo'?'DEMO · local keepers':'AI mode pending';}
export function taskKind(task,index=0){
 if(task.progress)return task.progress.kind;
 const text=String(task.label||'').toLowerCase();
 if(/wire|circuit/.test(text))return 'wires';
 if(/tune|signal|frequency|calibrat/.test(text))return 'tuning';
 if(/sequence|log|record|filter|suppl/.test(text))return 'sequence';
 // Engine relay tasks share a label; equipment varies by the actual station.
 return ({bridge:'wires',workshop:'wires',lantern:'tuning',engine:'tuning',archive:'sequence',galley:'sequence'})[task.roomId]||['wires','tuning','sequence'][index%3];
}
function beaconContexts(game){
 const self=game.self,active=game.phase==='roam'&&canViewAct(game)&&!game.systems?.selfTransit&&!self?.transit,hints=actionDescriptors(game),enabled=type=>active?hints.filter(h=>h.type===type&&h.enabled===true):[];
 const context=(h,label,hint)=>({type:h?.type,label:h?.label||label,fields:{...h?.fields},enabled:!!h,hint});
 const taskHint=enabled('task').find(h=>self.tasks?.some(t=>t.id===h.fields.taskId&&!t.completed)),task=taskHint&&self.tasks.find(t=>t.id===taskHint.fields.taskId),bell=enabled('meeting')[0];
 const equipment=descriptors(game),repair=active&&equipment.find(h=>h.type==='systemRepair'&&h.enabled===true),other=active&&equipment.find(h=>['investigate','vent'].includes(h.type)&&h.enabled===true);
 let use;
 if(repair)use={type:'beaconPanel',descriptorId:repair.id,label:repair.label,enabled:true,hint:''};
 else if(taskHint)use={...context(taskHint,'Task station','Approach a permitted task station.'),task};
 else if(bell)use=context(bell,'Emergency bell','Approach the permitted bell.');
 else if(other)use={type:'beaconPanel',descriptorId:other.id,label:other.label,enabled:true,hint:''};
 else use={type:'beaconPanel',label:'Beacon equipment',enabled:active,hint:'Open Systems & evidence for server-permitted actions.'};
 return {use,protect:context(enabled('protect')[0],'Harbor Ward','No permitted ward target.'),decoy:context(enabled('decoy')[0],'Signal Echo','No permitted echo action.'),report:context(enabled('report')[0],'Report body','No permitted report target. Approach an observed fallen keeper.'),eliminate:context(self?.role==='saboteur'?enabled('eliminate').find(h=>h.fields.targetId!==self.id):null,'Eliminate','No permitted elimination target.'),sabotage:{type:'beaconPanel',label:'System sabotage options',enabled:active&&self?.role==='saboteur',hint:'Open Systems & evidence for sabotage choices and cooldowns.'}};
}
export function contexts(game,world){
 if(game?.beaconVersion===1)return beaconContexts(game);
 const self=game?.self,pos=self?.position,available=game?.availableActions||[];
 const active=game?.phase==='roam'&&(self?.alive||self?.ghost)&&point(pos)&&game.worldVersion===1;
 const station=world.WORLD_STATIONS[self?.roomId];
 const nearby=active&&distance(pos,station)<=world.WORLD.interactionRadius;
 const task=(self?.tasks||[]).find(t=>!t.completed&&t.roomId===self?.roomId);
 const body=visibleBodies(game).find(b=>distance(pos,b.position)<=world.WORLD.reportRadius);
 const target=visiblePlayers(game).filter(p=>p.id!==self?.id&&distance(pos,p.position)<=world.WORLD.killRadius).sort((a,b)=>distance(pos,a.position)-distance(pos,b.position))[0];
 const allowed=type=>active&&available.includes(type);
 const repair=self?.alive&&game?.sabotage?.active&&game.sabotage.roomId===self?.roomId;
 const bell=active&&distance(pos,world.WORLD_BELL)<=world.WORLD.interactionRadius;
 const repairAction={type:'repair',label:'Repair beacon',fields:{},enabled:nearby&&allowed('repair'),hint:nearby?'Repair is unavailable. Each crew keeper can contribute once.':'Reach the flashing station to help repair.'};
 const taskAction={type:'task',label:task?.label||'Task station',fields:{taskId:task?.id},task,enabled:nearby&&allowed('task'),hint:nearby?'Task equipment is unavailable or cooling down.':'Reach your glowing task station.'};
 const bellAction={type:'meeting',label:'Emergency bell',fields:{},enabled:bell&&allowed('meeting'),hint:bell?'Bell unavailable: check cooldown, remaining emergencies and critical status.':'Use the bell in the Bridge. Unavailable during critical sabotage.'};
 // A distant unfinished Bridge task must not hide a bell that is actually in reach.
 let use=repair&&repairAction.enabled?repairAction:task&&taskAction.enabled?taskAction:bellAction.enabled?bellAction:repair?repairAction:task?taskAction:bellAction;
 return {
  use,
  report:{type:'report',label:'Report body',fields:{bodyId:body?.bodyId},enabled:!!body&&allowed('report'),hint:'Approach a visible fallen keeper.'},
  eliminate:{type:'eliminate',label:target?`Eliminate ${target.name}`:'Eliminate',fields:{targetId:target?.id},enabled:self?.role==='saboteur'&&!!target&&allowed('eliminate'),hint:target?'Wait for the elimination cooldown.':'Approach a visible keeper.'},
  protect:{type:'protect',label:'Harbor Ward',fields:{targetId:target?.id||self?.id},enabled:allowed('protect'),hint:'Ward a living keeper within 140 units and sight. One hit, 8 seconds; 35-second cooldown.'},
  decoy:{type:'decoy',label:'Signal Echo',fields:{x:pos?.x,y:pos?.y},enabled:allowed('decoy'),hint:'Drop a labeled distraction on your deck position. Lasts 6 seconds; 25-second cooldown.'},
  sabotage:{type:'sabotage',label:'Sabotage',fields:{},enabled:self?.role==='saboteur'&&allowed('sabotage'),hint:'Sabotage is unavailable or cooling down.'}
 };
}
/** Rendering blends only two received positions. Missing actors are removed immediately. */
export class ActorSamples{
 constructor(options={}){this.track=new MotionTrack(options);this.legacy=new Map();this.usingWorld=false;this.forceWorld=options.world===true;}
 get samples(){return this.usingWorld?this.track.samples:this.legacy;}
 get intent(){return this.usingWorld?this.track.intent:null;}
 setIntent(input,at){return this.usingWorld?this.track.setIntent(input,at):false;}
 update(game,at){
  // Every production world view has version/rooms or a map/beacon marker.
  // Only historical unit-only Cartesian fixtures lack all these identifiers.
  const realWorld=this.forceWorld||game?.beaconVersion===1||game?.map!==undefined||!!game?.worldVersion&&(Number.isFinite(game.version)||Array.isArray(game.rooms));
  if(realWorld!==this.usingWorld){this.clear();this.usingWorld=realWorld;}
  if(realWorld){this.track.update(game,at);if(game?.self?.ghost===true&&point(game.self.position)&&this.track.receivedAt===at){const p=game.players?.find(p=>p.id===game.self.id);if(p){const to={...game.self.position};this.track.samples.set(p.id,{from:to,to,at,player:{...p,position:to,ghost:true,moving:!!game.self.moving}});this.ghostId=p.id;}}else this.ghostId=null;return;}
  const seen=new Set();
  for(const player of visiblePlayers(game)){
   seen.add(player.id);const old=this.samples.get(player.id);
   if(old&&distance(old.to,player.position)<.001){old.player={...player,moving:player.id===game.self?.id?game.self.moving:old.player.moving};continue;}
   const prior=old?this.at(player.id,at):player.position;
   this.samples.set(player.id,{from:prior,to:{...player.position},at,player:{...player,moving:player.id===game.self?.id?game.self.moving:!!old}});
  }
  for(const id of this.samples.keys())if(!seen.has(id))this.samples.delete(id);
 }
 at(id,now,reduced=false){if(this.usingWorld){if(id===this.ghostId){const p=this.track.samples.get(id)?.to;return p?{...p}:null;}return this.track.at(id,now,reduced);}const sample=this.samples.get(id);if(!sample)return null;const t=reduced?1:clamp((now-sample.at)/140,0,1);return {x:sample.from.x+(sample.to.x-sample.from.x)*t,y:sample.from.y+(sample.to.y-sample.from.y)*t};}
 clear(){this.track.clear();this.legacy.clear();this.ghostId=null;this.usingWorld=false;}
}
export function validTaskSession(session,room,world){
 const game=room?.game,task=game?.self?.tasks?.find(t=>t.id===session?.taskId);
 const current=!!session&&room.roomId===session.roomId&&game?.matchId===session.matchId&&game.phase==='roam'&&canViewAct(game)&&!game.systems?.selfTransit&&!game.self?.transit&&task&&!task.completed&&game.self.roomId===session.location;
 if(current&&session.progressKey!==undefined&&session.progressKey!==JSON.stringify([task.progress?.v,task.progress?.kind,task.progress?.target,task.progress?.sequence,task.progress?.pressure,task.progress?.total]))return false;
 if(current&&session.challengeKey!==undefined&&session.challengeKey!==JSON.stringify([task.challenge?.version,task.challenge?.kind,task.challenge?.puzzle]))return false;
 if(!current||session.mapKey!==undefined&&session.mapKey!==mapKey(game.map??room.map))return false;
 if(game.beaconVersion===1)return hasActionDescriptor(game,'task',{taskId:session.taskId});
 return task.roomId===session.location&&distance(game.self.position,world.WORLD_STATIONS[task.roomId])<=world.WORLD.interactionRadius&&game.availableActions?.includes('task');
}
