# Final independent privacy and store-lock closure

Final receipt closes the repair-attribution finding in ENGINE-AI-CLOSURE.md. No additional concrete defect was found in the bounded lock review. No runtime source was edited.

## Exact pins

| Purpose | Commit |
| --- | --- |
| Repair privacy negative control | `6411e8d2f8fb1eb88194cc43cb75f902ed339db2` |
| Repair privacy correction | `c99e309daaeef08fd6dc8b05ab67191544677ae2` |
| Other owner's store-lock correction reviewed independently | `0908f2819d88acf727504450af7463e8931f0038` |

Source was read and tested from exact Git archives under D:/Widegames-work/temp. Existing dependencies were referenced through the already installed coordinator/node_modules. Source, temporary data, child helpers and logs remained under D:/Widegames-work. Coordinator, other worker sources, launch workspace, main and runtime code were not changed. No browser or paid/live provider call was made.

## Repair event privacy: closed and required by default

The c99e309 engine change removes only `playerId` from the public repair progress event. It retains the private validated action in the ended replay. The public repair count remains available for gameplay.

The owned `tests/engine-ai-review.test.mjs` now always runs the privacy check whenever ENGINE_AI_REVIEW_ROOT enables its current suite. ENGINE_AI_CHECK_REPAIR_PRIVACY is no longer read or required. The entire source-dependent suite may still skip when no review root is supplied, as before.

The strengthened check uses legal actions: p6 sabotages, p1 moves to Engine and repairs, while p2 remains on Bridge. It requires both p2's view and the spectator view to receive exactly `{at,id,repairsCompleted,type}` for repair progress, with no hidden repair actor/role field. p1's position remains null to the remote observer. Replay is null while active. After the actual critical deadline ends the game, replay must contain the fully attributed validated p1 repair action.

| Exact source | Independent result |
| --- | --- |
| 6411e8d, same strengthened privacy check | Expected red: 1 failure, public event includes playerId |
| c99e309, full current suite without opt-in flag | 9 pass, 0 fail |

The other eight current checks continue to cover firsthand witness priority, separated live evidence, distinct demo/live personas, private-role view equivalence, unseen eliminator redaction, rejection of model outcome fields, and 12 serial safe-view demo matches with provider fetch disabled. The optional historical 414e77f suite was not enabled in this final run; its historical expectations are preserved unchanged.

## Independent source review of 0908f28 lock recovery

Reviewed `server/store.mjs`, its process tests and documented protocol, and the startup ordering in `server/transport.mjs`. The implementation belongs to the transport owner; this review makes no lock implementation changes.

- Both normal startup and normal close acquire `service.lock.recovery` through exclusive creation before changing the primary service lock. A simultaneous cooperating process cannot race the primary pathname mutation while the claim is held.
- Primary records must be small regular files with a valid PID and ownership token. A valid live PID blocks acquisition. Only ESRCH establishes death; other probe failures propagate without unlinking the primary lock.
- Recovery reads under the claim, proves the observed PID dead, then rereads the primary ownership and probes again before removal. Changed PID/token ownership is rejected and preserved. This prevents the stale-observation deletion race between cooperating startup contenders.
- Normal close checks both the original PID and token. Claim release checks its own PID and token as well. A foreign primary or claim replacement is preserved. Concurrent closes share the same operation, and a close blocked by claim contention can retry after that contention is resolved.
- Any preexisting recovery claim blocks automatic startup, including malformed or dead-PID claims. Reclaiming that second lock automatically would reopen the recovery race. Failed initialization leaves evidence. This is deliberate fail-closed availability behavior, already documented by the owner.
- Transport awaits createRoomStore before constructing/reserving the daily budget. AI construction does not send provider calls. A startup that loses the store lock cannot reach the downstream budget initialization.

The committed `tests/transport-lock-process.test.mjs` at 0908f28 was run directly from its exact archive: **9 pass, 0 fail**. It includes the retained real-child negative control with two held writers under the old recovery protocol, one held writer under the corrected claim protocol, replacement live primary preservation, foreign close preservation, malformed/ambiguous claim preservation, retryable close contention, replacement under the held claim, and foreign claim preservation on release.

## Independent bounded child-process reproduction

A separately written D: temporary helper imports the actual 0908f28 createGameServer and default store; it does not reimplement the lock algorithm or monkeypatch filesystem I/O. Children synchronize startup through IPC and keep a successful service alive until explicitly released. A getter on the injected daily-budget dependency records whether startup reaches the budget boundary. Tests use no rooms/providers and do not listen on a network port.

Five bounded scenarios passed:

1. A parent-owned live-PID primary lock rejects the child. Exact primary bytes remain unchanged; no recovery claim remains; no budget access occurs.
2. A foreign live-PID recovery claim rejects the child. Exact claim bytes remain unchanged; no primary is created; no budget access occurs.
3. Three separate two-child races start from a primary lock whose PID was proved absent after a real child exited. Each race yields exactly one held writer and one rejected contender. The on-disk PID matches the still-live winner. Only that winner reaches the budget hook. Its normal close removes its primary and claim; the loser reaches neither budget nor ownership.

Result: **5/5 scenarios pass**; every rejected process has zero budget-hook observations. The helper has bounded waits, child lifetimes and cleanup restricted to its own newly created D: temporary directories. This independently supports the protocol and startup-order claims without treating the owner's own tests as the only evidence.

Locks protect cooperating processes on the configured local filesystem. This receipt does not claim distributed locking or protection against arbitrary external filesystem tampering. No additional defect was found under the documented local single-writer model.

## Commands and retained evidence

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:ENGINE_AI_REVIEW_ROOT='D:/Widegames-work/temp/engine-ai-closure-6411e8d'
node --test --test-name-pattern='unseen critical repair actor' tests/engine-ai-review.test.mjs # expected negative control
$env:ENGINE_AI_REVIEW_ROOT='D:/Widegames-work/temp/engine-final-c99e309'
node --test tests/engine-ai-review.test.mjs # 9/9, privacy enabled by default
$env:TRANSPORT_TEST_TEMP='D:/Widegames-work/temp'
node --test D:/Widegames-work/temp/engine-final-0908f28/tests/transport-lock-process.test.mjs # 9/9
node D:/Widegames-work/temp/engine-final-lock-independent.mjs # 5 bounded scenarios
node --check tests/engine-ai-review.test.mjs
```

Retained exact outputs under D:/Widegames-work/temp:

- `engine-final-6411-negative.txt`
- `engine-final-c99-positive.txt`
- `engine-final-lock-owner-controls.txt`
- `engine-final-lock-independent-results.txt`

The independent startup helper and child source are `engine-final-lock-independent.mjs` and `engine-final-lock-worker.mjs` in that same D: directory. No unexpected test failure occurred; the pre-fix privacy failure is the intentional negative control. Review is complete for these exact pins; no further work is proposed absent a concrete defect.
