import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.env.WORLD_AI_SOURCE_ROOT ? pathToFileURL(resolve(process.env.WORLD_AI_SOURCE_ROOT) + '/') : new URL('../', import.meta.url);
const pin = process.env.WORLD_AI_REVIEW_ENGINE_PIN;
const dataUrl = value => 'data:text/javascript;base64,' + Buffer.from(value).toString('base64');
async function loadEngine(revision) {
  if (!revision) return import(new URL('server/engine/index.mjs', root));
  assert.match(revision, /^[a-f0-9]{40}$/);
  const show = path => execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8' });
  // Only dependency locations change; the actual committed engine/runtime logic
  // runs against the qualified public geometry used by the source root.
  const contracts = dataUrl(readFileSync(new URL('shared/contracts.mjs', root), 'utf8'));
  const geometry = dataUrl(readFileSync(new URL('shared/world.mjs', root), 'utf8').replace("'./contracts.mjs'", JSON.stringify(contracts)).replace(/from '(\.\/maps\/[^']+)'/g, (_match, specifier) => `from ${JSON.stringify(new URL(specifier, new URL('shared/world.mjs', root)).href)}`));
  const runtime = dataUrl(show('server/engine/world-runtime.mjs'));
  const source = show('server/engine/index.mjs');
  assert(source.includes("'./world-runtime.mjs'"));
  const linked = source.replace("'../../shared/contracts.mjs'", JSON.stringify(contracts)).replace("'./world-runtime.mjs'", JSON.stringify(runtime)).replace("process.env.WORLD_ENGINE_GEOMETRY_MODULE||'../../shared/world.mjs'", JSON.stringify(geometry));
  return import(dataUrl(linked));
}
function stage(engine) {
  let state = engine.createMatch({ id: 'independent-replay-times', world: true, seed: 2, now: 0, config: { meetingCooldownMs: 1, discussionMs: 1000, votingMs: 1000 } });
  const act = (id, action, at) => { const result = engine.applyAction(state, id, action, at); assert.equal(result.accepted, true, JSON.stringify(result.error)); state = result.state; };
  const input = engine.applyInput(state, 'p1', { seq: 1, dx: -1, dy: 0 }, 0); assert(input.accepted); state = input.state;
  for (const [id, x, y] of [['p2', 818, 272], ['p3', 890, 272], ['p4', 746, 327], ['p5', 818.125, 327]]) act(id, { id: `short-${id}`, type: 'navigate', x, y }, 0);
  state = engine.tick(state, 1000).state;
  assert.equal(engine.getReplay(state), null);
  assert(engine.getPlayerView(state, null, 1000).players.every(player => !Object.hasOwn(player, 'role')));
  const saboteur = state.players.find(player => player.role === 'saboteur').id;
  act('p2', { id: 'bell', type: 'meeting' }, 1000); state = engine.tick(state, 2000).state;
  const voter = state.players.find(player => player.id !== saboteur).id;
  act(voter, { id: 'ballot', type: 'vote', targetId: saboteur }, 2000); state = engine.tick(state, 3000).state;
  assert.equal(state.phase, 'ended'); assert.equal(state.outcome.reason, 'ejection');
  return state;
}

test('historical Core aa471eb KNOWN DEFECT: actor settlement records600 before actual100ms arrivals', async () => {
  const engine = await loadEngine('aa471eb209c2c58a8d95ad9fa855ff01ebae83a2'), state = stage(engine), replay = engine.getReplay(state);
  const times = replay.filter(event => event.type === 'motion').map(event => event.at);
  assert.deepEqual(times, [600, 100, 100, 100, 18.125 / 180 * 1000]); assert(replay.some((event, index) => index && event.at < replay[index - 1].at));
});

test('independent Core replay: actual movement times ascend and equal-time causal insertion order is stable', async () => {
  const engine = await loadEngine(pin), state = stage(engine), before = structuredClone(state), replay = engine.getReplay(state);
  const motions = replay.filter(event => event.type === 'motion');
  assert.deepEqual(motions.map(event => [event.playerId, event.at]), [['p2', 100], ['p3', 100], ['p4', 100], ['p5', 18.125 / 180 * 1000], ['p1', 600]]);
  assert(replay.every((event, index) => !index || event.at >= replay[index - 1].at));
  for (const at of new Set(state.replay.map(event => event.at))) assert.deepEqual(replay.filter(event => event.at === at).map(event => event.id), state.replay.filter(event => event.at === at).map(event => event.id), `causal ties reordered at${at}`);
  const ending = replay.filter(event => event.at === 3000).map(event => event.type);
  assert(ending.indexOf('vote_result') < ending.indexOf('ejected')); assert(ending.indexOf('ended') < ending.indexOf('role_reveal'));
  assert.deepEqual(state, before, 'export must not sort/mutate persisted event order');
  const roles = replay.find(event => event.type === 'started').roles; roles[0].role = 'corrupt-fixture';
  motions[0].position.x = -999; replay.find(event => event.type === 'action').action.type = 'corrupt-fixture'; replay.reverse();
  assert.deepEqual(state, before, 'nested replay exports must be defensive copies');
  const again = engine.getReplay(state); assert(!JSON.stringify(again).includes('corrupt-fixture')); assert(again.every((event, index) => !index || event.at >= again[index - 1].at));
  assert(engine.getPlayerView(state, null, 3000).players.every(player => ['crew', 'saboteur'].includes(player.role)));
});

test('independent Core replay: active/discussion/voting/paused views withhold role-revealed export', async () => {
  const engine = await loadEngine(pin); let state = engine.createMatch({ id: 'replay-phase-guard', world: true, seed: 2, now: 0, config: { meetingCooldownMs: 1, discussionMs: 1000, votingMs: 1000, maxMatchMs: 10000 } });
  for (const now of [0, 1]) { state = engine.tick(state, now).state; assert.equal(engine.getReplay(state), null); }
  let result = engine.applyAction(state, 'p2', { id: 'meeting', type: 'meeting' }, 1); assert(result.accepted); state = result.state;
  assert.equal(state.phase, 'discussion'); assert.equal(engine.getReplay(state), null); state = engine.tick(state, 1001).state;
  assert.equal(state.phase, 'voting'); assert.equal(engine.getReplay(state), null); state = engine.tick(state, 10000).state;
  assert.equal(state.phase, 'paused'); assert.equal(engine.getReplay(state), null);
  for (const player of engine.getPlayerView(state, null, 10000).players) { assert(!Object.hasOwn(player, 'role')); for (const key of ['motion', 'destination', 'tasks', 'inputSeq']) assert(!Object.hasOwn(player, key)); }
});

test('independent Core input: delayed lifecycle zero cannot cancel a newer accepted wire intent', async () => {
  const engine = await loadEngine(pin); let state = engine.createMatch({ id: 'lifecycle-stop-order', world: true, seed: 2, now: 0 });
  let result = engine.applyInput(state, 'p1', { seq: 41, dx: 1, dy: 0 }, 0); assert(result.accepted); state = result.state;
  result = engine.applyInput(state, 'p1', { seq: 44, dx: 0, dy: 1 }, 100); assert(result.accepted); state = result.state;
  const delayedStop = engine.applyInput(state, 'p1', { seq: 42, dx: 0, dy: 0 }, 200); assert.equal(delayedStop.accepted, false); assert.equal(delayedStop.error.code, 'STALE_INPUT');
  state = engine.tick(delayedStop.state, 300).state;
  const self = engine.getPlayerView(state, 'p1', 300).self; assert.equal(self.inputSeq, 44); assert.equal(self.moving, true); assert.deepEqual(self.position, { x: 746, y: 308 });
});
