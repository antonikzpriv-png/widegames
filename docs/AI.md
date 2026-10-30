# Station and navigation integration

For match5, local worldCandidates uses nextStationInput on only its character's projected puzzle clues, then proposes ordinary validated taskInteract actions. All six original puzzle kinds are playable without credentials. Geometry caches contain only immutable public walkability/edge data, bounded to four closed-door signatures per registered map; actors, routes and model memory are not cached there. Server startup prepares selected-map navigation before accepting requests. Council models, budgets, identities and explicit demo/hybrid labels remain as below.

# Lantern Wake AI

Current beacon matches use explicit safe-view unknown/alive/dead status and dynamic rosters up to12 keepers. Unknown is never converted to dead in memory/provider input. Local goals handle actual system repair sites, disruptions and physical navigation; completed terminal sessions and reported historical bodies cannot trap the policy. Council can reference up to three owner-permitted dated device samples, separately from attack witnesses and proximity inferences. Existing provider/call/token/cost limits are unchanged. All new verification uses fixtures or labeled local demo, with no paid calls. See NEXT_FEATURE_INTERFACES.md.

Implementation: `server/ai/index.mjs`, `server/ai/demo.mjs`, `server/ai/anthropic.mjs`.

## Controller contract

```js
const ai = createAiController({ config: config.ai }); // full config also accepted
const action = await ai.decide({
  view: getPlayerView(state, player.id, now),
  player,                 // public CHARACTERS entry only
  context: room.aiContext,
  signal,
  commitReservation: async ({ id, amountUsd }) => {
    // Coordinator/transport: atomically persist aiContext and daily ledger.
    // Reject, throw, or return false when persistence/daily budget denies.
  }
});
```

Return is an action envelope with a unique engine-compatible ID, or null. Only the engine applies it. AI never imports or reads engine state. Views are read-only to the controller. Context is private, JSON-serializable server state: `matches['match:<id>']` contains conservative budget counters, reservation IDs and `memories['actor:<id>']`; `activeMatchId` selects the summary. Reuse the same context object for all characters in one room, persist it, and restore it before scheduling new decisions. Do not replace/clonally swap the context while decisions are in flight. Schedule at most one decision per actor per interval. The controller also checks its persisted timestamp and an in-process actor lock. Different matches have separate memories and budgets.

`ai.describe(context)` returns only `{mode,strategy,navigation,council,provider,model,calls,tokens,costUsd,limitReason?}`. Live summaries explicitly use `mode:"live", strategy:"hybrid", navigation:"local", council:"model"`; demo/fallback uses `strategy:"demo", navigation:"local", council:"demo"`. UI should label live mode as "Hybrid: live council / local navigation". Local movement is never represented as a model decision. Transport puts that summary in `room.ai`, and only `context.notices` in `room.notices`. Never serialize the complete context, reservations, provider response, credentials or observations to clients. `calls`, `tokens`, and `costUsd` are conservative reserved ceilings, including uncertain/failed requests; they are not actual invoiced usage.

## Persistence and budget hook

Every council provider attempt, including the single permitted retry, first synchronously increments per-match counters and appends `{id,amountUsd}` to the context reservation list. It then invokes and **awaits** `commitReservation({id,amountUsd})`. Only a successful acknowledgement permits a provider request. The callback is mandatory for live mode. A thrown/rejected error, `false`, or `{allowed:false}` denies the send and selects labeled demo. Return undefined (or an allowed result) on success. IDs include a match-derived prefix and a UUID, so daily-ledger persistence can deduplicate acknowledgements. Each retry has a fresh ID and its own reservation.

The transport/coordinator owns durable storage and the daily cap; the AI owns per-match reservation. Serialize competing hook writes and atomically persist both `room.aiContext` and the daily ledger before resolving. Never await an entire decision while holding a persistence lock needed by its callback. AI context is changed before hook entry, so snapshot it **inside** that serialized write. Keep reservations after restart; do not replay a pending provider request or refund a reservation with an unknown outcome. Persist post-decision demo notices/memory alongside normal room updates.

The hook shares each attempt's timeout/abort deadline. A late hook completion cannot send a request after timeout/cancellation. The hook itself must provide atomic writes and bounded execution; the controller cannot undo an already-started storage operation. Reservations remain charged even when persistence fails. This deliberately sacrifices availability instead of risking duplicated spend.

## Demo behavior

Demo is the default and needs no credentials. Each keeper uses its own safe view. Deterministic BFS follows the public map, crew finish their own tasks and prioritize critical repairs; the saboteur patrols, eliminates locally and sabotages. Local body sightings trigger reports. Each of the six characters has distinct opening, question and closing phrases, for both crew speech and saboteur bluffs. Safe firsthand witness events retain actor, victim, room and time only within that actor/match memory; eyewitness evidence outranks proximity guesses in dialogue and votes. Public rumors never become firsthand evidence. Proximity-based accusations explicitly say "Suspicion only" and "I did not see an attack". Actual safe witness events and bounded local observations influence suspicion, public debate and votes; absent evidence, crew skip. Saboteurs bluff and vote against another keeper. Dialogue is limited to three proposed messages per meeting and respects engine action hints. All proposals still undergo engine validation, including stale parallel proposals. The controller returns null for spectators, eliminated characters and inactive phases.

Demo decisions have random request IDs for idempotency but deterministic policy choices for the same view/memory. Demo notices explicitly say `Demo AI active: ...`. Unavailability or exhausted budget permanently selects demo for that match, preventing repeated failures every tick. No rule-judged or model-judged winner is invented; engine tasks, ejection, parity or critical failure decide matches.

## Hybrid live council and Anthropic setup

All roam actions (movement, tasks, repair, reports, elimination, sabotage, emergency meetings and waits) use the deterministic local policy in live as well as demo mode: no provider requests, reservation callbacks or budget increments. Only `discussion` speech and `voting` ballots can contact Anthropic; the adapter also rejects request construction outside those phases. Live speech is capped at two proposals per actor per meeting and voting uses one ballot, still constrained by the unchanged match call/token/cost caps. Demo speech retains its three-message cap. No budgets were raised by this refinement; coordinator configuration may supply `maxTokens:120000` while keeping `maxCostUsd:0.50`. The standalone controller fallback default remains 24000.

Use the root environment settings `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-haiku-4-5-20251001`, `MAX_AI_CALLS`, `MAX_AI_TOKENS` and `MAX_AI_COST_USD`. The coordinator supplies timeoutMs and decisionIntervalMs. No root config changes are required. Missing credentials default to labeled demo. Only the pinned Haiku model has a qualified price/adapter entry; arbitrary model names fail closed to demo rather than silently using an unknown price. Adding another model requires an explicit pricing/compatibility entry and offline tests.

The native fetch adapter uses the first-party HTTPS Messages endpoint with API version `2023-06-01`. It forces one `pick_action` tool call from a bounded list of proposed actions; no arbitrary action fields, IDs or targets from model text are trusted. Optional speech only changes the public text of an offered say action. Only safe observations, short recent dialogue and canonical public character persona enter the prompt. `firsthandWitnesses` and `proximitySuspicions` are separate fields, with an instruction to distinguish evidence from inference. No chain-of-thought is requested; non-tool response content is discarded. Provider responses/errors are never placed in notices, context or public summaries. Redirects are rejected.

Requests are capped at 12,000 UTF-8 bytes, responses at 32 KiB, output at 256 tokens, and choices at 40. Input reservation uses serialized request bytes plus 1,024 tokens for tool framing, rather than optimistic words/token estimates. Cost reserves pinned standard Haiku pricing of $1 per million input tokens and $5 per million output tokens, rounded upward. Provider-reported usage exceeding the reservation fails closed. Budgets of zero prevent the hook/send; parallel in-flight reservations count immediately. Unknown and malformed budget values cannot enlarge a cap.

Each attempt has a timeout covering hook, fetch and response reading (default 10 seconds). Caller cancellation returns null without a retry; uncertain reservations stay charged. HTTP 429, 5xx, network failure and timeouts can retry once, with a new reservation/hook acknowledgement. Authentication errors, malformed output and denied persistence do not retry. No background loop or model calls occur in engine ticks; transport controls cadence. Conservative accounting can exhaust the token cap well before 48 calls; the resulting demo fallback is intentional and visible.

Official sources checked 2026-10-29:

- [Create a Message](https://platform.claude.com/docs/en/api/messages/create)
- [Define tools and force tool choice](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)
- [Model pricing, Haiku 4.5](https://platform.claude.com/docs/en/about-claude/pricing)

## Offline qualification

`node --test tests/ai-controller.test.mjs` covers demo actions, serialization, public-safe summaries, interval/actor locks, hook ordering/denial, individual caps, concurrent reservations, retry IDs, restart accounting, output validation, timeout and cancellation. All live adapters are mocked. No paid calls are made.

`node --test tests/ai-engine.test.mjs` runs 16 seeded spectator matches and four idle-human matches using accelerated engine rules. It asserts that all matches reach an engine outcome, every proposed action is accepted, safe views are unchanged, and tasks, movement, elimination, reporting, discussion, voting, sabotage and repair occur. This suite skips when the engine has not yet been integrated into the AI foundation branch. To qualify against a sibling engine without editing/importing its files, set `AI_ENGINE_TEST_MODULE=file:///D:/Widegames-work/engine/server/engine/index.mjs`. Re-run against the integrated engine before release.

If sandbox process spawning is denied with `spawn EPERM`, Node's `--test-isolation=none` runs the same tests in the main process. Ordinary `npm test` and `npm run check` should also be run in the authorized native task environment. Provider protocol compatibility is checked against official documentation and mocked envelopes; live credentials, billing and real provider latency are deliberately untested.

## Recorded foundation qualification (de4fa12)

Qualified against sibling engine commit `19aa06d0199c0ee3fb752248ab4bb43d1bd68a30` (read-only; engine not imported into this branch):

```powershell
$env:AI_ENGINE_TEST_MODULE='file:///D:/Widegames-work/engine/server/engine/index.mjs'
npm --cache D:/Widegames-work/npm-cache test
npm --cache D:/Widegames-work/npm-cache run check
```

Result: 30 tests passed, zero failures/skips, including 20 complete seeded matches; syntax checked 12 modules. The initial default-sandbox `node --test tests/ai-controller.test.mjs` failed before tests with `spawn EPERM`; both the non-isolated workaround and later authorized ordinary subprocess run passed. During development the accelerated match fixture initially let tasks finish before any elimination; adjusted relative cooldowns exercised every required action. A repeated mock installation initially contaminated the same-process combined suite; one mock with a selectable response fixed cleanup, and the full combined/ordinary suites passed. No paid/live provider calls were used. This worktree contains no transport implementation beyond foundation; coordinator must independently qualify atomic daily-ledger storage and the integrated scheduler.

The engine advanced during qualification; the two engine integration tests were repeated against clean committed 19aa06d and both passed (all 20 matches).

## Hybrid refinement qualification

The same `npm --cache D:/Widegames-work/npm-cache test` command with `AI_ENGINE_TEST_MODULE=file:///D:/Widegames-work/engine/server/engine/index.mjs` passed 36 tests, zero failures/skips, against engine `19aa06d0199c0ee3fb752248ab4bb43d1bd68a30`; this includes all 20 complete matches. `npm --cache D:/Widegames-work/npm-cache run check` passed all 12 modules. New coverage asserts zero calls/reservations for every live roam action, actual mocked provider choice of council speech and a non-default vote, the live speech cap across restore/new meetings, six distinct crew/bluff voices, evidence versus rumor/proximity, and actor/match witness-memory isolation. No paid calls occurred. The manager budget audit is recorded separately in `docs/AI-BUDGET-REVIEW-43f300c.md`; manager files were not edited.
