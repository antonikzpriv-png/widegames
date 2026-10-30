# Ghost and ability qualification

Base: current `origin/main` at `90bb6e881f75f77e85b8b49729971a710b4c91b4`. The existing cloud checkout and its pre-existing ignored setup/data files were retained; no worktree, live provider or deployment was used. Remote branches, including unrelated strategic gameplay work, were preserved. Final integration fetch found no newer main commits.

Node 24.19.0, npm 11.9.0, Chromium 154.0.8037.57. Chromium is launched with the repository's normal container flags, through `/workspace/.local/bin/widegames-chromium` in this cloud machine.

| Command | Actual result |
| --- | --- |
| `npm ci --ignore-scripts --cache /workspace/.cache/widegames-npm --no-audit --no-fund` | Passed; frozen package-lock, 25 packages |
| `npm run check` | Passed; 97 JavaScript modules |
| `TRANSPORT_TEST_TEMP=/workspace/widegames/_artifacts/test-temp npm_config_cache=/workspace/.cache/widegames-npm npm test` | 455 tests, 449 passed, 0 failed, 6 opt-in checks skipped |
| `node --test --test-concurrency=2 tests/ghost-abilities-*.test.mjs` | 23 passed, 0 failed/skipped; includes metadata/privacy hardening verification |
| `CHROME_PATH=/workspace/.local/bin/widegames-chromium npm run test:features:browser` | All 19 checks passed; no browser page errors |
| `CHROME_PATH=/workspace/.local/bin/widegames-chromium npm run test:browser` | All 26 checks passed; human-plus-AI and all-AI wins; no page/console errors or unsafe returned views |
| `LW_WORLD_BROWSER=1 CHROME_PATH=/workspace/.local/bin/widegames-chromium node --test tests/world-ui-browser.test.mjs` | One browser test with 19 checks passed |
| `git diff --check` | Passed |

The feature suite covers default transfer and ghost retention; elimination/ejection; task IDs, progress, totals and final ghost task victory; valid and blocked movement, routes and leases; living-only parity, reports, repairs, councils and votes; fixed corpse position; dead-only private literal chat and bounded sends; wrong/duplicate/conflicting abilities; faction-independent ward targeting; one-hit counters, exact duration/cooldown boundaries, meeting/death/critical/terminal interaction; active effects/receipts and ghost navigation/chat after JSON and real server restart; old snapshots and corrupt optional metadata.

Twelve full seeded demo simulations use seeds 1, 7 and 19 across both death policies and both human/spectator modes, with optional abilities. These use the real engine, safe-view AI policy, physical navigation and actual rules-based task/ejection/parity victories. They restart the engine/AI context with an active effect, retain 15 task IDs, assert zero provider calls, and leave the human seat idle in human fixtures. The ghost simulations exercise fallen bot chat/task scheduling; they do not relabel a paused maximum-duration match as a win.

The new browser driver uses the actual app, HTTP/WS transport, cookies, geometry, engine and store. It selects presets in the lobby, activates a real ward with the target selector, expires it through server time, legally navigates/attacks with the fixture saboteur, walks the dead human through the actual input endpoint, sends a literal private message, reloads the ghost identity, checks public spectator filtering, solves the real Bridge wiring puzzle, validates unchanged corpse/task totals and mobile fit, then starts another real room with a saboteur and activates/expires a labeled echo. Its seeded role fixtures, idle demo scheduling and accelerated time are declared in the driver/report; it is not a claim of an unaccelerated autonomous browser match. Screenshots show the genuine returned fixture state.

The main browser runner reproduced its pre-existing Chromium reload/network-idle timeout during this task. Its reload now waits for DOM content and an actual connected app rather than unrelated network idleness. Council advances use the current server phase deadline rather than fixed +19/+11-second jumps that could skip voting. All original identity, vote, task, result, replay, privacy and source-integrity assertions remain and passed.

Retained local evidence:

- `_artifacts/ghost-abilities-browser-V5OD4X/report.json` and screenshots (new 19 checks).
- `_artifacts/world-browser-YhYECI/report.json` (26 checks, real human/all-AI rules wins).
- `_artifacts/world-ui-AQx6pH/report.json` (19 independent UI checks).
- Earlier pre-fix browser timeout: `_artifacts/world-browser-axbO7n/report.json`.

The source-controlled screenshots in this directory come from the successful feature fixture. Private fixture storage and browser profiles remain ignored. Browser execution and test reports establish local qualification only; no paid Anthropic calls, deployment, merge or environment publication was performed.

## Audit and current-main integration

The later [pre-merge audit](audit.md) fixed effect persistence/restore validation and incorporated `80dcc60`, the authoritative five-puzzle task implementation merged to main during validation. Ghosts now use its real task-step protocol in engine, bots, UI and browser checks; no direct-finish bypass was introduced. Current combined results supersede the initial counts above: 100 syntax-checked modules; 474 tests with 468 passed, 6 opt-in skips and 0 failures; 28 focused feature tests; all 42 main browser checks, 19 ghost/ability checks and 19 independent world-UI checks passed. New task-branch evidence/screenshots and original evidence were preserved. The feature browser is now also registered in CI.
