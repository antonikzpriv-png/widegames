import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiController } from '../server/ai/index.mjs';
import { candidates, observe } from '../server/ai/demo.mjs';
import { worldTaskAction } from '../server/ai/world.mjs';
import { challenge } from '../server/engine/tasks.mjs';
import { createStationChallenge, nextStationInput } from '../shared/station-challenges.mjs';
import { PERSONAS, LOBBY_DEFAULTS, rosterFor } from '../shared/lobby.mjs';
import { ROOM_LAYOUT } from '../shared/contracts.mjs';
import { deviceFacts } from '../server/features/strategy/index.mjs';
import * as engine from '../server/engine/index.mjs';
import { getMap } from '../shared/maps/index.mjs';

const config = { provider: 'anthropic', apiKey: 'mocked-offline-integration', maxCalls: 50,
  maxTokens: 250000, maxCostUsd: 10, decisionIntervalMs: 1, timeoutMs: 1000 };
const response = () => new Response(JSON.stringify({ stop_reason: 'tool_use', content: [
  { type: 'tool_use', name: 'pick_action', input: { choice: 0 } }
], usage: { input_tokens: 100, output_tokens: 20 } }));
function viewFor(id, saboteur = false) {
  return { matchId: 'integrated-generation-1', phase: 'discussion', serverNow: 100000,
    rooms: structuredClone(ROOM_LAYOUT),
    players: PERSONAS.map(({ id, name, color }) => ({ id, name, color, alive: true, roomId: 'bridge' })),
    self: { id, role: saboteur ? 'saboteur' : 'crew', alive: true, roomId: 'bridge', tasks: [],
      cooldowns: {}, meetingsRemaining: 1, ...(saboteur ? { teammates: ['p13', 'p14'].filter(peer => peer !== id) } : {}) },
    tasks: { completed: 0, total: 36 }, meeting: { id: 'council-1', votes: [], messages: [] },
    events: [], availableActions: ['say'] };
}

test('all 15 public actor identities retain their own safe personas and all peers in mocked council requests', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    requests.push(JSON.parse(options.body));
    return response();
  });
  for (const persona of PERSONAS) {
    const view = viewFor(persona.id, persona.id === 'p15'), context = {};
    const player = { id: persona.id, get persona() { assert.fail('hidden supplied persona read'); } };
    const action = await createAiController({ config }).decide({ view, player, context,
      commitReservation: async () => {} });
    assert.equal(action.type, 'say');
    const request = requests.at(-1), safe = JSON.parse(request.messages[0].content);
    assert.ok(request.system.includes(persona.persona), persona.id);
    assert.equal(safe.players.length, 15);
    assert.deepEqual(safe.players.slice(9).map(p => p.id), ['p10', 'p11', 'p12', 'p13', 'p14', 'p15']);
    assert.ok(safe.players.every(p => !Object.hasOwn(p, 'role') && !Object.hasOwn(p, 'persona')));
    if (persona.id === 'p15') assert.deepEqual(safe.self.teammates, ['p13', 'p14']);
    else assert.equal(Object.hasOwn(safe.self, 'teammates'), false);
    assert.equal(context.matches['match:' + view.matchId].calls, 1);
  }
  assert.equal(requests.length, 15);
});

test('private multiple-saboteur teammate knowledge excludes allies from vote and attack proposals', () => {
  const view = viewFor('p15', true);
  view.phase = 'voting'; view.availableActions = ['vote'];
  const votes = candidates(view, { witnesses: { p13: { at: 1 } }, suspicion: { p14: 3 } });
  assert.ok(votes.length > 1);
  assert.ok(votes.every(action => !['p13', 'p14'].includes(action.targetId)));
  view.phase = 'roam'; view.availableActions = ['eliminate', 'wait'];
  const attacks = candidates(view, {});
  assert.ok(attacks.some(action => action.type === 'eliminate'));
  assert.ok(attacks.every(action => !['p13', 'p14'].includes(action.targetId)));
});

test('merged AI dispatch respects edition-3 time gates and preserves the independent station protocol', () => {
  for (const kind of ['repair', 'transfer', 'sample']) {
    const task = { id: 'integrated-' + kind, roomId: 'bridge', kind, edition: 3 };
    task.progress = { ...challenge(task), index: kind === 'repair' ? 3 : 1, readyAt: 120000 };
    assert.deepEqual(worldTaskAction({ serverNow: 119999 }, task), { type: 'wait' });
    const action = worldTaskAction({ serverNow: 120000 }, task);
    assert.equal(action.type, 'taskStep'); assert.equal(action.taskId, task.id);
    assert.equal(action.step, task.progress.index); assert.equal(typeof action.input, 'string');
  }
  for (const kind of ['circuit', 'signal', 'sequence', 'glyphs', 'alignment', 'manifolds']) {
    const task = { id: 'retained-station-' + kind, kind: 'station', completed: false,
      challenge: createStationChallenge({ kind, seed: 'integrated-' + kind }) };
    assert.deepEqual(worldTaskAction({ serverNow: 120000 }, task),
      { type: 'taskInteract', taskId: task.id, ...nextStationInput(task.challenge) });
  }
});

test('late reservation authorization from an old generation cannot send or mutate fresh AI context', async t => {
  const network = t.mock.method(globalThis, 'fetch', () => assert.fail('stale generation sent provider call'));
  const view = viewFor('p15'), context = {};
  const action = await createAiController({ config }).decide({ view, player: { id: 'p15' }, context,
    commitReservation: async () => { context.activeMatchId = 'integrated-generation-2';
      context.matches['match:integrated-generation-2'] = { mode: 'demo', calls: 0, tokens: 0,
        costUsd: 0, memories: {}, reservations: [] }; } });
  assert.equal(action, null); assert.equal(network.mock.callCount(), 0);
  assert.equal(context.matches['match:integrated-generation-1'].calls, 1);
  assert.equal(context.matches['match:integrated-generation-1'].reservations.length, 1);
  assert.deepEqual(context.matches['match:integrated-generation-2'], { mode: 'demo', calls: 0,
    tokens: 0, costUsd: 0, memories: {}, reservations: [] });
});


test('15-keeper vitals samples and observed peers retain their original dated public records without private fields', () => {
  const view = viewFor('p1'), at = view.serverNow - 500;
  view.investigation = { observations: [{ id: 'vitals-15', deviceId: 'vitals-console',
    kind: 'vitals', at, data: { players: view.players.map(p => ({ id: p.id, status: 'alive',
      privateRole: 'PRIVATE_SENTINEL' })) } }] };
  const facts = deviceFacts(view);
  assert.equal(facts.length, 1); assert.equal(facts[0].at, at);
  assert.equal(facts[0].source, 'vitals-console'); assert.equal(facts[0].players.length, 15);
  assert.deepEqual(facts[0].players.at(-1), { id: 'p15', status: 'alive' });
  assert.ok(!JSON.stringify(facts).includes('PRIVATE_SENTINEL'));
  const memory = {}; observe(view, memory);
  assert.equal(memory.observation.nearby.length, 14);
  assert.ok(memory.observation.nearby.includes('p15'));
});


test('configured tactical AI receives an opening descriptor and advances a generated edition-3 task', async t => {
  const network = t.mock.method(globalThis, 'fetch', () => assert.fail('Demo task used a provider'));
  const settings = { ...LOBBY_DEFAULTS, capacity: 15, saboteurs: 3, tasksPerCrew: 4 };
  const state = engine.createMatch({ id: 'integrated-task-opening', mode: 'spectator', world: true,
    tactical: true, stationTasks: true, map: { id: 'beacon', version: 2 }, settings,
    roster: rosterFor(15), seed: 33, now: 1000 });
  const player = state.players.find(p => p.role === 'crew'), task = player.tasks.find(task => task.edition === 3);
  assert.ok(task);
  // A stationary range fixture isolates descriptor/dispatch authority from navigation, which has separate tests.
  player.tasks = [task]; const station = getMap(state.map).geometry.WORLD_STATIONS[task.roomId];
  player.position = { x: station.x, y: station.y };
  player.roomId = task.roomId;
  const view = engine.getPlayerView(state, player.id, 1000);
  assert.ok(view.interactions.some(h => h.type === 'task' && h.enabled && h.fields.taskId === task.id),
    'An incomplete equipment task needs its legal opening descriptor');
  const premature = engine.applyAction(state, player.id, { id: 'premature', type: 'task', taskId: task.id }, 1000);
  assert.equal(premature.accepted, false); assert.equal(premature.error.code, 'TASK_INCOMPLETE');
  const ai = createAiController({ config: { provider: 'demo', decisionIntervalMs: 1 } });
  const action = await ai.decide({ view, player: { id: player.id }, context: {} });
  assert.equal(action.type, 'taskStep'); assert.equal(action.taskId, task.id);
  const result = engine.applyAction(state, player.id, action, 1000);
  assert.equal(result.accepted, true, JSON.stringify(result.error));
  assert.equal(result.state.players.find(p => p.id === player.id).tasks[0].progress.index, 1);
  assert.equal(network.mock.callCount(), 0);
});

test('15 autonomous keepers with three saboteurs complete mixed station/equipment jobs through JSON restart', { timeout: 180000 }, async t => {
  const network = t.mock.method(globalThis, 'fetch', () => assert.fail('Autonomous demo used a provider'));
  const settings = { ...LOBBY_DEFAULTS, capacity: 15, saboteurs: 3, tasksPerCrew: 4,
    speed: 240, vision: 480, sabotageEnabled: false, emergencyMeetingsEnabled: false };
  // Delayed hostile actions isolate completion of the generated 48 crew jobs; default matches have separate tests.
  let state = engine.createMatch({ id: 'integrated-15-mixed', mode: 'spectator', world: true,
    tactical: true, stationTasks: true, map: { id: 'beacon', version: 2 }, settings,
    roster: rosterFor(15), seed: 33, now: 1000,
    config: { initialKillCooldownMs: 900000, roamDeadlineMs: 1000000, maxMatchMs: 1200000 } });
  const demoConfig = { provider: 'demo', decisionIntervalMs: 1800, maxCalls: 0 };
  let ai = createAiController({ config: demoConfig }), context = {}, restarted = false;
  const counts = {};
  for (let now = 1000; now < 250000 && !['ended', 'paused'].includes(state.phase); now += 600) {
    state = engine.tick(state, now).state;
    for (const player of state.players.filter(p => !p.human)) {
      const view = engine.getPlayerView(state, player.id, now);
      if (view.phase !== 'ended') assert.ok(view.players.every(p => !Object.hasOwn(p, 'role')));
      if (view.self.role === 'saboteur') assert.equal(view.self.teammates.length, 2);
      const action = await ai.decide({ view, player: { id: player.id }, context });
      if (!action) continue;
      const result = engine.applyAction(state, player.id, action, now);
      assert.equal(result.accepted, true, JSON.stringify({ playerId: player.id, action, error: result.error }));
      state = result.state; counts[action.type] = (counts[action.type] ?? 0) + 1;
    }
    if (!restarted && now >= 31000) {
      state = JSON.parse(JSON.stringify(state)); context = JSON.parse(JSON.stringify(context));
      ai = createAiController({ config: demoConfig }); restarted = true;
    }
  }
  assert.equal(restarted, true);
  assert.deepEqual({ winner: state.outcome?.winner, reason: state.outcome?.reason }, { winner: 'crew', reason: 'tasks' });
  assert.equal(state.players.length, 15); assert.equal(state.players.filter(p => p.role === 'saboteur').length, 3);
  const jobs = state.players.flatMap(p => p.tasks);
  assert.equal(jobs.length, 48); assert.ok(jobs.every(task => task.completed));
  assert.ok(counts.taskStep > 0); assert.ok(counts.taskInteract > 0); assert.ok(counts.task > 0);
  assert.equal(ai.describe(context).calls, 0); assert.equal(network.mock.callCount(), 0);
  t.diagnostic(JSON.stringify({ fixture: 'Hostility-disabled task-completion watch', counts, outcome: state.outcome, completed: jobs.length }));
});


test('15-player dated evidence dialogue stays within the public speech limit with maximum-length names', () => {
  const view = viewFor('p2'); view.beaconVersion = 1;
  view.players = view.players.map(p => ({ ...p, name: 'Keeper-' + p.id.padEnd(17, 'x') }));
  assert.ok(view.players.every(p => p.name.length === 24));
  view.investigation = { observations: [{ id: 'large-vitals', deviceId: 'vitals-console', kind: 'vitals',
    at: view.serverNow - 1000, data: { players: view.players.map(p => ({ id: p.id, status: 'alive' })) } }] };
  const speech = candidates(view, {})[0];
  assert.equal(speech.type, 'say'); assert.ok(speech.text.length <= 280);
  assert.match(speech.text, /^Vitals sampled /);
  assert.equal(deviceFacts(view)[0].players.length, 15, 'The underlying dated sample stays intact');
});
