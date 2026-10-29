# Budget size closure - exact c77f283

Reviewed 2026-10-29. Only this report and `tests/ai-budget-size-closure.test.mjs` are assigned changes. No runtime edits, paid providers, browser/Chrome, deployment, push or merge.

## Result

**The last reported size counterexample is fixed at the exact source below. No concrete remaining budget finding was identified in this bounded tested scope.** Earlier `KNOWN DEFECT` checks remain untouched and qualify their historical pinned sources only; they are not findings against c77.

| Source | Exact pin | Blob |
| --- | --- | --- |
| Budget | `c77f2836094049c4e0e9fccceb19ef91d4ce042f` | `a69eb7bd30d45c58701fe93885bf1291815011fb` |
| Transport at same pin | `c77f2836094049c4e0e9fccceb19ef91d4ce042f` | `506473809782165254c7c7d30c33d64f216c7811` |
| Store at same pin | `c77f2836094049c4e0e9fccceb19ef91d4ce042f` | `e5a846a72d550413bbaafa6067fd7ef37397bf40` |

Source was read with `git show <full-pin>:server/budget.mjs` and imported as a data URL, not from a moving manager checkout. The actual `git diff 4f9f22f c77f283 -- server/budget.mjs tests/budget.test.mjs` was reviewed. Transport/store blobs match the previously qualified one-factory/process-lock revision.

## Verified change and controls

The single `MAX_LEDGER_BYTES=2000000` bound applies both to restore and serialization before write. Reservation admission builds the proposed next ledger and serialized bytes, then rejects oversize data **before** temporary open, file write, sync, rename, counter publication or acknowledgement. The exact checked string is the one subsequently written.

- The original 9,708-entry fixture remains 1,999,935 bytes. Its next long-ID tiny reservation rejects with `storage limit`; persisted bytes and in-memory reserved amount remain unchanged, no temporary file remains, and a new factory restores it successfully.
- Filesystem-import instrumentation observes **no open/write/sync/close/rename** for that rejected proposal. It changes only the named import; actual admission/accounting/error code remains the exact committed implementation.
- A later short-ID reservation fits the same fixture, succeeds, retains the correct 9,709-nanodollar total, excludes the denied ID, and restores. Denial neither charges spend nor poisons the reservation queue.
- Both raw and already-canonical v1 1,112-entry fixtures migrate to v2, write 1,113 nanodollars and restore. Forged integer totals, decimal mismatches and negative saved totals reject.
- Independent tiny amounts retain expected ceilings of 1, 1, 1, 1, 2 and 10 nanodollars under a 16-nanodollar cap; restart preserves it and further positive spend rejects. Positive sub-nanodollar requests still reject at zero cap.
- Accepted writes remain ordered `open -> write -> sync -> close -> rename -> acknowledgement`. Holding sync unresolved prevents acknowledgement and counter publication.
- Injected open/write/sync/close/rename errors preserve prior acknowledged bytes/counters, reject, and permit later recovery. A separate real-filesystem rename obstruction rejects, recovers and then restores correctly.

## Checks and preserved limits

`node --test tests/ai-budget-size-closure.test.mjs`: **12 passed, zero failures/skips**. `node --check tests/ai-budget-size-closure.test.mjs` also passed. No check failed during this closure. Temporary artifacts were uniquely named beneath the AI tests directory and removed after verifying resolved containment. Historical reports/tests were not edited.

The budget module still requires exactly one instance under the transport's exclusive process-owned storage lock. Current unchanged transport/store source retains that prerequisite; this bounded pass does not extend qualification to independent writers or injected stores that bypass ownership.

File-sync ordering and ordinary persistence-failure behavior are qualified. Parent-directory sync, OS crashes, power loss, storage-controller behavior and general filesystem durability are **not qualified**. This is not blanket OS/power-loss durability approval. No further feature or refactoring work was performed.
