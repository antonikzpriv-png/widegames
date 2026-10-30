import {taskInput} from '../engine/tasks.mjs';
import {createSpatialWorld} from '../engine/world/index.mjs';
import {nextStationInput} from '../../shared/station-challenges.mjs';
import {getMap} from '../../shared/maps/index.mjs';
import { CHARACTERS, ROOM_LAYOUT } from '../../shared/contracts.mjs';
import { WORLD, WORLD_STATIONS, WORLD_BELL, distance, findWorldPath, canSeeWorldPoint } from '../../shared/world.mjs';

import {localGoals,localNavigationIntent} from '../features/strategy/index.mjs';

const navigators=new Map();
export function worldGeometry(view){return getMap(view.map).geometry;}
export function worldRoute(view,target){const self=view.self;if(!self?.position||self.transit||view.systems?.selfTransit||(!self.alive&&!(self.ghost===true&&self.role==='crew')))return null;const map=getMap(view.map),key=map.id+':'+map.version;if(!navigators.has(key))navigators.set(key,createSpatialWorld(map.geometry));return navigators.get(key).navigation({id:self.id,alive:true,position:self.position},target,view.serverNow,{systems:{doors:view.systems?.doors??[],transit:{}}});}
export function worldTaskAction(view,task){if(!task||task.completed)return {type:'wait'};if(task.kind==='station'){const input=nextStationInput(task.challenge);return input?{type:'taskInteract',taskId:task.id,...input}:{type:'wait'};}if(task.progress&&typeof task.progress==='object'){const p=task.progress;if(p.kind==='repair'&&p.index===3&&view.serverNow<p.readyAt)return {type:'wait'};return p.index<p.total?{type:'taskStep',taskId:task.id,step:p.index,input:taskInput(task)}:{type:'task',taskId:task.id};}return {type:'task',taskId:task.id};}

const ordered = values => [...values].sort((a, b) => a.id.localeCompare(b.id));
const point = value => value && Number.isFinite(value.x) && Number.isFinite(value.y);
const ready = (view, key) => (view.self.cooldowns?.[key] ?? 0) <= view.serverNow;
const at = (view, target, radius) => point(target) && distance(view.self.position, target) <= radius;

/** Only coordinates already visible in this actor's safe view are usable. */
export function visibleWorldPlayer(view, player) {
  return player.id !== view.self.id && player.alive===true && point(player.position) && (view.beaconVersion===1||canSeeWorldPoint(view.self.position, player.position));
}

function pathLength(start, target) {
  const path = findWorldPath(start, target);
  if (!path) return Infinity;
  let length = 0, previous = start;
  for (const next of path) { length += distance(previous, next); previous = next; }
  return length;
}

/** World proposals use public geometry and the actor's safe view, never state. */
export function worldCandidates(view, memory, suspect) {
  const optional=featureCandidates(view,memory);if(optional)return optional;
  if(view.beaconVersion===1)return beaconCandidates(view,memory,suspect);
  const allowed = new Set(view.availableActions ?? []);
  const wait = () => allowed.has('wait') ? [{ type: 'wait' }] : [];
  const self = view.self;
  if (!point(self.position)) return wait();
  const bellApproach = () => {
    // The bell sits on a solid chart table; choose a reachable public floor
    // point within interaction range rather than navigating into the prop.
    const radius = WORLD.interactionRadius * .7;
    return [[0, 0], [0, 1], [-1, 0], [1, 0], [0, -1]].map(([x, y]) => ({ x: WORLD_BELL.x + x * radius, y: WORLD_BELL.y + y * radius }))
      .map(target => ({ target, length: pathLength(self.position, target) })).filter(option => Number.isFinite(option.length))
      .sort((a, b) => a.length - b.length)[0]?.target;
  };
  const navigate = target => {
    if (!point(target) || !allowed.has('navigate')) return wait();
    if (self.moving && point(self.destination) && distance(self.destination, target) < 1) return wait();
    if (!Number.isFinite(pathLength(self.position, target))) return wait();
    return [{ type: 'navigate', x: target.x, y: target.y }];
  };

  // A current local body sighting may interrupt a less urgent walking route.
  const bodies = ordered((view.events ?? []).filter(event => event.type === 'body' && typeof event.bodyId === 'string' && !event.reported && point(event.position) && canSeeWorldPoint(self.position, event.position)).map(event => ({ ...event, id: event.bodyId })));
  for (const body of bodies) {
    if (allowed.has('report') && at(view, body.position, WORLD.reportRadius)) return [{ type: 'report', bodyId: body.bodyId }];
    if (!at(view, body.position, WORLD.reportRadius)) return navigate(body.position);
  }

  // Repair is urgent even while walking elsewhere. Once our accepted hint has
  // proposed this repair, leave the second contribution to a different keeper.
  const critical = view.sabotage;
  if (self.role === 'crew' && critical?.active && memory.worldRepairDeadline !== critical.deadlineAt) {
    const station = WORLD_STATIONS[critical.roomId];
    if (allowed.has('repair') && self.roomId === critical.roomId && at(view, station, WORLD.interactionRadius)) return [{ type: 'repair' }];
    if (station && !at(view, station, WORLD.interactionRadius)) return navigate(station);
  }

  if (self.role === 'saboteur') {
    const targets = ordered((view.players ?? []).filter(player => visibleWorldPlayer(view, player)));
    if (ready(view, 'killAt')) {
      const close = targets.find(player => allowed.has('eliminate') && at(view, player.position, WORLD.killRadius));
      if (close) return [{ type: 'eliminate', targetId: close.id }];
    }
    if (allowed.has('sabotage') && !critical?.active && ready(view, 'sabotageAt')) return [{ type: 'sabotage' }];
    if (ready(view, 'killAt') && targets.length) {
      targets.sort((a, b) => distance(self.position, a.position) - distance(self.position, b.position) || a.id.localeCompare(b.id));
      // Chasing a currently visible target is an intentional route interruption.
      if (!at(view, targets[0].position, WORLD.killRadius)) return navigate(targets[0].position);
    }
  } else {
    const here = ordered((self.tasks ?? []).filter(task => !task.completed && task.roomId === self.roomId));
    if (allowed.has('task') && ready(view, 'taskAt') && at(view, WORLD_STATIONS[self.roomId], WORLD.interactionRadius) && here.length) return [worldTaskAction(view,here[0])];
    if (!critical?.active && self.meetingsRemaining > 0 && ready(view, 'meetingAt') && suspect !== 'skip') {
      if (allowed.has('meeting') && at(view, WORLD_BELL, WORLD.interactionRadius)) return [{ type: 'meeting' }];
      return navigate(bellApproach());
    }
  }

  // Do not reissue a route per decision/frame. An arrival or an urgent visible
  // event above is needed before choosing a new destination.
  if (self.moving) return wait();
  if (self.role === 'crew') {
    const tasks = (self.tasks ?? []).filter(task => !task.completed && WORLD_STATIONS[task.roomId])
      .map(task => ({ ...task, length: pathLength(self.position, WORLD_STATIONS[task.roomId]) }))
      .filter(task => Number.isFinite(task.length))
      .sort((a, b) => a.length - b.length || a.id.localeCompare(b.id));
    if (tasks.length) {
      const station = WORLD_STATIONS[tasks[0].roomId];
      if (at(view, station, WORLD.interactionRadius)) return wait();
      return navigate(station);
    }
  }

  // Patrol only public station points, with distinct deterministic offsets.
  const offset = Math.max(0, CHARACTERS.findIndex(player => player.id === self.id));
  for (let step = 0; step < ROOM_LAYOUT.length; step++) {
    const index = ((memory.patrol ?? 0) + offset + step) % ROOM_LAYOUT.length;
    const station = WORLD_STATIONS[ROOM_LAYOUT[index].id];
    if (!station || at(view, station, WORLD.interactionRadius)) continue;
    if (!Number.isFinite(pathLength(self.position, station))) continue;
    return navigate(station);
  }
  return wait();
}

/** Group1 adaptation: local goals consume only server-permitted observations. */
function beaconCandidates(view,memory,suspect){
 const map=getMap(view.map),{WORLD,WORLD_STATIONS,WORLD_BELL,distance}=map.geometry,ROOM_LAYOUT=map.roomLayout;
 const self=view.self,allowed=new Set(view.availableActions??[]),wait=()=>allowed.has('wait')?[{type:'wait'}]:[];
 if(!point(self?.position)||self.transit)return wait();
 const controls=(view.interactions??[]).filter(a=>a.enabled),proposal=d=>({type:d.type,...d.fields});
 const navigate=target=>{const a=localNavigationIntent(view,target);if(a.type==='wait'&&view.tacticalVersion===1){const door=controls.find(h=>h.type==='systemRepair'&&h.fields.systemId==='door');if(door)return[proposal(door)];}return a.type==='wait'?wait():[a];};
 if(view.tacticalVersion===1)memory.tacticalStartedAt??=view.serverNow;
 if(view.investigation?.session?.status==='reading'&&!view.sabotage?.active)return wait();
 const bodies=(view.events??[]).filter(e=>e.type==='body'&&!e.reported&&point(e.position));
 const report=controls.find(h=>h.type==='report');if(report)return[proposal(report)];
 for(const body of bodies)if(distance(self.position,body.position)>WORLD.reportRadius)return navigate(body.position);
 if(self.role==='crew'){
  const repair=controls.find(a=>a.type==='systemRepair');if(repair)return [proposal(repair)];
  const goal=localGoals.select(view,memory);
  if(goal?.goalId==='repair'){memory.goal={id:goal.goalId,at:view.serverNow};return navigate(goal.target);}
  const task=controls.find(h=>h.type==='task');if(task&&ready(view,'taskAt')){const own=self.tasks.find(t=>t.id===task.fields.taskId);return own?[worldTaskAction(view,own)]:wait();}
  if(goal?.goalId==='investigate'){const device=controls.find(h=>h.type==='investigate'&&h.fields.deviceId===goal.deviceId);if(device){memory.lastTerminalAt=view.serverNow;memory.tacticalReads=(memory.tacticalReads??0)+1;return [proposal(device)];}return navigate(goal.target);}
  if(!view.sabotage?.active&&suspect!=='skip'&&ready(view,'meetingAt')&&self.meetingsRemaining>0){if(allowed.has('meeting'))return [{type:'meeting'}];return navigate(WORLD_BELL);}
  if(goal){memory.goal={id:goal.goalId,at:view.serverNow};return navigate(goal.target);}
 }else{
  const targets=ordered((view.players??[]).filter(p=>p.id!==self.id&&p.alive&&point(p.position)));
  if(allowed.has('eliminate')&&ready(view,'killAt')){const target=controls.find(a=>a.type==='eliminate');if(target)return [proposal(target)];}
  const sabotage=controls.filter(a=>a.type==='systemSabotage');
  if(sabotage.length){const order=['lights','communications','door','flood','power'],kind=order[(memory.beaconSabotages??0)%order.length],chosen=sabotage.find(a=>a.fields.kind===kind)??sabotage[0];memory.beaconSabotages=(memory.beaconSabotages??0)+1;return [proposal(chosen)];}
  if(view.tacticalVersion===1&&(memory.tacticalPassages??0)<2){const passage=controls.filter(h=>h.type==='vent').sort((a,b)=>a.id.localeCompare(b.id))[0];if(passage){memory.tacticalPassages=(memory.tacticalPassages??0)+1;return[proposal(passage)];}}
  if(ready(view,'killAt')&&targets.length){targets.sort((a,b)=>distance(self.position,a.position)-distance(self.position,b.position));return navigate(targets[0].position);}
 }
 if(self.moving)return wait();
 const terminal=controls.find(a=>a.type==='investigate');if(terminal&&view.serverNow-(memory.lastTerminalAt??-Infinity)>30000){memory.lastTerminalAt=view.serverNow;return [proposal(terminal)];}
 if(view.investigation?.session?.status==='reading')return wait();
 const doors=controls.find(a=>a.type==='systemRepair'&&a.fields.systemId==='door');if(doors)return [proposal(doors)];
 const offset=(view.players??[]).findIndex(p=>p.id===self.id);for(let step=0;step<ROOM_LAYOUT.length;step++){const station=WORLD_STATIONS[ROOM_LAYOUT[((memory.patrol??0)+Math.max(0,offset)+step)%ROOM_LAYOUT.length].id];if(point(station)&&!at(view,station,WORLD.interactionRadius))return navigate(station);}
 return wait();
}

/** Optional features execute locally from exact advertised capabilities only. */
function featureCandidates(view,memory){
 const self=view.self,allowed=new Set(view.availableActions??[]),geo=worldGeometry(view),wait=()=>allowed.has('wait')?[{type:'wait'}]:[];
 if(!self?.position||self.transit||view.systems?.selfTransit)return null;
 const navigate=target=>{const route=worldRoute(view,target);if(!allowed.has('navigate')||!route||self.moving&&self.destination&&geo.distance(self.destination,target)<1)return wait();return [{type:'navigate',x:target.x,y:target.y}];};
 if(!self.alive&&self.ghost===true&&self.role==='crew'){
  if(allowed.has('ghostSay')&&!memory.ghostSpoken)return [{type:'ghostSay',text:'Fallen channel: I will finish my remaining jobs. The living cannot hear this.'}];
  const tasks=ordered((self.tasks??[]).filter(t=>!t.completed));
  const here=tasks.find(t=>geo.WORLD_STATIONS[t.roomId]&&geo.distance(self.position,geo.WORLD_STATIONS[t.roomId])<=geo.WORLD.interactionRadius);
  if(here&&ready(view,'taskAt')&&(allowed.has('task')||allowed.has('taskStep')||allowed.has('taskInteract')))return [worldTaskAction(view,here)];
  if(self.moving)return wait();
  const next=tasks.map(task=>{const target=geo.WORLD_STATIONS[task.roomId],route=target&&worldRoute(view,target);let length=Infinity;if(route){length=0;let p=self.position;for(const q of route){length+=geo.distance(p,q);p=q;}}return{task,target,length};}).sort((a,b)=>a.length-b.length||a.task.id.localeCompare(b.task.id))[0];
  return next&&Number.isFinite(next.length)?navigate(next.target):wait();
 }
 if(!self.alive)return [];
 if(allowed.has('protect')){const target=ordered((view.players??[]).filter(p=>p.id!==self.id&&p.alive===true&&point(p.position)&&geo.distance(self.position,p.position)<=140))[0]??(view.players??[]).find(p=>p.id===self.id);if(target)return[{type:'protect',targetId:target.id}];}
 if(allowed.has('decoy'))return[{type:'decoy',x:self.position.x,y:self.position.y}];
 return null;
}
