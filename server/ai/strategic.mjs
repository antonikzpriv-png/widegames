import { WORLD, WORLD_STATIONS, distance, findWorldPath, canSeeWorldPoint } from '../../shared/world.mjs';
import { visibleWorldPlayer } from './world.mjs';

const visible = view => (view.players ?? []).filter(p => visibleWorldPlayer(view, p));
const ready = (view, key) => (view.self.cooldowns?.[key] ?? 0) <= view.serverNow;
// Changes in position alone do not invalidate a route or buy another plan.
export function situation(view) {
  return JSON.stringify([view.meeting?.id, view.sabotage?.active ? view.sabotage.deadlineAt : null,
    (view.players ?? []).map(p => [p.id, p.alive]),
    (view.self.tasks ?? []).map(t => [t.id, !!t.completed]),
    (view.events ?? []).filter(e => ['body', 'witness'].includes(e.type)).map(e => [e.type, e.bodyId, e.at])]);
}
export function remember(view, memory) {
  const seen = visible(view);
  memory.observations = [...(memory.observations ?? []), { at: view.serverNow, roomId: view.self.roomId,
    players: seen.slice(0, 24).map(p => ({ id: p.id, position: { x: p.position.x, y: p.position.y } })) }].slice(-12);
  const claims = view.meeting?.messages ?? [];
  memory.heardClaims = [...(memory.heardClaims ?? []), ...claims.map(m => ({ id: m.id, at: m.at, playerId: m.playerId, text: String(m.text).slice(0, 280) }))]
    .filter((m, i, all) => all.findIndex(n => n.id === m.id) === i).slice(-16);
  memory.suspicions = Object.entries(memory.suspicion ?? {}).slice(0, 24).map(([id, score]) => ({ id, score, at: view.serverNow }));
}
export function intentions(view, memory) {
  const choices = [];
  const add = (goal, fields = {}) => choices.push({ type: 'intend', goal, ...fields });
  if (view.self.role === 'crew') {
    if (view.sabotage?.active && memory.worldRepairDeadline !== view.sabotage.deadlineAt) add('repair', { roomId: view.sabotage.roomId, deadlineAt: view.sabotage.deadlineAt });
    for (const t of (view.self.tasks ?? []).filter(t => !t.completed).slice(0, 8)) add('task', { taskId: t.id, roomId: t.roomId });
  } else {
    if (!view.sabotage?.active) add('sabotage');
    for (const p of visible(view).slice(0, 4)) add('isolate', { targetId: p.id });
    for (const roomId of Object.keys(WORLD_STATIONS).slice(0, 4)) add('fake_work', { roomId });
  }
  for (const e of (view.events ?? []).filter(e => e.type === 'body' && !e.reported && e.position && canSeeWorldPoint(view.self.position, e.position)).slice(-2)) {
    if (Number.isFinite(e.position.x) && Number.isFinite(e.position.y)) add('report', { bodyId: e.bodyId, position: { x: e.position.x, y: e.position.y } });
  }
  for (const p of visible(view).slice(0, 3)) {
    add('follow', { targetId: p.id }); add('avoid', { targetId: p.id });
    add('alibi', { roomId: p.roomId });
  }
  for (const observation of (memory.observations ?? []).slice(-2)) {
    if (observation.players.length) add('investigate', { roomId: observation.roomId, observedAt: observation.at });
  }
  for (const roomId of Object.keys(WORLD_STATIONS).slice(0, 2)) add('position', { roomId });
  return choices.slice(0, 32);
}
export function install(memory, intention, view) {
  memory.intention = { ...intention, startedAt: view.serverNow, expiresAt: view.serverNow + 30000, situation: situation(view) };
  memory.planProgress = { steps: 0, failures: 0, lastPosition: null, lastDistance: null };
}
// Returns only legal engine action shapes. Historical sightings never supply a
// moving player's current coordinate. The engine validates every proposal again.
export function execute(view, memory) {
  const plan = memory.intention, progress = memory.planProgress;
  if (!plan || !progress || view.phase !== 'roam' || !view.self.alive || plan.expiresAt <= view.serverNow || plan.situation !== situation(view) || progress.failures >= 3) return null;
  const allowed = new Set(view.availableActions ?? []), self = view.self;
  const wait = () => allowed.has('wait') ? { type: 'wait' } : null;
  const action = (type, fields = {}) => allowed.has(type) ? { type, ...fields } : wait();
  let target = WORLD_STATIONS[plan.roomId], radius = WORLD.interactionRadius;
  if (['follow', 'avoid', 'isolate'].includes(plan.goal)) {
    const player = visible(view).find(p => p.id === plan.targetId);
    if (!player) return null;
    target = player.position;
    if (plan.goal === 'avoid') target = Object.values(WORLD_STATIONS).filter(p => findWorldPath(self.position, p)).sort((a,b) => distance(b, player.position) - distance(a, player.position))[0];
    if (plan.goal === 'isolate') {
      if (self.role !== 'saboteur') return null;
      radius = WORLD.killRadius;
      const witnesses = visible(view).filter(p => p.id !== player.id && distance(p.position, player.position) < WORLD.visibilityRadius);
      if (distance(self.position, target) <= radius && ready(view, 'killAt') && !witnesses.length) return action('eliminate', { targetId: player.id });
    }
  }
  if (plan.goal === 'sabotage') {
    if (self.role !== 'saboteur' || view.sabotage?.active) return null;
    // Waiting for fewer witnesses is a bounded timing decision.
    if (ready(view, 'sabotageAt') && visible(view).length <= 1) return action('sabotage');
    return wait();
  }
  if (plan.goal === 'report') {
    const body = (view.events ?? []).find(e => e.type === 'body' && e.bodyId === plan.bodyId && !e.reported && e.position);
    if (!body || !canSeeWorldPoint(self.position, body.position)) return null;
    target = body.position; radius = WORLD.reportRadius;
  }
  if (plan.goal === 'task' && (self.role !== 'crew' || !(self.tasks ?? []).some(t => t.id === plan.taskId && !t.completed && t.roomId === plan.roomId))) return null;
  if (plan.goal === 'repair' && (self.role !== 'crew' || !view.sabotage?.active || view.sabotage.deadlineAt !== plan.deadlineAt || memory.worldRepairDeadline === plan.deadlineAt)) return null;
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y) || !self.position) return null;
  const remaining = distance(self.position, target);
  progress.steps++;
  if (remaining <= radius) {
    progress.failures = 0;
    if (plan.goal === 'task' && ready(view, 'taskAt')) return action('task', { taskId: plan.taskId });
    if (plan.goal === 'repair') return action('repair');
    if (plan.goal === 'report') return action('report', { bodyId: plan.bodyId });
    return wait(); // fake work, alibi and positioning never complete crew tasks
  }
  if (progress.lastDistance !== null && remaining >= progress.lastDistance - 1) progress.failures++;
  else progress.failures = 0;
  progress.lastDistance = remaining;
  progress.lastPosition = { ...self.position };
  if (!findWorldPath(self.position, target)) return null;
  if (self.moving && self.destination && distance(self.destination, target) < radius) return wait();
  return action('navigate', { x: target.x, y: target.y });
}
