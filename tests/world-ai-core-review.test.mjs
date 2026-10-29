import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.env.WORLD_AI_SOURCE_ROOT ? pathToFileURL(resolve(process.env.WORLD_AI_SOURCE_ROOT) + '/') : new URL('../', import.meta.url);
const engine = await import(new URL('server/engine/index.mjs', root));
const { WORLD, WORLD_STATIONS, distance } = await import(new URL('shared/world.mjs', root));
const accepted = result => { assert.equal(result.accepted, true, JSON.stringify(result.error)); return result.state; };

// Independent Core controls. The fixture drives accepted actions to stage an
// attack; hidden state is read by assertions, never supplied to an AI/client.
test('independent world Core: wall-occluded attack/body stays private and firsthand position/time survives report/restart', () => {
  let state = engine.createMatch({ id: 'world-private-attack', world: true, mode: 'spectator', seed: 'review-privacy', now: 0, config: { initialKillCooldownMs: 1, discussionMs: 1000, votingMs: 1000 } });
  assert.equal(state.schemaVersion, 2);
  const saboteur = state.players.find(p => p.role === 'saboteur').id;
  const [victim, witness, observer] = state.players.filter(p => p.role === 'crew').map(p => p.id);
  for (const id of [saboteur, victim, witness]) state = accepted(engine.applyAction(state, id, { id: `stage-${id}`, type: 'navigate', x: WORLD_STATIONS.archive.x, y: WORLD_STATIONS.archive.y }, 0));
  state = accepted(engine.applyAction(state, observer, { id: 'stage-observer', type: 'navigate', x: 630, y: 350 }, 0));
  state = engine.tick(state, 15000).state;
  assert(distance(state.players.find(p => p.id === observer).position, WORLD_STATIONS.archive) < WORLD.visibilityRadius, 'wall rather than distance hides the attack');
  state = accepted(engine.applyAction(state, saboteur, { id: 'attack', type: 'eliminate', targetId: victim }, 15000));
  const view = engine.getPlayerView(state, observer, 15000), local = engine.getPlayerView(state, witness, 15000), spectator = engine.getPlayerView(state, null, 15000);
  for (const id of [saboteur, victim]) { assert.equal(view.players.find(p => p.id === id).position, null); assert.equal(view.players.find(p => p.id === id).roomId, null); }
  assert(!view.events.some(e => ['body', 'witness'].includes(e.type)));
  assert(!spectator.events.some(e => e.type === 'witness'));
  const body = local.events.find(e => e.type === 'body'), seen = local.events.find(e => e.type === 'witness');
  assert.deepEqual(body.position, { x: WORLD_STATIONS.archive.x, y: WORLD_STATIONS.archive.y }); assert.equal(body.at, 15000);
  assert.equal(seen.playerId, saboteur); assert.equal(seen.targetId, victim); assert.deepEqual(seen.position, body.position);
  assert.equal(engine.getReplay(state), null);
  state = engine.tick(JSON.parse(JSON.stringify(state)), 20000).state;
  const restored = engine.getPlayerView(state, witness, 20000).events.find(e => e.type === 'body'); assert.equal(restored.at, 15000); assert.deepEqual(restored.position, body.position);
  state = accepted(engine.applyAction(state, witness, { id: 'report', type: 'report', bodyId: body.bodyId }, 20000));
  assert.equal(state.phase, 'discussion'); assert(state.players.every(p => !p.motion.path.length && !p.motion.manual));
  assert(!engine.getPlayerView(state, observer, 20000).events.some(e => e.type === 'body'));
  assert(!engine.getPlayerView(state, observer, 20000).events.some(e => e.type === 'witness'));
  assert(engine.getPlayerView(state, witness, 20000).events.some(e => e.type === 'witness' && e.playerId === saboteur));
  state = engine.tick(state, 21000).state;
  for (const player of state.players.filter(p => p.alive)) state = accepted(engine.applyAction(state, player.id, { id: `ballot-${player.id}`, type: 'vote', targetId: saboteur }, 21000));
  state = engine.tick(state, 22000).state; assert.equal(state.phase, 'ended'); assert.equal(state.outcome.reason, 'ejection');
  assert(engine.getReplay(state).some(e => e.type === 'witness' && e.playerId === saboteur));
});

test('independent world Core: late input settles only up to the meeting boundary and cannot resume movement during council', () => {
  let state = engine.createMatch({ id: 'world-late-direction', world: true, seed: 'review-phase', now: 0, config: { roamDeadlineMs: 1000, discussionMs: 1000, votingMs: 1000 } });
  const start = { ...state.players[0].position };
  state = accepted(engine.applyInput(state, 'p1', { seq: 1, dx: 1, dy: 0 }, 900));
  const result = engine.applyInput(state, 'p1', { seq: 2, dx: 1, dy: 0 }, 1500);
  assert.equal(result.accepted, false); assert.equal(result.error.code, 'WRONG_PHASE'); state = result.state;
  assert.equal(state.phase, 'discussion'); assert(Math.abs(distance(start, state.players[0].position) - WORLD.speed * .1) < 1e-6);
  const position = { ...state.players[0].position }; state = engine.tick(JSON.parse(JSON.stringify(state)), 2500).state;
  assert.equal(state.phase, 'voting'); assert.deepEqual(state.players[0].position, position);
  assert.equal(state.players[0].motion.seq, 2, 'phase denial is persisted separately from action IDs'); assert.equal(state.players[0].motion.manual, false);
  const resumed = engine.tick(state, 3000).state;
  const duplicate = engine.applyInput(resumed, 'p1', { seq: 2, dx: 1, dy: 0 }, 3000);
  assert.equal(duplicate.accepted, false); assert.equal(duplicate.duplicate, true); assert.equal(duplicate.error.code, 'WRONG_PHASE');
  assert.deepEqual(duplicate.state.players[0].position, position);
  state = accepted(engine.applyInput(duplicate.state, 'p1', { seq: 3, dx: 1, dy: 0 }, 3000));
  state = engine.tick(state, 3100).state; assert(Math.abs(distance(position, state.players[0].position) - WORLD.speed * .1) < 1e-6);
});
