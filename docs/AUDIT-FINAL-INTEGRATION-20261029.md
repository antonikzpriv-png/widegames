# Final bounded integration review - 2026-10-29

## Decision and exact source

**Bounded source/tree acceptance:** integration commit `91d635f8f0343a66f0deddfeb0a688b9f298a290` contains the reviewed origin-validation and UI-recovery runtime bytes, with no unrelated runtime change detected in the inspected tree. No concrete integration defect was found by these exact object/diff/source checks. This is not a rerun or approval of the manager's combined suite/browser qualification.

The coordinator worktree `D:/Widegames-work/coordinator` was read-only. All qualified comparisons use committed Git objects at the exact integration pin, not its moving HEAD or untracked documentation. This reviewer changed only this report in `D:/Widegames-work/audit-privacy-20261029`; no runtime, test, other worker, main, push or deployment change was made.

Reference revisions:

- Saved base: `0842a0090f1cfd1ec43b898f16e8191e5b9c2497`.
- Reviewed origin runtime: `5c698b92c1c465830d5ad52f0383072536f12d14`.
- Independently reviewed UI fix: `0045f764f4a7d42a55fb659c51549ffc6617b4fa`.

## Per-file committed blob comparisons

| Integration file | Blob at 91d635f | Reviewed reference blob | Result |
| --- | --- | --- | --- |
| `server/config.mjs` | `74f58a263416dadf36772c8d031510833c6cae4d` | `5c698b92`: `74f58a263416dadf36772c8d031510833c6cae4d` | Identical |
| `server/origin.mjs` | `19ed10d65c7fe5bd421902e973ea1bb9b7903d62` | `5c698b92`: `19ed10d65c7fe5bd421902e973ea1bb9b7903d62` | Identical |
| `server/transport.mjs` | `c7452ef02280c10a0ed9fcfc5495b0600bc5ee73` | `5c698b92`: `c7452ef02280c10a0ed9fcfc5495b0600bc5ee73` | Identical |
| `public/app.mjs` | `8d98c1ad5e05207aeb53245a28ceb58e974e9e45` | `0045f764`: `8d98c1ad5e05207aeb53245a28ceb58e974e9e45` | Identical |
| `public/panels.mjs` | `231ba3b53a0166d3ab354fdc62264f39e0041ac3` | `0045f764`: `231ba3b53a0166d3ab354fdc62264f39e0041ac3` | Identical |

The runtime/launch scope contains 29 integrated files: `server/**`, `public/**`, `shared/**`, `scripts/**`, `package.json`, `package-lock.json`, `Dockerfile`, `.dockerignore`, `.github/**`, and `.gitignore`. Relative to saved 0842, only the five files in the table change: four modified and the origin helper added. The remaining 24 integrated files in that scope are unchanged; there are no other runtime deletions or additions. Engine, AI, rooms, store, budget, static service, public rendering helpers/styles, shared contracts, entry scripts, dependency lock and launch/CI configuration therefore retain saved-base blobs.

Outside runtime, `.env.example` adds one explanatory PUBLIC_ORIGIN comment without changing any value. Deployment docs add the origin-validation setup explanation. Other changed paths are audit tests/reports. No hidden spending/default/identity change was introduced by those documentation/template deltas.

## Integration test review

Source inspections and focused diffs establish:

1. **UI positive regressions are active on current checkout.** `tests/audit-ui-review-20261029-lifecycle.test.mjs` is byte-identical to independently reviewed receipt `4e7e626f3036ddead6902b2d9eaff195fc12fa79`. With no `AUDIT_UI_REVIEW_PIN`, its source loader reads actual checkout files. Exact full-commit override remains supported. There are no skip branches for the recovery, successful-join bound, uncertain-success cookies/seat, obsolete/canceled work or Cancel room/phase/disabled guards. Historical reproductions still explicitly load 0842 Git objects. No new execution result is claimed here; the earlier 19/19 exact-0045 receipt is separate evidence.
2. **Original privacy negative evidence remains historical rather than requiring broken current UI.** The integration changes its old source loader from current app plus old-hash assertion to `git show 0842...:public/app.mjs`, and labels that negative case historical. The actual obsolete POST assertions remain. Current positive behavior is covered separately above. HTTP privacy tests retain their real transport/engine/redaction assertions; their coordinator delta only derives temporary directories within checkout `_artifacts/test-temp`.
3. **Frontend owner regressions are preserved.** The integrated owner ownership test and its two browser drivers are identical to the reviewed 0045 commit. The ownership test defaults to current source, with explicitly historical negatives. The old browser audit driver remains an archived exact-base receipt, not evidence of current-browser success. No browser driver was launched by this reviewer.
4. **Terminal-AI tests retain their behavior checks.** The only base-to-integration delta makes the old source-equality precondition conditional on an explicit `TRANSPORT_TERMINAL_ROOT` and updates test titles. Ordinary mode imports current transport/store/engine and still tests real HTTP victory, pause, restart, cancellation and reservation retention. Explicit historical-root mode still checks the original pin before/after execution. No assertions about behavior were removed and no test became skipped.
5. **Origin positives remain current and active.** Boundary origin and independent origin-review tests import the current helper/config/transport. They retain malformed/userinfo/null-origin, pre-storage rejection, safe error/log and canonical HTTP/HTTPS/WS/cookie assertions. The B01/B02 desired assertions remain active: rejecting invalid startup is a valid passing outcome, not a skip. Independent origin review retains its explicit alternate-root option.
6. **Portability changes are bounded.** Boundary tests derive artifacts from the checkout, preserve platform environment requirements while removing inherited app credentials, quote fixture data paths, and locate npm portably. Provider test changes from the reviewed owner revision only move temporary paths and remove BOM; provider I/O remains mocked/denied by default. Those checks do not constitute this AI author's self-approval of AI behavior.
7. **No known-defect test was newly skipped.** A source scan of the integrated audit and modified terminal tests found one skip option: `AUDIT_PRODUCTION_ONLY=1` opts into the separate offline production-only npm-install fixture. Its ordinary CLI canonical-origin/secret-exclusion behavior remains an active check. This is an explicitly labeled cache/install prerequisite, not a bypass of a known defect. Existing baseline opt-in suites were not changed by this integration. No new `test.only`, `test.skip` or `test.todo` exclusion was detected in the inspected audit/terminal paths.

The ordinary test script is unchanged from 0842: `node --test --test-concurrency=2 tests/*.test.mjs`. Package/dependency/CI blobs are unchanged. Counts from different historical/source reviews must not be added into a new suite result.

## Read-only commands and check limits

Commands were run from the coordinator repository solely to resolve/read committed objects:

```powershell
git rev-parse 91d635f 5c698b92 0045f764 0842a00
git diff --name-status 0842a00 91d635f
git rev-parse 91d635f:<file>
git rev-parse <reviewed-commit>:<file>
git diff --name-status 0842a00 91d635f -- server public shared scripts package.json package-lock.json Dockerfile .dockerignore .github .gitignore
git diff 0842a00 91d635f -- .env.example tests/transport-terminal-ai.test.mjs
git diff --exit-code 4e7e626 91d635f -- tests/audit-ui-review-20261029-lifecycle.test.mjs
git diff 0342980 91d635f -- tests/audit-privacy-20261029-http.test.mjs tests/audit-privacy-20261029-ownership.test.mjs
git diff 5c698b92 91d635f -- tests/audit-boundaries-20261029-config-static.test.mjs tests/audit-boundaries-20261029-origin.test.mjs tests/audit-boundaries-20261029-provider.test.mjs
git grep -n -E 'skip:|\.skip\(|\.todo\(|\.only\(' 91d635f -- 'tests/audit-*.mjs' 'tests/transport-terminal-ai.test.mjs'
```

An initial PowerShell table-formatting helper hit the session's constrained-language restriction on PSCustomObject construction. Repeating the five comparisons with plain strings succeeded; all five exact blob comparisons were equal. This was a command-formatting limitation, not a product/test failure.

No tests, npm install, full suite, Chrome, live/paid provider, Docker build, hosted CI, deployment or load check was run in this bounded pass. The manager's concurrent combined-suite and integrated two-match/browser results remain its own evidence. This report makes no Docker/live-provider/full hosted-CI pass claim. Single-writer storage ownership and previously documented filesystem/power-loss limits are unchanged.
