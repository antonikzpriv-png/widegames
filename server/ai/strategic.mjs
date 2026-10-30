import {getMap} from '../../shared/maps/index.mjs';
import { visibleWorldPlayer, worldTaskAction, worldGeometry, worldRoute } from './world.mjs';

const distance=(a,b)=>a&&b&&Number.isFinite(a.x)&&Number.isFinite(b.x)?Math.hypot(a.x-b.x,a.y-b.y):Infinity;
const visible = view => (view.players ?? []).filter(p => visibleWorldPlayer(view, p));
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const ready = (view, key) => (view.self.cooldowns?.[key] ?? 0) <= view.serverNow;
// Changes in position alone do not invalidate a route or buy another plan.
const evidence = view => (view.events ?? []).filter(e => ['body', 'witness'].includes(e.type)).map(e => JSON.stringify([e.type,e.bodyId,e.playerId,e.targetId,e.at]));
export function situation(view, memory = {}) {
  return JSON.stringify([view.meeting?.id, view.sabotage?.active ? view.sabotage.deadlineAt : null,
    view.map??view.mapId,view.self.id,view.self.alive,view.self.ghost===true,!!(view.self.transit||view.systems?.selfTransit),
    (view.systems?.doors??[]).filter(d=>d.closed).map(d=>d.id).sort(),
    view.sabotage?.sites?.map(s=>[s.id,s.progress]),
    (view.self.tasks ?? []).map(t => memory.intention?.goal === 'task_route' ? [t.id, t.roomId] : [t.id, !!t.completed]),
    memory.seenEvents ?? evidence(view)]);
}
export function remember(view, memory) {
  const {WORLD,WORLD_STATIONS,distance,canSeeWorldPoint}=worldGeometry(view);
  memory.seenEvents = Array.isArray(memory.seenEvents) ? memory.seenEvents.filter(s => typeof s === 'string' && s.length <= 240).slice(-48) : [];
  memory.observations = Array.isArray(memory.observations) ? memory.observations
    .filter(o => Number.isFinite(o?.at) && Array.isArray(o.players)).slice(-12)
    .map(o => ({
      at: o.at, roomId: o.roomId,
      players: o.players.filter(p => typeof p?.id === 'string' && point(p.position)).slice(0, 24)
        .map(p => ({ id: p.id, roomId: p.roomId, position: { x: p.position.x, y: p.position.y } }))
    })) : [];
  memory.heardClaims = Array.isArray(memory.heardClaims) ? memory.heardClaims.filter(c => typeof c?.text === 'string' && Number.isFinite(c.at)).slice(-16) : [];
  memory.seenEvents = [...new Set([...(memory.seenEvents ?? []), ...evidence(view)])].slice(-48);
  const seen = visible(view);
  const snapshot = { at: view.serverNow, roomId: view.self.roomId,
    players: seen.slice(0, 24).map(p => ({ id: p.id, roomId: p.roomId, position: { x: p.position.x, y: p.position.y } })) };
  const previous = memory.observations?.at(-1);
  // Keep meaningful roaming history; unchanged council snapshots must not erase it.
  if (view.phase === 'roam' && (!previous || previous.roomId !== snapshot.roomId ||
      JSON.stringify(previous.players.map(p => p.id)) !== JSON.stringify(snapshot.players.map(p => p.id)) ||
      snapshot.players.some(p => distance(p.position, previous.players.find(old => old.id === p.id)?.position) > WORLD.interactionRadius))) {
    memory.observations = [...(memory.observations ?? []), snapshot].slice(-12);
  }
  const claims = view.meeting?.messages ?? [];
  memory.heardClaims = [...(memory.heardClaims ?? []), ...claims.map(m => ({ id: m.id, at: m.at, playerId: m.playerId, text: String(m.text).slice(0, 280) }))]
    .filter((m, i, all) => all.findIndex(n => n.id === m.id) === i).slice(-16);
  memory.suspicions = Object.entries(memory.suspicion ?? {}).slice(0, 24).map(([id, score]) => ({ id, score, at: view.serverNow }));
}
export function intentions(view, memory) {
  const {WORLD,WORLD_STATIONS,distance,canSeeWorldPoint}=worldGeometry(view);
  const choices = [];
  const add = (goal, fields = {}) => choices.push({ type: 'intend', goal, ...fields });
  if (view.self.role === 'crew') {
    if(view.beaconVersion){
      if(view.sabotage?.active)for(const site of view.sabotage.sites??[])if(site.progress!==1)add('repair',{roomId:site.roomId,siteId:site.id,systemId:view.sabotage.kind,deadlineAt:view.sabotage.deadlineAt});
      for(const systemId of ['lights','communications'])if(view.systems?.[systemId]?.active)for(const site of getMap(view.map??view.mapId).fixtures.repairs[systemId])add('repair',{roomId:site.roomId,siteId:site.id,systemId,deadlineAt:view.systems[systemId].deadlineAt});
      if(!view.sabotage?.active&&!view.systems?.communications?.active)for(const device of (view.investigation?.devices??[]).slice(0,3))if(point(device.position))add('device',{deviceId:device.id,roomId:device.roomId});
    }else if (view.sabotage?.active && memory.worldRepairDeadline !== view.sabotage.deadlineAt) add('repair', { roomId: view.sabotage.roomId, deadlineAt: view.sabotage.deadlineAt });
    const work = (view.self.tasks ?? []).filter(t => !t.completed).slice(0, 8);
    for (const t of work) add('task', { taskId: t.id, roomId: t.roomId });
    if (work.length >= 2) {
      add('task_route', { taskIds: work.slice(0, 3).map(t => t.id) });
      add('task_route', { taskIds: work.slice(0, 3).map(t => t.id).reverse() });
    }
  } else {
    if(view.beaconVersion){for(const h of view.interactions??[])if(h.enabled&&h.type==='systemSabotage')add('sabotage',{kind:h.fields.kind,targetId:h.fields.targetId});for(const h of view.interactions??[])if(h.enabled&&h.type==='vent')add('passage',{entryId:h.fields.entryId,exitId:h.fields.exitId});}else if (!view.sabotage?.active) add('sabotage');
    for (const p of visible(view).slice(0, 4)) add('isolate', { targetId: p.id });
    for (const roomId of Object.keys(WORLD_STATIONS).slice(0, 4)) add('fake_work', { roomId });
  }
  for (const e of (view.events ?? []).filter(e => e.type === 'body' && !e.reported && e.position && (view.beaconVersion||canSeeWorldPoint(view.self.position, e.position))).slice(-2)) {
    if (Number.isFinite(e.position.x) && Number.isFinite(e.position.y)) add('report', { bodyId: e.bodyId, position: { x: e.position.x, y: e.position.y } });
  }
  for (const p of visible(view).slice(0, 3)) {
    add('follow', { targetId: p.id }); add('avoid', { targetId: p.id });
    add('alibi', { roomId: p.roomId });
  }
  const investigated = new Set();
  for (const observation of [...(memory.observations ?? [])].reverse()) {
    for (const player of observation.players) {
      if (visible(view).some(p => p.id === player.id) || investigated.has(player.id)) continue;
      add('investigate', { roomId: player.roomId ?? observation.roomId, observedAt: observation.at, observedPlayerId: player.id, position: { ...player.position } });
      investigated.add(player.id);
      if (investigated.size >= 3) break;
    }
    if (investigated.size >= 3) break;
  }
  for (const roomId of Object.keys(WORLD_STATIONS).slice(0, 2)) add('position', { roomId });
  return choices.slice(0, 32);
}
export function install(memory, intention, view) {
  memory.intention = { ...intention, startedAt: view.serverNow, expiresAt: view.serverNow + 30000, situation: null };
  memory.intention.situation = situation(view, memory);
  memory.planProgress = { steps: 0, failures: 0, lastPosition: null, lastDistance: null, lastProgressAt: view.serverNow, routeIndex: 0 };
}
// Returns only legal engine action shapes. Historical sightings never supply a
// moving player's current coordinate. The engine validates every proposal again.
export function execute(view, memory) {
  const {WORLD,WORLD_STATIONS,distance,canSeeWorldPoint}=worldGeometry(view);
  const plan = memory.intention, progress = memory.planProgress;
  if (!plan || !progress || !Number.isFinite(plan.startedAt) || !Number.isFinite(plan.expiresAt) ||
      plan.startedAt > view.serverNow || plan.expiresAt > plan.startedAt + 30000 ||
      !Number.isSafeInteger(progress.steps) || progress.steps < 0 ||
      !Number.isSafeInteger(progress.failures) || progress.failures < 0) return null;
  if (!['task', 'task_route', 'repair', 'follow', 'avoid', 'isolate', 'sabotage', 'report', 'fake_work', 'alibi', 'investigate', 'position', 'device', 'passage'].includes(plan.goal) ||
      view.phase !== 'roam' || !view.self.alive || view.self.transit || view.systems?.selfTransit || plan.expiresAt <= view.serverNow ||
      plan.situation !== situation(view, memory) || progress.failures >= 3) return null;
  const allowed = new Set(view.availableActions ?? []), self = view.self;
  const wait = () => allowed.has('wait') ? { type: 'wait' } : null;
  const action = (type, fields = {}) => allowed.has(type) ? { type, ...fields } : wait();
  const controls=(view.interactions??[]).filter(h=>h.enabled),proposal=h=>({type:h.type,...h.fields});
  if(plan.goal==='passage'){const h=controls.find(h=>h.type==='vent'&&h.fields.entryId===plan.entryId&&h.fields.exitId===plan.exitId);return h?proposal(h):null;}
  let target = WORLD_STATIONS[plan.roomId], radius = WORLD.interactionRadius, taskId = plan.taskId;
  if (plan.goal === 'task_route') {
    if (self.role !== 'crew' || !Array.isArray(plan.taskIds) || !plan.taskIds.length || plan.taskIds.length > 3) return null;
    while (progress.routeIndex < plan.taskIds.length) {
      const task = (self.tasks ?? []).find(t => t.id === plan.taskIds[progress.routeIndex]);
      if (!task) return null;
      if (task.completed) { progress.routeIndex++; continue; }
      target = WORLD_STATIONS[task.roomId]; taskId = task.id; break;
    }
    if (progress.routeIndex >= plan.taskIds.length) return null;
  }
  if(plan.goal==='device'){const d=(view.investigation?.devices??[]).find(d=>d.id===plan.deviceId);if(!d||view.systems?.communications?.active)return null;target=d.position;}
  if(plan.goal==='repair'&&view.beaconVersion){const effect=['lights','communications'].includes(plan.systemId)?view.systems?.[plan.systemId]:view.sabotage;if(!effect?.active||effect.deadlineAt!==plan.deadlineAt)return null;const site=(effect.sites??getMap(view.map??view.mapId).fixtures.repairs[plan.systemId]??[]).find(s=>s.id===plan.siteId&&s.progress!==1);if(!site)return null;target=site.position;}
  if (plan.goal === 'investigate' && plan.position) target = plan.position;
  if (['follow', 'avoid', 'isolate'].includes(plan.goal)) {
    const player = visible(view).find(p => p.id === plan.targetId);
    if (!player) return null;
    target = player.position;
    if (plan.goal === 'avoid') target = Object.values(WORLD_STATIONS).filter(p => worldRoute(view,p)).sort((a,b) => distance(b, player.position) - distance(a, player.position))[0];
    if (plan.goal === 'isolate') {
      if (self.role !== 'saboteur') return null;
      radius = WORLD.killRadius;
      const witnesses = visible(view).filter(p => p.id !== player.id && distance(p.position, player.position) < WORLD.visibilityRadius);
      if (distance(self.position, target) <= radius && ready(view, 'killAt') && !witnesses.length) return action('eliminate', { targetId: player.id });
    }
  }
  if (plan.goal === 'sabotage') {
    if(self.role!=='saboteur')return null;
    if(view.beaconVersion){const h=controls.find(h=>h.type==='systemSabotage'&&h.fields.kind===plan.kind&&h.fields.targetId===plan.targetId);return h?proposal(h):null;}
    if(view.sabotage?.active)return null;
    // Waiting for fewer witnesses is a bounded timing decision.
    if (ready(view, 'sabotageAt') && visible(view).length <= 1) return action('sabotage');
    return wait();
  }
  if (plan.goal === 'report') {
    const body = (view.events ?? []).find(e => e.type === 'body' && e.bodyId === plan.bodyId && !e.reported && e.position);
    if (!body || (!view.beaconVersion&&!canSeeWorldPoint(self.position, body.position))) return null;
    target = body.position; radius = WORLD.reportRadius;
  }
  if (plan.goal === 'task' && (self.role !== 'crew' || !(self.tasks ?? []).some(t => t.id === plan.taskId && !t.completed && t.roomId === plan.roomId))) return null;
  if (plan.goal === 'repair' && !view.beaconVersion && (self.role !== 'crew' || !view.sabotage?.active || view.sabotage.deadlineAt !== plan.deadlineAt || memory.worldRepairDeadline === plan.deadlineAt)) return null;
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y) || !self.position) return null;
  const remaining = distance(self.position, target);
  progress.steps++;
  if (remaining <= radius) {
    progress.failures = 0;
    if (['task', 'task_route'].includes(plan.goal) && ready(view, 'taskAt') && allowed.has('task')) {
      return worldTaskAction(view, self.tasks.find(t => t.id === taskId));
    }
    if(plan.goal==='repair'&&view.beaconVersion){const h=controls.find(h=>h.type==='systemRepair'&&h.fields.systemId===plan.systemId&&h.fields.siteId===plan.siteId);return h?proposal(h):null;}
    if(plan.goal==='device'){const h=controls.find(h=>h.type==='investigate'&&h.fields.deviceId===plan.deviceId);return h?proposal(h):null;}
    if (plan.goal === 'repair') return action('repair');
    if (plan.goal === 'report') return action('report', { bodyId: plan.bodyId });
    return wait(); // fake work, alibi and positioning never complete crew tasks
  }
  // A legal path can initially move away from the destination around walls.
  // Measure actual movement, and sample stalls no faster than once a second.
  if (!progress.lastPosition || distance(self.position, progress.lastPosition) > .5) {
    progress.failures = 0;
    progress.lastProgressAt = view.serverNow;
  } else if (view.serverNow - (progress.lastProgressAt ?? plan.startedAt) >= 1000) {
    progress.failures++;
    progress.lastProgressAt = view.serverNow;
  }
  progress.lastDistance = remaining;
  progress.lastPosition = { ...self.position };
  if (!worldRoute(view,target)) return null;
  if (self.moving && self.destination && distance(self.destination, target) < radius) return wait();
  return action('navigate', { x: target.x, y: target.y });
}
