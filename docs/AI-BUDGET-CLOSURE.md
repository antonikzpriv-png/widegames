# Independent budget closure and imported frontend review

Review date: 2026-10-29. Scope: read-only review of manager/frontend implementation; only this report and `tests/ai-budget-closure.test.mjs` are assigned changes. No paid provider calls, browser sessions, source checkout/reset, manager edits, push or merge.

## Decision

Historical receipt for its pinned revisions. Later fixes and the final positive qualification are in [budget size closure](AI-BUDGET-SIZE-CLOSURE.md); its old open finding is not current.

The original negative-total bypass is fixed. Canonical integer accounting and file-sync-before-rename controls pass the exercised checks. **Closure remains qualified by one reproduced availability defect below.** The budget module still requires a single instance under the transport storage lock. File/directory durability under OS, power or storage failure is not approved by this audit.

## Exact qualified source pins

All executable source was read with `git show <full-commit>:<path>` from committed Git objects, then imported from a data URL. No moving manager worktree source was imported.

| Component | Commit | File/blob or equivalence |
| --- | --- | --- |
| Fixed budget | `c38d1f96b596e1831b175ed1cc549c790347d57d` | `server/budget.mjs`, blob `2184c2b397f9a10753e33d37de2d9d122169112b` |
| Previous budget control | `43f300c2f74c6902c10dbadc123173b27d724e60` | `server/budget.mjs`, blob `2671f0b5999b2ce59ab5e1521d84dac6c67ad5f1` |
| Integrated transport/hybrid metadata | `3ba5c8efd97e368e0d69a3a9aea9f5a8edbdb8cb` | transport `506473809782165254c7c7d30c33d64f216c7811`; store `6901eb1cfd7ad509aa05acd1bec0a5d1a716f173`; rooms `8bbc2122dfe9bee5f1f1595cd8f11b8cabe05cbb` |
| Frontend author revision | `0d93c1b1e707187fb1b632040d42a68ad8db1618` | `public/app.mjs`, `api.mjs`, `ui.mjs`, `panels.mjs`, `presentation.mjs`, `index.html`; public-tree equivalence below also includes styles |
| Imported frontend/integration revision | `6411e8d2f8fb1eb88194cc43cb75f902ed339db2` | Complete `public/**` diff against `0d93c1b` is empty; app blob `88e6260ea3bfaa4e42c51ab09c2c49aa530bd1e3` |

The closure test verifies that `6411e8d` contains exactly the fixed budget blob and the reviewed transport/store/rooms source, as well as the identical frontend public tree. These findings qualify those pins, not later commits.

## Remaining concrete defect

**P2 availability: the fixed module can reject its own successfully written canonical ledger after restart.** In `c38d1f9:server/budget.mjs`, restore validation at line 16 compares the raw decimal reservation sum against saved total with tolerance `1e-6`; persistence at lines 29-32 writes the sum of individually ceiling-rounded nanodollars. Those are different sums.

Reproduced with 1,112 distinct entries of `1e-10` USD, a valid legacy ledger whose saved total equals the raw sum, clock fixed to 2026-10-29 noon UTC, and cap 0.01 USD. Restore succeeds and reports canonical total `0.000001112`. Reserving one more `1e-10` succeeds and persists `0.000001113`. A subsequent `createDailyBudget` rejects with `Daily AI budget cannot be restored safely`. The raw sum is about `0.0000001113`; its difference from the persisted canonical total exceeds the old tolerance. All amounts/IDs/counts are within the module's accepted ranges.

This is fail-closed startup failure, not an overspend. It is an edge case involving accepted sub-nanodollar amounts; the current AI adapter's ordinary reservations are much larger. Validation should distinguish compatible legacy raw totals from canonical per-entry ceiling totals, or use an explicit canonical integer schema, so self-written files remain restorable. Manager owns the fix. The closure suite's explicitly named `KNOWN DEFECT` test asserts this reproducer and emits an open-finding diagnostic; a green test count does not mean the defect is fixed.

## Budget checks and controls

`node --test tests/ai-budget-closure.test.mjs` passed **16 tests, zero failures/skips**, including the open-defect reproducer.

- The exact `43f300c` negative-total ledger reproduces the positive-spend/zero-cap bypass. The same ledger rejects at startup under `c38d1f9`.
- Positive amounts `Number.MIN_VALUE`, `1e-15`, `1e-10`, and `1e-9` all reject against a zero cap. A 1.9-nanodollar cap floors to one nanodollar; a request above that floor rejects.
- A compatible saved ledger with reservations 0.1 + 0.2 and understated saved total 0.2999995 restores to canonical 0.3, not the understated value. It cannot reserve additional positive spend at a 0.3 cap. A later valid write at a higher explicitly supplied cap persists canonical 0.4 and restores correctly.
- Eight same-instance concurrent 0.25 requests against a 1.00 cap accept exactly four. Same-ID/same-amount is idempotent, changed amount rejects, denied calls preserve persisted bytes, and restart preserves the full cap.
- An instrumented filesystem import holds `sync()` unresolved: the promise remains unacknowledged, status remains unchanged, and rename has not happened. After release, observed order is **open → write → sync → close → rename → acknowledgement**.
- Injected open, write, sync, close and rename errors each reject the reservation, preserve prior acknowledged in-memory and persisted ledger, attempt temporary-file cleanup, and allow a later valid reservation. The instrumentation replaces only the module's named filesystem import; accounting, control flow and exception handling remain the exact committed code.
- A separate real-filesystem control obstructs the destination with an empty directory. Rename rejects, status remains zero, and removing the obstruction permits a reservation that survives restore.

All test artifacts use uniquely named `tests/ai-budget-closure-*` directories under the assigned AI worktree. Cleanup verifies resolved containment before recursive removal. The tests use Git's read-only object access and do not alter reviewed sources.

## Single-factory/lock prerequisite

The actual committed transport at `3ba5c8e` obtains `createRoomStore(config.dataDir)` before its sole `createDailyBudget(...)` factory invocation. The store creates `service.lock` with exclusive `open(...,'wx')`, writes/syncs the ownership record, and checks the owning PID before allowing stale-lock recovery. A failed budget initialization closes the store. The server close path finishes tracked work before releasing it.

The closure test executes this exact transport startup/close body with actual pinned store, budget and room modules. It does not listen on a network port. Unused static serving/WebSocket endpoints are stubbed, and empty-room engine/AI dependencies are injected; no provider or browser is involved. A first server constructs exactly one budget instance. A second server sharing its data directory rejects as already in use **before another budget factory call**. After the first closes, reopening succeeds.

This closes the current default transport-path prerequisite, not arbitrary use of `createDailyBudget` by multiple instances/processes. Dependency-injected stores can bypass the default lock; alternate deployments must preserve exclusive ownership and one budget instance. The module itself still does not coordinate independent writers.

## Imported frontend role, dialogue and secret review

No new concrete role-disclosure, dialogue-injection or credential-handling bug was found in the reviewed source.

- `public/ui.mjs:element` appends dynamic strings through `document.createTextNode`; `syncChildren` updates text-node values. Council speech, speaker names, timeline/replay text, notices and error messages use this path. A minimal DOM control executes the pinned council renderer with hostile `<img onerror>` and `<script>` dialogue: the literal string remains present and no IMG/SCRIPT elements are created. This is a renderer check, not browser/XSS qualification.
- `watchPanel` reads assignment from `game.self`, and renders a spectator label when self is null. The same control verifies spectator versus own-saboteur assignment. Role-revealed results return null before `phase==='ended'`.
- The crew list displays `player.role` only when the backend supplies it; frontend privacy therefore depends on the engine/transport safe-view contract. Frontend does not derive roles from character IDs or request hidden engine state. This audit does not re-certify engine redaction.
- `app.mjs` retains only `lantern-room` ID in sessionStorage; roles, dialogue, context and replay stay in memory. Role/private payloads are not written to localStorage. `api.mjs` uses same-origin credentials and no token query parameters. Room cookies are issued HttpOnly/SameSite=Strict by pinned rooms code. Replay fetch is exposed through ended results and is also guarded by transport's ended check.
- The executed room-summary control confirms the safe AI allowlist drops injected key/memory/reasoning fields and private context, while preserving `strategy:'hybrid'`, local navigation and model council fields. Rooms emit the explicit hybrid notice. The frontend mode badge itself still says Live, but renders that backend notice; it does not claim local navigation was model-generated.

## Limits

File sync before rename is established by source/control-flow tests. No OS crash, power cut, filesystem fault campaign, directory metadata sync, storage-controller durability, real provider or browser behavior is qualified. Parent-directory sync remains absent. Atomic replacement and successful ordinary restart controls must not be described as a blanket OS/power-loss durability guarantee.
