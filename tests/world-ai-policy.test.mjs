import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Default is actual checkout. An explicit read-only qualification overlay is
// permitted before the coordinator imports the shared contract; never skipped.
const root = process.env.WORLD_AI_SOURCE_ROOT ? pathToFileURL(resolve(process.env.WORLD_AI_SOURCE_ROOT) + '/') : new URL('../', import.meta.url);
const { createAiController } = await import(new URL('server/ai/index.mjs', root));
const { CHARACTERS, ROOM_LAYOUT } = await import(new URL('shared/contracts.mjs', root));
const { WORLD, WORLD_STATIONS, WORLD_BELL, worldSpawn, isWalkable, distance, findWorldPath } = await import(new URL('shared/world.mjs', root));
const controller = extra => createAiController({ config: { provider: 'demo', decisionIntervalMs: 10, ...extra } });
const live = extra => controller({ provider: 'anthropic', apiKey: 'offline-fixture-secret', model: 'claude-haiku-4-5-20251001', maxTokens: 250000, maxCostUsd: .5, ...extra });
function fixture() {
  return { matchId: 'world-safe-fixture', worldVersion: 1, version: 1, phase: 'roam', serverNow: 1000,
    rooms: structuredClone(ROOM_LAYOUT), players: CHARACTERS.map(p => ({ id: p.id, alive: true, roomId: p.id === 'p1' ? 'bridge' : null, position: p.id === 'p1' ? worldSpawn('p1') : null })),
    self: { id: 'p1', role: 'crew', alive: true, roomId: 'bridge', position: worldSpawn('p1'), inputSeq: 0, moving: false, destination: null,
      tasks: [{ id: 'task-bridge', roomId: 'bridge', completed: false }], cooldowns: {}, meetingsRemaining: 1 },
    tasks: { total: 15, completed: 0 }, sabotage: null, events: [], meeting: null,
    availableActions: ['navigate', 'wait'] };
}
const decide = (view, c = controller(), context = {}, extra = {}) => c.decide({ view, context, player: CHARACTERS[0], ...extra });
const actionFields = action => { const { id, ...fields } = action; assert.match(id, /^ai_[A-Za-z0-9_-]+$/); return fields; };
const state = context => context.matches[`match:${context.activeMatchId}`];
function freeze(value) { Object.freeze(value); for (const v of Object.values(value)) if (v && typeof v === 'object') freeze(v); return value; }
function mockResponse() { return new Response(JSON.stringify({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'pick_action', input: { choice: 0 } }], usage: { input_tokens: 100, output_tokens: 20 } }), { headers: { 'content-type': 'application/json' } }); }

test('world fixture: same room out of range navigates to the public station deterministically', async () => {
  const view = freeze(fixture());
  assert(distance(view.self.position, WORLD_STATIONS.bridge) > WORLD.interactionRadius);
  const expected = { type: 'navigate', x: WORLD_STATIONS.bridge.x, y: WORLD_STATIONS.bridge.y };
  assert.deepEqual(actionFields(await decide(view)), expected);
  assert.deepEqual(actionFields(await decide(view)), expected);
});

test('world fixture: active route waits, then arrival permits a nearby task; cooldown waits', async () => {
  const view = fixture(), c = controller(), context = {};
  view.self.moving = true; view.self.destination = { ...WORLD_STATIONS.bridge };
  assert.equal((await decide(view, c, context)).type, 'wait');
  view.serverNow += 10; view.self.position = { ...WORLD_STATIONS.bridge }; view.self.moving = false;
  view.availableActions.push('task');
  assert.deepEqual(actionFields(await decide(view, c, context)), { type: 'task', taskId: 'task-bridge' });
  view.serverNow += 10; view.self.cooldowns.taskAt = view.serverNow + 1000;
  assert.equal((await decide(view, c, context)).type, 'wait');
});

test('world fixture: task path selection uses reachable public geometry and stable task IDs', async () => {
  const view = fixture(); view.self.position = { ...WORLD_STATIONS.bridge };
  view.self.tasks = [{ id: 'z', roomId: 'engine' }, { id: 'a', roomId: 'archive' }, { id: 'b', roomId: 'archive' }];
  const action = await decide(view);
  assert.deepEqual(actionFields(action), { type: 'navigate', x: WORLD_STATIONS.archive.x, y: WORLD_STATIONS.archive.y });
  assert(findWorldPath(view.self.position, action).length > 1, 'route goes around walls rather than across void');
});

test('world fixture: local visible body approach interrupts travel and reports only in range', async () => {
  const view = fixture(); view.self.position = { x: 650, y: 300 }; view.self.moving = true; view.self.destination = { ...WORLD_STATIONS.engine };
  view.events = [{ type: 'body', bodyId: 'body-p2', roomId: 'bridge', position: { x: 950, y: 300 }, at: 900 }];
  assert.deepEqual(actionFields(await decide(view)), { type: 'navigate', x: 950, y: 300 });
  view.self.position = { x: 850, y: 300 }; view.availableActions.push('report');
  assert.deepEqual(actionFields(await decide(view)), { type: 'report', bodyId: 'body-p2' });
});

test('world fixture: absent, malformed or occluded body coordinates never become destinations', async () => {
  for (const position of [null, { x: NaN, y: 1 }, WORLD_STATIONS.engine, { x: 1100, y: 300 }]) {
    const view = fixture(); view.events = [{ type: 'body', bodyId: 'body-hidden', roomId: 'bridge', position }];
    assert.deepEqual(actionFields(await decide(view)), { type: 'navigate', x: WORLD_STATIONS.bridge.x, y: WORLD_STATIONS.bridge.y });
  }
});

test('world fixture: sabotage interrupts walking; completed contribution is remembered across serialization', async () => {
  const view = fixture(), c = controller(); let context = {};
  view.self.moving = true; view.self.destination = { ...WORLD_STATIONS.archive };
  view.sabotage = { active: true, roomId: 'engine', deadlineAt: 50000, repairsCompleted: 0, repairsRequired: 2 };
  assert.deepEqual(actionFields(await decide(view, c, context)), { type: 'navigate', x: WORLD_STATIONS.engine.x, y: WORLD_STATIONS.engine.y });
  view.self.position = { ...WORLD_STATIONS.engine }; view.self.roomId = 'engine'; view.self.moving = false; view.serverNow += 10; view.availableActions.push('repair');
  assert.equal((await decide(view, c, context)).type, 'repair');
  context = JSON.parse(JSON.stringify(context)); view.serverNow += 10; view.availableActions = ['navigate', 'wait'];
  assert.equal(state(context).memories['actor:p1'].worldRepairDeadline, 50000);
  const next = await decide(view, controller(), context);
  assert.notEqual(next.type, 'repair');
  assert.notDeepEqual(actionFields(next), { type: 'navigate', x: WORLD_STATIONS.engine.x, y: WORLD_STATIONS.engine.y });
  view.sabotage.deadlineAt = 90000; view.serverNow += 10; view.availableActions.push('repair');
  assert.equal((await decide(view, controller(), context)).type, 'repair');
});

test('world fixture: eliminate range is checked; chase uses only a currently visible safe position', async () => {
  const view = fixture(); view.self.role = 'saboteur'; view.self.tasks = [];
  view.players[1].roomId = 'bridge'; view.players[1].position = { x: 900, y: 300 }; view.availableActions.push('eliminate');
  assert.deepEqual(actionFields(await decide(view)), { type: 'navigate', x: 900, y: 300 });
  view.self.position = { x: 850, y: 300 };
  assert.deepEqual(actionFields(await decide(view)), { type: 'eliminate', targetId: 'p2' });
});

test('world fixture: unseen actors, their metadata and a forged full-state argument are never read', async () => {
  const view = fixture(); view.self.role = 'saboteur'; view.self.tasks = [];
  view.players[1].roomId = 'bridge'; view.players[1].position = null;
  for (const name of ['destination', 'tasks', 'role', 'motion']) Object.defineProperty(view.players[1], name, { get() { throw new Error('hidden property read'); } });
  const hidden = new Proxy({}, { get() { throw new Error('full state read'); } });
  const action = await decide(view, controller(), {}, { state: hidden });
  assert.equal(action.type, 'navigate');
  assert.deepEqual({ x: action.x, y: action.y }, { x: WORLD_STATIONS.bridge.x, y: WORLD_STATIONS.bridge.y });
});

test('world fixture: bell approach is reachable despite its solid table, then engine hint enables meeting', async () => {
  const view = fixture(); view.events = [{ type: 'witness', playerId: 'p3', targetId: 'p2', roomId: 'bridge', at: 900 }];
  assert.equal(isWalkable(WORLD_BELL), false, 'labeled solid-prop fixture');
  const approach = await decide(view);
  assert.equal(approach.type, 'navigate'); assert(isWalkable(approach)); assert(distance(approach, WORLD_BELL) <= WORLD.interactionRadius);
  view.self.position = { x: approach.x, y: approach.y }; view.availableActions.push('meeting');
  assert.equal((await decide(view)).type, 'meeting');
});

test('world fixture: invalid own position fails closed; aborted work has no proposal', async () => {
  const view = fixture(); view.self.position = null;
  assert.equal((await decide(view)).type, 'wait');
  assert.equal(await decide(fixture(), controller(), {}, { signal: AbortSignal.abort() }), null);
});

test('LIVE world fixture: roam movement/task/wait/repair/report/chase never sends or reserves', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('network forbidden'); });
  const c = live(), context = {}; let reservations = 0;
  const view = fixture();
  for (let i = 0; i < 20; i++) {
    view.serverNow += 10; view.self.moving = i % 2 === 1;
    if (i === 4) { view.self.position = { ...WORLD_STATIONS.bridge }; view.availableActions.push('task'); }
    if (i === 7) { view.sabotage = { active: true, roomId: 'engine', deadlineAt: 50000 }; }
    if (i === 9) { view.self.position = { ...WORLD_STATIONS.engine }; view.self.roomId = 'engine'; view.availableActions.push('repair'); }
    if (i === 11) { view.events = [{ type: 'body', bodyId: 'b1', roomId: 'engine', position: { ...WORLD_STATIONS.engine } }]; view.availableActions.push('report'); }
    if (i === 14) { view.events = []; view.self.role = 'saboteur'; view.players[1].position = { x: 1350, y: 960 }; view.players[1].roomId = 'engine'; view.availableActions.push('eliminate'); }
    await decide(view, c, context, { commitReservation: async () => { reservations++; } });
  }
  assert.equal(fetch.mock.callCount(), 0); assert.equal(reservations, 0);
  assert.equal(c.describe(context).calls, 0); assert.equal(c.describe(context).navigation, 'local'); assert.equal(c.describe(context).strategy, 'hybrid');
});

test('LIVE world fixture: council alone sends after reservation; restored budget stays closed', async t => {
  let committed = 0;
  const fetch = t.mock.method(globalThis, 'fetch', async () => { assert(committed > 0); return mockResponse(); });
  const c = live({ maxCalls: 1 }), view = fixture(), context = {};
  view.phase = 'discussion'; view.meeting = { id: 'm1', messages: [], votes: [] }; view.availableActions = ['say'];
  assert.equal((await decide(view, c, context, { commitReservation: async () => { committed++; } })).type, 'say');
  assert.equal(committed, 1); assert.equal(fetch.mock.callCount(), 1);
  const restored = JSON.parse(JSON.stringify(context)); view.phase = 'voting'; view.availableActions = ['vote']; view.serverNow += 10;
  assert.equal((await decide(view, live({ maxCalls: 1 }), restored, { commitReservation: async () => { committed++; } })).type, 'vote');
  assert.equal(fetch.mock.callCount(), 1); assert.equal(committed, 1); assert.equal(c.describe(restored).limitReason, 'budget_calls');
  assert(restored.notices.some(notice => notice.includes('Demo AI')));
});

test('world fixture: safe witnesses and separate persona memories survive council unchanged', async () => {
  const speeches = new Set(), c = controller(), context = {};
  for (const player of CHARACTERS) {
    const view = fixture(); view.self.id = player.id; view.phase = 'discussion'; view.availableActions = ['say']; view.meeting = { id: 'm1' };
    if (player.id === 'p1') view.events = [{ type: 'witness', playerId: 'p3', targetId: 'p2', roomId: 'bridge', at: 500 }];
    const action = await c.decide({ view, player, context }); speeches.add(action.text);
    if (player.id === 'p1') assert.match(action.text, /firsthand/); else assert.doesNotMatch(action.text, /firsthand; I will vote/);
  }
  assert.equal(speeches.size, 6); assert.equal(Object.keys(state(context).memories).length, 6);
});

test('legacy fixture: schema1 local task and adjacent BFS move remain compatible', async () => {
  const view = fixture(); delete view.worldVersion; view.availableActions = ['task', 'move', 'wait'];
  assert.deepEqual(actionFields(await decide(view)), { type: 'task', taskId: 'task-bridge' });
  view.self.tasks[0].roomId = 'engine';
  assert.deepEqual(actionFields(await decide(view)), { type: 'move', roomId: 'lantern' });
});
