import {taskProgress,taskInput} from '../engine/tasks.mjs';
import { ROOM_LAYOUT } from '../../shared/contracts.mjs';
import { WORLD, WORLD_STATIONS, WORLD_BELL, distance, findWorldPath, canSeeWorldPoint } from '../../shared/world.mjs';

const ordered = values => [...values].sort((a, b) => a.id.localeCompare(b.id));
const point = value => value && Number.isFinite(value.x) && Number.isFinite(value.y);
const ready = (view, key) => (view.self.cooldowns?.[key] ?? 0) <= view.serverNow;
const at = (view, target, radius) => point(target) && distance(view.self.position, target) <= radius;

/** Only coordinates already visible in this actor's safe view are usable. */
export function visibleWorldPlayer(view, player) {
  return player.id !== view.self.id && !view.self.teammates?.includes(player.id) && player.alive && point(player.position) && canSeeWorldPoint(view.self.position, player.position,view.settings?.vision);
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

  if(self.ghost){
    if(allowed.has('ghostSay')&&!memory.ghostSpoken)return [{type:'ghostSay',text:'Fallen channel: I will finish my remaining relays. The living cannot hear this.'}];
    const tasks=ordered((self.tasks||[]).filter(t=>!t.completed));
    const here=tasks.find(t=>at(view,WORLD_STATIONS[t.roomId],WORLD.interactionRadius));
    if(here&&allowed.has('task')){const c=taskProgress(here);if(c.kind==='repair'&&c.index===3&&view.serverNow<c.readyAt)return wait();return [c.index<c.total?{type:'taskStep',taskId:here.id,step:c.index,input:taskInput(here)}:{type:'task',taskId:here.id}];}
    if(self.moving)return wait();
    const next=tasks.map(t=>({...t,length:pathLength(self.position,WORLD_STATIONS[t.roomId])})).sort((a,b)=>a.length-b.length||a.id.localeCompare(b.id))[0];
    return next?navigate(WORLD_STATIONS[next.roomId]):wait();
  }

  // A current local body sighting may interrupt a less urgent walking route.
  const bodies = ordered((view.events ?? []).filter(event => event.type === 'body' && typeof event.bodyId === 'string' && !event.reported && point(event.position) && canSeeWorldPoint(self.position, event.position,view.settings?.vision)).map(event => ({ ...event, id: event.bodyId })));
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

  if(allowed.has('protect')){
    const target=ordered(view.players.filter(p=>p.alive&&point(p.position)&&at(view,p.position,140))).find(p=>p.id!==self.id)||view.players.find(p=>p.id===self.id);
    if(target)return [{type:'protect',targetId:target.id}];
  }
  if(allowed.has('decoy'))return [{type:'decoy',x:self.position.x,y:self.position.y}];
  if(self.role==='crew'){
    const echo=(view.effects||[]).find(e=>e.kind==='echo'&&memory.investigatedEcho!==e.id);
    if(echo){memory.investigatedEcho=echo.id;if(!at(view,echo.position,WORLD.interactionRadius))return navigate(echo.position);}
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
    if (allowed.has('task') && ready(view, 'taskAt') && at(view, WORLD_STATIONS[self.roomId], WORLD.interactionRadius) && here.length) {const t=here[0];if(!t.progress)return [{type:'task',taskId:t.id}];const c=taskProgress(t);if(c.kind==='repair'&&c.index===3&&view.serverNow<c.readyAt)return [{type:'wait'}];return [c.index<c.total?{type:'taskStep',taskId:t.id,step:c.index,input:taskInput(t)}:{type:'task',taskId:t.id}];}
    if (view.settings?.emergencyMeetingsEnabled!==false && !critical?.active && self.meetingsRemaining > 0 && ready(view, 'meetingAt') && suspect !== 'skip') {
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
  const offset = Math.max(0, (view.players??[]).findIndex(player => player.id === self.id));
  for (let step = 0; step < ROOM_LAYOUT.length; step++) {
    const index = ((memory.patrol ?? 0) + offset + step) % ROOM_LAYOUT.length;
    const station = WORLD_STATIONS[ROOM_LAYOUT[index].id];
    if (!station || at(view, station, WORLD.interactionRadius)) continue;
    if (!Number.isFinite(pathLength(self.position, station))) continue;
    return navigate(station);
  }
  return wait();
}
