import { BEACON_DEVICES } from '../../../shared/beacon.mjs';
import { MAX_ACTORS, record, own, dictionary, put, clone, time, point, actorFor, deviceFor, rules, unavailable, sessionReason, sample, validateState, validateObservation } from './data.mjs';

export const INVESTIGATION_ACTIONS = Object.freeze(['investigate', 'deviceCancel']);
const fail = (code, message) => ({ code, message });
const active = session => session?.status === 'reading';
const hasState = state => record(state?.investigation);
function atTime(at) { if (!time(at)) throw new Error('Invalid investigation time'); }
function privateRecord(ctx, state, playerId, type, at, fields) {
  if (typeof ctx?.record !== 'function') throw new Error('Investigation replay context unavailable');
  ctx.record(state, type, at, { ...clone(fields), playerId, visibleTo: [playerId] });
}

export function initializeInvestigation(state, now) {
  atTime(now);
  if (state.investigation !== undefined) { validateState(state); return false; }
  if (!Array.isArray(state.players) || !state.players.length || state.players.length > MAX_ACTORS) throw new Error('Invalid investigation roster');
  rules(state);
  state.investigation = { version: 1, sessions: dictionary(), observations: dictionary(), cooldowns: dictionary() };
  validateState(state); return true;
}

/** Overdue restored reads wake at the saved checkpoint, never in the past. */
export function investigationDeadline(state) {
  if (!hasState(state)) return Infinity;
  let next = Infinity;
  for (const session of Object.values(state.investigation.sessions)) if (active(session)) next = Math.min(next, Math.max(session.deadlineAt, state.updatedAt));
  return next;
}
function finish(state, playerId, session, at, reason, ctx) {
  const config = rules(state), deadline = at + config.deviceCooldownMs;
  if (!time(deadline)) throw new Error('Investigation time limit');
  // No sensitive terminal activity is sent through publicEvent.
  privateRecord(ctx, state, playerId, 'device_session', at, { deviceId: session.deviceId, status: 'failed', reason });
  put(state.investigation.sessions, playerId, { ...session, status: 'failed', endedAt: at, reason });
  put(state.investigation.cooldowns, playerId, deadline);
}
export function advanceInvestigation(state, at, ctx) {
  atTime(at);
  if (!hasState(state)) return false;
  if (at < state.updatedAt) throw new Error('Investigation time moved backwards');
  let changed = false;
  for (const [playerId, session] of Object.entries(state.investigation.sessions)) {
    if (!active(session)) continue;
    if (at < session.startedAt) throw new Error('Investigation time moved backwards');
    const player = actorFor(state, { id: playerId });
    const reason = sessionReason(state, player, session, at, ctx);
    if (reason) { finish(state, playerId, session, at, reason, ctx); changed = true; continue; }
    if (at < session.deadlineAt) continue;
    // A late caller cannot label current positions/health as a past sample.
    if (at > session.deadlineAt) { finish(state, playerId, session, at, 'stale', ctx); changed = true; continue; }
    const config = rules(state), observation = sample(state, player, deviceFor(session.deviceId), at, ctx);
    const cooldown = at + config.deviceCooldownMs; if (!time(cooldown)) throw new Error('Investigation time limit');
    privateRecord(ctx, state, playerId, 'device_observation', at, { observation });
    const previous = own(state.investigation.observations, playerId) ?? [];
    put(state.investigation.observations, playerId, [...previous, observation].slice(-config.observationLimit));
    put(state.investigation.sessions, playerId, { ...session, status: 'elapsed', endedAt: at, reason: null });
    put(state.investigation.cooldowns, playerId, cooldown); changed = true;
  }
  return changed;
}

export function onInvestigationPhaseChange(state, phase, at, ctx) {
  atTime(at);
  if (!hasState(state) || phase === 'roam') return false;
  if (at < state.updatedAt) throw new Error('Investigation time moved backwards');
  let changed = false;
  for (const [id, session] of Object.entries(state.investigation.sessions)) if (active(session)) { finish(state, id, session, at, 'phase', ctx); changed = true; }
  return changed;
}

export function validateInvestigationAction(state, player, action, now, ctx) {
  if (!time(now) || !record(action) || !INVESTIGATION_ACTIONS.includes(action.type) || (action.id !== undefined && (typeof action.id !== 'string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(action.id)))) return fail('INVALID_ACTION', 'Invalid terminal action.');
  const fields = action.type === 'investigate' ? ['id', 'type', 'deviceId'] : ['id', 'type'];
  if (Object.keys(action).some(key => !fields.includes(key)) || (action.type === 'investigate' && typeof action.deviceId !== 'string')) return fail('INVALID_ACTION', 'Invalid terminal action fields.');
  if (!hasState(state)) return fail('UNAVAILABLE', 'Investigation consoles are not enabled in this match.');
  const actor = actorFor(state, player);
  if (!actor) return fail('INVALID_PLAYER', 'Unknown keeper.');
  if (!actor.alive) return fail('PLAYER_DEAD', 'Fallen keepers cannot use consoles.');
  if (state.phase !== 'roam') return fail('WRONG_PHASE', 'Consoles require an active watch.');
  if (now < state.updatedAt) return fail('INVALID_TIME', 'Terminal time is stale.');
  const session = own(state.investigation.sessions, actor.id);
  if (action.type === 'deviceCancel') {
    if (!time(now + rules(state).deviceCooldownMs)) return fail('INVALID_TIME', 'Terminal time limit reached.');
    return active(session) ? null : fail('UNAVAILABLE', 'No terminal read is in progress.');
  }
  const device = deviceFor(action.deviceId);
  if (!device) return fail('INVALID_DEVICE', 'Choose a known investigation console.');
  if (state.systems?.communications?.active) return fail('COMMUNICATIONS_DOWN', 'Communications are disabled; consoles are unavailable.');
  if (active(session)) return fail('DEVICE_BUSY', 'Finish or cancel the current terminal read first.');
  if ((own(state.investigation.cooldowns, actor.id) ?? 0) > now) return fail('COOLDOWN', 'Your terminal equipment is cooling down.');
  const reason = unavailable(state, actor, device, now, ctx);
  if (reason) return fail('UNAVAILABLE', ({ movement: 'Stand still before starting a terminal read.', transit: 'Consoles are unavailable during transit.', out_of_range: 'Approach a visible console before reading it.' })[reason] ?? 'This console is unavailable.');
  const deadline = now + rules(state).deviceReadMs;
  if (!time(deadline) || !time(deadline + rules(state).deviceCooldownMs)) return fail('INVALID_TIME', 'Terminal time limit reached.');
  return null;
}

/** Coordinator still owns outer action IDs, cloning and durable commits. */
export function applyInvestigationAction(state, player, action, now, ctx) {
  const denial = validateInvestigationAction(state, player, action, now, ctx);
  if (denial) return false;
  const actor = actorFor(state, player);
  if (action.type === 'deviceCancel') { finish(state, actor.id, own(state.investigation.sessions, actor.id), now, 'cancelled', ctx); return true; }
  const deadlineAt = now + rules(state).deviceReadMs;
  privateRecord(ctx, state, actor.id, 'device_session', now, { deviceId: action.deviceId, status: 'reading', deadlineAt });
  put(state.investigation.sessions, actor.id, { deviceId: action.deviceId, startedAt: now, deadlineAt, anchor: { x: actor.position.x, y: actor.position.y }, status: 'reading', endedAt: null, reason: null });
  return true;
}

export function investigationActionHints(state, player, now, ctx) {
  const actor = actorFor(state, player); if (!actor || !hasState(state)) return [];
  const hints = BEACON_DEVICES.map(device => {
    const fields = { deviceId: device.id }, denial = validateInvestigationAction(state, actor, { type: 'investigate', ...fields }, now, ctx);
    return { id: `investigate:${device.id}`, type: 'investigate', fields, label: device.label, enabled: denial === null, position: { x: device.position.x, y: device.position.y }, roomId: device.roomId, ...(denial ? { reason: denial.message } : {}) };
  });
  if (active(own(state.investigation.sessions, actor.id))) {
    const denial = validateInvestigationAction(state, actor, { type: 'deviceCancel' }, now, ctx);
    hints.push({ id: 'deviceCancel', type: 'deviceCancel', fields: {}, label: 'Cancel terminal read', enabled: denial === null, ...(denial ? { reason: denial.message } : {}) });
  }
  return hints;
}

export function getInvestigationView(state, viewerId, now, ctx) {
  atTime(now);
  const actor = actorFor(state, { id: viewerId }), enabled = hasState(state);
  let status = !enabled ? 'unavailable' : state.systems?.communications?.active ? 'unavailable' : !actor ? 'spectating' : !actor.alive || state.phase !== 'roam' ? 'inactive' : 'available';
  const output = { devices: BEACON_DEVICES.map(device => {
    const denial = actor && enabled ? validateInvestigationAction(state, actor, { type: 'investigate', deviceId: device.id }, now, ctx) : fail('UNAVAILABLE', !enabled ? 'Consoles are not enabled.' : state.systems?.communications?.active ? 'Communications are disabled; consoles are unavailable.' : 'Observe only; no console access.');
    return { id: device.id, kind: device.kind, label: device.label, roomId: device.roomId, position: { x: device.position.x, y: device.position.y }, available: denial === null, ...(denial ? { reason: denial.message } : {}) };
  }), session: null, observations: [], status };
  if (!actor || !enabled) return output;
  const raw = own(state.investigation.sessions, actor.id), cooldownAt = own(state.investigation.cooldowns, actor.id) ?? 0;
  if (!time(cooldownAt)) throw new Error('Invalid investigation cooldown');
  if (raw) {
    if (!record(raw) || !time(raw.startedAt) || !time(raw.deadlineAt) || !point(raw.anchor) || (raw.endedAt !== null && !time(raw.endedAt)) || (raw.reason !== null && !['cancelled', 'dead', 'phase', 'communications', 'transit', 'position', 'movement', 'out_of_range', 'stale'].includes(raw.reason))) throw new Error('Invalid investigation session');
    const device = deviceFor(raw.deviceId); if (!device || !['reading', 'elapsed', 'failed'].includes(raw.status)) throw new Error('Invalid investigation session');
    const reason = active(raw) ? sessionReason(state, actor, raw, now, ctx) ?? (now >= raw.deadlineAt ? 'stale' : null) : raw.reason;
    output.session = { deviceId: device.id, startedAt: raw.startedAt, deadlineAt: raw.deadlineAt, status: active(raw) && reason ? 'stale' : raw.status, endedAt: raw.endedAt, reason, cooldownAt };
    if (status === 'available') output.status = active(raw) ? reason ? 'stale' : 'reading' : cooldownAt > now ? 'cooldown' : raw.status;
  } else if (status === 'available' && cooldownAt > now) output.status = 'cooldown';
  const observations = own(state.investigation.observations, actor.id) ?? [];
  if (!Array.isArray(observations) || observations.length > rules(state).observationLimit) throw new Error('Invalid investigation observations');
  const actors = new Set(state.players.map(player => player.id));
  for (const observation of observations) validateObservation(observation, actor.id, actors, state.updatedAt);
  output.observations = clone(observations);
  return output;
}
export const validateInvestigationState = validateState;
