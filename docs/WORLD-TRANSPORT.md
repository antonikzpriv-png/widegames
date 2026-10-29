# World movement transport

`POST /api/rooms/:id/input` is the authenticated continuous-input boundary. It accepts exactly `{seq,dx,dy}`: sequence is a positive safe integer, directions are integers in -1..1, and a zero vector stops movement. The actor comes exclusively from this room's human p1 cookie. Missing/foreign room authentication, spectators, invalid origins, extra/private fields, malformed values and bodies over8KiB are rejected. Responses retain the normal permitted room envelope or safe `{error:{code,message}}`; no state/internal motion object is sent directly.

Movement has separate per-address and per-identity 600/minute counters and does not consume the 60/minute discrete actor allowance or the discrete write bucket. Every input still consumes the existing overall600/minute HTTP cap. That total includes create/start/poll/action traffic: a fresh test's create+start leave598 successful input requests before the next request receives429. The separate buckets therefore provide isolation, not extra overall capacity. HTTP is the input channel; WebSocket clients receive safe state broadcasts and continue to use HTTP for writes.

## Engine authority and persistence

Input executes inside the existing room mutation queue against a clone of current state. Results must have a valid accepted flag, same match/mode/schema, nondecreasing safe version and a valid persisted-room shape. Accepted schema2 results must acknowledge exactly the requested actor sequence. Changed state is persisted before replacing memory or broadcasting; changed deadline state is retained even when the input is denied. Inert duplicate results do not write/broadcast. Engine tick may still settle legitimate elapsed motion/deadlines while processing a retransmission, but retransmission cannot renew the input lease or repeat direction application. Invalid engine results fail closed without mutating the authoritative original.

Start forwards `world:config.worldMode===true`. Unspecified direct-constructor worldMode stays explicitly legacy. Root/coordinator `loadConfig` owns the production `worldMode:true` and tickMs100 settings. The transport never manufactures worldVersion, coordinates, hidden roles, navigation destinations or input counters in a client view: it uses the engine's own identity-specific view. Spectators may observe public physical positions, while a human's unseen players have null coordinates/room IDs and no other actor's private motion/destination/sequence. Only own permitted inputSeq/destination are exposed by Core.

The existing independent server timer drives authoritative movement and deadlines even with no browsers. A client zero-vector stop is best-effort; Core's600ms lease is the fallback after a browser disappears. Movement never directly calls a provider. Existing AI scheduling, terminal cancellation and durable room-before-deployment reservation ordering remain unchanged.

## Schema compatibility, validation and backup

The outer room/cookie format remains schema1. Engine checkpoints may be schema1 (legacy) or schema2/worldVersion1. A restored started legacy match keeps its original rules, roles, action IDs and room semantics even if the new deployment creates world matches. No restore/input path upgrades it or injects positions; mixed legacy/world fields are rejected. The real Core returns WORLD_REQUIRED for continuous input in a legacy match.

Schema2 structure validation checks canonical player IDs and roles, room IDs, finite positions/body timestamps, motion sequence/axes/times, boolean manual mode, at most4,096 path points, destination/path consistency and inactive/dead movement. The asynchronous `validateRoomSnapshot(room,{worldGeometry?})` additionally validates map bounds, collision-safe positions/paths/bodies and the maximum input lease against shared geometry. Navigation record times permit fractional milliseconds with a tiny floating-point comparison tolerance. Save validates before any primary write. Invalid saved files are preserved under uniquely named quarantine paths. A missing/invalid deployed geometry module is a startup error outside the quarantine handler, so a valid world checkpoint is preserved instead of being misclassified as corrupt.

Production geometry resolves `shared/world.mjs` only for schema2; schema1 rooms do not require that module. An optional `worldGeometry` server/store dependency supports read-only sibling/pinned qualification. The map/config modules remain coordinator owned and are not copied into this worker's runtime source tree.

`store.backup(roomId)` creates an exclusive private, synced byte copy next to the existing checkpoint and returns its path/schema metadata. It is server-only, has no HTTP route, and callers must serialize it with any live room writes (or operate after stopping the service and obtaining the exclusive store lock). Backups contain private identities/roles/AI context and must stay private. `validateRoomSnapshot` is a read-only candidate-validation path usable before an explicit offline migration: it neither writes the candidate nor changes the original. It checks structure/geometry, not whether a proposed conversion preserves every game's semantics. The test validates a deliberately constructed candidate after backing up the original, then proves the original bytes and resumed schema1 match are unchanged. No updater or automatic migration was added, and no original running data directory was opened.

## Qualification

Early boundary milestone: `f930d7f1beda63179065f5c754b4c2e5d91fad7d` (8 envelope controls passed). The completed follow-up has **15/15 world transport checks**, zero failures/skips, including7 actual-Core cases and8 independent envelope controls. Final actual-engine qualification used immutable ignored archive fixtures from:

- Core: `093d0498bec25faaa107e3d32231c93c89fdf69d`.
- Shared world geometry/config contract: `eb64cc8fc6f9a024c0fe6c84dabf384e897819fe`.
- Qualification fixture: `_artifacts/world-core-pin-6f2068108f5145f7a7139d55825a48b9` in this worktree. Other builders' source/worktrees were read only.

The first envelope fixture intentionally uses a stub applyInput and legacy initialization to isolate body/auth/quotas/serialization without pretending to qualify physics. Its `_transportTestInput` checkpoint is labelled test-only metadata; memory-store variants isolate rate behavior without hundreds of fsyncs. The actual-Core suite uses real engine/createMatch/applyInput/actions/ticks/views, real HTTP/WebSockets and persistent storage with only seeded initialization and idle AI injected. It verifies concurrent duplicates, exact speed/lease expiry without browsers, same-room task range before/after navigation, cross-room privacy, safe human/spectator socket updates, discussion denial/deadline persistence, restart sequences/stops, existing private context and unchanged durable deployment reservation, schema1 preservation, backup/dry validation, malformed snapshots and missing-geometry preservation.

After integrating coordinator shared modules and Core, ordinary commands are:

```powershell
node --test --test-concurrency=2 tests/world-transport-envelope.test.mjs tests/world-transport-core.test.mjs
node --test tests/transport-service.test.mjs tests/transport-lock-process.test.mjs
```

Before integration, set `WORLD_TRANSPORT_ENGINE_MODULE` to the pinned Core `server/engine/index.mjs` file URL and `WORLD_ENGINE_GEOMETRY_MODULE` to the pinned shared/world.mjs file URL. Core also uses the latter to resolve geometry. For this exact qualified fixture:

```powershell
$env:WORLD_TRANSPORT_ENGINE_MODULE=([uri](Join-Path (Get-Location) '_artifacts/world-core-pin-6f2068108f5145f7a7139d55825a48b9/core/server/engine/index.mjs')).AbsoluteUri
$env:WORLD_ENGINE_GEOMETRY_MODULE=([uri](Join-Path (Get-Location) '_artifacts/world-core-pin-6f2068108f5145f7a7139d55825a48b9/geometry/shared/world.mjs')).AbsoluteUri
node --test --test-concurrency=2 tests/world-transport-envelope.test.mjs tests/world-transport-core.test.mjs
```

Observed final world run:15 pass,16.860s. Focused existing transport+process-lock compatibility run:19 pass,9.356s. Syntax checks for all three owned service modules and both new test files, plus `git diff --check`, passed. Actual environment: Node24.20.0 on Windows. New fixtures live in ignored checkout-local `_artifacts/test-temp`; the pinned source archive is also ignored. Only the pinned production dependency was installed offline with the D: cache. No provider, Chrome, deployment, push, main change, manager root/config/shared edit or existing-data migration occurred.

These are owner implementation checks, not independent approval of this worker's transport. The manager must integrate its shared/config modules, Core and this task's focused commits and run combined world/AI/browser checks. This receipt does not qualify another owner's later Core changes, world-aware AI policy, frontend controls/minigames, browser stop handlers, broad load/performance, distributed storage or power-loss behavior.
