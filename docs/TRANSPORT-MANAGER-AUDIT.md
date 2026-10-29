# Independent manager boundary audit, 2026-10-29

This is separate from the process-lock implementation. The coordinator worktree was read only; engine, AI, frontend and manager runtime changes were not imported or edited. Inspection covered deployment-budget commits 163996de43afec4b4a01f43c788a8ec9869daf41 and 43f300c2f74c6902c10dbadc123173b27d724e60, denial-state integration 01c26bef48447c60bf1cfa7f145b75440afc5157, and their current integrated runtime. The coordinator advanced from 5913be8 through 7360171 during inspection.

## Budget checks

The deployment ledger serializes reservations within one instance, rejects over-cap amounts, retains idempotent IDs across restart and fails closed for malformed saved data. Commit 43f300c adds a backwards-clock rejection and defines own reservation properties so special names such as `__proto__` cannot bypass accounting. The production room service creates one ledger after acquiring the data-directory process lock and shares it across rooms. Therefore deployment isolation relies on a single service process and one persistent data directory; the stale primary-lock race being fixed would also undermine this budget boundary.

The audit test starts two independent spectator rooms against the real coordinator transport and budget modules, using a stub AI that calls the production reservation callback before a simulated send. With a $0.05 daily cap and two $0.04 reservations, exactly one simulated send succeeds. Both rooms' pending contexts are persisted before the callback completes. The surviving ledger contains exactly one $0.04 reservation, and restoring it still rejects another $0.04 reservation. No model/provider/browser calls occur.

Remaining durability finding: `server/budget.mjs` uses `writeFile` followed by `rename`, without syncing the temporary file or directory. Awaiting rename establishes an atomic successful filesystem operation but does not prove that the acknowledged deployment reservation survives sudden power loss. This is an inference from the source; power-loss recovery was not tested. The room context is fsynced before the callback reaches this ledger, but that does not itself restore deployment-wide totals across rooms. Manager follow-up: define the intended power-loss guarantee and consider syncing ledger contents and supported directory metadata. The budget module was left untouched.

## Denial-state checks

The integrated engine increments state version when it records a valid request's rule denial and when it advances a deadline. The manager HTTP change persists changed result state before returning the denial and broadcasting the updated view. The AI path assigns `result.state` on both accepted and denied proposals before committing context and state. This preserves remembered denied IDs and deadline transitions even when the proposed action is rejected.

Runtime controls confirm that an impossible HTTP move retains its denied ID on disk; an action crossing the roam deadline persists the discussion transition plus denial; restart retains the denial; and reusing that ID with a different action remains a conflict. A separate stub AI crosses the roam deadline before returning a move, and the production coordinator persists the resulting `WRONG_PHASE` request and discussion state through restart. No denial-state defect was found in these paths.

The first AI audit polled raw room files while the Windows service was replacing them. This reproduced transient `EPERM` rename failures, and the service correctly paused AI rather than acknowledging a failed commit. That observer contention is separate from the denial-state logic. The retained audit waits for committed in-memory state and closes the service before inspecting the disk checkpoint. External tools that hold room-file handles during writes can still cause storage errors; no rename/retry behavior was changed in this bounded lock task.

## Reproduction

From the transport worktree in PowerShell:

```powershell
$env:TRANSPORT_AUDIT_ROOT='file:///D:/Widegames-work/coordinator/'
node --test tests/transport-lock-process.test.mjs tests/transport-lock-manager-audit.test.mjs
```

The manager audit is explicitly opt-in and is skipped when `TRANSPORT_AUDIT_ROOT` is absent. It imports the manager modules read only and wraps engine/storage errors for diagnostics. Its temporary files are uniquely named under `TRANSPORT_TEST_TEMP` or the existing sibling `../temp` directory. The fixed process-lock tests always run against this task branch's store, independently of the audit root.
