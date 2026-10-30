import test from 'node:test';
import assert from 'node:assert/strict';
import * as investigation from '../server/engine/investigation/index.mjs';
import * as geometry from '../shared/world.mjs';
import { BEACON_DEVICES, BEACON_DOORS, DEFAULT_BEACON_RULES } from '../shared/beacon.mjs';

const device = id => BEACON_DEVICES.find(value => value.id === id);
const copy = value => structuredClone(value);
function fixture(kind = 'security', extraRules = {}) {
  const station = device(kind);
  const keeper = (id, position, alive = true) => ({ id, role: 'crew', alive, position: { ...position }, roomId: geometry.worldRoomAt(position), motion: { seq: 0, manual: false, path: [], destination: null, leaseUntil: 0 } });
  const state = { id: 'investigation-unit', schemaVersion: 3, worldVersion: 1, beaconVersion: 1, phase: 'roam', updatedAt: 0, players: [keeper('owner', station.position), keeper('near-camera', { x: 370, y: 510 }), keeper('far-camera', { x: 600, y: 490 }), keeper('dead-keeper', { x: 280, y: 510 }, false), keeper('in-hatch', { x: 280, y: 510 }), keeper('engine-keeper', { x: 1450, y: 960 })], beaconRules: { ...DEFAULT_BEACON_RULES, deviceReadMs: 100, deviceCooldownMs: 50, ...extraRules }, systems: { lights: { active: false }, communications: { active: false }, doors: [], transit: { 'in-hatch': { entryId: 'archive-hatch', exitId: 'workshop-hatch', deadlineAt: 50 } } }, replay: [] };
  const owner = state.players[0], calls = [];
  const blocked = (from, to) => state.systems.doors.some(door => {
    if (!door.closed) return false;
    const rect = BEACON_DOORS.find(value => value.id === door.id); if (!rect) return false;
    const count = Math.max(1, Math.ceil(geometry.distance(from, to) / 2));
    for (let step = 0; step <= count; step++) { const x = from.x + (to.x - from.x) * step / count, y = from.y + (to.y - from.y) * step / count; if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return true; }
    return false;
  });
  // Real public geometry plus explicit dynamic-visibility fixture. This isolates
  // the module's ctx delegation; it does not qualify Core's forthcoming LOS.
  const ctx = { geometry, record(current, type, at, data) { current.replay.push({ type, at, ...copy(data) }); }, publicEvent() { throw new Error('Investigation must never publish sensitive activity'); }, stop() {},
    sees(current, observer, target) { calls.push({ observer: copy(observer.position), target: copy(target) }); return geometry.canSeeWorldPoint(observer.position, target) && !blocked(observer.position, target); },
    nearby(current, observer, target, radius = geometry.WORLD.interactionRadius) { return geometry.distance(observer.position, target) <= radius && this.sees(current, observer, target); } };
  investigation.initializeInvestigation(state, 0);
  return { state, owner, ctx, calls, start(id = kind, player = owner) { assert.equal(investigation.validateInvestigationAction(state, player, { type: 'investigate', deviceId: id }, state.updatedAt, ctx), null); assert.equal(investigation.applyInvestigationAction(state, player, { type: 'investigate', deviceId: id }, state.updatedAt, ctx), true); },
    advance(at) { state.updatedAt = at; const changed = investigation.advanceInvestigation(state, at, ctx); investigation.validateInvestigationState(state); return changed; },
    view(id = owner.id, at = state.updatedAt) { return investigation.getInvestigationView(state, id, at, ctx); } };
}
function freeze(value) { Object.freeze(value); for (const entry of Object.values(value)) if (entry && typeof entry === 'object') freeze(entry); return value; }

test('initialization is bounded, serializable and idempotent without erasing restored observations', () => {
  const f = fixture(); assert.deepEqual(investigation.INVESTIGATION_ACTIONS, ['investigate', 'deviceCancel']); assert.equal(investigation.investigationDeadline(f.state), Infinity);
  f.start(); f.advance(100); const saved = copy(f.state.investigation); assert.equal(investigation.initializeInvestigation(f.state, 100), false); assert.deepEqual(f.state.investigation, saved); assert.equal(investigation.validateInvestigationState(JSON.parse(JSON.stringify(f.state))), true);
});

test('validation/hints are pure; canonical player position, proximity, LOS and strict action fields control access', () => {
  const f = fixture(), original = copy(f.state); freeze(f.state);
  assert.equal(investigation.validateInvestigationAction(f.state, f.owner, { type: 'investigate', deviceId: 'security' }, 0, f.ctx), null);
  const hint = investigation.investigationActionHints(f.state, f.owner, 0, f.ctx).find(value => value.fields.deviceId === 'security'); assert.equal(hint.enabled, true);
  for (const action of [{ type: 'investigate' }, { type: 'investigate', deviceId: 'missing' }, { type: 'investigate', deviceId: 'security', playerId: 'near-camera' }, { type: 'deviceCancel', deviceId: 'security' }, { type: 'task' }, [], null]) assert(investigation.validateInvestigationAction(f.state, f.owner, action, 0, f.ctx));
  assert.deepEqual(f.state, original);
  const remote = fixture(); remote.owner.position = { x: 650, y: 300 }; assert(investigation.validateInvestigationAction(remote.state, { ...remote.owner, position: device('security').position }, { type: 'investigate', deviceId: 'security' }, 0, remote.ctx));
  const blocked = fixture(); blocked.ctx.sees = () => false; assert(investigation.validateInvestigationAction(blocked.state, blocked.owner, { type: 'investigate', deviceId: 'security' }, 0, blocked.ctx));
});

test('camera read waits for its exact deadline, records private dated samples and never creates an attack witness', () => {
  const f = fixture(); f.start(); assert.equal(investigation.investigationDeadline(f.state), 100); assert.equal(f.view().status, 'reading'); assert.deepEqual(f.view().observations, []);
  assert.equal(f.advance(99), false); assert.equal(f.advance(100), true); assert.equal(investigation.investigationDeadline(f.state), Infinity);
  const observation = f.view().observations[0]; assert.equal(observation.at, 100); assert.equal(observation.kind, 'cameras');
  const archive = observation.data.frames.find(frame => frame.cameraId === 'archive-camera'); assert.deepEqual(archive.players.map(p => p.id), ['near-camera', 'far-camera']);
  assert(!JSON.stringify(observation).includes('dead-keeper')); assert(!JSON.stringify(observation).includes('in-hatch'));
  for (const entry of f.state.replay) { assert.deepEqual(entry.visibleTo, ['owner']); assert.notEqual(entry.type, 'witness'); }
  assert(f.calls.some(call => call.observer.x === 260 && call.observer.y === 510), 'visibility must originate at the camera, not its user console');
  const saved = copy(observation); f.state.players[1].position.x = 800; f.state.players[1].alive = false; assert.deepEqual(f.view().observations[0], saved, 'old telemetry cannot track later state');
  const exported = f.view(); exported.observations[0].data.frames[0].players[0].position.x = -999; assert.deepEqual(f.view().observations[0], saved);
});

test('camera lights radius and closed corridor door suppress samples; terminal user role cannot enlarge camera view', () => {
  const light = fixture(); light.owner.role = 'saboteur'; light.state.systems.lights.active = true; light.start(); light.advance(100);
  const entries = light.view().observations[0].data.frames.find(frame => frame.cameraId === 'archive-camera').players; assert.deepEqual(entries.map(p => p.id), ['near-camera'], '110 unit boundary visible; 340 unit sighting suppressed during lights failure');
  const door = fixture(); door.state.systems.doors = [{ id: 'west-upper', closed: true }]; door.start(); door.advance(100);
  assert.deepEqual(door.view().observations[0].data.frames.find(frame => frame.cameraId === 'archive-camera').players.map(p => p.id), ['near-camera']);
});

test('occupancy gives room counts without identities, excluding transit/dead and avoiding stale corridor room labels', () => {
  const f = fixture('occupancy'); f.state.players[2].roomId = 'archive'; f.start(); f.advance(100);
  const observation = f.view().observations[0]; assert.equal(observation.kind, 'occupancy'); assert.deepEqual(observation.data.rooms.find(room => room.roomId === 'archive'), { roomId: 'archive', count: 2 }); assert.deepEqual(observation.data.rooms.find(room => room.roomId === 'engine'), { roomId: 'engine', count: 1 });
  for (const row of observation.data.rooms) assert.deepEqual(Object.keys(row).sort(), ['count', 'roomId']);
  for (const target of f.state.players.slice(1)) assert(!JSON.stringify(observation).includes(target.id));
});

test('vitals reads statuses without reading roles, target positions or route metadata', () => {
  const f = fixture('vitals');
  for (const target of f.state.players.slice(1)) for (const field of ['role', 'position', 'motion', 'tasks', 'knowledge']) Object.defineProperty(target, field, { enumerable: true, get() { throw new Error(`Forbidden vitals read: ${field}`); } });
  f.start(); f.advance(100); const observation = f.view().observations[0]; assert.equal(observation.kind, 'vitals');
  assert.equal(observation.data.players.find(player => player.id === 'dead-keeper').status, 'dead'); assert.equal(observation.data.players.find(player => player.id === 'in-hatch').status, 'alive');
  for (const row of observation.data.players) assert.deepEqual(Object.keys(row).sort(), ['id', 'status']);
});

for (const [reason, change] of [
  ['movement', f => { f.owner.position.x++; }],
  ['movement', f => { f.owner.motion.path = [{ x: 940, y: 310 }]; f.owner.motion.destination = { x: 940, y: 310 }; }],
  ['movement', f => { f.owner.motion.manual = true; f.owner.motion.leaseUntil = 500; }],
  ['phase', f => { f.state.phase = 'discussion'; }],
  ['dead', f => { f.owner.alive = false; }],
  ['transit', f => { f.state.systems.transit.owner = { deadlineAt: 1000 }; }],
  ['communications', f => { f.state.systems.communications.active = true; }],
  ['out_of_range', f => { f.ctx.sees = () => false; }]
]) test(`read cancels before sampling on ${reason}: ${change.toString().slice(0, 65)}`, () => {
  const f = fixture(); f.start(); change(f); assert.equal(f.advance(50), true); assert.deepEqual(f.view().observations, []); assert.equal(f.state.investigation.sessions.owner.status, 'failed'); assert.equal(f.state.investigation.sessions.owner.reason, reason); assert.equal(f.state.replay.at(-1).at, 50);
});

test('comms is truthfully unavailable, retains historical samples and never returns invented empty telemetry', () => {
  const f = fixture('vitals'); f.start(); f.advance(100); f.state.systems.communications.active = true;
  const view = f.view(); assert.equal(view.status, 'unavailable'); assert(view.devices.every(device => !device.available && /Communications/.test(device.reason))); assert.equal(view.observations.length, 1);
  assert.equal(investigation.validateInvestigationAction(f.state, f.owner, { type: 'investigate', deviceId: 'vitals' }, 100, f.ctx).code, 'COMMUNICATIONS_DOWN'); assert.equal(f.view(null).status, 'unavailable');
});

test('phase hook and explicit cancel retain failed status, private replay and bounded cooldown', () => {
  const f = fixture(); f.start(); f.state.updatedAt = 40; assert.equal(investigation.onInvestigationPhaseChange(f.state, 'discussion', 40, f.ctx), true); assert.equal(f.state.investigation.sessions.owner.reason, 'phase');
  assert.equal(investigation.validateInvestigationAction(f.state, f.owner, { type: 'investigate', deviceId: 'security' }, 89, f.ctx).code, 'COOLDOWN'); f.state.updatedAt = 90; f.start();
  assert.equal(investigation.applyInvestigationAction(f.state, f.owner, { type: 'deviceCancel' }, 90, f.ctx), true); assert.equal(f.state.investigation.sessions.owner.reason, 'cancelled'); assert.equal(investigation.investigationDeadline(f.state), Infinity);
  assert.equal(investigation.onInvestigationPhaseChange(f.state, 'roam', 90, f.ctx), false); assert.equal(investigation.validateInvestigationState(f.state), true);
});

test('late/overdue reads fail stale rather than backdate present data; active JSON restart completes only at true deadline', () => {
  const f = fixture(); f.start(); f.state.updatedAt = 50; const saved = JSON.parse(JSON.stringify(f.state));
  assert.equal(investigation.validateInvestigationState(saved), true); assert.equal(investigation.investigationDeadline(saved), 100);
  saved.updatedAt = 100; assert.equal(investigation.advanceInvestigation(saved, 100, f.ctx), true); assert.equal(saved.investigation.observations.owner[0].at, 100);
  f.state.updatedAt = 500; assert.equal(investigation.investigationDeadline(f.state), 500); assert.equal(f.view().status, 'stale'); assert(f.advance(500)); assert.equal(f.state.investigation.sessions.owner.reason, 'stale'); assert.deepEqual(f.view().observations, []);
  assert.throws(() => investigation.advanceInvestigation(f.state, 499, f.ctx), /backwards/);
});

test('read memories remain isolated per actor and spectator; observations are a bounded immutable history', () => {
  const f = fixture('vitals', { observationLimit: 2 });
  for (const start of [0, 150, 300]) { f.state.updatedAt = start; f.start(); f.advance(start + 100); }
  assert.deepEqual(f.view().observations.map(o => o.at), [250, 400]);
  assert.equal(f.view('near-camera').session, null); assert.deepEqual(f.view('near-camera').observations, []); assert.equal(f.view(null).session, null); assert.deepEqual(f.view(null).observations, []);
  assert(!JSON.stringify(f.view()).includes('anchor')); assert(!JSON.stringify(f.view(null)).includes('cooldownAt')); assert.equal(investigation.validateInvestigationState(f.state), true);
});

test('strict restore validation rejects hidden-field injection, unknown owners, oversized history and invalid dates', () => {
  const f = fixture('vitals'); f.start(); f.advance(100);
  const corruptions = [state => { state.investigation.observations.owner[0].data.players[0].role = 'saboteur'; }, state => { state.investigation.sessions.foreign = copy(state.investigation.sessions.owner); }, state => { state.investigation.observations.owner = Array(65).fill(state.investigation.observations.owner[0]); }, state => { state.investigation.observations.owner[0].at = 101; }, state => { state.investigation.sessions.owner.anchor.x = Infinity; }, state => { state.investigation.cooldowns.owner = { secret: 'not-a-time' }; }, state => { state.investigation.sessions.owner.reason = 'private-raw-secret'; }];
  for (const change of corruptions) { const state = copy(f.state); change(state); assert.throws(() => investigation.validateInvestigationState(state), /Invalid investigation/); }
  const state = copy(f.state); state.investigation.observations.owner[0].data.players[0].position = { x: 1, y: 2 }; assert.throws(() => investigation.getInvestigationView(state, 'owner', 100, f.ctx), /Invalid investigation/);
});

test('camera frames remain bounded with a larger roster and never expose private actor fields', () => {
  const f = fixture();
  for (let n = 0; n < 10; n++) f.state.players.push({ ...copy(f.state.players[1]), id: `extra-${n}`, position: { x: 300, y: 510 }, tasks: ['PRIVATE_TASK'], secretRoute: 'PRIVATE_EXIT' });
  f.start(); f.advance(100); const observation = f.view().observations[0], frame = observation.data.frames.find(value => value.cameraId === 'archive-camera');
  assert.equal(frame.players.length, 6); assert.equal(frame.limited, true); assert(!JSON.stringify(observation).includes('PRIVATE_'));
  for (const target of frame.players) assert.deepEqual(Object.keys(target).sort(), ['id', 'position']);
});

test('strict restore protects configured read duration, cooldown charge and plausible camera coordinates', () => {
  const f = fixture(); f.start();
  let bad = copy(f.state); bad.investigation.sessions.owner.deadlineAt--; assert.throws(() => investigation.validateInvestigationState(bad));
  f.advance(100); bad = copy(f.state); bad.investigation.cooldowns.owner = 0; assert.throws(() => investigation.validateInvestigationState(bad));
  bad = copy(f.state); bad.investigation.observations.owner[0].data.frames[0].players[0].position = { x: -1, y: 0 }; assert.throws(() => investigation.validateInvestigationState(bad));
});

test('actor IDs cannot alias inherited object keys through JSON restoration', () => {
  const f = fixture('vitals'); f.owner.id = '__proto__'; f.start(); f.advance(100);
  const saved = JSON.parse(JSON.stringify(f.state)); assert.equal(investigation.validateInvestigationState(saved), true);
  assert(Object.hasOwn(saved.investigation.sessions, '__proto__')); assert.equal(investigation.getInvestigationView(saved, '__proto__', 100, f.ctx).observations.length, 1);
  assert.equal(Object.getPrototypeOf(saved.investigation.sessions), Object.prototype);
});
