import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiController } from '../server/ai/index.mjs';
import { route } from '../server/ai/demo.mjs';
import { CHARACTERS, ROOM_LAYOUT } from '../shared/contracts.mjs';

const live = extra => createAiController({ config: { provider: 'anthropic', apiKey: 'server-secret', model: 'claude-haiku-4-5-20251001', maxCalls: 48, maxTokens: 250000, maxCostUsd: 10, timeoutMs: 100, decisionIntervalMs: 10, ...extra } });
const demo = () => createAiController({ config: { decisionIntervalMs: 10 } });
function view(overrides = {}) {
  return { matchId: 'fixture', version: 1, phase: 'roam', serverNow: 1000, deadlineAt: 20000,
    rooms: structuredClone(ROOM_LAYOUT), players: CHARACTERS.map(p => ({ id: p.id, name: p.name, alive: true, roomId: p.id === 'p1' ? 'bridge' : null })),
    self: { id: 'p1', role: 'crew', alive: true, roomId: 'bridge', tasks: [{ id: 't1', roomId: 'bridge', completed: false }], cooldowns: {}, meetingsRemaining: 1 },
    tasks: { completed: 0, total: 15 }, sabotage: null, meeting: null, outcome: null, events: [], availableActions: ['move', 'task', 'wait'], ...overrides };
}
function args(overrides = {}) { return { view: view(), player: CHARACTERS[0], context: {}, commitReservation: async () => {}, ...overrides }; }
function response(choice = 0, extra = {}) { return new Response(JSON.stringify({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'pick_action', input: { choice } }], usage: { input_tokens: 100, output_tokens: 20 }, ...extra }), { headers: { 'content-type': 'application/json' } }); }
function state(context) { return context.matches[`match:${context.activeMatchId}`]; }
function freeze(object) { Object.freeze(object); for (const value of Object.values(object)) if (value && typeof value === 'object') freeze(value); return object; }

test('demo defaults are labeled, serializable, deterministic and do not mutate a frozen view', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('network forbidden'); });
  const controller = demo(), input = args({ view: freeze(view()) });
  const first = await controller.decide(input);
  assert.equal(first.type, 'task');
  assert.match(first.id, /^[A-Za-z0-9_-]{1,100}$/);
  assert.equal(controller.describe(input.context).mode, 'demo');
  assert(input.context.notices.some(s => s.includes('Demo AI')));
  assert.doesNotThrow(() => JSON.stringify(input.context));
  const second = await demo().decide(args());
  assert.equal(second.type, first.type); assert.equal(second.taskId, first.taskId); assert.notEqual(second.id, first.id);
});

test('BFS chooses adjacent shortest steps and rejects unknown rooms', () => {
  assert.deepEqual(route('bridge', 'engine'), ['lantern', 'engine']);
  assert.deepEqual(route('bridge', 'bridge'), []);
  assert.deepEqual(route('unknown', 'engine'), []);
});

test('crew prioritize repairs and take shortest path to work', async () => {
  let input = args({ view: view({ sabotage: { active: true, roomId: 'bridge' }, availableActions: ['repair', 'task', 'move'] }) });
  assert.equal((await demo().decide(input)).type, 'repair');
  const v = view(); v.self.tasks[0].roomId = 'engine';
  input = args({ view: v });
  assert.deepEqual((({ type, roomId }) => ({ type, roomId }))(await demo().decide(input)), { type: 'move', roomId: 'lantern' });
  v.self.cooldowns.moveAt = 2000;
  assert.equal((await demo().decide(args({ view: v }))).type, 'wait');
});

test('safe local body events trigger a report, hidden remote bodies do not', async () => {
  const v = view({ events: [{ type: 'body', bodyId: 'body-p2', roomId: 'bridge' }], availableActions: ['report', 'task'] });
  assert.equal((await demo().decide(args({ view: v }))).bodyId, 'body-p2');
  v.events[0].roomId = 'engine';
  assert.equal((await demo().decide(args({ view: v }))).type, 'task');
});

test('saboteur eliminates locally, sabotages, and speaks a bounded bluff', async () => {
  const v = view({ availableActions: ['eliminate', 'sabotage', 'move'] });
  v.self.role = 'saboteur'; v.self.tasks = []; v.players[1].roomId = 'bridge';
  assert.equal((await demo().decide(args({ view: v }))).targetId, 'p2');
  v.self.cooldowns.killAt = 2000;
  assert.equal((await demo().decide(args({ view: v }))).type, 'sabotage');
  v.phase = 'discussion'; v.meeting = { id: 'm1', votes: [], messages: [] }; v.availableActions = ['say'];
  const speech = await demo().decide(args({ view: v }));
  assert.equal(speech.type, 'say'); assert(speech.text.length <= 280); assert.match(speech.text, /relays/);
});

test('firsthand witness events influence debate and votes, with no invented roles', async () => {
  const v = view({ phase: 'voting', meeting: { id: 'm1', votes: [], eligibleVoters: ['p1', 'p2', 'p3'] }, events: [{ type: 'witness', playerId: 'p3', targetId: 'p2', roomId: 'bridge' }], availableActions: ['vote'] });
  assert.equal((await demo().decide(args({ view: v }))).targetId, 'p3');
  v.events = [];
  assert.equal((await demo().decide(args({ view: v }))).targetId, 'skip');
  v.meeting.votes = [{ playerId: 'p1' }];
  assert.equal(await demo().decide(args({ view: v })), null);
});

test('discussion is bounded and new meetings reset dialogue memory', async () => {
  const c = demo(), input = args({ view: view({ phase: 'discussion', meeting: { id: 'm1' }, availableActions: ['say'] }) });
  for (let i = 0; i < 3; i++) { input.view.serverNow += 10; assert.equal((await c.decide(input)).type, 'say'); }
  input.view.serverNow += 10; assert.equal(await c.decide(input), null);
  input.view.serverNow += 10; input.view.meeting.id = 'm2'; assert.equal((await c.decide(input)).type, 'say');
});

test('wrong actor, spectator, dead, inactive and pre-aborted inputs produce no action or network', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('network forbidden'); });
  const c = live();
  for (const phase of ['ended', 'paused', 'lobby']) assert.equal(await c.decide(args({ view: view({ phase }) })), null);
  assert.equal(await c.decide(args({ player: CHARACTERS[1] })), null);
  assert.equal(await c.decide(args({ view: view({ self: null }) })), null);
  const dead = view(); dead.self.alive = false;
  assert.equal(await c.decide(args({ view: dead })), null);
  assert.equal(await c.decide(args({ signal: AbortSignal.abort() })), null);
  assert.equal(fetch.mock.callCount(), 0);
});

test('interval and actor memory survive serialization and are match-scoped', async () => {
  const c = demo(), input = args();
  assert(await c.decide(input)); assert.equal(await c.decide(input), null);
  input.context = JSON.parse(JSON.stringify(input.context));
  assert.equal(await demo().decide(input), null);
  input.view.matchId = 'second'; assert(await c.decide(input));
  assert.equal(Object.keys(input.context.matches).length, 2);
});

test('credentials, supported model and a persistence hook are required for live sends', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('network forbidden'); });
  for (const [config, reason] of [[{ apiKey: '' }, 'missing_credentials'], [{ model: 'unknown-secret-model' }, 'unsupported_model'], [{ provider: 'unsupported' }, 'unsupported_provider']]) {
    const c = live(config), input = args(); assert(await c.decide(input)); assert.equal(c.describe(input.context).limitReason, reason);
    assert(!JSON.stringify(c.describe(input.context)).includes('secret'));
  }
  const c = live(), input = args({ commitReservation: undefined });
  assert(await c.decide(input)); assert.equal(c.describe(input.context).limitReason, 'reservation_required');
  assert.equal(fetch.mock.callCount(), 0);
});

test('reservation is visible in context and durably acknowledged before provider send', async t => {
  const c = live(), input = args(); let release, persisted = false;
  input.commitReservation = async reservation => {
    assert.deepEqual(Object.keys(reservation).sort(), ['amountUsd', 'id']);
    assert(reservation.amountUsd > 0);
    assert.equal(state(input.context).calls, 1);
    assert.deepEqual(state(input.context).reservations[0], reservation);
    await new Promise(resolve => { release = resolve; }); persisted = true;
  };
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert(persisted); assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(options.headers['x-api-key'], 'server-secret');
    const payload = JSON.parse(options.body);
    assert.equal(payload.max_tokens, 256); assert.equal(payload.tool_choice.name, 'pick_action');
    assert(!options.body.includes('server-secret')); return response();
  });
  const pending = c.decide(input);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fetch.mock.callCount(), 0); release();
  assert.equal((await pending).type, 'task');
  assert.equal(fetch.mock.callCount(), 1); assert.equal(c.describe(input.context).mode, 'live');
  assert(!JSON.stringify(c.describe(input.context)).includes('memories'));
});

test('failed or denied reservation never sends and produces only a safe demo notice', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('network forbidden'); });
  for (const hook of [async () => { throw new Error('server-secret failure detail'); }, async () => false, async () => ({ allowed: false })]) {
    const c = live(), input = args({ commitReservation: hook });
    assert.equal((await c.decide(input)).type, 'task');
    assert.equal(c.describe(input.context).limitReason, 'reservation_failed');
    assert.equal(state(input.context).calls, 1); assert(!JSON.stringify(input.context).includes('server-secret'));
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('retry reserves a distinct ID and awaits the hook again before sending', async t => {
  const order = [], reservations = [];
  t.mock.method(globalThis, 'fetch', async () => { order.push('send'); return order.length === 2 ? new Response('', { status: 503 }) : response(); });
  const c = live(), input = args({ commitReservation: async r => { order.push('reserve'); reservations.push(r); } });
  assert.equal((await c.decide(input)).type, 'task');
  assert.deepEqual(order, ['reserve', 'send', 'reserve', 'send']);
  assert.notEqual(reservations[0].id, reservations[1].id);
  assert.equal(c.describe(input.context).calls, 2);
  assert(c.describe(input.context).costUsd >= reservations.reduce((sum, r) => sum + r.amountUsd, 0));
});

test('each budget limit blocks sends before hook execution', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('network forbidden'); });
  for (const [config, reason] of [[{ maxCalls: 0 }, 'budget_calls'], [{ maxTokens: 0 }, 'budget_tokens'], [{ maxCostUsd: 0 }, 'budget_cost']]) {
    const c = live(config); let hooks = 0; const input = args({ commitReservation: async () => { hooks++; } });
    assert.equal((await c.decide(input)).type, 'task'); assert.equal(hooks, 0);
    assert.equal(c.describe(input.context).limitReason, reason);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('parallel actors cannot oversubscribe a match and duplicate actor decisions coalesce', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response());
  const c = live({ maxCalls: 1 }), input = args(); let release;
  input.commitReservation = async () => new Promise(resolve => { release = resolve; });
  const first = c.decide(input); await new Promise(resolve => setImmediate(resolve));
  assert.equal(await c.decide(input), null);
  const other = structuredClone(input.view); other.self.id = 'p2';
  const second = await c.decide({ ...input, player: CHARACTERS[1], view: other });
  assert.equal(second.type, 'task'); release(); assert.equal((await first).type, 'task');
  assert.equal(state(input.context).calls, 1); assert.equal(fetch.mock.callCount(), 0);
});

test('parallel live reservations are both included before provider responses', async t => {
  let release; const barrier = new Promise(resolve => { release = resolve; });
  const fetch = t.mock.method(globalThis, 'fetch', async () => { await barrier; return response(); });
  const c = live(), input = args(); const other = structuredClone(input.view); other.self.id = 'p2';
  const first = c.decide(input), second = c.decide({ ...input, player: CHARACTERS[1], view: other });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state(input.context).calls, 2); assert.equal(fetch.mock.callCount(), 2);
  release(); await Promise.all([first, second]);
  assert.equal(new Set(state(input.context).reservations.map(r => r.id)).size, 2);
});

test('uncertain reservations are retained across restart and never refunded', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 401 }));
  const input = args(), c = live({ maxCalls: 1 }); await c.decide(input);
  const cost = c.describe(input.context).costUsd;
  input.context = JSON.parse(JSON.stringify(input.context)); input.view.serverNow += 100;
  const restarted = live({ maxCalls: 1 }); await restarted.decide(input);
  assert.equal(fetch.mock.callCount(), 1); assert.equal(restarted.describe(input.context).costUsd, cost);
  assert.equal(restarted.describe(input.context).mode, 'demo');
});

test('invalid structured outputs and excessive output fail closed without leaking response text', async t => {
  const bad = [
    { content: [{ type: 'text', text: 'server-secret reasoning' }] },
    { content: [{ type: 'tool_use', name: 'pick_action', input: { choice: 999 } }] },
    { content: [{ type: 'tool_use', name: 'pick_action', input: { choice: 0, hidden: 'server-secret' } }] },
    { usage: { input_tokens: 1e9, output_tokens: 300 } }
  ];
  let nextResponse;
  t.mock.method(globalThis, 'fetch', async () => nextResponse());
  for (const output of bad) {
    nextResponse = () => response(0, output);
    const c = live(), input = args(); assert.equal((await c.decide(input)).type, 'task');
    assert.equal(c.describe(input.context).mode, 'demo'); assert(!JSON.stringify(input.context).includes('server-secret'));
  }
  nextResponse = () => new Response('x'.repeat(40000));
  const c = live(), input = args(); await c.decide(input); assert.equal(c.describe(input.context).limitReason, 'output_limit');
});

test('public speech can be customized but never changes action type or adds fields', async t => {
  t.mock.method(globalThis, 'fetch', async () => response(0, { content: [{ type: 'tool_use', name: 'pick_action', input: { choice: 0, speech: 'I saw nobody at the bridge.' } }] }));
  const input = args({ view: view({ phase: 'discussion', meeting: { id: 'm1' }, availableActions: ['say'] }) });
  const action = await live().decide(input);
  assert.deepEqual(Object.keys(action).sort(), ['id', 'text', 'type']); assert.equal(action.text, 'I saw nobody at the bridge.');
});

test('hanging persistence hook times out without any send', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response());
  const c = live({ timeoutMs: 10 }), input = args({ commitReservation: async () => new Promise(() => {}) });
  assert.equal((await c.decide(input)).type, 'task'); assert.equal(c.describe(input.context).limitReason, 'reservation_failed');
  assert.equal(fetch.mock.callCount(), 0); assert.equal(state(input.context).calls, 1);
});

test('hanging providers time out with a separately reserved bounded retry', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Promise(() => {}));
  const c = live({ timeoutMs: 10 }), input = args();
  assert.equal((await c.decide(input)).type, 'task'); assert.equal(c.describe(input.context).limitReason, 'timeout');
  assert.equal(fetch.mock.callCount(), 2); assert.equal(state(input.context).calls, 2);
});

test('external cancellation during reservation or send returns null without a retry', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Promise(() => {}));
  for (const duringHook of [true, false]) {
    const abort = new AbortController(), c = live(), input = args({ signal: abort.signal });
    if (duringHook) input.commitReservation = async () => new Promise(() => {});
    const pending = c.decide(input); await new Promise(resolve => setImmediate(resolve)); abort.abort();
    assert.equal(await pending, null); assert.equal(state(input.context).calls, 1);
  }
  assert.equal(fetch.mock.callCount(), 1);
});


test('a successfully persisted live reservation remains charged when restored before response', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response());
  let snapshot;
  const input = args({ commitReservation: async () => { snapshot = JSON.parse(JSON.stringify(input.context)); } });
  await live({ maxCalls: 1 }).decide(input);
  input.context = snapshot; input.view.serverNow += 100;
  const restored = live({ maxCalls: 1 }); await restored.decide(input);
  assert.equal(fetch.mock.callCount(), 1); assert.equal(restored.describe(input.context).limitReason, 'budget_calls');
});

test('corrupt restored ledgers cannot reopen spending and keep demo interval limits', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response());
  for (const context of [{ matches: 'corrupt' }, { matches: { 'match:fixture': null } }, { matches: { 'match:fixture': { mode: 'live', calls: 0, tokens: 0, costUsd: 0, memories: {}, reservations: [{ id: 'unpaid', amountUsd: 0.01 }] } } }]) {
    const c = live(), input = args({ context });
    assert.equal((await c.decide(input)).type, 'task'); assert.equal(c.describe(context).limitReason, 'invalid_context');
    assert.equal(await c.decide(input), null);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('malformed caps, oversize prompts and wait-only turns cannot send', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response());
  for (const bad of [-1, NaN, Infinity, '48']) {
    const c = live({ maxCalls: bad }), input = args(); await c.decide(input);
    assert.equal(c.describe(input.context).limitReason, 'budget_calls');
  }
  const big = args({ view: view({ tasks: { completed: 0, total: 15, unexpected: 'x'.repeat(13000) } }) });
  const c = live(); await c.decide(big); assert.equal(c.describe(big.context).limitReason, 'prompt_limit');
  const wait = args({ view: view({ availableActions: ['wait'] }) });
  assert.equal((await live().decide(wait)).type, 'wait');
  assert.equal(fetch.mock.callCount(), 0);
});
