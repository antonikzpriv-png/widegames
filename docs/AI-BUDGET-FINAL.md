# Final independent budget audit - exact 4f9f22f

Reviewed 2026-10-29. Assigned changes are only this report and `tests/ai-budget-final.test.mjs`. No runtime, manager, historical review or historical test files were edited. No paid providers, browser, deployment, push or merge were used.

## Decision

The previous canonical-restoration defect is **fixed at the reviewed v2 pin**. The old c38 `KNOWN DEFECT` test remains unchanged as a historical control, and the new suite demonstrates successful v1 raw/canonical migration, v2 writes and repeated restart with the same 1,112-entry tiny-input case.

**One separate concrete availability finding remains in the tested scope:** valid reservations can write a ledger exceeding the module's own restore byte limit. This is fail-closed startup failure, not an overspend. A passing reproducer test is not an approval of that behavior.

## Exact committed sources

Source was loaded with read-only `git show <full-commit>:<path>` and imported as a data URL, never from a moving manager checkout. The actual Git diff inspected was `git diff c38d1f9 4f9f22f -- server/budget.mjs tests/budget.test.mjs`.

| Component | Commit | Blob |
| --- | --- | --- |
| Final budget | `4f9f22f424e6660cac58306817fcfd9c925ee44a` | `server/budget.mjs`: `80716736b8517abea6ab3a61a16f4ea4284504f3` |
| Historical c38 budget | `c38d1f96b596e1831b175ed1cc549c790347d57d` | `server/budget.mjs`: `2184c2b397f9a10753e33d37de2d9d122169112b` |
| Current transport at final pin | `4f9f22f424e6660cac58306817fcfd9c925ee44a` | `server/transport.mjs`: `506473809782165254c7c7d30c33d64f216c7811` |
| Current store at final pin | `4f9f22f424e6660cac58306817fcfd9c925ee44a` | `server/store.mjs`: `e5a846a72d550413bbaafa6067fd7ef37397bf40` |
| Current rooms at final pin | `4f9f22f424e6660cac58306817fcfd9c925ee44a` | `server/rooms.mjs`: `8bbc2122dfe9bee5f1f1595cd8f11b8cabe05cbb` |

Transport source is unchanged from `3ba5c8e`; the store has since gained ownership-checked recovery claims. The new startup control uses the final pin's actual updated store source. No later manager revisions are qualified here.

## Verified schema, migration and accounting

The new initial ledger and each new-day ledger use version 2. New writes include `totalNanos` and decimal `total`. On restore the module recomputes the sum of per-entry ceiling-rounded nanodollars. Version 2 requires a safe integer `totalNanos` equal to that recomputed sum and decimal `total` exactly equal to the canonical integer sum divided by 1e9. Invalid/negative amounts, negative totals, invalid IDs/dates and unsupported versions reject.

Version 1 accepts the compatible legacy raw total tolerance or canonical total tolerance, then normalizes in memory to version 2. Reading and same-ID idempotent acknowledgement leave original bytes untouched. A successful new reservation writes v2; write failure does not complete migration or change the prior acknowledged ledger.

Independent controls passed:

- Exact c38 source reproduces the historical 1,112-entry restore/write/restart failure. Exact 4f9 source migrates the same raw v1 input, writes v2 with 1,113 nanodollars, restores, writes again and restores at 1,114 nanodollars.
- Both legacy raw and already-canonical v1 totals migrate on a successful new write and restore consistently.
- Forged v2 integer/decimal totals, noninteger/missing/string nano fields, negative totals/amounts, unsupported schema, invalid date and materially mismatched v1 totals reject without changing rejected bytes.
- Explicit independent tiny values `1e-15`, `0.25e-9`, `0.999e-9`, `1e-9`, `1.0001e-9` and `9.5e-9` reserve expected ceilings of 1, 1, 1, 1, 2 and 10 nanodollars. The 16-nanodollar cap survives restart and rejects additional positive spend.
- Positive `Number.MIN_VALUE`, `1e-15`, `1e-10` and `1e-9` requests reject at zero cap before/after v2 restart. The floor of a 1.9-nanodollar cap allows one nanodollar and rejects requests above it. A zero-cost reservation remains zero and writes valid v2 metadata.
- UTC rollover writes fresh bounded v2 data, and a backwards clock cannot reopen a previous day's allowance.

## Remaining precise counterexample

**P2 availability: write/restore size limits disagree.** At `4f9f22f:server/budget.mjs:13` restore rejects files above 2,000,000 bytes. Reservation admission at lines 31-35 checks amount/cap and fewer than 10,000 existing entries, but does not enforce the serialized byte limit before acknowledging a write.

Reproduction uses the exact committed module, fixed clock `2026-10-29T12:00:00Z`, cap 0.01 USD, and:

```js
const count = 9708;
const amount = 1.2345678901234567e-10;
const id = i => 'r'.repeat(176) + String(i).padStart(4, '0');
const reservations = Object.fromEntries(
  Array.from({length: count}, (_, i) => [id(i), amount])
);
// Seed valid v2: totalNanos=count, total=count/1e9.
// Existing file is 1,999,935 bytes and restores successfully.
await budget.reserve({id: id(count), amount});
// Acknowledged file is now 2,000,141 bytes, with 9,709 entries.
// createDailyBudget(...) now rejects: cannot be restored safely.
```

All IDs are 180 permitted characters, all amounts are valid, all accounting is internally consistent, and entry count/cost remain below their caps. The normal adapter's shorter request IDs do not match this particular edge case. It affects the budget module's accepted input contract, not demonstrated everyday provider traffic. A manager fix should ensure acknowledged serialized files remain within the restore bound (or make read/write limits consistent) while preserving prior bytes/counters on denial. No runtime fix was made by the reviewer.

The final suite explicitly labels this test `KNOWN DEFECT` and emits an open-finding diagnostic. It is separate from the now-fixed c38 raw-versus-canonical discrepancy.

## Persistence, ownership and limits

The actual diff retains file-handle `writeFile`, `sync`, `close`, then atomic `rename` before publishing the new in-memory ledger and acknowledging a reservation. An import-only filesystem seam held sync unresolved and verified no rename/acknowledgement or counter update before release. Injected open/write/sync/close/rename failures preserved prior acknowledged bytes/counters, rejected the request and allowed subsequent recovery. A real-filesystem rename obstruction also rejected, then recovered and restored after removal. Only the named filesystem import was replaced for fault instrumentation; schema/accounting/acknowledgement control flow remained exact committed source.

The current transport still obtains its actual process-owned room store before constructing one daily budget instance. The final pin's updated store uses an exclusive recovery claim around acquisition/release, validates PID/token ownership, and preserves ambiguous claims. The runtime startup control used actual pinned transport/store/rooms/budget modules, an unstarted HTTP server, unused WebSocket/static stubs and empty-room engine/AI dependencies. A second server in the same directory failed before a second budget factory call; closing the first allowed reopening. Alternate callers and dependency-injected stores must preserve exclusive directory ownership and exactly one budget instance: the budget module alone does not coordinate multiple writers.

File-sync ordering and ordinary process/file failure behavior are tested. Parent-directory sync, OS crashes, power loss, storage-controller behavior and general filesystem durability are **not qualified**. Do not interpret these results as blanket OS/power-loss durability approval.

## Checks

```powershell
node --test tests/ai-budget-closure.test.mjs tests/ai-budget-final.test.mjs
node --check tests/ai-budget-final.test.mjs
```

Combined result: **32 passed, zero failures/skips** (16 historical closure checks plus 16 final checks), including explicitly labeled defect reproducers. Temporary directories were uniquely named beneath this AI worktree's tests directory and removed after verifying resolved containment. Historical closure report/test files remain unchanged; old findings apply only to their pinned sources. No further feature work was performed.
