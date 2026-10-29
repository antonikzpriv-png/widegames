# Independent UI fix review - preparation receipt 2026-10-29

Assigned worktree: `D:/Widegames-work/audit-privacy-20261029`, branch `codex/lantern-audit-privacy-20261029`. Own only this report and `tests/audit-ui-review-20261029*.test.mjs`. No runtime, prior audit evidence or other worktree files were edited. No Chrome was started: Frontend retains the exclusive lease. No paid providers, merge/main, deployment or user account substitution.

## Status

**Preparation complete; actual fix verification is pending an explicit committed Frontend SHA. No finding is closed or approved by this receipt.** At preparation time Frontend had committed its initial audit and was editing its fix; uncommitted runtime is not a qualified source pin.

Read-only evidence inspected: Frontend commit `7e06040`, `docs/AUDIT-UI-20261029.md` and its actual `tests/audit-ui-20261029.mjs` driver. The report's final real-browser run records five passes and two failing desired-behavior assertions at exact source `0842a0090f1cfd1ec43b898f16e8191e5b9c2497`. The independent privacy audit's stale-401 evidence is preserved in `034298090b0dc9e3798ec194e6556dec2c5b32ee` and its uniquely owned report/tests. Those original negative receipts remain unchanged.

## Independent historical controls

The new test loads source through `git show <full-commit>:<path>`, not a moving Frontend worktree. Its historical controls remain permanently pinned to `0842a0090f1cfd1ec43b898f16e8191e5b9c2497` and independently reproduce:

1. Initial spectator GET returns 401; its join fails before delivery; visible Retry issues another GET but does not rejoin and remains at the loading/retry interface.
2. Elimination Cancel removes its focused control and leaves focus at BODY rather than the available elimination trigger.
3. A deferred old-room GET401, delivered after navigation to another room, starts an obsolete join using the newer navigation controller.

These controls deliberately assert the historical behavior; green results establish reproduction, not desired-behavior success or closure. Frontend's original red browser assertions were inspected and not rewritten or rerun.

## Real HTTP uncertainty controls

The new harness uses the actual local transport, persistent store and engine from this audit worktree, whose runtime remains the saved 0842 source. Only an inert explicitly labeled fixture controller replaces AI; no authored AI behavior is exercised/approved and no model calls occur. All identities are fresh isolated fixture credentials.

The application's actual saved functions run in a VM with real saved UI/panel/presentation reconciliation and a small DOM interface. Its request adapter sends real loopback HTTP. A join's real Set-Cookie header and JSON are received, then the adapter deliberately drops the result to create an uncertain-success application boundary. This models loss after cookie receipt; it is not a claim about native browser cookie storage or actual network loss frequency.

Two current positive controls pass:

- A newly issued spectator cookie survives the lost join result. Visible retry GETs the room, reuses that cookie, obtains a null spectator seat, issues no additional join, and adds no identity.
- An existing fixture host cookie becomes available while an earlier unauthorized GET result is queued. The actual backend join preserves that human p1 identity. After its result is dropped, retry GET preserves the exact cookie and human seat, issues no new join, and keeps the room at one identity.

These already-safe paths must remain safe after a recovery fix; permitting another explicit attempt must not unconditionally rejoin or replace a human cookie.

## Prepared adversarial checks for the actual fix

Set `AUDIT_UI_REVIEW_PIN` to the exact full 40-character committed fix SHA. The harness validates that Git commit and loads its actual app/API/UI/panel/presentation/shared sources. It does not cherry-pick or edit runtime in either worktree. Nine desired-behavior checks are prepared:

- After a pre-delivery initial join failure, the visible Retry performs GET first, then at most one new join when still unauthorized, and recovers the spectator view.
- A stale old-room GET401 starts no join, does not use the new controller, and does not poison a later legitimate attempt to join that room.
- A join that was already in flight when navigation changes retains its original aborted signal and cannot overwrite the new room with a late success.
- Cancel restores the still-available elimination trigger and sends no action request.
- Deferred Cancel focus callbacks cannot steal focus in a new room, even if that room reuses the same target ID/key.
- Deferred Cancel focus callbacks cannot restore an obsolete action after a change to discussion.
- The two real-HTTP uncertain-success cookie/seat controls above also pass using the actual candidate app.
- Background polling does not repeatedly auto-join after a failed initial attempt; explicit user recovery is distinguished from unbounded automatic attempts.

The DOM fixture runs the saved renderer, reconciliation and action handlers. Focused-node removal resets focus to BODY, matching Frontend's original browser observation. Callback control covers animation frames, queued microtasks and zero-delay timers. It does not synthesize browser-default Enter activation or certify accessibility behavior in Chrome; the real browser lease remains with Frontend. Candidate fixture compatibility and actual results must be checked when the SHA arrives; these are prepared assertions, not pre-approval of an unknown implementation.

## Commands and actual result

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:npm_config_cache='D:/Widegames-work/npm-cache'
node --test tests/audit-ui-review-20261029-lifecycle.test.mjs
node --check tests/audit-ui-review-20261029-lifecycle.test.mjs
```

Preparation result: **14 registered checks: five passed, zero failed, nine explicitly pending/skipped because no committed fix SHA was supplied.** The five passes are three historical negative reproductions and two positive uncertainty controls. No failed check was converted into a skip. Syntax check passed. The old full application suites and Chrome were not run.

For the forthcoming independent receipt:

```powershell
$env:AUDIT_UI_REVIEW_PIN='<exact full committed frontend SHA>'
node --test tests/audit-ui-review-20261029-lifecycle.test.mjs
```

Inspect the actual committed diff before treating a candidate run as qualified. HTTP server runtime pin must be stated separately if the frontend commit changes backend files; current HTTP controls use saved 0842 backend. Record actual failures, any fixture correction and all source blobs in the follow-up receipt. Parent-directory/power-loss durability, native browser race frequency, real screen-reader/keyboard behavior and provider behavior remain unqualified. Data/cache/temp paths remain on D:, and each real HTTP fixture cleans only its uniquely named `D:/Widegames-work/temp/audit-ui-review-20261029-*` directory after containment verification.
