import { DEFAULT_BEACON_RULES } from '../../../shared/beacon.mjs';
import { getMap } from '../../../shared/maps/index.mjs';

export const MAX_OBSERVATIONS = 64;
export const MAX_ACTORS = 64;
export const MAX_CAMERA_PLAYERS = 6;
export const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const time = value => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
export const point = value => record(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
export const own = (map, id) => Object.hasOwn(map, id) ? map[id] : undefined;
export const dictionary = () => ({});
export const put = (map, id, value) => Object.defineProperty(map, id, { value, writable: true, enumerable: true, configurable: true });
export const clone = value => structuredClone(value);
export const tactical = state => [4,5].includes(state?.schemaVersion);
export function mapForState(state) {
  if (tactical(state) && (state.tacticalVersion !== 1 || !record(state.map) || Object.keys(state.map).length !== 2 || !Object.hasOwn(state.map, 'id') || !Object.hasOwn(state.map, 'version'))) throw new Error('Invalid investigation map');
  return getMap(state?.map);
}
export const deviceFor = (id, state) => mapForState(state).fixtures.devices.find(device => device.id === id);
export const mapIdentity = state => { const map = mapForState(state); return { id: map.id, version: map.version }; };
export const scoped = state => tactical(state) ? { map: mapIdentity(state) } : {};
export const actorFor = (state, player) => state.players.find(actor => actor.id === player?.id);
export const distance = (a, b) => point(a) && point(b) ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
export const moving = (player, at) => !!player.motion && (player.motion.path?.length > 0 || player.motion.destination != null || (player.motion.manual && player.motion.leaseUntil > at));
export const inTransit = (state, id) => !!state.systems?.transit && Object.hasOwn(state.systems.transit, id);
export const communications = state => state.systems?.communications?.active === true;
export function rules(state) {
  const result = {};
  for (const key of ['deviceReadMs', 'deviceCooldownMs', 'observationLimit', 'visionRadius', 'lightsVisionRadius']) result[key] = state.beaconRules?.[key] ?? DEFAULT_BEACON_RULES[key];
  if (!Number.isSafeInteger(result.deviceReadMs) || result.deviceReadMs < 1 || result.deviceReadMs > 86400000 || !Number.isSafeInteger(result.deviceCooldownMs) || result.deviceCooldownMs < 0 || result.deviceCooldownMs > 86400000 || !Number.isSafeInteger(result.observationLimit) || result.observationLimit < 1 || result.observationLimit > MAX_OBSERVATIONS || ![result.visionRadius, result.lightsVisionRadius].every(radius => Number.isFinite(radius) && radius > 0 && radius <= 10000)) throw new Error('Invalid investigation rules');
  return result;
}
export function unavailable(state, player, device, at, ctx) {
  if (!player || !player.alive) return 'dead';
  if (state.phase !== 'roam') return 'phase';
  if (communications(state)) return 'communications';
  if (inTransit(state, player.id)) return 'transit';
  if (!device || !point(player.position)) return 'position';
  if (moving(player, at)) return 'movement';
  if (typeof ctx?.nearby !== 'function' || typeof ctx?.sees !== 'function' || !ctx.nearby(state, player, device.position) || !ctx.sees(state, player, device.position)) return 'out_of_range';
  return null;
}
export function sessionReason(state, player, session, at, ctx) {
  const reason = unavailable(state, player, deviceFor(session.deviceId, state), at, ctx);
  if (reason) return reason;
  if (tactical(state) && (!record(session.map) || session.map.id !== state.map.id || session.map.version !== state.map.version)) return 'map';
  if (distance(player.position, session.anchor) > .001) return 'movement';
  return null;
}

/** A camera is a public stationary observer; never impersonates an eyewitness. */
function cameraFrame(state, player, camera, ctx, config) {
  const radius = Math.min(camera.radius ?? config.visionRadius, state.systems?.lights?.active ? config.lightsVisionRadius : config.visionRadius);
  // The foundation cameras have radial FOV. A shared directional fixture may
  // optionally narrow it with facingRad/fovRad; no actor's saboteur vision bonus.
  const fov = camera.fovRad ?? Math.PI * 2, facing = camera.facingRad ?? 0;
  if (!point(camera.position) || !Number.isFinite(radius) || radius <= 0 || !Number.isFinite(fov) || fov <= 0 || fov > Math.PI * 2 || !Number.isFinite(facing)) throw new Error('Invalid camera fixture');
  const observer = { id: player.id, alive: true, role: 'crew', position: { x: camera.position.x, y: camera.position.y } };
  const visible = state.players.filter(target => {
    if (!target.alive || inTransit(state, target.id) || !point(target.position) || distance(camera.position, target.position) > radius) return false;
    const angle = Math.atan2(target.position.y - camera.position.y, target.position.x - camera.position.x) - facing;
    if (distance(camera.position, target.position) > 1e-8 && Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) > fov / 2 + 1e-10) return false;
    return ctx.sees(state, observer, target.position);
  }).sort((a, b) => distance(camera.position, a.position) - distance(camera.position, b.position) || a.id.localeCompare(b.id));
  return { cameraId: camera.id, ...(tactical(state) ? { field: { origin: { ...camera.position }, radius, facingRad: facing, fovRad: fov } } : {}), limited: visible.length > MAX_CAMERA_PLAYERS, players: visible.slice(0, MAX_CAMERA_PLAYERS).map(target => ({ id: target.id, position: { x: target.position.x, y: target.position.y } })) };
}
export function sample(state, player, device, at, ctx) {
  const config = rules(state), map = mapForState(state), cameras = map.fixtures.cameras;
  let data;
  if (device.kind === 'cameras') {
    if (cameras.length > 8) throw new Error('Camera fixture limit');
    data = { frames: cameras.map(camera => cameraFrame(state, player, camera, ctx, config)) };
  } else if (device.kind === 'occupancy') {
    const counts = new Map(map.roomLayout.map(room => [room.id, 0]));
    for (const target of state.players) {
      if (!target.alive || inTransit(state, target.id) || !point(target.position)) continue;
      const found = map.geometry.worldRoomAt(target.position), room = typeof found === 'string' ? found : found?.id;
      if (counts.has(room)) counts.set(room, counts.get(room) + 1);
    }
    data = { rooms: [...counts].map(([roomId, count]) => ({ roomId, count })) };
  } else if (device.kind === 'vitals') data = { players: state.players.map(target => ({ id: target.id, status: target.alive ? 'alive' : 'dead' })) };
  else throw new Error('Invalid investigation device');
  return { id: `obs:${player.id}:${device.id}:${at}`, deviceId: device.id, kind: device.kind, at, ...scoped(state), ...(tactical(state) ? { provenance: { type: 'device', ownerId: player.id } } : {}), data };
}

const keys = (value, allowed) => record(value) && Object.keys(value).every(key => allowed.includes(key));
const assert = condition => { if (!condition) throw new Error('Invalid investigation state'); };
export function validateFixtures(state) {
  const map = mapForState(state), deviceFixtures = map.fixtures.devices, cameraFixtures = map.fixtures.cameras, roomIds = new Set(map.roomLayout.map(room => room.id)), { isWalkable } = map.geometry;
  const devices = new Map(deviceFixtures.map(device => [device.id, device]));
  assert(Array.isArray(deviceFixtures) && deviceFixtures.length > 0 && deviceFixtures.length <= 16 && devices.size === deviceFixtures.length);
  for (const device of deviceFixtures) assert(typeof device.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(device.id) && ['cameras', 'occupancy', 'vitals'].includes(device.kind) && typeof device.label === 'string' && device.label.length <= 120 && roomIds.has(device.roomId) && point(device.position) && isWalkable(device.position));
  assert(Array.isArray(cameraFixtures) && cameraFixtures.length > 0 && cameraFixtures.length <= 8 && new Set(cameraFixtures.map(camera => camera.id)).size === cameraFixtures.length);
  for (const camera of cameraFixtures) assert(typeof camera.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(camera.id) && roomIds.has(camera.roomId) && point(camera.position) && isWalkable(camera.position) && (camera.radius === undefined || Number.isFinite(camera.radius) && camera.radius > 0 && camera.radius <= 10000) && (camera.facingRad === undefined || Number.isFinite(camera.facingRad)) && (camera.fovRad === undefined || Number.isFinite(camera.fovRad) && camera.fovRad > 0 && camera.fovRad <= Math.PI * 2));
}

export function validateObservation(observation, actorId, actors, updatedAt, state) {
  const map = mapForState(state), cameraFixtures = map.fixtures.cameras, roomIds = new Set(map.roomLayout.map(room => room.id)), { WORLD, isWalkable } = map.geometry;
  assert(keys(observation, ['id', 'deviceId', 'kind', 'at', 'data', ...(tactical(state) ? ['map', 'provenance'] : [])]));
  if (tactical(state)) {
    assert(keys(observation.map, ['id', 'version']) && observation.map.id === map.id && observation.map.version === map.version);
    assert(keys(observation.provenance, ['type', 'ownerId']) && observation.provenance.type === 'device' && observation.provenance.ownerId === actorId);
  }
  const device = deviceFor(observation.deviceId, state);
  assert(device && observation.kind === device.kind && time(observation.at) && observation.at <= updatedAt && observation.id === `obs:${actorId}:${device.id}:${observation.at}` && record(observation.data));
  if (device.kind === 'cameras') {
    assert(keys(observation.data, ['frames']) && Array.isArray(observation.data.frames) && observation.data.frames.length === cameraFixtures.length);
    const cameras = new Set();
    for (const frame of observation.data.frames) {
      assert(keys(frame, ['cameraId', 'limited', 'players', ...(tactical(state) ? ['field'] : [])]) && cameraFixtures.some(camera => camera.id === frame.cameraId) && !cameras.has(frame.cameraId) && typeof frame.limited === 'boolean' && Array.isArray(frame.players) && frame.players.length <= MAX_CAMERA_PLAYERS); cameras.add(frame.cameraId);
      if (tactical(state)) {
        const camera = cameraFixtures.find(value => value.id === frame.cameraId), field = frame.field, config = rules(state), normal = Math.min(camera.radius ?? config.visionRadius, config.visionRadius), dark = Math.min(normal, config.lightsVisionRadius);
        assert(keys(field, ['origin', 'radius', 'facingRad', 'fovRad']) && keys(field.origin, ['x', 'y']) && field.origin.x === camera.position.x && field.origin.y === camera.position.y && [normal, dark].includes(field.radius) && field.facingRad === (camera.facingRad ?? 0) && field.fovRad === (camera.fovRad ?? Math.PI * 2));
        for (const entry of frame.players) {
          const angle = Math.atan2(entry.position?.y - field.origin.y, entry.position?.x - field.origin.x) - field.facingRad;
          assert(distance(entry.position, field.origin) <= field.radius && (distance(entry.position, field.origin) <= 1e-8 || Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) <= field.fovRad / 2 + 1e-10));
        }
      }
      const seen = new Set();
      for (const player of frame.players) { assert(keys(player, ['id', 'position']) && actors.has(player.id) && !seen.has(player.id) && keys(player.position, ['x', 'y']) && point(player.position) && player.position.x >= 0 && player.position.x <= WORLD.width && player.position.y >= 0 && player.position.y <= WORLD.height && isWalkable(player.position)); seen.add(player.id); }
    }
  } else if (device.kind === 'occupancy') {
    assert(keys(observation.data, ['rooms']) && Array.isArray(observation.data.rooms) && observation.data.rooms.length === roomIds.size);
    const seen = new Set();
    for (const room of observation.data.rooms) { assert(keys(room, ['roomId', 'count']) && roomIds.has(room.roomId) && !seen.has(room.roomId) && Number.isSafeInteger(room.count) && room.count >= 0 && room.count <= actors.size); seen.add(room.roomId); }
    assert(observation.data.rooms.reduce((sum, room) => sum + room.count, 0) <= actors.size);
  } else {
    assert(keys(observation.data, ['players']) && Array.isArray(observation.data.players) && observation.data.players.length === actors.size);
    const seen = new Set();
    for (const player of observation.data.players) { assert(keys(player, ['id', 'status']) && actors.has(player.id) && !seen.has(player.id) && ['alive', 'dead'].includes(player.status)); seen.add(player.id); }
  }
}
export function validateState(state) {
  validateFixtures(state);
  assert(Array.isArray(state.players) && state.players.length > 0 && state.players.length <= MAX_ACTORS && time(state.updatedAt));
  const actors = new Set(state.players.map(player => player.id));
  assert(actors.size === state.players.length && state.players.every(player => typeof player.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(player.id) && typeof player.alive === 'boolean'));
  const config = rules(state), investigation = state.investigation;
  assert(keys(investigation, ['version', 'sessions', 'observations', 'cooldowns']) && investigation.version === 1);
  for (const map of [investigation.sessions, investigation.observations, investigation.cooldowns]) assert(record(map) && Object.keys(map).length <= actors.size && Object.keys(map).every(id => actors.has(id)));
  for (const [id, session] of Object.entries(investigation.sessions)) {
    assert(keys(session, ['deviceId', 'startedAt', 'deadlineAt', 'anchor', 'status', 'endedAt', 'reason', ...(tactical(state) ? ['map'] : [])]) && deviceFor(session.deviceId, state) && time(session.startedAt) && session.startedAt <= state.updatedAt && time(session.deadlineAt) && session.deadlineAt > session.startedAt && session.deadlineAt - session.startedAt === config.deviceReadMs && keys(session.anchor, ['x', 'y']) && point(session.anchor));
    if (tactical(state)) { const map = mapForState(state); assert(keys(session.map, ['id', 'version']) && session.map.id === map.id && session.map.version === map.version && map.geometry.isWalkable(session.anchor) && distance(session.anchor, deviceFor(session.deviceId, state).position) <= map.geometry.WORLD.interactionRadius); }
    assert(['reading', 'elapsed', 'failed'].includes(session.status));
    if (session.status === 'reading') assert(session.endedAt === null && session.reason === null);
    else assert(time(session.endedAt) && session.endedAt >= session.startedAt && session.endedAt <= state.updatedAt && (session.status === 'elapsed' ? session.endedAt === session.deadlineAt && session.reason === null : ['cancelled', 'dead', 'phase', 'communications', 'transit', 'position', 'movement', 'out_of_range', 'stale', ...(tactical(state) ? ['map'] : [])].includes(session.reason)));
    if (session.status === 'reading') assert((own(investigation.cooldowns, id) ?? 0) <= session.startedAt);
    else assert(own(investigation.cooldowns, id) === session.endedAt + config.deviceCooldownMs);
    if (session.status === 'failed' && session.reason === 'stale') assert(session.endedAt > session.deadlineAt);
    if (session.status === 'elapsed') assert(own(investigation.observations, id)?.some(observation => observation.id === `obs:${id}:${session.deviceId}:${session.endedAt}`));
  }
  for (const [id, observations] of Object.entries(investigation.observations)) {
    assert(Array.isArray(observations) && observations.length <= config.observationLimit);
    const seen = new Set(); let last = -1;
    for (const observation of observations) { validateObservation(observation, id, actors, state.updatedAt, state); assert(!seen.has(observation.id) && observation.at >= last); seen.add(observation.id); last = observation.at; }
  }
  for (const value of Object.values(investigation.cooldowns)) assert(time(value));
  return true;
}
