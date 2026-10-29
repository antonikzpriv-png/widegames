# World UI

World-first visual slice based on `d5eed65eb4737ceccab594c6dad911ff9033d2ba`. Original canvas raincoat keepers, illustrated storm-beacon floors and rooms, follow camera, safe-position-only actor interpolation, HUD, lobby host Start, role reveal, contextual controls and movement input are in `public/world/`. No assets, packages, HTTP, credentials, engine internals or runtime mutations are owned here.

Integration: link `/game.css`, import `createWorldExperience` from `/world/experience.mjs`, create once for the current room, and call `update(room,{now,connected,pending,feedback})` on safe snapshots/timer updates. Supply callbacks `{action(type,fields),input({seq,dx,dy}),start(),leave(),loadReplay()}`. Dispose before changing network ownership/rooms. The coordinator's `/shared/world.mjs` is required and imported directly; no duplicate world geometry is invented. Renderer static decorations are illustrative; server/shared geometry controls collisions.

This first commit is the requested early visible slice. Task puzzles, council, results/replay and qualification follow in the same assigned scope. No integrated backend/browser pass is claimed in this slice.

## Complete visual implementation

The scene surface now includes all three numbered/symbol-labeled puzzles (wires, tuning and sequence), actual task submission gating, keyboard elimination confirmation, emergency/report council transition, stable avatar roster and chat, cast-only voting state, skip, nonterminal ejection, role-revealed results and readable attributed world-motion replay. The canvas and interactive/chat nodes remain mounted across snapshots. Static equipment and keeper art is drawn locally; there are no copied assets, external fonts or dependencies.

Keyboard/touch axes are integer -1/0/1, refreshed about every 200 ms while moving, with safe inputSeq resumption. Click-to-walk uses callback action `navigate` with **only `{x,y}`**, after an acknowledged zero input; the engine computes the route and remains authoritative. Keyboard input cancels deferred click intent. Blur/hidden/dispose cancel controls and emit a zero when the actor can still input; hidden RAF/lease timers stop. Root ownership must allow its captured room's final zero to reach the backend before aborting that room. The coordinator's root currently rejects callbacks once hidden; the manual-input lease still expires server-side, but it must cancel authoritative navigation too. This is a root integration responsibility, not permission for this worker to edit app/network files.

Context USE chooses an available nearby station/repair/bell. In particular an unfinished but distant Bridge task cannot hide the nearby bell. Task submission checks room ID, match ID, phase, alive state, current task, station room and exact shared proximity again; state changes close stale equipment. Cancel restores focus only to a connected, available trigger. Controls expose unavailable-action reasons instead of silently ignoring activation. Critical timers stay visible through council, and AI mode/notices/status/Exit remain explicit.

At this source commit the first 12-scenario real-backend run passed at `_artifacts/world-ui-szkeUg/` against coordinator `cb37c6df899005b86b115ab0629399cb05d891f4`; it covers the pre-refinement bytes archived there, not a qualification claim for later edits. Its exact driver, before/after source fingerprints and 20 screenshots remain. Extended current-source qualification follows below. Pure boundary tests currently pass 12/12. No main changes, provider calls, deployment or worker approval.

## Final worker receipt · 2026-10-29

Visual source: **`9e571c7dae0d8153935c7c3d932402357191b8b3`** (early slice `b2cc6c33be4fcd240254c1758a0877351593fa9f`), all changes confined to this worker's assigned 12 files. The final driver-only correction scopes acknowledged input sequence waits to the current room; it is included in this receipt commit. Runtime source did not change after `9e571c7` in this worktree.

Final commands: `node --check` for every `public/world/*.mjs` and the browser driver; `node --test tests/world-ui-model.test.mjs` **12 passed, 0 failed/skipped**, 142.3602 ms; `git diff --check` passed. The 12 units are synthetic safe-view/input fixtures, not 12 independent backend matches. They test absent/NaN actor positions, immediate hidden-actor removal, no extrapolation, exact radii, bell/task priority, task session invalidation, integer lease refresh/stop, safe sequence resumption, typing/IME/native Space isolation, cleanup and attributed replay.

The last real Chromium invocation observed **19/19 workflow checks passing**, zero page errors, but the **process exited 1** because its source-stability gate detected coordinator edits during the run. This is **not a successful frozen integrated qualification**. Receipt: `D:/Widegames-work/world-frontend-20261029/_artifacts/world-ui-j41YdP/report.json`; archived exact driver, source-before/after SHA256 manifests and 25 PNGs are alongside it. Started against clean coordinator `d2e47351a5a5780b356ff0da2a3f686dceb5dfa8`. This worker's frontend fingerprints stayed identical; coordinator `server/store.mjs` and `public/app.mjs` changed. Their before→after SHA256 values:

- `server/store.mjs`: `442194c7c63ffea6ddb3ba08247b6906b11f8dbc7b08601ef608d98dd1ba58b4` → `e2720bc529d3e3d88fdcc0f8b4d897a3563edc2c4d2a56315dae9192caa3a920`.
- `public/app.mjs`: `ac20b299b39921cb7044f8f30e92eb965ed3ce270e7355d9e85f82b40a5ce444` → `2530e68debcb7e2f58e7b36003440e40ffe80f4a88c396498f35b560d80a57af`.

The 19 observed checks cover actual lobby/start; own crew reveal; movement/stop acknowledgements; 1440×1000, 320×740, 390×844, 768×1024 and 844×390 layouts with no document overflow; native Puppeteer touch and actual callback navigation; synthetic window-blur event with real movement requests; stale task closure without a task POST; real spectator join/cookie plus socket-unavailable HTTP fallback; all three puzzles gating one actual task each; emergency/report council transitions; live draft/node/selection identity; plain-text markup-like messages; cast-only vote privacy; engine ejection victory; readable role-revealed replay and keyboard End; saboteur Q/Cancel focus/confirmation/elimination; nonterminal ejection without invented role; actual critical repair; and a fixed critical deadline through reported-body council while a draft survives updates.

These are seeded real engine preconditions with idle AI scheduling, real native HTTP/WS/cookies/storage and a controlled clock. Long transit uses actual `navigate` actions. Critical-council setup uses legal real-engine actions by fixture AI seats. No API responses, client roles or model outputs are mocked. This is not an autonomous demo-match, real-time latency or physical mobile hardware qualification. Chrome `156.0.8078.73`, Puppeteer `25.16.0`, Node `24.20.0`; no live/paid provider requests. Canvas semantics, native screen readers, Safari/Firefox and hardware IME were not qualified.

Representative screenshots under that last receipt directory: `world-1440x1000.png`, `world-320x740.png`, `world-390x844.png`, `world-768x1024.png`, `world-844x390.png`, `task-wires.png`, `task-tuning.png`, `task-sequence.png`, `desktop-discussion.png`, `mobile-discussion.png`, `desktop-vote.png`, `ejection-scene.png`, `desktop-results.png`, `desktop-replay.png`, `mobile-replay.png`, `saboteur-role.png`, `report-council.png`, `mobile-critical-repair.png`, `critical-council.png`. `source-before.json` pins every source file, not just Git HEAD. A machine-readable run inventory and all final local SHA256s are in `_artifacts/world-ui-final-summary.json`.

Preserved failures (each existing receipt and archived driver remains unchanged):

| Receipt suffix | Actual outcome / correction |
| --- | --- |
| initial-harness-failure.txt | ENOENT before launching Chrome/server: artifact parent missing; create parent first |
| pI66QA | 2 passed, fixed-delay movement-distance assertion failed |
| szkeUg | Earlier 12-scenario process passed, frozen source; screenshots found secondary button contrast and misleading completion feedback, subsequently corrected |
| AEy5fU | 4 passed, fixed-delay touch-distance assertion failed |
| MHiHmG | 2 passed, movement assertion read inputSeq 1 while later writes were queued; changed checks to bounded real progress + stop acknowledgement |
| IFTJRu | 8 passed, repeated navigation was inert; source also drifted (engine). Harness spread station `id` into action ID, triggering correct idempotency; now send only x/y with a fresh request ID |
| z5iSho | 4 passed, click's fixed-delay progress assertion failed; use acknowledged authoritative navigation and wait for actual arrival |
| 9q0SJJ | 4 passed, repeated station navigation timed out; same request-ID fixture defect, now corrected |
| T07RLh | 17 passed, critical setup waited for previous room's inputSeq; final driver filters exactly the current room path |
| j41YdP | 19 passed, zero workflow/page errors; exit 1 due app/store source drift, correctly preserved |

One intermediate unit assertion also failed after the desired bell-priority fix because it expected USE to become unavailable just beyond task range even though the bell was in range. The radius counterexample now isolates task hints; an additional test positively requires the reachable bell. No product success was asserted from that failed unit invocation.

Important driver details: do not spread station metadata into an action envelope (station `id` is not a request ID). Wait for actual input acknowledgement/arrival, not a fixed host sleep. The source gate compares before/after runtime **bytes**, accepts the intentional frontend baseline, and rejects a changed runtime. New source commits are recorded, not pinned to historical 0842. The recorded 19 observations overlap the earlier 12/17 observations; counts must not be added as independent scenarios.

Reproduce from this worktree (or an integrated checkout, where LW_WORLD_RUNTIME and the Puppeteer override can be omitted):

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:LW_WORLD_BROWSER='1'
$env:LW_WORLD_RUNTIME='D:/Widegames-work/world-coordinator-20261029'
$env:LW_WORLD_PUPPETEER='D:/Widegames-work/coordinator/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
$env:CHROME_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
node --test tests/world-ui-browser.test.mjs
```

All owned browser/server instances were closed in each receipt's finally block and all fresh profile/data directories removed. Final native process inspection found no Chrome with this worker's artifact profile and no Node world-ui-browser process. **Chrome lease released to the manager.** The coordinator still owns final root hidden-stop cancellation and independent frozen integrated verification.

Final local working-byte SHA256 pins:

- `public/world/experience.mjs`: `b953a0591ae92179a893907e7eaad716b4cff48ce92f084f40cfbe7827d23c96`.
- `public/world/input.mjs`: `7c83cf9e9066c2783db769b3ebf2f586aac2923d3261cb7f82ca694276d29ed3`.
- `public/game.css`: `17dd6b464aecce52f7d23f8208ee9c924acb26e77a11782fac78beaebefc7c0c`.
- Final browser driver: `09a40e439f2c0acdbc861559bd2d158092bc14811cb8d656ce239d5bee5b0086`.
