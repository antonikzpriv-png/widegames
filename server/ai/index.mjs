import { randomUUID, createHash } from 'node:crypto';
import { CHARACTERS } from '../../shared/contracts.mjs';
import { intentions, remember, install, execute, situation } from './strategic.mjs';
import { candidates, observe } from './demo.mjs';
import { AiFailure, MODEL, makeRequest, send } from './anthropic.mjs';

const REASONS = new Set(['demo_configured', 'missing_credentials', 'unsupported_provider', 'unsupported_model', 'reservation_required', 'reservation_failed', 'budget_calls', 'budget_tokens', 'budget_cost', 'provider_unavailable', 'provider_response', 'provider_usage', 'prompt_limit', 'output_limit', 'timeout', 'invalid_context']);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value, fallback, max) => value === undefined ? fallback : Number.isFinite(value) && value >= 0 ? Math.min(value, max) : 0;

/** Await an untrusted async operation while honoring cancellation and deadline. */
async function bounded(operation, signal) {
  signal.throwIfAborted();
  let listener;
  const aborted = new Promise((_, reject) => {
    listener = () => reject(signal.reason ?? new AiFailure('timeout', true));
    signal.addEventListener('abort', listener, { once: true });
  });
  try { return await Promise.race([Promise.resolve().then(operation), aborted]); }
  finally { signal.removeEventListener('abort', listener); }
}

export function createAiController({ config = {} } = {}) {
  const source = config.ai ?? config;
  const settings = {
    strategy: source.strategy === 'strategic' ? 'strategic' : 'hybrid',
    provider: source.provider ?? 'demo', apiKey: typeof source.apiKey === 'string' ? source.apiKey : '',
    model: source.model ?? MODEL,
    maxCalls: Math.floor(number(source.maxCalls, 48, 500)),
    maxTokens: Math.floor(number(source.maxTokens, 24000, 250000)),
    maxCostUsd: number(source.maxCostUsd, 0.5, 10),
    timeoutMs: Math.max(1, number(source.timeoutMs, 10000, 30000)),
    decisionIntervalMs: Math.max(1, number(source.decisionIntervalMs, 1800, 60000))
  };
  const initialReason = settings.provider === 'demo' ? 'demo_configured' : settings.provider !== 'anthropic' ? 'unsupported_provider' : !settings.apiKey ? 'missing_credentials' : settings.model !== MODEL ? 'unsupported_model' : null;
  const busy = new WeakMap();
  const matchKey = id => `match:${id}`;
  function notice(context, reason) {
    if (!Array.isArray(context.notices)) context.notices = [];
    const message = `Demo AI active: ${reason.replaceAll('_', ' ')}.`;
    if (!context.notices.includes(message)) context.notices.push(message);
    context.notices = context.notices.slice(-8);
  }
  function fallback(context, state, reason) {
    state.mode = 'demo';
    state.limitReason = REASONS.has(reason) ? reason : 'provider_unavailable';
    notice(context, state.limitReason);
  }
  function getState(context, matchId) {
    let invalid = context.matches !== undefined && !record(context.matches);
    if (!record(context.matches)) context.matches = {};
    context.activeMatchId = matchId;
    const key = matchKey(matchId);
    const fresh = () => ({ mode: initialReason ? 'demo' : 'live', calls: 0, tokens: 0, costUsd: 0, memories: {}, reservations: [] });
    if (!Object.hasOwn(context.matches, key)) context.matches[key] = fresh();
    if (!record(context.matches[key])) { invalid = true; context.matches[key] = fresh(); }
    const state = context.matches[key];
    if (state.mode === 'demo' && state.limitReason === 'invalid_context' && record(state.memories)) { notice(context, 'invalid_context'); return state; }
    const reservationsValid = Array.isArray(state.reservations) && state.reservations.length <= 500 && state.reservations.every(r => record(r) && typeof r.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(r.id) && Number.isFinite(r.amountUsd) && r.amountUsd > 0);
    if (!['demo', 'live'].includes(state.mode) || !Number.isSafeInteger(state.calls) || state.calls < 0 || !Number.isSafeInteger(state.tokens) || state.tokens < 0 || !Number.isFinite(state.costUsd) || state.costUsd < 0 || !record(state.memories) || !reservationsValid) invalid = true;
    if (reservationsValid && (state.calls !== state.reservations.length || new Set(state.reservations.map(r => r.id)).size !== state.reservations.length || state.costUsd + 1e-9 < state.reservations.reduce((sum, r) => sum + r.amountUsd, 0))) invalid = true;
    if (invalid) {
      // A damaged restored ledger may not reopen the live allowance.
      state.calls = settings.maxCalls; state.tokens = settings.maxTokens; state.costUsd = settings.maxCostUsd;
      state.reservations = []; state.memories = {};
      fallback(context, state, 'invalid_context');
    }
    if (initialReason) fallback(context, state, initialReason);
    return state;
  }
  function envelope(action, view, memory) {
    if (!action) return null;
    if (action.type === 'ghostSay') memory.ghostSpoken=true;
    if (action.type === 'say') memory.discussionCount = (memory.discussionCount ?? 0) + 1;
    if (view.worldVersion === 1 && action.type === 'repair') memory.worldRepairDeadline = view.sabotage?.deadlineAt;
    if (action.type === 'move' || action.type === 'navigate') memory.patrol = (memory.patrol ?? 0) + 1;
    const scope = createHash('sha256').update(view.matchId).digest('hex').slice(0, 12);
    return { ...action, id: `ai_${scope}_${randomUUID()}` };
  }
  return {
    async decide({ view, player, context, signal, commitReservation, getCurrentView } = {}) {
      if (signal?.aborted || !record(context) || !view?.self || (!view.self.alive&&!(view.self.ghost===true&&view.self.role==='crew')) || typeof view.matchId !== 'string' || !Number.isFinite(view.serverNow) || !['roam', 'discussion', 'voting'].includes(view.phase)) return null;
      const publicEntry=(view.players??[]).slice(0,24).find(p=>p.id===player?.id);
      const validName=typeof publicEntry?.name==='string'&&publicEntry.name.trim().length>0&&publicEntry.name.length<=80&&!/[\u0000-\u001f\u007f]/u.test(publicEntry.name);
      // Public roster wins over canonical defaults; never consume a supplied hidden persona.
      const actor=publicEntry&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(publicEntry.id)&&validName?{id:publicEntry.id,name:publicEntry.name,color:publicEntry.color,persona:'A keeper aboard the beacon.'}:null;
      if (!actor || actor.id !== view.self.id) return null;
      const state = getState(context, view.matchId);
      const actorKey = `actor:${actor.id}`;
      if (!record(state.memories[actorKey])) state.memories[actorKey] = {};
      const memory = state.memories[actorKey];
      let pending = busy.get(context);
      if (!pending) { pending = new Set(); busy.set(context, pending); }
      const busyKey = `${view.matchId}:${actor.id}`;
      if (pending.has(busyKey) || (memory.lastDecisionAt !== undefined && view.serverNow - memory.lastDecisionAt < settings.decisionIntervalMs)) return null;
      memory.lastDecisionAt = view.serverNow;
      pending.add(busyKey);
      try {
        observe(view, memory);
        if (settings.strategy === 'strategic' && view.worldVersion === 1) remember(view, memory);
        const strategic = settings.strategy === 'strategic' && state.mode === 'live' && !view.self.ghost && view.phase === 'roam' && view.worldVersion === 1;
        const localChoices = candidates(view, memory);
        if (view.phase !== 'roam' || view.self.ghost) delete memory.intention;
        // Retain optional local ability behavior without introducing model calls.
        if (view.self.alive && ['protect', 'decoy'].includes(localChoices[0]?.type)) return envelope(localChoices[0], view, memory);
        if(view.self.transit||view.systems?.selfTransit||view.investigation?.session?.status==='reading')return envelope(localChoices[0],view,memory);
        if (strategic) {
          const continued = execute(view, memory);
          if (continued) return envelope(continued, view, memory);
          delete memory.intention;
          // A failed/completed plan cannot buy repeated replans on each tick.
          if (memory.plannedSituation === situation(view, memory) && view.serverNow < memory.replanAt) return envelope(localChoices[0], view, memory);
        }
        const choices = strategic ? intentions(view, memory) : localChoices;
        if (!choices.length) return null;
        const demo = () => envelope(localChoices[0], view, memory);
        // Ordinary hybrid roaming stays local; strategic intentions use this same budget path.
        if (view.self.ghost || (!strategic && view.phase === 'roam') || (choices.length === 1 && choices[0].type === 'wait')) return demo();
        if (state.mode === 'live' && view.phase === 'discussion' && (memory.discussionCount ?? 0) >= 2) return null;
        if (state.mode !== 'live') return demo();
        if (typeof commitReservation !== 'function') { fallback(context, state, 'reservation_required'); return demo(); }
        if (strategic) { memory.plannedSituation = situation(view, memory); memory.replanAt = view.serverNow + 30000; }
        const current = () => getCurrentView ? getCurrentView() : view;
        const valid = () => { const fresh=current();return context.activeMatchId===view.matchId&&fresh?.matchId===view.matchId&&fresh.phase===view.phase&&fresh.self?.id===actor.id&&fresh.self?.alive===true&&fresh.map?.id===view.map?.id&&fresh.map?.version===view.map?.version&&fresh.meeting?.id===view.meeting?.id&&(!strategic||situation(fresh,memory)===situation(view,memory)); };
        let request;
        try { request = makeRequest(view, actor, memory, choices); }
        catch (error) { fallback(context, state, error.code); return demo(); }
        for (let attempt = 0; attempt < 2; attempt++) {
          if (signal?.aborted || !valid()) return null;
          if (state.mode !== 'live') return demo();
          const reason = state.calls + 1 > settings.maxCalls ? 'budget_calls' : state.tokens + request.tokens > settings.maxTokens ? 'budget_tokens' : state.costUsd + request.amountUsd > settings.maxCostUsd ? 'budget_cost' : null;
          if (reason) { fallback(context, state, reason); return demo(); }
          const id = `ai_${createHash('sha256').update(view.matchId).digest('hex').slice(0, 12)}_${randomUUID()}`;
          // Synchronous reservation before any await closes parallel-actor races.
          state.calls++;
          state.tokens += request.tokens;
          state.costUsd = Math.ceil((state.costUsd + request.amountUsd) * 1e9) / 1e9;
          state.reservations.push({ id, amountUsd: request.amountUsd });
          // Retain the maximum reservation forever, including timeouts/failures:
          // a crash or lost provider response must never refund uncertain spend.
          const timeout = new AbortController();
          const abort = () => timeout.abort(signal.reason);
          signal?.addEventListener('abort', abort, { once: true });
          const timer = setTimeout(() => timeout.abort(new AiFailure('timeout', true)), settings.timeoutMs);
          let persisted = false;
          try {
            const permission = await bounded(() => commitReservation({ id, amountUsd: request.amountUsd }), timeout.signal);
            if (permission === false || permission?.allowed === false) throw new AiFailure('reservation_failed');
            persisted = true;
            timeout.signal.throwIfAborted();
            if (!valid()) return null;
            if (state.mode !== 'live') return demo();
            const action = await bounded(() => send({ request, apiKey: settings.apiKey, choices, signal: timeout.signal }), timeout.signal);
            if (signal?.aborted) return null;
            if (!valid()) return null;
            if (state.mode !== 'live') return demo();
            if (strategic) { install(memory, action, current()); return envelope(execute(current(), memory), current(), memory); }
            return envelope(action, current(), memory);
          } catch (error) {
            if (signal?.aborted || !valid()) return null;
            const code = !persisted ? 'reservation_failed' : timeout.signal.aborted ? 'timeout' : error.code;
            if (persisted && attempt === 0 && (error.retryable || code === 'timeout')) continue;
            fallback(context, state, code);
            return demo();
          } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
          }
        }
        return demo();
      } finally { pending.delete(busyKey); }
    },
    describe(context = {}) {
      const state = context.matches?.[matchKey(context.activeMatchId)];
      const reason = initialReason ?? (REASONS.has(state?.limitReason) ? state.limitReason : undefined);
      const mode = initialReason ? 'demo' : state?.mode === 'demo' ? 'demo' : 'live';
      return {
        mode, strategy: mode === 'live' ? settings.strategy : 'demo',
        navigation: 'local', council: mode === 'live' ? 'model' : 'demo',
        provider: settings.provider === 'anthropic' ? 'anthropic' : 'demo',
        model: settings.provider === 'anthropic' && settings.model === MODEL ? MODEL : null,
        calls: Number.isFinite(state?.calls) ? state.calls : 0,
        tokens: Number.isFinite(state?.tokens) ? state.tokens : 0,
        costUsd: Number.isFinite(state?.costUsd) ? state.costUsd : 0,
        ...(reason ? { limitReason: reason } : {})
      };
    }
  };
}
