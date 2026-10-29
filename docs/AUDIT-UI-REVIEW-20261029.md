# Independent UI closure - exact committed fix 0045f764

**Independent VM/HTTP closure:** exact Frontend commit `0045f764f4a7d42a55fb659c51549ffc6617b4fa` passes all **19 targeted checks, zero failures/skips**. This includes the originally prepared nine positive checks, five additional ownership/focus guards, three permanently historical negative reproductions, and two historical positive HTTP controls. The three reported UI findings are addressed within this tested scope. Coordinator integration/qualification remains separate; no production or broad browser approval is asserted.

This current closure supersedes the pending status in the preserved preparation receipt below. Only the assigned review tests/report changed. Runtime files, original privacy evidence, Frontend files and other worktrees were not edited. No account substitution, paid provider, Chrome, merge/main, push or deployment was used.

## Exact committed diff and pins

Read-only review compared Frontend audit base `7e060406d7caed91212763663e2b87fa8aa98f0f` to fix `0045f764f4a7d42a55fb659c51549ffc6617b4fa`. The actual production delta is only `public/app.mjs` and `public/panels.mjs`; report/owner-test/browser-driver changes were also inspected read-only. Backend, shared, package/lock, API helper, UI reconciliation and presentation source are unchanged from saved `0842a0090f1cfd1ec43b898f16e8191e5b9c2497`, established by the empty Git diff over those paths.

| Candidate source | Git blob at exact fix |
| --- | --- |
| `public/app.mjs` | `8d98c1ad5e05207aeb53245a28ceb58e974e9e45` |
| `public/panels.mjs` | `231ba3b53a0166d3ab354fdc62264f39e0041ac3` |
| `public/api.mjs` | `6fba198d5f92577a5afb3236332a204097bd7fc7` |
| `public/ui.mjs` | `8f7bf80b22d6551f56fd384cb74ea19899db69db` |

Pinned mode validates the full 40-character commit and loads actual committed app/API/UI/panel/presentation/shared objects with `git show`. Real HTTP controls use this audit checkout's saved 0842 backend, whose source equals the fix's backend. No moving uncommitted candidate was used to close a finding.

## Source reasoning and independent controls

- **Failed initial join recovery:** the attempt marker now records an acknowledged join, rather than being set before a possibly failed POST. The actual visible Retry handler performs GET first, then one join only if still unauthorized and permitted. The failed-first/retry scenario passes; background polling does not enter a repeated join loop, and a later unauthorized reopen after successful acknowledgement does not create another identity.
- **Uncertain success:** real local HTTP returns genuine Set-Cookie and room JSON; the adapter deliberately drops the app's join result after cookie receipt. GET-first recovery preserves the exact spectator cookie/identity or existing fixture human p1 cookie/seat, creates no extra identity and issues no second join. These are fixture cookies, not user accounts. Browser cookie storage and native loss timing are not claimed.
- **Obsolete work:** each open captures `opened`, and `ownsOpen` checks epoch, room ID, controller identity and abort state before fallback POST, after asynchronous join and before applying data. A deferred old-room 401 starts no join and does not consume a later legitimate join attempt. In-flight old joins retain their original aborted owner and late responses cannot replace the current room. Explicitly canceled opens also cannot start a fallback POST.
- **Cancel focus:** Cancel passes a return target to `setConfirmation`. The helper rejects a prior room epoch, rerenders current state, and focuses only a still-connected enabled trigger. The current key is preserved through real saved reconciliation. Tests verify normal return focus with zero action requests; deferred callbacks after room/phase change; queued old handlers after room/phase change; and a trigger that becomes disabled. An old Cancel cannot clear a newer room's confirmation or steal its focus.

The historical tests still load exact 0842 objects and reproduce all three original behaviors. The original privacy report/test and Frontend's real-browser negative evidence were not changed. The renderer fixture and queued unabortable completion are synthetic interfaces, clearly separated from real local HTTP. They do not establish native browser race frequency, keyboard-default Enter dispatch or screen-reader conformance. The Frontend browser report was read, not rerun or counted as independent browser evidence.

## Default mode, portability and negative receipts

Positive regressions now run **by default against actual current-checkout files**, with no skip flag or required environment override. Explicit `AUDIT_UI_REVIEW_PIN` mode remains available. Historical controls always read pinned old Git objects. Fixture data and logs are under this checkout's ignored `_artifacts`, paths are derived from `import.meta.url`, and cleanup checks resolved containment. No test hardcodes D: or a sibling worktree; full Git history is required for the historical controls.

This reviewer checkout intentionally retains the old runtime because runtime edits were forbidden. Its no-override run correctly reports **19 tests / 15 pass / four fail / zero skips**: initial retry, obsolete 401, normal Cancel focus and queued old-room Cancel. Those four desired-behavior failures prove default positives actually test local source; they are not failures against 0045f764. Integration must include the fix before expecting ordinary current-checkout positives to pass. The explicit fix run reports 19/19. No failed regression was converted to a skip.

Preserved local ignored receipts:

- `_artifacts/ui-review-20261029-default-before-fix.txt`: interrupted-turn command partially completed; the preserved run itself finished with **17 tests / 13 pass / four fail / zero skips**. This used an earlier test revision. It remains untouched.
- `_artifacts/ui-review-20261029-0045f764-independent.txt`: final exact-pin independent run, **19 pass**, zero failures/skips.
- `_artifacts/ui-review-20261029-current-checkout-negative.txt`: final no-override old-runtime control, **15 pass / four fail**, zero skips, exit 1.

The earlier native interruption was reported as an invalid transport response, not a product test result. Existing uncommitted tests/evidence were preserved; review resumed in the same assigned session/account. The earlier preparation receipt remains verbatim below, including its five passes/nine pending at that time. Fixture directories from final runs were cleaned; only logs remain.

## Exact commands and limitations

```powershell
# Worktree: D:/Widegames-work/audit-privacy-20261029
$env:TEMP=(Join-Path (Get-Location) '_artifacts')
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:AUDIT_UI_REVIEW_PIN='0045f764f4a7d42a55fb659c51549ffc6617b4fa'
node --test tests/audit-ui-review-20261029-lifecycle.test.mjs
# 19 pass, zero failures/skips.

Remove-Item Env:AUDIT_UI_REVIEW_PIN -ErrorAction SilentlyContinue
node --test tests/audit-ui-review-20261029-lifecycle.test.mjs
# Expected on this untouched old-runtime checkout: 15 pass, four fail, zero skips.

node --check tests/audit-ui-review-20261029-lifecycle.test.mjs
# Passed.
git diff --exit-code 0842a00 0045f76 -- server shared public/api.mjs public/ui.mjs public/presentation.mjs package.json package-lock.json
# Empty runtime dependency diff.
```

No concrete remaining defect was found in the requested lifecycle/focus scope at the fixed pin. Native Chrome keyboard behavior, full browser integration, production load and live providers remain outside this independent run. The manager retains its planned integrated two-match/browser qualification. AI is an inert fixture, not authored-AI self-approval. No worker deployment or merge approval is implied.

---

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
