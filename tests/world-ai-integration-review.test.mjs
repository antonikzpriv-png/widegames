import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const sourceRoot = process.env.WORLD_AI_SOURCE_ROOT ? pathToFileURL(resolve(process.env.WORLD_AI_SOURCE_ROOT) + '/') : new URL('../', import.meta.url);
const history = 'b2cc6c33be4fcd240254c1758a0877351593fa9f';
async function inputModule(pin) {
  const source = pin ? execFileSync('git', ['show', `${pin}:public/world/input.mjs`], { encoding: 'utf8' }) : await readFile(new URL('public/world/input.mjs', sourceRoot), 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
class Events {
  listeners = new Map();
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type) { this.listeners.delete(type); }
  fire(type, event) { this.listeners.get(type)?.(event); }
  setInterval() { return 1; }
  clearInterval() {}
}
function fixture(createWorldInput, encode = value => value) {
  const win = new Events(), doc = new Events(), target = new Events(), joystick = new Events(), sent = [];
  let now = 1000, enabled = true;
  const input = createWorldInput({ win, doc, target, joystick, knob: { style: {} }, getState: () => ({ enabled, inputSeq: 0, position: { x: 728, y: 272 } }), onInput: value => sent.push(encode(value)), onClick: () => [{ x: 900, y: 300 }], onShortcut: () => {}, clock: () => now });
  const key = value => win.fire('keydown', { key: value, target: { closest: () => null }, preventDefault() {} });
  return { input, win, doc, sent, key, advance() { now += 200; }, disable() { enabled = false; input.sync(); } };
}
const valid = input => Number.isSafeInteger(input.seq) && input.seq > 0 && [input.dx, input.dy].every(n => Number.isInteger(n) && Math.abs(n) <= 1);

test('historical frontend b2cc6c3 KNOWN DEFECT: diagonal sends fractional axes rejected by transport/Core', async () => {
  const { createWorldInput } = await inputModule(history), f = fixture(createWorldInput);
  try { f.key('w'); f.key('d'); assert(f.sent.some(input => !valid(input))); assert.equal(f.sent[1].seq, 2); assert(Math.abs(f.sent[1].dx - Math.SQRT1_2) < 1e-15); assert(f.sent[1].dy < 0); }
  finally { f.input.dispose(); }
});

test('independent frontend current/pinned input emits integer diagonal, stop and bounded sequence', async () => {
  const { createWorldInput } = await inputModule(process.env.WORLD_AI_REVIEW_UI_PIN);
  // Qualify the real networking adapter when integrated, while permitting an
  // already-integer renderer without that optional bridge in a frontend pin.
  const appPin = process.env.WORLD_AI_REVIEW_APP_PIN;
  const read = path => appPin ? Promise.resolve(execFileSync('git', ['show', `${appPin}:${path}`], { encoding: 'utf8' })) : readFile(new URL(path, sourceRoot), 'utf8');
  let encode = value => value;
  try {
    const source = await read('public/world-input-envelope.mjs');
    encode = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).worldInputEnvelope;
    const app = await read('public/app.mjs');
    assert(app.includes('body:worldInputEnvelope(input)') || (/(?:const|let) packet=worldInputEnvelope\(input\)/.test(app) && app.includes('body:packet')), 'actual worldInput must use the inspected adapter');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const f = fixture(createWorldInput, encode);
  try {
    f.key('w'); f.key('d'); f.advance(); f.key('d');
    assert(f.sent.every(valid), `Invalid wire input: ${JSON.stringify(f.sent)}`);
    assert(f.sent.some(input => input.dx === 1 && input.dy === -1));
    f.disable(); assert.deepEqual(f.sent.at(-1), { seq: f.sent.at(-1).seq, dx: 0, dy: 0 });
    f.input.dispose(); assert.equal(f.win.listeners.has('keydown'), false);
    assert(f.sent.every(valid));
    for (let i = 1; i < f.sent.length; i++) assert(f.sent[i].seq > f.sent[i - 1].seq);
  } finally { f.input.dispose(); }
});

test('independent Core current/pinned geometry integration preserves schema1 safe views', async () => {
  const engine = await import(new URL('server/engine/index.mjs', sourceRoot));
  const state = engine.createMatch({ id: 'legacy-world-boundary', seed: 'review', now: 0, world: false });
  assert.equal(state.schemaVersion, 1);
  for (const playerId of ['p1', null]) {
    const view = engine.getPlayerView(state, playerId, 0);
    assert.equal('worldVersion' in view, false); assert(!view.availableActions.includes('navigate'));
    assert(view.players.every(player => !Object.hasOwn(player, 'position')));
  }
});

// Historical source control rewrites import locations only, preserving both
// committed engine modules and exact committed shared geometry behavior.
test('historical Core 093d049 KNOWN DEFECT: shared navigate type crashes a schema1 view', async () => {
  const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  const show = path => execFileSync('git', ['show', path], { encoding: 'utf8' });
  const contracts = dataUrl(show('eb64cc8:shared/contracts.mjs'));
  const geometry = dataUrl(show('eb64cc8:shared/world.mjs').replace("'./contracts.mjs'", JSON.stringify(contracts)));
  const runtime = dataUrl(show('093d049:server/engine/world-runtime.mjs'));
  const source = show('093d049:server/engine/index.mjs').replace("'../../shared/contracts.mjs'", JSON.stringify(contracts)).replace("'./world-runtime.mjs'", JSON.stringify(runtime)).replace("process.env.WORLD_ENGINE_GEOMETRY_MODULE||'../../shared/world.mjs'", JSON.stringify(geometry));
  const engine = await import(dataUrl(source));
  const state = engine.createMatch({ id: 'legacy-historical-control', now: 0, seed: 'review', world: false });
  assert.throws(() => engine.getPlayerView(state, 'p1', 0), /Cannot read properties of undefined/);
});

test('independent frontend input: hidden and dispose send a final zero lease then remove steering listeners', async () => {
  const { createWorldInput } = await inputModule(process.env.WORLD_AI_REVIEW_UI_PIN), f = fixture(createWorldInput);
  f.key('d'); assert(f.sent.at(-1).dx > 0);
  f.doc.hidden = true; f.doc.fire('visibilitychange', {}); assert.equal(f.sent.at(-1).dx, 0); assert.equal(f.sent.at(-1).dy, 0);
  f.doc.hidden = false; f.key('w'); assert(f.sent.at(-1).dy < 0); f.input.dispose();
  assert.equal(f.sent.at(-1).dx, 0); assert.equal(f.sent.at(-1).dy, 0);
  const count = f.sent.length; f.key('d'); f.doc.fire('visibilitychange', {}); assert.equal(f.sent.length, count);
});
