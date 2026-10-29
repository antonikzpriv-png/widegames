import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
const root = process.env.WORLD_AI_SOURCE_ROOT ? pathToFileURL(resolve(process.env.WORLD_AI_SOURCE_ROOT) + '/') : new URL('../', import.meta.url);
const { createGameServer } = await import(new URL('server/transport.mjs', root));
const engine = await import(new URL('server/engine/index.mjs', root));
const { WORLD, distance, worldSpawn } = await import(new URL('shared/world.mjs', root));
const artifacts = fileURLToPath(new URL('../_artifacts/world-ai-http/', import.meta.url));
const origin = 'http://world-review.test';
// Networking/persistence review isolates OTHER owners with inert labeled AI;
// this does not independently approve the AI implemented by this reviewer.
const aiController = { describe: () => ({ mode: 'demo', provider: 'inert-audit-fixture' }), decide: async () => null };
async function fixture(t) {
  await mkdir(artifacts, { recursive: true }); const directory = await mkdtemp(join(artifacts, 'room-'));
  let now = 100000, game, base;
  const config = { publicOrigin: origin, worldMode: true, dataDir: directory, tickMs: 60000, now: () => now, ai: { provider: 'demo' } };
  const dependencies = { engine: { ...engine, createMatch: options => engine.createMatch({ ...options, seed: 1 }) }, aiController };
  async function open() { game = await createGameServer(config, dependencies); game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening'); base = `http://127.0.0.1:${game.server.address().port}`; }
  await open();
  t.after(async () => { await game.close(); assert(resolve(directory).startsWith(resolve(artifacts) + sep)); await rm(directory, { recursive: true, force: true }); });
  async function request(path, data, cookie, headers = {}) {
    const response = await fetch(base + path, { method: data === undefined ? 'GET' : 'POST', headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    return { status: response.status, body: await response.json(), headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const host = await request('/api/rooms', { mode: 'human' }), id = host.body.roomId, route = `/api/rooms/${id}`;
  assert.equal(host.status, 201); const start = await request(route + '/start', { id: 'start' }, host.cookie); assert.equal(start.status, 200); assert.equal(start.body.game.worldVersion, 1);
  return { host, id, route, request, directory, get game() { return game; }, get base() { return base; }, advance(ms) { now += ms; }, async restart() { await game.close(); await open(); } };
}
function safe(body, human) {
  const text = JSON.stringify(body);
  for (const field of ['"identities"', '"aiContext"', '"motion"', '"path"', '"leaseUntil"', '"requests"']) assert(!text.includes(field), `private field ${field}`);
  for (const player of body.game.players) for (const field of ['role', 'tasks', 'inputSeq', 'destination']) assert(!Object.hasOwn(player, field));
  assert.equal(body.game.self?.id ?? null, human ? 'p1' : null);
}

test('independent world HTTP/WS: strict input auth and each audience receives redacted engine views', async t => {
  const f = await fixture(t), input = { seq: 1, dx: 1, dy: -1 };
  const guest = await f.request(f.route + '/join', {}); assert.equal(guest.status, 200);
  safe(guest.body, false); assert(guest.body.game.players.every(p => p.position));
  assert.equal((await f.request(f.route + '/input', input)).status, 401);
  assert.equal((await f.request(f.route + '/input', input, guest.cookie)).status, 403);
  assert.equal((await f.request(f.route + '/input', input, f.host.cookie, { Origin: 'http://foreign.test' })).status, 403);
  const other = await f.request('/api/rooms', { mode: 'human' }); assert.equal((await f.request(f.route + '/input', input, other.cookie)).status, 401);
  for (const malformed of [{ ...input, playerId: 'p2' }, { ...input, position: { x: 100, y: 100 } }, { ...input, dx: .707 }]) assert.equal((await f.request(f.route + '/input', malformed, f.host.cookie)).status, 400);
  const ws = new WebSocket(f.base.replace('http:', 'ws:') + f.route + '/socket', { headers: { Origin: origin, Cookie: guest.cookie } });
  t.after(() => ws.terminate()); const [initial] = await once(ws, 'message'); safe(JSON.parse(initial).room, false);
  const update = once(ws, 'message'), response = await f.request(f.route + '/input', input, f.host.cookie); assert.equal(response.status, 200); safe(response.body, true);
  const [payload] = await update; safe(JSON.parse(payload).room, false);
  assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.body.game.self.inputSeq, 1);
  assert.deepEqual(response.body.game.self.position, worldSpawn('p1'), 'input acknowledgement does not teleport');
});

test('independent world HTTP/store restart: duplicate lease cannot extend or bypass persisted input sequence', async t => {
  const f = await fixture(t);
  assert.equal((await f.request(f.route + '/input', { seq: 1, dx: 1, dy: 0 }, f.host.cookie)).status, 200);
  f.advance(300); assert.equal((await f.request(f.route + '/input', { seq: 2, dx: 1, dy: 0 }, f.host.cookie)).status, 200);
  f.advance(100); assert.equal((await f.request(f.route + '/input', { seq: 2, dx: 1, dy: 0 }, f.host.cookie)).status, 200);
  const stored = JSON.parse(await readFile(join(f.directory, `room-${f.id}.json`), 'utf8'));
  assert.equal(stored.state.players[0].motion.leaseUntil, 100900);
  f.advance(2000); await f.restart();
  assert.equal((await f.request(f.route + '/input', { seq: 1, dx: -1, dy: 0 }, f.host.cookie)).status, 409);
  const snapshot = await f.request(f.route, undefined, f.host.cookie); assert.equal(snapshot.status, 200); safe(snapshot.body, true);
  assert.equal(snapshot.body.game.self.inputSeq, 2); assert.equal(snapshot.body.game.self.moving, false);
  assert(Math.abs(distance(worldSpawn('p1'), snapshot.body.game.self.position) - WORLD.speed * .9) < 1e-6);
  assert.equal((await f.request(f.route + '/input', { seq: 2, dx: -1, dy: 0 }, f.host.cookie)).status, 409);
  const stop = await f.request(f.route + '/input', { seq: 3, dx: 0, dy: 0 }, f.host.cookie); assert.equal(stop.status, 200);
  assert.equal(stop.body.game.self.inputSeq, 3); assert.deepEqual(stop.body.game.self.position, snapshot.body.game.self.position);
});

test('independent world HTTP: navigation reveals own destination only and remote coordinates remain hidden', async t => {
  const f = await fixture(t), request = await f.request(f.route + '/action', { id: 'walk-archive', type: 'move', roomId: 'archive' }, f.host.cookie);
  assert.equal(request.status, 200); assert(request.body.game.self.destination); safe(request.body, true);
  f.advance(15000); const arrived = await f.request(f.route + '/input', { seq: 1, dx: 0, dy: 0 }, f.host.cookie); assert.equal(arrived.status, 200);
  assert.equal(arrived.body.game.self.roomId, 'archive'); assert.equal(arrived.body.game.self.destination, null);
  assert(arrived.body.game.players.filter(p => p.id !== 'p1').every(p => p.position === null && p.roomId === null));
  assert.equal((await f.request(f.route + '/replay', undefined, f.host.cookie)).status, 409);
});
