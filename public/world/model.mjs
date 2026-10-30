import {getWorld} from '../../shared/world.mjs';
/** Pure presentation rules. Inputs are redacted views, never engine state. */
export const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
export const distance = (a,b) => point(a)&&point(b)?Math.hypot(a.x-b.x,a.y-b.y):Infinity;
export const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
export function remaining(deadline,now){return Math.max(0,Math.ceil(((deadline||now)-now)/1000));}
export function clock(deadline,now){const n=remaining(deadline,now);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
export function visiblePlayers(game){return (game?.players||[]).filter(p=>(p.alive||(game?.self?.ghost&&p.id===game.self.id))&&point(p.position));}
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
export function contexts(game,world){
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
 const use=repair&&repairAction.enabled?repairAction:task&&taskAction.enabled?taskAction:bellAction.enabled?bellAction:repair?repairAction:task?taskAction:bellAction;
 return {
  use,
  report:{type:'report',label:'Report body',fields:{bodyId:body?.bodyId},enabled:!!body&&allowed('report'),hint:'Approach a visible fallen keeper.'},
  eliminate:{type:'eliminate',label:target?`Eliminate ${target.name}`:'Eliminate',fields:{targetId:target?.id},enabled:self?.role==='saboteur'&&!!target&&allowed('eliminate'),hint:target?'Wait for the elimination cooldown.':'Approach a visible keeper.'},
  protect:{type:'protect',label:'Harbor Ward',fields:{targetId:target?.id||self?.id},enabled:allowed('protect'),hint:'Ward a living keeper within 140 units and sight. One hit, 8 seconds; 35-second cooldown.'},
  decoy:{type:'decoy',label:'Signal Echo',fields:{x:pos?.x,y:pos?.y},enabled:allowed('decoy'),hint:'Drop a labeled distraction on your deck position. Lasts 6 seconds; 25-second cooldown.'},
  sabotage:{type:'sabotage',label:'Sabotage',fields:{},enabled:self?.role==='saboteur'&&allowed('sabotage'),hint:'Sabotage is unavailable or cooling down.'}
 };
}
function receivedSegment(from,to,isWalkable){
 // Geometry-free fixtures and legacy maps retain their existing display rules.
 if(!from||!isWalkable(from)||!isWalkable(to))return true;
 const steps=Math.max(1,Math.ceil(distance(from,to)/7));
 for(let i=1;i<steps;i++)if(!isWalkable({x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps}))return false;
 return true;
}
/** Render a bounded received-position timeline one server tick behind the network.
 * Restarting an easing curve on every packet causes visible acceleration pulses;
 * a shared sample clock keeps both actors and their camera moving at steady speed.
 * There is no extrapolation, and newly hidden actors are removed immediately.
 */
export class ActorSamples{
 constructor(){this.samples=new Map();this.delayMs=100;this.mapKey=null;}
 update(game,at){
  const mapId=game?.mapId??'beacon',revision=game?.mapRevision??1,mapKey=`${mapId}:${revision}`;
  if(this.mapKey!==mapKey){this.samples.clear();this.mapKey=mapKey;}
  const {isWalkable}=getWorld(mapId,revision);
  const seen=new Set();
  for(const player of visiblePlayers(game)){
   seen.add(player.id);const old=this.samples.get(player.id);
   if(old&&distance(old.to,player.position)<.001){old.receivedAt=at;old.player={...player,moving:player.id===game.self?.id?game.self.moving:old.player.moving};continue;}
   const position={...player.position},history=old?.history||[];
   if(old&&old.receivedAt>history.at(-1).at)history.push({at:old.receivedAt,position:old.to,interpolate:true});
   const replace=history.length&&at<=history.at(-1).at,prior=history.at(replace?-2:-1)?.position;
   const snapshot={at,position,interpolate:receivedSegment(prior,position,isWalkable)};
   if(replace)history[history.length-1]=snapshot;
   else history.push(snapshot);
   while(history.length>8)history.shift();
   this.samples.set(player.id,{history,to:position,at,receivedAt:at,player:{...player,moving:player.id===game.self?.id?game.self.moving:!!old}});
  }
  for(const id of this.samples.keys())if(!seen.has(id))this.samples.delete(id);
 }
 at(id,now,reduced=false){
  const sample=this.samples.get(id);if(!sample)return null;
  const {history}=sample,time=now-this.delayMs;
  if(reduced||time>=history.at(-1).at)return {...sample.to};
  if(time<=history[0].at)return {...history[0].position};
  for(let i=1;i<history.length;i++){
   const from=history[i-1],to=history[i];if(time>to.at)continue;
   // A missing turn is not permission to draw a shortcut through a wall.
   if(to.interpolate===false)return {...from.position};
   const t=clamp((time-from.at)/(to.at-from.at),0,1);
   return {x:from.position.x+(to.position.x-from.position.x)*t,y:from.position.y+(to.position.y-from.position.y)*t};
  }
  return {...sample.to};
 }
 clear(){this.samples.clear();}
}
export function validTaskSession(session,room,world){
 const game=room?.game,task=game?.self?.tasks?.find(t=>t.id===session?.taskId);
 return !!session&&room.roomId===session.roomId&&game?.matchId===session.matchId&&game.phase==='roam'&&(game.self?.alive||game.self?.ghost)&&task&&!task.completed&&game.self.roomId===session.location&&task.roomId===session.location&&distance(game.self.position,world.WORLD_STATIONS[task.roomId])<=world.WORLD.interactionRadius&&game.availableActions?.includes('task');
}
