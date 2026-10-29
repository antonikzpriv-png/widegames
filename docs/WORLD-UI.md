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


## Deferred task rejection correction

Starting from clean worker `dd707716df5a47aa134ebb8a5455576e285ec8e8`, the unchanged independent Reviewer driver reproduced the exact stale task failure: 12 passed / 1 failed, with OLD TASK FAILURE replacing the new council feedback. The final candidate passes that same driver **13/13**, including its still-current rejection control and historical 9e571c7 known-defect control. Reviewer source SHA256 is `3556e2d7a1933af2b3d8adfaee7c80696b664a501407d3c86ec3e5837622f189`; its bytes remain unchanged.

Submission completion now captures the original puzzle and session identity and requires both identities plus current room/match/phase/task/proximity validity before changing feedback or equipment. A still-current rejection keeps the solved equipment, exact nodes, useful error and enabled retry. Owned regressions pass **23/23** (11 new retained-callback counterexamples plus 12 existing model/input checks). Cases cover council, room, match, position, disabled action, death, task completion, manual close, phase returning to roam, disposal and successful retry. These are minimal-DOM/VM callback fixtures, not native browser or backend workflow claims; counts overlap Reviewer coverage.

Raw red, intermediate and final green logs, unchanged Reviewer harness copy, candidate source copies and SHA256 receipt are preserved at `D:/Widegames-work/world-frontend-20261029/_artifacts/world-ui-task-feedback-e1YQkB`. Final source SHA256: `2db939074f1deecd0d7668044b172effc060f6f300ec0d8093f19867738e614b`; owned regression SHA256: `cfd458c8f997d7627b0aa06a9c8a63ddce750ac31475b3e439c381acac7b6ddf`. Syntax and ownership/diff checks also pass. USE now explicitly renders a text-style gear (U+2699 + VS15), SABOTAGE a text-style lightning bolt (U+26A1 + VS15), encoded with JavaScript escapes; evaluated codepoints were checked. Console question marks were an encoding display artifact, so actual source codepoints were inspected before replacement. No external assets.

Commands (from this worker root):

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:WORLD_AI_SOURCE_ROOT='D:/Widegames-work/world-coordinator-20261029'
$env:WORLD_AI_REVIEW_UI_ROOT='D:/Widegames-work/world-frontend-20261029'
Remove-Item Env:WORLD_AI_REVIEW_UI_PIN -ErrorAction SilentlyContinue
node --test D:/Widegames-work/world-reviewer-20261029/tests/world-ai-ui-review.test.mjs
$env:WORLD_UI_TEST_SOURCE_ROOT=$env:WORLD_AI_SOURCE_ROOT
$env:WORLD_UI_TEST_UI_ROOT=$env:WORLD_AI_REVIEW_UI_ROOT
node --test tests/world-ui-task-feedback.test.mjs tests/world-ui-model.test.mjs
```

The earlier root hidden-stop concern is superseded by manager `b8cdb4a96e7e28cf1a22f5ddde24e7ac348a80eb`: source now sends a scoped same-origin keepalive zero with a 1500 ms bound before aborting controllers, allocates wire sequences around lifecycle stops and discards the final response. The manager reports an actual hidden-navigation stopping pass; this worker has not independently rerun Chrome. Stopping is best effort: manual movement still has the authority's 600 ms lease; delivery of a zero to cancel an authoritative route cannot be guaranteed during network/process termination. No root edits were made here. The old 19 observed browser cases remain preserved with their **failed source-stability gate**, not relabeled as qualification. Manager retains the exclusive Chrome lease; this correction started no browser or server.

## Independent root/harbor audit after the task fix (read-only)

Fix commit: `889a50d135f4e3e1d9acdbda3a22e8c95604eb0a`. The manager's six inspected public files were copied read-only from clean **`3c250bcd21bfb760916b9e7512f37b7f89e0f9a5`** and remained byte-identical at the end of this audit. Evidence: `D:/Widegames-work/world-frontend-20261029/_artifacts/world-ui-shell-audit-dyfXRe/`. It includes all six source snapshots, individual SHA256s, `audit.mjs`, `audit-report.json` and a final source comparison. Reviewer files, root files, other worktrees and the manager's Chrome were not modified.

The browser-free harness executes the actual root render and deferred action handlers with a minimal DOM, injected scene drawing and controlled request completions. It also evaluates the pinned CSS cascade and sRGB contrast. Two checks passed: root mounts the safe room into world-mode; the full-stage `100dvh`/zero-padding and short-screen min-height overrides are present. The audit **exits 1 for three reproducible counterexamples**, not a product qualification failure hidden as a pass:

| Finding | Reproduction and observed result | Owner / limits |
| --- | --- | --- |
| **P2 ROOT-STALE-TASK-FEEDBACK** | Start a task request in roam; accept discussion in the same room/epoch; set CURRENT COUNCIL NOTICE; reject the original request with a 409. At `public/app.mjs:216`, root `mutation()` calls `tell()` without phase/session ownership. Its finally render forwards **OLD ROOT TASK FAILURE** to the current scene as `options.feedback`. This is a second path, separate from the corrected visual-module catch, and can bypass that correction through a fresh feedback option. | Manager root. Actual handlers, synthetic retained request; no claim about native race frequency. Preserve current-phase feedback when an obsolete task settles, while keeping useful still-current errors/retry ownership. |
| **P2 ROOT-RULES-FLOW** | Open How to play in the harbor, then activate PLAY/WATCH with keyboard focus without closing rules. Actual `render()` enters world-mode but leaves `#rules.hidden === false`. The normal-flow rules aside precedes `#main` (`index.html:16`, `styles.css:355`); world-mode hides masthead/footer/feedback but not rules. The main remains `100dvh`, and body hides overflow, so the still-open aside displaces/clips the full-stage world. | Manager root/layout. DOM state reproduced; displacement follows the pinned flow rules. No browser pixel/scroll measurement. Close/hide the rules on world entry or remove it from normal flow appropriately. |
| **P2 ROOT-GLOBAL-HOVER** | Hover an enabled harbor PLAY/WATCH, Begin watch, or a minigame primary submit. Global `button:hover:not(:disabled)` (`styles.css:39`, specificity 0,2,1) wins background `#304b56` over lower-specificity harbor/primary rules. Dark harbor text `#163448` survives: **1.400:1** contrast. World primary text `#17384a !important` survives: **1.332:1**. No world hover override exists in the pinned `game.css`. | Manager base-style integration. Static selector/cascade/contrast counterexample; manager's sole Chrome lease is needed for native hover verification. Scope the generic hover or provide appropriately specific foreground/background pairs. |

Raw source pins most relevant to those findings:

- `public/app.mjs`: `51c2e356a8a77cb8989e1212ea50abc6448ce4f6ba663a1cfb89b5cbe957c80b`.
- `public/styles.css`: `e6b81d24d4785d2493ddaaaff14cf4b3ff968b15864f45a924937bce1c59a8a7`.
- `public/game.css`: `34af8ed107f82eb1379f28b41ea16c897d9b8a58a687c2fd0d4b5f550c51968c`.

Reproduce the saved counterexamples without Chrome: `node _artifacts/world-ui-shell-audit-dyfXRe/audit.mjs` (expected exit 1 with the three finding records). This runs against archived source snapshots, so subsequent manager fixes must be independently tested rather than judged from this historical receipt. No question-mark defect was filed for the root beacon/title: byte inspection confirmed the original U+25C8 diamond and U+00B7 separators; console encoding alone was not treated as product evidence.

The root keepalive stop fix remains acknowledged and was not reopened. Keepalive cancellation is best effort; manual input's 600 ms lease remains the server fallback. This worker started no browser/server for this correction or audit. **Manager retains the exclusive Chrome lease.** The prior source-drifted 19 observed browser cases retain their original failure classification.

## Closure of the three root counterexamples

All three findings from the read-only audit at `3c250bcd21bfb760916b9e7512f37b7f89e0f9a5` are **closed for the retained source/VM/CSS checks** at exact manager fix **`44ef7bdfcaf719a8e1d341d59ba9a243fcf4b8b7`** and current source **`b919d0071498c6ce5eea05d73ab55a3f392524f7`**. This closure adds only `tests/world-ui-root-closure.test.mjs` and this report; no runtime/root edits or Chrome/server/provider calls.

The new driver retains the original minimal root-handler fixture and the original stimuli, with positive expectations after the correction. It adds current-context controls so suppressing all task errors cannot pass:

| Check | Exact 44ef7bd / current source |
| --- | --- |
| ROOT-RULES-FLOW | Open rules, enter lobby/roam/discussion: rules become hidden, `aria-expanded` resets false, the safe room mounts in world-mode, and the `100dvh`/zero-padding/short-screen min-height overrides remain present. |
| ROOT-STALE-TASK-FEEDBACK | A late task rejection after discussion returns `AbortError`; neither a 409 nor an uncertain failure changes CURRENT COUNCIL NOTICE or creates a retry. Current scene options retain the current notice. |
| ROOT-GLOBAL-HOVER | PLAY/WATCH and world primary/secondary controls resolve to the scoped pale hover backgrounds with dark text, overcoming the old global hover selector. |
| Current rule error | A still-current 409 preserves its useful error and releases pending state; it is not incorrectly marked stale. |
| Current uncertain task | The same-ID retry remains visible and resends the identical URL, request ID, type and task ID. Acknowledgement clears the retry. |
| Completed task | A newer completion snapshot removes an obsolete uncertain retry; its retained click handler cannot dispatch another request. |

Results: **6/6 passed, exit 0 at exact 44ef7bd** (386.512 ms), then **6/6 passed, exit 0 against current source** (229.7296 ms). These are the same six checks across revisions, not twelve independent workflows. The historical negative control at `3c250bcd21bfb760916b9e7512f37b7f89e0f9a5` exits 1 as expected: 2 passed / 4 failed (the original three categories plus the completed-task retry assertion). This preserves proof that the closure assertions detect the old defects. All original red audit artifacts remain untouched.

The hover cascade fixture processes the unconditional desktop declarations and the selectors relevant to these four controls, including specificity, stylesheet order and `!important`. It is not a full CSS/browser engine or a pixel measurement. Resolved colors/contrast:

- Primary / PLAY: background `#ffdda0`, foreground `#17384a`, **9.4664:1**.
- Secondary / WATCH: background `#b9dfd4`, foreground `#17384a`, **8.5648:1**.

The manager still owns actual hover/rules measurements under the frozen browser lease. This worker used synthetic DOM/scene/request completions for actual root-handler code, not mocked responses claimed as real game workflows. No unrelated audits were added. No remaining failure was reproduced among these six requested checks.

Evidence: `D:/Widegames-work/world-frontend-20261029/_artifacts/world-ui-root-closure-I0rTTo/` contains the exact driver, `historical-negative.log`, `exact-44ef7bd.log`, `current-source.log`, `report.json`, raw source snapshots and SHA256 manifests. Driver SHA256: `3158d87a6195185f3cb204c3229447aca6581a08d608bb83c65a2c5af2affa31`.

The current files stayed byte-identical throughout their run. Compared with exact 44ef7bd, current `app.mjs` adds the owner's action-generation guard; the other five inspected files match after LF/CRLF normalization. Raw working-tree versus Git-blob hashes therefore differ even for unchanged normalized text; both sets are recorded, with `composition.diff` and `normalized-comparison.json`. Important exact pins:

- Exact `public/app.mjs`: `2043da512ced6d60382fc2183edbd274fb46b48ff71c4f39ca39ba3696d33cf1`; current working bytes: `3979277d0a9a8624cf1355f94396b0c0aec671de554f83760116bcf791a7e528`.
- Exact `public/styles.css`: `335d5670e89500451202f07d60812638a49358ed0dc852af271e3272b8c5ee02`; current working bytes: `c300ec919813a9937c9adcf0eacf772bc18b20c3c685ce16b7425e1fa23257d2`.

Reproduce from this worker (defaults use the current integrated checkout when the root override is omitted):

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:WORLD_UI_ROOT_REVIEW_ROOT='D:/Widegames-work/world-coordinator-20261029'
$env:WORLD_UI_ROOT_REVIEW_PIN='44ef7bdfcaf719a8e1d341d59ba9a243fcf4b8b7'
node --test tests/world-ui-root-closure.test.mjs
Remove-Item Env:WORLD_UI_ROOT_REVIEW_PIN -ErrorAction SilentlyContinue
node --test tests/world-ui-root-closure.test.mjs
```

Syntax and `git diff --check` passed; ownership is limited to this uniquely named world-ui test and `docs/WORLD-UI.md`. Manager retains the exclusive Chrome lease. Earlier native transport interruptions and the source-drifted 19 observed browser cases remain historical and are not qualification passes.
