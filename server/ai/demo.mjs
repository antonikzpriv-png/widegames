import { ROOM_LAYOUT } from '../../shared/contracts.mjs';
import { worldCandidates, visibleWorldPlayer } from './world.mjs';

const rooms = new Map(ROOM_LAYOUT.map(room => [room.id, room]));
const ordered = list => [...list].sort((a, b) => String(a.id).localeCompare(String(b.id)));

/** Deterministic BFS over public map geometry only. */
export function route(from, to) {
  if (!rooms.has(from) || !rooms.has(to)) return [];
  const queue = [[from]], seen = new Set([from]);
  for (const path of queue) {
    const here = path.at(-1);
    if (here === to) return path.slice(1);
    for (const next of rooms.get(here).neighbors) {
      if (!seen.has(next)) { seen.add(next); queue.push([...path, next]); }
    }
  }
  return [];
}

function ready(view, key) {
  return (view.self.cooldowns?.[key] ?? 0) <= view.serverNow;
}

function visibleBodies(view) {
  const found = new Map();
  for (const room of view.rooms ?? []) {
    if (room.id !== view.self.roomId) continue;
    for (const body of room.bodies ?? []) {
      const id = typeof body === 'string' ? body : body.id ?? body.bodyId;
      if (typeof id === 'string') found.set(id, id);
    }
  }
  for (const event of view.events ?? []) {
    if (event.bodyId && event.roomId === view.self.roomId && !event.reported) found.set(event.bodyId, event.bodyId);
  }
  return [...found.values()].slice(0, 15);
}

function suspect(view, memory) {
  const living = ordered((view.players ?? []).filter(p => p.alive && p.id !== view.self.id && !view.self.teammates?.includes(p.id)));
  const witnessed = living.filter(p => memory.witnesses?.[p.id]);
  if (witnessed.length) return witnessed.sort((a, b) => memory.witnesses[b.id].at - memory.witnesses[a.id].at || a.id.localeCompare(b.id))[0].id;
  const ranked = living.filter(p => (memory.suspicion?.[p.id] ?? 0) > 0)
    .sort((a, b) => memory.suspicion[b.id] - memory.suspicion[a.id] || a.id.localeCompare(b.id));
  if (ranked.length) return ranked[0].id;
  if (view.self.role === 'saboteur' && living.length) return living[0].id;
  return 'skip';
}

const VOICES = Object.freeze({
  p1: ['Keep it practical.', 'Give me a concrete route.', 'Jobs first; keep the beacon working.'],
  p2: ['Marking my route.', 'Which crossing did you take?', 'Let us compare the map before we split up.'],
  p3: ['Everyone take a breath.', 'Tell us what you actually saw.', 'Stay together; we need every keeper.'],
  p4: ['For the record.', 'That account needs checking.', 'Separate the record from a guess.'],
  p5: ['Plain speaking.', 'No excuses: where were you?', 'Pair up and get the jobs done.'],
  p6: ['Storm has a sense of humor.', 'Any signals clearer than rumors?', 'Less static, more working relays.']
});

function dialogue(view, memory) {
  const target = suspect(view, memory);
  const name = (view.players??[]).find(p => p.id === target)?.name;
  const room = rooms.get(view.self.roomId)?.name ?? 'my station';
  const number = Math.min(memory.discussionCount ?? 0, 2);
  const voice = VOICES[view.self.id] ?? VOICES.p1;
  if (view.self.role === 'saboteur') return [
    voice[0] + ' I was checking the relays near ' + room + '. Who can account for the last crossing?',
    voice[1] + (name ? ' ' + name + ', tell us your route. We need a consistent account.' : ' Keep the repair teams together.'),
    voice[2] + ' I am voting on the accounts we have heard.'
  ][number];
  const witness = memory.witnesses?.[target];
  if (witness && number < 2) {
    const victim = (view.players??[]).find(p => p.id === witness.targetId)?.name;
    const where = rooms.get(witness.roomId)?.name;
    return voice[number] + ' I saw ' + name + ' attack ' + victim + ' in ' + where + '. That is firsthand; I will vote for ' + name + '.';
  }
  if (name && number < 2) return voice[number] + ' Suspicion only: ' + name + ' was nearby before a disappearance. I did not see an attack; that is a proximity inference.';
  return [
    voice[0] + ' I was at ' + room + '. ' + (view.self.tasks?.filter(t => !t.completed).length ?? 0) + ' jobs remain on my list. What did you see?',
    voice[1] + ' I have no firsthand evidence to accuse anyone. I favor skipping unless someone saw the attack.',
    voice[2] + ' After the vote, pair up for repairs and finish the remaining jobs.'
  ][number];
}

/** Memory records observations from this actor's safe view, never engine state. */
export function observe(view, memory) {
  const phaseKey = view.meeting?.id ?? null;
  if (memory.meetingId !== phaseKey) {
    memory.meetingId = phaseKey;
    memory.discussionCount = 0;
  }
  for (const event of view.events ?? []) {
    if (event.type === 'witness' && event.playerId !== view.self.id && event.playerId !== event.targetId && (view.players??[]).some(p => p.id === event.playerId) && (view.players??[]).some(p => p.id === event.targetId) && rooms.has(event.roomId)) {
      memory.witnesses ??= {};
      memory.witnesses[event.playerId] = { targetId: event.targetId, roomId: event.roomId, at: Number.isFinite(event.at) ? event.at : view.serverNow };
    }
  }
  const dead = new Set((view.players ?? []).filter(p => !p.alive).map(p => p.id));
  if (memory.observation?.roomId === view.self.roomId) {
    const newlyDead = memory.observation.nearby.filter(id => dead.has(id) && !memory.observation.dead.includes(id));
    if (newlyDead.length) {
      memory.suspicion ??= {};
      for (const id of memory.observation.nearby) {
        if (!dead.has(id)) memory.suspicion[id] = Math.min(3, (memory.suspicion[id] ?? 0) + 1);
      }
    }
  }
  memory.observation = {
    roomId: view.self.roomId,
    nearby: (view.players ?? []).filter(p => p.id !== view.self.id && p.alive && (view.worldVersion === 1 ? visibleWorldPlayer(view, p) : p.roomId === view.self.roomId)).map(p => p.id).slice(0, 15),
    dead: [...dead].slice(0, 15)
  };
}

/** Enumerated proposals are still subject to authoritative engine validation. */
export function candidates(view, memory) {
  const allowed = new Set(view.availableActions ?? []);
  const can = type => allowed.has(type);
  const actions = [];
  if (!view.self?.alive || ['ended', 'paused', 'lobby'].includes(view.phase)) return actions;
  if (view.phase === 'discussion') {
    if (can('say') && (memory.discussionCount ?? 0) < 3) actions.push({ type: 'say', text: dialogue(view, memory) });
    return actions;
  }
  if (view.phase === 'voting') {
    const votes = view.meeting?.votes ?? [];
    if (can('vote') && !votes.some(v => v.playerId === view.self.id)) {
      const preferred = suspect(view, memory);
      actions.push({ type: 'vote', targetId: preferred });
      for (const p of ordered((view.players ?? []).filter(p => p.alive && p.id !== view.self.id && !view.self.teammates?.includes(p.id)))) {
        if (p.id !== preferred) actions.push({ type: 'vote', targetId: p.id });
      }
      if (preferred !== 'skip') actions.push({ type: 'vote', targetId: 'skip' });
    }
    return actions;
  }
  if (view.phase !== 'roam') return actions;
  if (view.worldVersion === 1) return worldCandidates(view, memory, suspect(view, memory));
  if (can('report')) for (const bodyId of visibleBodies(view)) actions.push({ type: 'report', bodyId });
  if (can('repair') && view.sabotage?.active && view.sabotage.roomId === view.self.roomId) actions.push({ type: 'repair' });
  if (view.self.role === 'saboteur') {
    if (can('eliminate') && ready(view, 'killAt')) {
      for (const p of ordered((view.players ?? []).filter(p => p.alive && p.id !== view.self.id && !view.self.teammates?.includes(p.id) && p.roomId === view.self.roomId))) {
        actions.push({ type: 'eliminate', targetId: p.id });
      }
    }
    if (can('sabotage') && !view.sabotage?.active && ready(view, 'sabotageAt')) actions.push({ type: 'sabotage' });
  } else if (can('task') && ready(view, 'taskAt')) {
    for (const task of ordered((view.self.tasks ?? []).filter(t => !t.completed && t.roomId === view.self.roomId))) actions.push({ type: 'task', taskId: task.id });
  }
  if (can('meeting') && view.self.roomId === 'bridge' && ready(view, 'meetingAt') && view.self.meetingsRemaining > 0 && suspect(view, memory) !== 'skip' && view.self.role !== 'saboteur' && !view.sabotage?.active) actions.push({ type: 'meeting' });
  if (can('move') && ready(view, 'moveAt')) {
    let goal;
    if (view.sabotage?.active && view.self.role !== 'saboteur') goal = view.sabotage.roomId;
    else if (view.self.role !== 'saboteur') {
      const tasks = (view.self.tasks ?? []).filter(t => !t.completed && t.roomId !== view.self.roomId);
      tasks.sort((a, b) => route(view.self.roomId, a.roomId).length - route(view.self.roomId, b.roomId).length || a.id.localeCompare(b.id));
      goal = tasks[0]?.roomId;
    }
    // Patrol deterministically after work; different keepers follow different offsets.
    const offset = Math.max(0, (view.players??[]).findIndex(p => p.id === view.self.id));
    if (!goal) {
      const index = ((memory.patrol ?? 0) + offset) % ROOM_LAYOUT.length;
      goal = ROOM_LAYOUT[index].id;
      if (goal === view.self.roomId) { memory.patrol = (memory.patrol ?? 0) + 1; goal = ROOM_LAYOUT[(index + 1) % ROOM_LAYOUT.length].id; }
    }
    const next = route(view.self.roomId, goal)[0];
    if (next) actions.push({ type: 'move', roomId: next });
    for (const id of rooms.get(view.self.roomId)?.neighbors ?? []) if (id !== next) actions.push({ type: 'move', roomId: id });
  }
  if (can('wait')) actions.push({ type: 'wait' });
  return actions.slice(0, 40);
}
