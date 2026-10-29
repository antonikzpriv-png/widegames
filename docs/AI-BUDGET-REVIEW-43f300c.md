# Independent AI reviewer audit: manager budget 43f300c

Reviewed exact `server/budget.mjs` from commit `43f300c2f74c6902c10dbadc123173b27d724e60`, not the moving coordinator working copy. Source was obtained with `git -C D:/Widegames-work/coordinator show 43f300c:server/budget.mjs`, UTF-8/base64 encoded and imported through a Node data URL. No manager files were modified. No provider calls occurred.

## Findings

1. **P2 durability risk: acknowledgement precedes a durable file sync** (`server/budget.mjs:27-29`). `writeFile` followed by `rename` provides atomic replacement for ordinary process/file errors, but neither explicitly syncs the temporary file before rename. An acknowledged reservation can therefore be lost during OS/power/storage failure, reopening daily allowance after restart. This is a storage-durability limitation established by source inspection; no power-failure simulation was performed. Manager should use a file handle with `sync()` before rename, consistent with the room store, and document filesystem/directory-sync guarantees. This does not imply that ordinary process restarts failed the tests.

2. **P3 reproduced math/validation defect: restore accepts negative totals inside its tolerance** (`server/budget.mjs:14`). Write `{version:1,day:'2026-10-29',reservations:{},total:-0.0000005}`. Restore with `maxCostUsd:0`, fixed clock at noon that day, then reserve `{id:'over-zero',amount:0.0000005}`. Restore and reservation both succeed; a zero cap has acknowledged positive spend. The magnitude is tiny, but it violates strict fail-closed restoration and is distinct from unavoidable floating-point roundoff. Reject negative saved totals and derive canonical totals from validated entries; fixed integer accounting can make comparisons explicit. The larger tested mismatch (`reservations:{x:0.25},total:0`) correctly rejects.

3. **Single-writer prerequisite, reproduced and externally mitigated** (`server/budget.mjs:9,19-30`). Create two instances for the same initially empty directory with cap 1.00 before either reserves. `a.reserve({id:'a',amount:0.75})` and then `b.reserve({id:'b',amount:0.75})` both acknowledge, while disk retains only the second 0.75 entry. The in-memory promise queue serializes one instance, not all writers. The integrated room store obtains `service.lock` before budget creation, so this is not a demonstrated bypass in the current single-server startup path. Keep exactly one budget instance per locked directory; alternate callers or multiple instances need an enforced shared lock/transaction. Do not claim this module alone is safe for multiple processes or multiple factory instances.

## Reproduced checks

An offline Node assertion harness imported the exact committed source as described above. All temporary data lived under a unique `D:/Widegames-work/ai/tests/ai-budget-audit-*` directory and was removed after verifying its resolved path remained beneath the AI tests directory.

- Eight simultaneous 0.25 reservations with a 1.00 cap on one instance: exactly four fulfilled; persisted/status total exactly 1.00.
- Same ID/same amount: idempotent; changed amount: conflict rejection.
- New instance restoring the committed 1.00 ledger: retained total; additional 0.001 rejected.
- Materially corrupt saved total: startup rejected without resetting allowance.
- Forced rename failure by placing an empty directory at `ai-daily-budget.json`: reservation rejected, in-memory total remained zero. Removing the obstruction allowed a later 0.25 reservation and correct persisted total. Failed writes did not acknowledge spend.
- Two stale instances: reproduced 1.50 acknowledged against 1.00 cap with only 0.75 persisted.
- Negative saved total within tolerance: reproduced positive reservation against zero cap.

The normal singleton cap and ordinary persistence-failure behavior passed. OS-level durability remains unqualified. The active room-store lock is relevant mitigation for the multi-instance case and must be preserved during integration. Root manager implementation changes belong to the manager.
