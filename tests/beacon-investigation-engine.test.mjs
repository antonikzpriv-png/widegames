import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateInvestigationState } from '../server/engine/investigation/index.mjs';
const root = process.env.BEACON_INVESTIGATION_ENGINE_ROOT ? pathToFileURL(resolve(process.env.BEACON_INVESTIGATION_ENGINE_ROOT) + '/') : new URL('../', import.meta.url);
const engine = await import(new URL('server/engine/index.mjs', root));
const { BEACON_DEVICES, BEACON_VENTS } = await import(new URL('shared/beacon.mjs', root));
const point = id => BEACON_DEVICES.find(device => device.id === id).position;

// Real engine actions/ticks, explicit seed/clock and faster terminal timing.
// Fixture reads hidden roles only to stage authorized actors; no AI receives it.
function fixture() {
  let state = engine.createMatch({ id: 'beacon-console-fixture-01', world: true, systems: true, mode: 'spectator', now: 0, seed: 'console-integration', beaconRules: { deviceReadMs: 100, deviceCooldownMs: 50 }, config: { moveCooldownMs: 1, initialKillCooldownMs: 1, meetingCooldownMs: 1 } });
  assert.equal(state.schemaVersion, 3, 'Actual schema3 engine integration is required, not a skip or legacy pass');
  let now = 0, seq = 0;
  const owner = state.players.find(player => player.role === 'crew').id, saboteur = state.players.find(player => player.role === 'saboteur').id;
  return { get state() { return state; }, get now() { return now; }, owner, saboteur,
    act(id, type, fields = {}, requestId) { const result = engine.applyAction(state, id, { id: requestId ?? `console:${++seq}`, type, ...fields }, now); assert.equal(result.accepted, true, `${type}: ${JSON.stringify(result.error)}`); state = result.state; validateInvestigationState(state); return result; },
    tick(at) { now = at; state = engine.tick(state, now).state; validateInvestigationState(state); },
    walk(id, destination) { this.act(id, 'navigate', { x: destination.x, y: destination.y }); this.tick(now + 12000); assert(Math.hypot(state.players.find(p => p.id === id).position.x - destination.x, state.players.find(p => p.id === id).position.y - destination.y) < .001); },
    input(id, input) { const result = engine.applyInput(state, id, input, now); assert.equal(result.accepted, true, JSON.stringify(result.error)); state = result.state; validateInvestigationState(state); return result; },
    view(id = owner) { return engine.getPlayerView(state, id, now); }, restore() { state = JSON.parse(JSON.stringify(state)); validateInvestigationState(state); } };
}

test('actual schema3 engine: late tick samples exact scheduled read time; duplicate request and JSON restart do not repeat it', () => {
  const f = fixture(); f.walk(f.owner, point('security')); const startedAt = f.now;
  f.act(f.owner, 'investigate', { deviceId: 'security' }, 'durable-read'); f.tick(startedAt + 50); assert.equal(f.view().investigation.session.status, 'reading'); f.restore();
  f.tick(startedAt + 1000); const inv = f.view().investigation; assert.equal(inv.observations.length, 1); assert.equal(inv.observations[0].at, startedAt + 100); assert.equal(inv.session.status, 'elapsed');
  assert.equal(f.act(f.owner, 'investigate', { deviceId: 'security' }, 'durable-read').duplicate, true); assert.equal(f.view().investigation.observations.length, 1);
  assert.equal(engine.getReplay(f.state), null); assert.equal(f.view(null).investigation.session, null); assert.deepEqual(f.view(null).investigation.observations, []);
  for (const record of f.state.replay.filter(event => event.type.startsWith('device_'))) assert.deepEqual(record.visibleTo, [f.owner]);
});

for (const kind of ['normal', 'lights', 'door']) test(`actual schema3 camera: ${kind} obeys dynamic world LOS/radius and bounded safe fields`, () => {
  const f = fixture(), targets = f.state.players.filter(player => player.id !== f.owner).slice(0, 2);
  f.walk(targets[0].id, { x: 370, y: 510 }); f.walk(targets[1].id, { x: 600, y: 490 }); f.walk(f.owner, point('security'));
  if (kind !== 'normal') f.act(f.saboteur, 'systemSabotage', { kind, targetId: kind === 'door' ? 'west-upper' : 'beacon' });
  f.act(f.owner, 'investigate', { deviceId: 'security' }); f.tick(f.now + 100);
  const observation = f.view().investigation.observations[0], frame = observation.data.frames.find(value => value.cameraId === 'archive-camera');
  assert.deepEqual(frame.players.map(player => player.id), kind === 'normal' ? targets.map(player => player.id) : [targets[0].id]);
  for (const row of frame.players) assert.deepEqual(Object.keys(row).sort(), ['id', 'position']);
  assert(!f.view().events.some(event => event.type === 'device_observation' || event.type === 'device_session'));
});

test('actual schema3: communications cancels reading immediately; repaired radio restores availability after cooldown', () => {
  const f = fixture(); f.walk(f.owner, point('security')); f.act(f.owner, 'investigate', { deviceId: 'security' }); f.tick(f.now + 40);
  f.act(f.saboteur, 'systemSabotage', { kind: 'communications', targetId: 'beacon' });
  let inv = f.view().investigation; assert.equal(inv.status, 'unavailable'); assert.equal(inv.session.reason, 'communications'); assert.deepEqual(inv.observations, []); assert(inv.devices.every(device => !device.available && /Communications/.test(device.reason)));
  f.act(f.owner, 'systemRepair', { systemId: 'communications', siteId: 'radio' }); f.tick(f.now + 50); f.act(f.owner, 'investigate', { deviceId: 'security' }); f.tick(f.now + 100);
  inv = f.view().investigation; assert.equal(inv.session.status, 'elapsed'); assert.equal(inv.observations.length, 1);
});

test('actual schema3: steering cancels a stationary read, and a real emergency phase cancels the next one', () => {
  const f = fixture(); f.walk(f.owner, point('security')); f.act(f.owner, 'investigate', { deviceId: 'security' }); f.input(f.owner, { seq: 1, dx: 1, dy: 0 }); assert.equal(f.view().investigation.session.reason, 'movement');
  f.input(f.owner, { seq: 2, dx: 0, dy: 0 }); f.tick(f.now + 50); f.act(f.owner, 'investigate', { deviceId: 'security' });
  const caller = f.state.players.find(player => player.id !== f.owner).id; f.walk(caller, { x: 800, y: 250 });
  // The long walk legitimately finishes that read; start a new one immediately
  // before the bell to exercise phase priority, rather than editing a session.
  f.act(f.owner, 'investigate', { deviceId: 'security' }); f.act(caller, 'meeting');
  assert.equal(f.state.phase, 'discussion'); assert.equal(f.view().investigation.session.reason, 'phase');
});

test('actual schema3 vitals: a remote real death is revealed only in the reader sample, not globally by device use', () => {
  const f = fixture(), victim = f.state.players.find(player => player.role === 'crew' && player.id !== f.owner).id;
  f.walk(victim, { x: 1450, y: 960 }); f.walk(f.saboteur, { x: 1450, y: 960 }); f.walk(f.owner, point('vitals')); f.act(f.saboteur, 'eliminate', { targetId: victim });
  const beforePublic = f.view(null).players.find(player => player.id === victim); f.act(f.owner, 'investigate', { deviceId: 'vitals' }); f.restore(); f.tick(f.now + 100);
  const observation = f.view().investigation.observations[0]; assert.equal(observation.data.players.find(player => player.id === victim).status, 'dead'); assert.equal(f.view().players.find(player => player.id === victim).status, 'dead', 'only the entitled reader adopts its own vitals sample'); assert.deepEqual(f.view(null).players.find(player => player.id === victim), beforePublic);
  assert.deepEqual(f.view(f.saboteur).investigation.observations, []); assert.deepEqual(f.view(null).investigation.observations, []);
  assert(observation.data.players.every(player => Object.keys(player).sort().join(',') === 'id,status')); assert.equal(engine.getReplay(f.state), null);
});

test('actual schema3: death during a read cancels it before any terminal observation', () => {
  const f = fixture(); f.walk(f.owner, point('security')); f.walk(f.saboteur, point('security')); f.act(f.owner, 'investigate', { deviceId: 'security' }); f.tick(f.now + 40); f.act(f.saboteur, 'eliminate', { targetId: f.owner });
  const inv = f.view().investigation; assert.equal(inv.status, 'inactive'); assert.equal(inv.session.reason, 'dead'); assert.deepEqual(inv.observations, []);
  assert(f.state.replay.some(record => record.type === 'device_session' && record.reason === 'dead' && record.visibleTo.length === 1 && record.visibleTo[0] === f.owner));
});

test('actual schema3: hatch entry cancels its user read and occupancy excludes the real actor in private transit', () => {
  const f = fixture(); f.walk(f.owner, point('occupancy')); f.walk(f.saboteur, { x: 150, y: 500 }); f.act(f.saboteur, 'investigate', { deviceId: 'occupancy' });
  const entry = BEACON_VENTS.find(vent => vent.id === 'archive-hatch'); f.act(f.saboteur, 'vent', { entryId: entry.id, exitId: entry.links[0] });
  assert.equal(f.view(f.saboteur).investigation.session.reason, 'transit'); assert.deepEqual(f.view(f.saboteur).investigation.observations, []);
  f.act(f.owner, 'investigate', { deviceId: 'occupancy' }); f.tick(f.now + 100);
  assert(Object.hasOwn(f.state.systems.transit, f.saboteur)); const observation = f.view().investigation.observations[0]; assert.equal(observation.data.rooms.find(room => room.roomId === 'archive').count, 1); assert(!JSON.stringify(observation.data).includes(f.saboteur));
});

test('actual schema3: seeing a killer on a later camera frame does not manufacture attack eyewitness evidence', () => {
  const f = fixture(), victim = f.state.players.find(player => player.role === 'crew' && player.id !== f.owner).id;
  f.walk(victim, { x: 1450, y: 960 }); f.walk(f.saboteur, { x: 1450, y: 960 }); f.walk(f.owner, point('security')); f.act(f.saboteur, 'eliminate', { targetId: victim });
  const beforeWitnesses = f.state.replay.filter(record => record.type === 'witness' && record.visibleTo.includes(f.owner)).length;
  f.act(f.owner, 'investigate', { deviceId: 'security' }); f.tick(f.now + 100); const observation = f.view().investigation.observations[0];
  const frame = observation.data.frames.find(camera => camera.cameraId === 'engine-camera'); assert(frame.players.some(player => player.id === f.saboteur)); assert(!frame.players.some(player => player.id === victim));
  assert.equal(f.state.replay.filter(record => record.type === 'witness' && record.visibleTo.includes(f.owner)).length, beforeWitnesses); assert(!f.view().events.some(event => event.type === 'witness' && event.playerId === f.saboteur));
});
