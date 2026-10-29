import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = process.env.WORLD_AI_SOURCE_ROOT ? pathToFileURL(resolve(process.env.WORLD_AI_SOURCE_ROOT) + '/') : new URL('../', import.meta.url);
const { createAiController } = await import(new URL('server/ai/index.mjs', root));
const { CHARACTERS } = await import(new URL('shared/contracts.mjs', root));
const { WORLD, distance, canSeeWorldPoint, isWalkable } = await import(new URL('shared/world.mjs', root));
const engine = await import(new URL('server/engine/index.mjs', root));

// Real authoritative engine, real public geometry; deterministic seed/time and
// council deadlines are fixtures. No state edits, teleports or invented wins.
for (const mode of ['spectator', 'human']) test(`strategic offline engine: seeded ${mode} matches reach actual wins with safe-view local bots and restart`, { timeout: 180000 }, async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { return new Response(JSON.stringify({stop_reason:'tool_use',content:[{type:'tool_use',name:'pick_action',input:{choice:0}}],usage:{input_tokens:100,output_tokens:20}})); });
  const receipts = [];
  for (const seed of [1, 7]) {
    const config = { discussionMs: 6000, votingMs: 4000 };
    let state = engine.createMatch({ id: `world-ai-${mode}-${seed}`, mode, seed, now: 1000, world: true, config });
    assert.equal(state.schemaVersion, 2, 'This test requires the actual world engine; legacy is not a pass');
    let c = createAiController({ config: { provider: 'anthropic', apiKey: 'offline', strategy: 'strategic', maxCalls: 6, maxTokens: 250000, decisionIntervalMs: 1800 } }), context = {}, restarted = false;
    const types = new Set(); let moved = false, waits = 0;
    const positions = new Map(state.players.map(p => [p.id, { ...p.position }]));
    for (let now = 1000; now <= 901000 && !['ended', 'paused'].includes(state.phase); now += 250) {
      state = engine.tick(state, now).state;
      for (const player of CHARACTERS.filter(p => mode !== 'human' || p.id !== 'p1')) {
        const view = engine.getPlayerView(state, player.id, now), before = structuredClone(view);
        assert.equal(view.worldVersion, 1);
        assert(isWalkable(view.self.position));
        for (const other of view.players.filter(p => p.id !== player.id)) {
          assert(!Object.hasOwn(other, 'destination')); assert(!Object.hasOwn(other, 'inputSeq')); assert(!Object.hasOwn(other, 'motion')); assert(!Object.hasOwn(other, 'tasks'));
          if (state.phase !== 'ended') assert(!Object.hasOwn(other, 'role'));
          const actual = state.players.find(p => p.id === other.id);
          if (!canSeeWorldPoint(view.self.position, actual.position) && state.phase !== 'ended') assert.equal(other.position, null, 'unseen actor position leaked');
        }
        const action = await c.decide({ view, player, context, commitReservation: async () => {} });
        assert.deepEqual(view, before, 'AI mutated engine safe view');
        if (!action) continue;
        if (action.type === 'wait' && view.self.moving) waits++;
        if (action.type === 'navigate') assert(isWalkable(action), 'AI target must be public reachable floor');
        const result = engine.applyAction(state, player.id, action, now);
        assert.equal(result.accepted, true, `${mode} seed ${seed} ${player.id} ${JSON.stringify(action)}: ${JSON.stringify(result.error)} at ${now}`);
        state = result.state; types.add(action.type);
      }
      for (const p of state.players) if (distance(p.position, positions.get(p.id)) > WORLD.speed * .25 + .01) assert.fail('movement exceeded authoritative tick speed');
      for (const p of state.players) { if (distance(p.position, positions.get(p.id)) > 0) moved = true; positions.set(p.id, { ...p.position }); }
      if (!restarted && state.players.some(p => p.motion?.path.length)) {
        state = JSON.parse(JSON.stringify(state)); context = JSON.parse(JSON.stringify(context));
        c = createAiController({ config: { provider: 'anthropic', apiKey: 'offline', strategy: 'strategic', maxCalls: 6, maxTokens: 250000, decisionIntervalMs: 1800 } }); restarted = true;
      }
    }
    assert(restarted); assert(moved); assert(waits > 0, 'travel should wait, not reset each interval');
    assert.equal(state.phase, 'ended', `${mode} seed ${seed} stopped without a rules win`);
    assert(['crew', 'saboteur'].includes(state.outcome.winner));
    assert(['tasks', 'ejection', 'parity', 'critical'].includes(state.outcome.reason));
    assert(engine.getReplay(state).some(event => event.type === 'role_reveal'));
    assert(c.describe(context).calls > 0); assert.equal(c.describe(context).mode, 'demo');
    if (mode === 'human') assert.equal(state.players.find(p => p.id === 'p1').motion.seq, 0, 'human seat remains idle');
    receipts.push({ seed, mode, outcome: state.outcome, types: [...types].sort(), waits, restarted });
  }
  assert(fetch.mock.callCount() > 0); t.diagnostic(JSON.stringify(receipts));
});
