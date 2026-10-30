# Interactive tasks verification — 2026-10-29

## Final follow-up qualification

Runtime commit **788936c5692edc650d853b6af1c2e3fbfa91ff8d**, clean Cloud checkout on the preserved `codex/lantern-world-frontend-20261029` branch. Main fetched and rechecked after qualification: `90bb6e8`, already incorporated by ordinary merge. No reset, schema bump, paid provider call or deployment.

| Command | Actual result |
| --- | --- |
| `npm ci --cache /tmp/widegames-npm-cache` | Exit 0; 25 packages installed |
| `npm run check` | Exit 0; 94 modules syntax checked; not the test suite |
| `npm test` | Exit 0; 446 tests, 440 passed, 0 failed, 6 existing opt-in skips |
| `CHROME_PATH=/usr/bin/chromium npm run test:browser` | Exit 0; **42/42 checks**; both human-plus-AI and all-AI worlds reached crew/task victory |
| `LW_WORLD_BROWSER=1 CHROME_PATH=/usr/bin/chromium node --test tests/world-ui-browser.test.mjs` | Exit 0; 1 Node browser test containing **19 successful workflow scenarios**, 0 failures/skips |
| `git diff --check` | Exit 0 |

The standard suite's six opt-in skips are not counted as passes. The opt-in world UI test above ran separately and is counted once as a Node test, with 19 internal scenarios. The 42 standard browser checks and 19 optional scenarios overlap; they are not 61 independent matches.

Both browser runs use Chrome **154.0.8037.57**, Node **v24.19.0**, native HTTP/WS, actual cookies, persisted rooms and real server movement/validation. Standard-run receipt: `_artifacts/world-browser-0xGNzq/report.json`, committed as [task-browser-report.json](task-browser-report.json). Optional-run receipt: `_artifacts/world-ui-UgWa3E/report.json`, committed as [task-ui-browser-report.json](task-ui-browser-report.json). Both pin the clean runtime commit and verify unchanged source during the run. Updated screenshots, including touch pressure controls at mobile width, are in [task-screenshots](task-screenshots/).

## What the audit added

The deeper audit found and fixed three real gaps: loss of keyboard focus when a pending step disabled the active button, insufficient consistency checks on saved diagnostic metadata, and missing root-app taskStep stale-response guards. [WORLD-TASKS-AUDIT.md](WORLD-TASKS-AUDIT.md) records the failing checks, fixes and requirement trace. The actual pre-fix Chromium focus failure is retained as [task-audit-red-browser.json](task-audit-red-browser.json).

The new protocol suite derives inputs independently from the permitted challenge, rather than calling the engine's solver. It rejects wrong and future inputs at every stage and checks all other actors' views for assignment/progress leaks. Actual HTTP tests cover physical station arrival, spectator denial, forged actor/clock/progress/solved/counter fields, concurrent duplicate IDs, changed-content conflicts, close/reopen of the actual disk store mid-diagnostic, exact 1,499/1,500ms enforcement, persisted denial receipts after time advances, completion retry after restart, and unchanged task total. Existing tests cover movement/meeting interruption, death transfer, former-owner denial, final-task victory, cooldowns and legacy matches.

The standard native browser run solves all five types. It uses Tab/Enter for wiring, sequence and repair; Home/ArrowRight and keyboard activation for tuning; and native touchscreen taps for pressure balancing. It checks focus after all 14 semantic steps, the mobile pressure layout, and both plain direct-finish and forged solved:true requests for every type. Exactly ten deliberate HTTP 409 console messages are expected; any extra/different console error fails. It also verifies original seat reload, council drafts, redacted views, mobile layouts and chronological replay.

The optional UI suite preserves actual keyboard movement, joystick release, click routes, stale task closure, spectator HTTP fallback, chat node/focus/selection retention, literal text, vote privacy, role-revealed replay, elimination confirmation, body reports, nonterminal ejection, critical repair and the fixed critical deadline through council. Its old fixed-answer/local-solved task loop was updated to wait for server-confirmed progress; assertions were not removed to hide product regressions.

## Earlier attempts and limits

Original qualification at 74c09fb observed 26 browser checks; its successful receipt is preserved in Git at 5dbc543. That narrower qualification missed the three later audit findings. Earlier local receipts remain without being overwritten: WWT9En hit a network-idle reload timeout; CB01kt exposed a driver sequence-selector closure issue; NACVCA, ddI2Zj, m33r5T and hl5EOd had deliberate HTTP 409s incorrectly treated as failures by the console/cleanup gate. Those process failures are not counted as final passes. The gate now accounts for exactly the deliberate rejected requests and rejects unexpected errors.

The audit's VyWJZq focus failure reproduced the actual product bug. Two new root tests also failed before their fix: stale rejection exposed old feedback/retry, and stale success was not discarded. The initial protocol run additionally had an incorrect fixture expectation of HTTP 400 for an engine-level rejection; the existing route intentionally returns 409 and the corrected test verifies INVALID_ACTION. Native-touch attempt YxYQzn changed Puppeteer's mobile capability after opening a modal, which caused a page reload; enabling touch before the initial load and resizing only dimensions fixed that driver issue.

Initial plain npm ci failed because `/home/agent/.npm/_cacache` was unwritable. The authorized `/tmp` cache resolved it without dependency or lockfile changes. Chromium is available and all stated final commands exited 0. Fixtures use seeded/controlled or accelerated server time, and local demo/idle scheduling as described in each receipt. They do not establish hardware touch behavior, screen-reader behavior, Safari/Firefox, real-time network performance or paid-provider behavior.
