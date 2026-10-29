import { ROOM_LAYOUT, CHARACTERS } from '../../shared/contracts.mjs';

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
  return [...found.values()].slice(0, 6);
}

function suspect(view, memory) {
  const living = ordered((view.players ?? []).filter(p => p.alive && p.id !== view.self.id));
  const ranked = living.filter(p => (memory.suspicion?.[p.id] ?? 0) > 0)
    .sort((a, b) => memory.suspicion[b.id] - memory.suspicion[a.id] || a.id.localeCompare(b.id));
  if (ranked.length) return ranked[0].id;
  if (view.self.role === 'saboteur' && living.length) return living[0].id;
  return 'skip';
}

function dialogue(view, memory) {
  const target = suspect(view, memory);
  const name = CHARACTERS.find(p => p.id === target)?.name;
  const room = rooms.get(view.self.roomId)?.name ?? 'my station';
  const number = memory.discussionCount ?? 0;
  if (view.self.role === 'saboteur') return [
    `I was checking the relays near ${room}. Who can account for the last crossing?`,
    name ? `${name}, tell us your route. We need a consistent account.` : 'Keep the repair teams together. Splitting up makes this easier for the saboteur.',
    'I am voting on the accounts we have heard. Keep the beacon running.'
  ][Math.min(number, 2)];
  return [
    `I was at ${room}. ${view.self.tasks?.filter(t => !t.completed).length ?? 0} jobs remain on my list. What did you see?`,
    name ? `I am concerned about ${name}: they were nearby before someone disappeared. That is a suspicion, not proof.` : 'I have no firsthand evidence to accuse anyone. I favor skipping unless someone saw the attack.',
    'After the vote, pair up for repairs and finish the remaining jobs.'
  ][Math.min(number, 2)];
}

/** Memory records observations from this actor's safe view, never engine state. */
export function observe(view, memory) {
  const phaseKey = view.meeting?.id ?? null;
  if (memory.meetingId !== phaseKey) {
    memory.meetingId = phaseKey;
    memory.discussionCount = 0;
  }
  for (const event of view.events ?? []) {
    if (event.type === 'witness' && event.playerId !== view.self.id && CHARACTERS.some(p => p.id === event.playerId)) {
      memory.suspicion ??= {};
      memory.suspicion[event.playerId] = 3;
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
    nearby: (view.players ?? []).filter(p => p.id !== view.self.id && p.alive && p.roomId === view.self.roomId).map(p => p.id).slice(0, 6),
    dead: [...dead].slice(0, 6)
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
      for (const p of ordered((view.players ?? []).filter(p => p.alive && p.id !== view.self.id))) {
        if (p.id !== preferred) actions.push({ type: 'vote', targetId: p.id });
      }
      if (preferred !== 'skip') actions.push({ type: 'vote', targetId: 'skip' });
    }
    return actions;
  }
  if (view.phase !== 'roam') return actions;
  if (can('report')) for (const bodyId of visibleBodies(view)) actions.push({ type: 'report', bodyId });
  if (can('repair') && view.sabotage?.active && view.sabotage.roomId === view.self.roomId) actions.push({ type: 'repair' });
  if (view.self.role === 'saboteur') {
    if (can('eliminate') && ready(view, 'killAt')) {
      for (const p of ordered((view.players ?? []).filter(p => p.alive && p.id !== view.self.id && p.roomId === view.self.roomId))) {
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
    const offset = Math.max(0, CHARACTERS.findIndex(p => p.id === view.self.id));
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
