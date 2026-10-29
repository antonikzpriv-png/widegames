# Independent release-readiness packaging audit — 2026-10-29

Read-only review of manager-owned packaging in `D:/Widegames-work/coordinator`, observed at **`b5bfe5d1209f4d446a4365909e8e53e1041c5daa`**, including configuration documentation change **`ce75f104a98af24329e27cac631eb7ebc76c427b`** and comparison with original saved packaging **`0842a0090f1cfd1ec43b898f16e8191e5b9c2497`**. The coordinator had an untracked `docs/AUDIT-CLOSURE-20261029.md`; it was left untouched. This worker writes only this report in its assigned audit worktree.

**Scope result:** no missing runtime asset group, new-helper shipping omission, production dependency mismatch or root-command mismatch found. One concrete browser qualification gate gap and several bounded packaging/CI assumptions are recorded below. This is source/metadata review, not a new image/browser/combined-test pass or release approval.

## Findings and limits

### R1 — browser console errors are collected but do not fail the command

In `scripts/browser-check.mjs`, the page console listener appends console errors to `report.consoleErrors`. The success check is `check(!report.errors.length, 'No browser runtime or payload privacy failures')`; the final late-error check also inspects only `report.errors`. Neither checks `report.consoleErrors`. Therefore a synthetic report with `errors:[]` and `consoleErrors:['synthetic console error']` satisfies the existing runtime-error gates. That is a source-level counterexample; no Chrome session or real game console failure was generated in this audit.

A CI `npm run test:browser` exit 0 does not by itself certify zero console errors. The report preserves those messages, so previous evidence that explicitly inspected an empty console-error list is not invalidated. Coordinator follow-up: gate console errors as well, or explicitly distinguish report inspection from the command's enforced assertions before presenting an exit code as console-error-free. No browser driver changes were made here.

### R2 — documented root secrets/state are excluded; build-context protection is narrower than a secret scanner

`.dockerignore` excludes `.git`, `node_modules`, root `.env`, default `data`, `_artifacts` and `tests`. The Dockerfile additionally copies only package metadata and the `shared`, `server` and `public` groups. Thus the documented root `.env`, default persistent state, private audit/browser fixtures and browser profiles are not image inputs. The example API key is empty; no key is passed as a build argument or baked into image ENV.

The ignore list does not cover all alternate secret names such as root `.env.local`, nor arbitrary custom state directories. Such files can enter the Docker build context even when the explicit COPY groups keep them out of the final image. Files deliberately placed under runtime asset folders need their own protection; the deployment docs correctly forbid placing/mounting secrets under public/static folders. This is a conditional context-hardening limitation, not an observed actual secret leak. No image/context was built or uploaded here.

### R3 — CI browser and container health checks have explicit environment assumptions

CI selects `ubuntu-latest`, Node24 and `CHROME_PATH=/usr/bin/google-chrome`, but has no Chrome installation step. It relies on the runner supplying that executable; `puppeteer-core` does not supply a bundled browser in the production graph. README correctly requires an installed Chrome/Chromium and documents the override. Browser availability on a future hosted image, a hosted Actions pass and any Chrome startup were not verified in this audit.

The Docker health command fetches port3000, matching image `ENV PORT=3000` and the documented run command. Overriding container PORT without also adapting health/proxy/port mapping can produce a misleading health failure. The defaults are consistent; alternate-port container operation is not qualified.

## Runtime assets and production dependency boundary

- The Dockerfile recursively copies `shared`, **the entire `server` folder**, and `public`; the newly tracked `server/origin.mjs` is therefore included automatically. No extra COPY line is needed. `server/main.mjs`, `shared/contracts.mjs` and `public/index.html` are tracked at the reviewed pin.
- A read-only scan of 13 server/shared modules found no missing relative import targets. The only non-builtin runtime package import is `ws`.
- Package and lock metadata agree: production graph is only **`ws@8.22.0`**, with no installed transitive runtime dependencies in the lock. Its native acceleration peer declarations are optional, not additional locked production packages.
- **`puppeteer-core@25.16.0`** and its browser/test tooling graph are marked dev. `npm ci --omit=dev --ignore-scripts --no-audit --no-fund` in the image excludes that installed graph. `scripts`, tests, development browser fixtures and Chrome profiles are not copied into the image. Package/lock files still contain development metadata; that is not installed browser code.
- The image is based on Node24, creates/chowns `/app/data`, switches to `USER node`, defaults to demo AI, exposes3000 and mounts `/app/data`. Documentation requires one process/private persistent local volume and does not claim distributed or power-loss guarantees. Linux volume/user semantics and the image build remain unexecuted here.

The origin validator and transport behavior were authored by this worker. Their functional acceptance/approval belongs to Core's separate independent controls. This report independently checks manager packaging/documentation **shipping** that helper; it does not present another independent approval of my own runtime changes.

## Commands, configuration documentation and CI

| Documented command / requirement | Actual source correspondence |
| --- | --- |
| `npm ci` | Lockfile v3 agrees with root dependencies and Node>=22.13 engine declaration |
| `npm start` | `node server/main.mjs`; entry exists |
| `npm run dev` | `node --watch server/main.mjs`; entry exists |
| `node --env-file=.env server/main.mjs` | README/deployment explicit env-file invocation targets the same main module |
| `npm test` | `node --test --test-concurrency=2 tests/*.test.mjs`; no Chrome command in this script |
| `npm run check` | `node scripts/check.mjs`; scanner includes server/shared/public/tests/scripts, including the helper |
| `npm run test:browser` | `node scripts/browser-check.mjs`; separate dev-tooling/browser entry exists |
| Docker build/run examples | Dockerfile CMD uses the same main module; named volume and exact localhost origin match image defaults |
| Historical source audits | Actions checkout uses **`fetch-depth:0`**, supplying full history rather than a shallow checkout |
| Browser artifacts | Always-upload allowlist is report JSON plus PNGs under `_artifacts/browser-*`; private state and `chrome-profile` are outside that allowlist |

The browser driver uses fresh UUID/time-named ignored output, private fixture state/profile, explicit demo configuration and seeded/accelerated engine rules. It records source commit/modified tracked paths, privacy checks and cleanup errors. Its report is qualification evidence, not production game state. The source records modified tracked files but does not itself enforce a clean-tree precondition; a caller must inspect provenance when making an exact-source qualification claim. The console-error gate limitation is R1.

Within the requested file set, comparison from `0842a00` to the reviewed head changes only the `.env.example` origin comment and the two-line deployment origin paragraph introduced at `ce75f10`. README, Dockerfile, ignore list, workflow, scripts and package/lock are otherwise identical to original saved packaging. The new docs accurately describe the intended/Core-reviewed origin setup: absolute HTTP(S), optional trailing slash, no credentials/path/query/fragment, canonical values, safe errors before storage and same browser origin for writes/sockets. No independent functional runtime claim is added here.

README/deployment text separates demo/offline qualification from live provider billing/setup, documents proxy/WebSocket/HTTPS and persistent local storage, labels Docker commands as instructions until executed and disclaims live provider/power-loss qualification. Its repository-default-branch/history statements were not reverified against GitHub in this local file review. No hosted CI, image, deployment, minimum-Node22, live billing or browser availability result is newly claimed. The previous local Docker probe was ENOENT; Docker was not launched/rechecked here.

## Reviewed source fingerprints and method

SHA-256 of the actual reviewed Windows-checkout file bytes (Git pin above provides repository provenance):

| File | SHA-256 |
| --- | --- |
| README.md | `2054cb3075c793fc68ab059d98555998ec3b78369ac33169f7dbcb005f7cc4ef` |
| docs/DEPLOYMENT.md | `feef3c75bb862ea994d7493f645c04e7682a5cd6d8b4f7d48bb65dbfa020296a` |
| .env.example | `7de4df7474a9b923746c620745db5bed2decc18960cb3e3484248bd2b046110b` |
| Dockerfile | `1e82b00c097509c19831c1c7421e7eeb09e6aee10862ddd1cefcf522f2f99a5a` |
| .dockerignore | `225b8916d025f6482639532c2580efa3f1889accd5559add4f3b8beeee072b4c` |
| .github/workflows/check.yml | `f7f26c80492cd32d6938034c6fc22c39d6f7ec5ffed6e5edd9ff83e5b6c80d97` |
| package.json | `e220b7f479c1114f5b12cfdc427fe3ccf8e555996ac70af9571ffeb016905627` |
| package-lock.json | `69d8d16c85c641063313fb66033ecab494e56c6f3463d1319a725560b1d35162` |
| scripts/browser-check.mjs | `53d668fc6ea79587a730d16019a38666b5fbc13f87664380b868d13c614988f1` |

Checks were read-only Git diff/show/status/ls-files and filesystem/JSON/source inspection, plus a bounded dependency/import/command-target metadata scan. All command targets and scanned relative runtime imports existed. A first metadata helper attempted to spawn Git inside Node and received host `EPERM`; it was rerun successfully with Git invoked separately by PowerShell and Node limited to read-only filesystem analysis. That host restriction was not a product/test failure.

No new install, full test suite, Chrome, paid/live provider request, coordinator write, deployment, push or main change was performed. The manager owns combined execution/integration checks. The only committed deliverable for this task is `docs/AUDIT-RELEASE-READINESS-20261029.md`; all earlier negative evidence and other workers' files remain untouched.

## Exact-pin R1 harness closure — 2026-10-29

Independently reviewed manager fix **`698336ffb01773d40d5b00383fbe4f106aa63a0b`** against its parent **`6aeaeffe0577f132d102e29fa36c9bd3dc90bfda`** in the coordinator worktree, read only. The diff changes only `scripts/browser-check.mjs`: a normal-completion primary-page console assertion is added, and the final post-cleanup gate includes collected console errors. Reviewed Git blob: **`0de52fc19614ca4e0889896b132fed61c7578cf6`**. The coordinator's working copy of that script matched the exact commit. Original R1 evidence, source pin and fingerprints above are preserved unchanged as the historical failing-source record.

The normal completion now runs the original runtime/privacy check followed by `check(!report.consoleErrors.length,'No primary-page browser console errors')`. After browser/server close and final drain, the gate is `if((report.errors.length||report.consoleErrors.length)&&!report.failure)`, throwing a combined runtime/privacy/console error. The existing prior-failure guard remains so an error already being rethrown is not replaced with a second audit error.

Validation used **actual statements extracted from both committed versions**, including their original `check` function, evaluated with synthetic report objects in bounded Node VM contexts. The browser module was never imported or launched. Ten controls passed:

| Source/control | Observed result |
| --- | --- |
| Parent, `errors:[]`, `consoleErrors:['synthetic']`, normal gate | Counterexample passes, reproducing original R1 |
| Parent, same report, final cleanup gate | Counterexample passes, reproducing original R1 |
| Exact fix, same report, normal gate | Rejected with the primary-page console assertion |
| Exact fix, same report, final cleanup gate | Rejected with the late runtime/privacy/console error containing the synthetic message |
| Exact fix, clean report, normal gate | Passes and records successful checks |
| Exact fix, clean report, cleanup gate | Passes |
| Exact fix, clean normal completion followed by a new synthetic console error before final gate | Final gate rejects the late error |
| Exact fix, runtime-only error, normal gate | Existing runtime/privacy rejection retained |
| Exact fix, runtime-only error, cleanup gate | Existing late-runtime rejection retained |
| Exact fix, console error plus an existing `report.failure` | No replacement audit exception; the existing failure remains the failure path |

**R1 is closed for collected primary-page console errors in this exact source-level scope.** This is not a new real-browser qualification pass: no Chrome, game/server execution, installs or full suites were run. The manager owns the real qualification run. An initial Windows `node -e` driver invocation failed with argument-quoting SyntaxError before evaluating any control; piping the driver source directly to Node corrected that invocation, and the ten controls above then completed with exit0. No failed product assertion was skipped or relabelled.

Coverage remains deliberately specific. The primary page still has the console-error collector; the observer page has its existing `pageerror` listener but **no newly added console listener**. Its join/forbidden-action flow intentionally exercises expected HTTP401/403 responses. This review does not claim those observer console messages, all pages, all HTTP errors, or every browser log are collected/clean. The manager's new assertion explicitly says primary-page console errors, which matches the implemented collection scope.

R2 and R3 remain the same conditional packaging/context/browser-availability/health-port limitations described above; they were not fixed or promoted to demonstrated deployment failures by this harness change. My own origin/transport implementation remains outside this independent harness approval and is reviewed separately by Core. Only this appended receipt is changed/committed in the audit worktree; coordinator files, tests, runtime/root sources, previous evidence and other workers' files are untouched. No paid/live provider requests, main changes, push or deployment occurred.
