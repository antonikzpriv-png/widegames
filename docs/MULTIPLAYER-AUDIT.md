# Multiplayer follow-up audit

Audited in the Cloud workspace on 2026-10-30. The original implementation was rechecked against every requested backend, UI, persistence, privacy and rematch constraint. Main advanced from `90bb6e8` to `fa7aaa0` during the audit; the branch merges that revision and preserves its authoritative five-task protocol, optional ghost/ability gameplay, tests, documentation, CI jobs and historical evidence.

## Findings corrected

- Named legacy room creation incorrectly assumed a configurable roster existed.
- Retrying an automatic seat claim could choose another seat or fail in a full lobby. Retries now retain the caller's current seat and readiness; changed names unready the caller.
- A duplicate rematch receipt was checked before host authorization. Every rematch attempt now authenticates and requires the host, including duplicate attempts.
- Disabled emergency bells could still attract local crew AI. Policies now honor that option.
- Old mutation completions could clear a newer pending operation or retry. Operation ownership, generation and action-context checks now fence both success and failure paths.
- Revoked movement responses could leave controls enabled until a later refresh. Authorization failures immediately disable movement; revoked polling also clears retries.
- Numeric settings could be lost on focus changes/background updates. Dirty forms now retain edits and starting applies them first.
- Active host revocation existed only as an API. **Manage crew** now exposes it through a focus-trapped dialog that stops movement and explains the reserved-seat policy.
- Dynamic save validation now additionally checks canonical badges/personas, rematch receipts and bounded archived rosters/factions.
- A late daily-budget reservation must finish conservatively without granting an old provider send. The additional post-reservation match check is covered by a deferred real-ledger test; uncertain reservations remain charged.
- The original per-address limits throttled multiple humans on the same network. Authenticated human charges now share that room's address allowance while retaining individual caps and the original single-human ceiling.
- Duplicate names needed consistent numbered attribution beyond voting. Elimination/confirmation, chat, ejection and replay labels now retain keeper badges.

The main integration also required dynamic crew task-accounting in optional-feature validation, ghost-aware human input and AI scheduling, generation-aware puzzle handling, configurable feature presets, and per-match vision for ability targeting/effect projection. A combined 15-player ghost/ability save/reload/rematch regression exercises these seams.

## Request coverage

| Requested behavior | Implementation and verification |
| --- | --- |
| Multiple humans, AI vacancies, spectators, invitations/readiness/host controls | `rooms.mjs`, serialized transport routes, lobby/member UI; real HTTP/WS and independent-browser coverage. Empty join remains spectator-only. |
| 4–15 capacity, 1–3 valid saboteurs, six-player defaults | `shared/lobby.mjs`, dynamic engine/AI/world; every supported capacity/ratio creates a valid, private, restorable roster. |
| Stable IDs/personas, p10–p15, collision-safe spawns | Canonical p1–p15 profiles; all spawn points walkable and separated by at least two body radii; large IDs/identities/bodies persist. |
| Names and distinguishable accessible appearance | Palette raincoats and numbered badges, including duplicate-name targets, council/chat, results/replays; desktop/mobile screenshots. |
| Task/speed/vision/cooldown/council/options controls | Server-bounded settings, ratios, immutable match snapshot; ghost/death/ability presets merged from main and tested with 15 actors. |
| Settings stay per match and lock at start | Independent speed/vision state tests and unchanged shared `WORLD`; active settings/seat writes rejected. |
| Serialized claims/readiness/settings/start | Single durable room queue; competing joins/start, duplicate claim/start and oversubscription regressions. |
| Current authenticated HTTP/WS ownership | Re-resolve in each queued mutation and each projection; reassignment, queued revocation and stale sockets tested. |
| Active newcomers spectate only | Existing cookies reconnect to original seats; new identities have no actor; revoked seats remain idle and human-owned until rematch. No takeover. |
| Private saboteur team knowledge | Only saboteur `self.teammates`; HTTP/WS crew/spectator checks, dynamic AI prompt checks, teammate exclusion from elimination/vote policy. |
| Multiple-saboteur outcomes | Ejecting one continues; ejecting all wins for crew; living parity wins for saboteurs; real browser match ejects all three. |
| Rematches preserve group/invitation and refresh logical match | Fresh generation/match ID, role randomness, versions/receipts/input/AI context and controllers; private bounded replay archive, host-only idempotent transition. |
| Old work cannot affect new generation | Old HTTP input/action/start, client responses/retries, queued AI/provider work and reservation callbacks fenced; deferred callbacks and fresh context tests. |
| Deployment budget/uncertain old reservations survive | Real durable daily ledger retains reservations through terminal cancellation, rematch and reload; no refund or ledger reset. |
| Strong historical persistence compatibility | Valid container schema 1 and engine schema 1/2 load byte-preservingly; dynamic saves/reloads at 4/6/15 and optional 15-player ghost state; malformed metadata still rejected. |
| Integrated latest main | Merge of `fa7aaa0`; original feature/task tests and browser suites retained, plus combined multiplayer/ghost regressions. |
| Setup, required checks, screenshots and handoff | Exact final results and screenshots in [qualification](MULTIPLAYER-VERIFICATION.md); cloud setup instructions retained. Feature branch only, no deployment or paid calls. PR API access remains an explicit external blocker. |

## Limits of the evidence

Automated coverage proves the listed scenarios, not absence of every possible bug. Browser fixtures use the real app, HTTP/WS, isolated identities and private storage, with explicit local AI/clock/engine fixtures for deterministic progression. No paid provider was called. Original reports are retained separately; the final merged-source results and source revisions are recorded in the qualification document.

The implementation and audit commits are pushed to `codex/multiplayer-configurable-lobbies`. Creating the requested PR requires `api.github.com`, which the enforced cloud network policy denies. Native Git fetch/push remains available. A reviewable PR body and a cloud configuration draft requesting that domain have been saved; no PR URL is claimed without successful creation.
