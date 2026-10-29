import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createAiController } from '../server/ai/index.mjs';
import { CHARACTERS } from '../shared/contracts.mjs';

// A foundation-only AI worktree has no engine yet. Coordinator runs these again
// after integration; AI_ENGINE_TEST_MODULE permits read-only sibling qualification.
const engineUrl = process.env.AI_ENGINE_TEST_MODULE || new URL('../server/engine/index.mjs', import.meta.url).href;
const available = existsSync(new URL(engineUrl));
const engine = available ? await import(engineUrl) : null;
const fast = { moveCooldownMs: 100, taskCooldownMs: 1800, killCooldownMs: 1800, initialKillCooldownMs: 500, sabotageCooldownMs: 700, criticalDurationMs: 12000, discussionMs: 1200, votingMs: 800, meetingCooldownMs: 1000, roamDeadlineMs: 16000, maxMatchMs: 120000 };

test('demo safe-view bots complete seeded spectator matches through authoritative engine', { skip: !available && 'Engine absent in foundation branch; run after integration or set AI_ENGINE_TEST_MODULE.' }, async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Demo must never contact providers'); });
  const types = new Set(), winners = new Set();
  for (let seed = 0; seed < 16; seed++) {
    let state = engine.createMatch({ id: `ai-seed-${seed}`, mode: 'spectator', seed, now: 1000, config: fast });
    const controller = createAiController({ config: { provider: 'demo', decisionIntervalMs: 100 } }), context = {};
    for (let now = 1000; now < 121000 && !['ended', 'paused'].includes(state.phase); now += 100) {
      state = engine.tick(state, now).state;
      for (const player of CHARACTERS) {
        const view = engine.getPlayerView(state, player.id, now);
        const snapshot = structuredClone(view);
        const action = await controller.decide({ view, player, context });
        assert.deepEqual(view, snapshot, 'AI mutated safe view');
        if (!action) continue;
        const result = engine.applyAction(state, player.id, action, now);
        assert.equal(result.accepted, true, `seed ${seed}: ${action.type} rejected: ${JSON.stringify(result.error)}`);
        types.add(action.type); state = result.state;
      }
    }
    assert.equal(state.phase, 'ended', `seed ${seed} did not finish`);
    assert(engine.getReplay(state)?.length > 0);
    winners.add(state.outcome.winner);
    assert.equal(controller.describe(context).mode, 'demo');
  }
  for (const type of ['move', 'task', 'eliminate', 'report', 'say', 'vote', 'sabotage', 'repair']) assert(types.has(type), `No ${type} proposal across seeds`);
  assert(winners.has('crew'));
});

test('demo bots also resolve human rooms with an idle human seat', { skip: !available && 'Engine absent in foundation branch.' }, async () => {
  for (const seed of [10, 20, 30, 40]) {
    let state = engine.createMatch({ id: `ai-human-${seed}`, mode: 'human', seed, now: 1000, config: fast });
    const controller = createAiController({ config: { provider: 'demo', decisionIntervalMs: 100 } }), context = {};
    for (let now = 1000; now < 121000 && !['ended', 'paused'].includes(state.phase); now += 100) {
      state = engine.tick(state, now).state;
      for (const player of CHARACTERS.slice(1)) {
        const action = await controller.decide({ view: engine.getPlayerView(state, player.id, now), player, context });
        if (action) {
          const result = engine.applyAction(state, player.id, action, now);
          assert(result.accepted, JSON.stringify(result.error)); state = result.state;
        }
      }
    }
    assert.equal(state.phase, 'ended', `idle human seed ${seed} did not finish`);
  }
});
