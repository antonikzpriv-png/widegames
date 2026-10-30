# Gameplay quality independent audit

Assigned branch codex/ship-quality-audit-20261030, foundation **941e857f046ef7cc9bae25f0fcad27cf6ab7578a**. Historical product source **d55144dd3c71f5ad965814aee92f4612bc4084ba**. Independent reviewer: no runtime/art/map/task implementation edits, no Chrome lease, no paid providers, no main/push/deployment. Only tests/quality-review*.test.mjs, scripts/quality-browser-check.mjs and this report are owned.

## Immediate concrete walking-presentation findings

**Q-A1: renderer interpolates through a solid collider.** On exact Beacon1, real engine accepts navigation first to(700,200), then to(900,200), legally detouring around the chart table. Feed the two actual owner safe views to public ActorSamples at0 and1000. at(p1,1070) returns(800,200), inside the actual solid chart-table rectangle. Neither authoritative endpoint is invalid and no state position is injected. Existing renderer draws the returned actor point without collision validation. This is a presentation/collision defect under sparse updates, not a server teleport or hidden-state exploit. Positive requirement is that displayed positions from these legal observations remain statically walkable. It fails on both source pins.

**Q-A2: camera response depends on draw cadence rather than elapsed time.** Feed actual legal observations at(700,300) then(900,300) to createWorldScene. Run actual draw logic for the same200ms using6 calls at30/s versus24 calls at120/s. toWorld at the canvas center reports camera x819.0865529728 versus894.6421219370716, a75.55556896427163 world-unit difference. Test accepts at most1 world unit difference as an explicit equal-elapsed integration tolerance; it is not a proprietary pixel claim. Source eases14percent per draw, so this is a deterministic logical cadence defect. The native no-op Canvas2D fixture exercises scene transforms, not a Chrome/GPU benchmark or measured browser frame rate. It fails on both source pins.

Two active positive assertions are committed in tests/quality-review-initial.test.mjs; neither skipped/inverted. Initial result on each pin:0 pass/2 fail, exit1. Ignored raw archives _artifacts/quality-source-d55144d and _artifacts/quality-source-941e857 come from exact git show file bytes with manifests and no runtime overlays. tests default to the actual checkout; QUALITY_REVIEW_ROOT is an explicit optional source override. The only runtime-tree diff between these pins is the new shared/station-contract.mjs; the affected movement/renderer sources are identical.

Actual commands: set TEMP/TMP D:/Widegames-work/temp and npm cache D:/Widegames-work/npm-cache, remove WORLD_ENGINE_GEOMETRY_MODULE, set QUALITY_REVIEW_ROOT to each exact ignored archive, then node --test tests/quality-review-initial.test.mjs. Evidence _artifacts/quality-initial-d55144d-red.txt and _artifacts/quality-initial-941e857-red.txt preserves both real failures. Exact hash receipts and the remaining initial controls follow separately. Source code is not changed to make a literal test pass.

## Verified official comparison and intentional scope

Consulted the primary [Innersloth Among Us guide](https://www.innersloth.com/games/among-us/) on2026-10-30. It describes crew completing tasks or ejecting impostors, body/emergency meetings, voting, sabotage response, Admin/Security information and impostor vent travel/deception. Those broad loops are the comparison reference. It does not establish exact pixels, proprietary map dimensions or a requirement for paid-role feature parity; no such claim is made here. Lantern Wake keeps its own setting, art, maps, bounded dated private observations and demo/model budget policy. Current source tasks are legacy relays with local human puzzles; the manager's planned schema5 six-puzzle protocol is not yet present and is not falsely claimed solved by these checks.

Initial review remains capped at8 meaningful native controls. Chrome/performance/workflow qualification waits for explicit manager lease and committed sources. Historical reports in this checkout are useful prior evidence, never a substitute for running the new cases. No fabricated scores, complete-game outcomes or browser-performance numbers are recorded.

## Completed initial eight-control audit

Exact current foundation remains **941e857f046ef7cc9bae25f0fcad27cf6ab7578a**; git diff against this pin is empty for server/public/shared. Initial source archives contain74 tracked files at d55144d and75 at941e857, including exact per-file blob/SHA256 manifests. The earlier immediate red milestone is **ef0a8c5510bfd5cb8c9365c22a837520e78dda75**. No runtime fixes were performed by this reviewer.

**8 tests:6 pass,2 fail, zero skipped/todo/cancelled**, Node24.20.0 exit1. Both presentation defects remain active positive assertions. The six other tests use actual accepted engine routes/inputs/actions and redacted views:

- Cardinal movement covers36 units over200ms and expires at the600ms lease ceiling108 units; diagonal normalization covers the same36 units over200ms. These are the game's declared180-unit speed, not a comparison to proprietary pixel scale.
- Dense10ms and sparse600ms ticks along a real chart-table corner cannot put an actor inside its collider or exceed the active lease distance; both end with no continuing movement.
- A remote legacy relay attempt and another actor's task ID are rejected. Physically reaching the assigned station permits its actual legacy completion, and JSON-restored same-ID retry does not repeat it. This intentionally does not assert that old relay actions solve the planned schema5 station puzzles.
- A higher-sequence zero cancels an accepted finite route; JSON restoration and stale/duplicate packets cannot revive it or renew old steering.
- A previously visible actor physically moves to Engine, becomes null-position in the other actor's actual safe view, and is removed from ActorSamples immediately. No hidden coordinates, roles or motion metadata are fed to the renderer.
- Every current Beacon1/Annex1 task station is reached through actual engine navigation.14 sequential route observations record real Node route-and-settle wall duration and simulated normal-speed travel time. These are harness observations, not GPU/frame/production latency claims or an invented performance grade. The exact JSON diagnostics are retained in the log; initial observed native durations range2.792?73.656ms and simulated trips1148?9422ms for this specific order/fixture. No arbitrary timing threshold gates a passing test.

Exact principal blobs at both pins: public/world/model.mjs **f23951944a46c4a550aadd6aca8950d1eb35e150**, public/world/scene.mjs **56a0fabec0f8f6814719d71458214f868aac72fc**, server/engine/world/motion.mjs **64e6adfcc22087067c3d83b26d2f77ce79bda54b**. Original red evidence SHA256: _artifacts/quality-initial-d55144d-red.txt **952C8E79C2B7029390CD2BFC48985AE4301F9CA3E718802BB34F4C2B82285B08**, _artifacts/quality-initial-941e857-red.txt **FD706B4B13D98EA3C2088BCC9FFA475E5C6EE585F56E2B6D42E29DB079020FA1**. Complete current eight-case log _artifacts/quality-initial-eight-current.txt **6F259CB2EF27E6915363F6B83E813BBF5540021860B4C4F1FC62CD25403D9678**. Source manifests: d55144d **825D6C9240ACA8A467322170AF969C5610DDD097B39A3FEE8514CB44622B69BD**,941e857 **CFE5FE84BFC33D37ACFA4644627BB81B9A887865B92E9B7C8D0F2B2D0499AD0C**.

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
Remove-Item Env:WORLD_ENGINE_GEOMETRY_MODULE -ErrorAction SilentlyContinue
Remove-Item Env:QUALITY_REVIEW_ROOT -ErrorAction SilentlyContinue
node --test tests/quality-review-initial.test.mjs
node --check tests/quality-review-initial.test.mjs
git diff --check
```

Default imports exercise the current checkout without requiring a pin override or skipping known failures. The optional root mode retains independent historical source controls. Syntax/whitespace checks pass. No preparation failure occurred in these native eight cases.

Read the existing real reports in this assigned checkout: tactical-normal-browser-report.json records26 passing named checks at247250e5c6bf4b342bf2ba8816dd2979b614ef5c; tactical-browser-report.json records32 at104f494d6c575901b113cbf2ba57960365326355, both with0 recorded browser/console errors. Neither report has top-level performance/frame/longtask/CPU/metric data. They are historical workflow evidence and cannot qualify smoothness or actual rendering cost of the new quality phase. Native Canvas2D transform tests use a labeled no-op context, so they are not substituted for the later real desktop/mobile browser profile.

Current initial work is complete within the8-test bound. New map/Core/client/task commits must be independently source-reviewed before exact-fix closure; new authoritative puzzle permissions/duplicate input/restore/model-safe-view and complete human/all-AI workflows remain subsequent work on committed integration. Chrome remains manager-held; no browser was launched. Browser harness will use the actual forthcoming protocol/UI rather than fabricate six solved tasks or outcomes. No Group2 branch, role expansion, seat allocation, paid feature parity, main/push/deploy or runtime edits are introduced here. Earlier authored AI/investigation dependencies are not independently self-approved by this audit.

## Exact station integration review and frozen native baseline, 2026-10-30

Reviewed **95e926057075032b1ed53c4db3ee611d0d93cc20**, including primitives **9c822ea4de1494a51e5fd873d9b353a22faaf92c**, root integration **b4430f8ed21dcbc190714aff500a2de3ae2deb0f**, and the final four-kind assignment/circuit-history tightening at95e9260. Raw archive `_artifacts/quality-source-95e9260` contains81 exact tracked runtime/package files, with per-file blobs and SHA256 manifest **28256af159e5415f614298d53d452289e279ff1fb726e1005e1c4d9906e1070e**. Product source remains untouched in this review worktree. This receipt supersedes the earlier 'no browser lease yet' preparation status only for the explicitly lent historical baseline.

The actual diff extends room3/match4 support with opt-in room4/match5 stationTasksVersion1, keeps absent opt-in legacy behavior, registers taskInteract through the same actor/envelope/phase/range validation, projects challenges through self.tasks only, and persists per-input receipts. Opening records owner-only task_opened without completing or applying the completion cooldown; actual completed puzzles apply that cooldown. Store validation checks challenge shape/history/completed agreement, extends retained-map static historical geometry checks to schema5, and treats future room/match/station/challenge versions as unavailable data to preserve. AI supplies structured local inputs through the same engine. This review does not add or independently self-approve the earlier authored AI implementation.

Principal exact95e9260 blobs:

| File | Blob |
| --- | --- |
| public/app.mjs | bc47ba5759d98575898044fa975845917d53d18b |
| server/features/tasks/index.mjs | 59ca0115ea86d1108a6c2afc9db3ea4778b654e9 |
| shared/station-challenges.mjs | f63d245eeb120645e855b4f02bd154e3018bb4eb |
| server/store.mjs | c1c994fca66c683ddb73af4a7a303faf6eb7c6a0 |
| server/engine/index.mjs | 4a0d944620f8888d77c80132040ebf3eaa6a3a76 |
| server/ai/world.mjs | bda2063e03fd91e0d981721cd348866a84ef0682 |
| shared/maps/beacon-v2.mjs | d865873635f4fa028686330d8a4822121e555100 |

### Eight new station-root controls

`tests/quality-review-stations.test.mjs`: **8 pass,0 fail,0 skip/todo/cancel**, Node24.20.0. No manager pure-puzzle test is copied or rerun. The independent clue interpreter derives input from actual owner views, not the production nextStationInput solver; real generated assignments and accepted routes/actions supply positions, phases, deaths and transit. No runtime player/task mutation creates a success fixture.

1. All six actual generated kinds on Beacon2 are physically reached and solved through engine taskInteract actions. Each accepted input changes confirmed progress; completion updates aggregate tasks and actual completion cooldown.
2. Repeated opening remains inert. Relay confirm/complete, incomplete glyph verification, nonexistent tiles, extra completed/actorId fields and a co-located other crew actor cannot control the owner's puzzle.
3. Real localhost HTTP/WS: concurrent same-ID inputs apply once; a conflicting payload is rejected; an old accepted receipt remains inert after a later accepted input. Spectator WS/GET never contains the task ID or another actor's task data. Visitor action, cross-room cookie, foreign task and extra playerId spoof are rejected by the actual transport/engine. The fixture uses explicitly idle demo seats, not simulated payloads.
4. Actual store.backup, exact backup-byte restoration and two server/store restarts preserve room4/match5 glyph progress, cookie/seat and receipts. A wrong glyph toggle has numeric progress0; a new toggle clears it, and the old accepted receipt cannot re-toggle it even after restart. Backup bytes remain unchanged; active replay stays denied.
5. Future room5, match6, station2, challenge2 and map99 files fail unavailable-version loading without being quarantined, rewritten or removed. The saved bytes and preexisting backup stay exact. These are deliberately corrupted future-version fixtures, not a supported upgrade or migration claim.
6. Actual root app handlers receive real engine glyph views: empty -> wrong selected tile -> empty has equal numeric progress0. Older work is revoked even after the ABA return; late errors cannot create feedback/retry, a current409 still shows its real error, and a retained retry cannot send after selection context changes. Scene drawing alone is stubbed in the VM.
7. Real movement out of range, emergency council, accepted elimination and accepted saboteur hatch transit deny stale task inputs without losing partial progress. Actual root movement/phase/death views also revoke pending feedback. Crew are not fabricated as hatch users: transit rejection is tested on a real saboteur, who has no crew task access.
8. **AI self-check:** real LIVE-mode controller decisions solve all six generated puzzles at their stations through accepted taskInteract actions, with a mocked never-sent key, zero reservation callbacks and zero sends. A separately constructed real council request contains only owner task id/room/completed, no puzzle/clue/progress, outcome, replay or hidden-role fields. makeRequest is inspected, not sent; no provider or whole-AI-match claim follows from this check.

The unchanged glyph positive assertion is also tested with **historical941e857 app handlers** receiving95e9260 engine safe views. It fails with `Error: OBSOLETE GLYPH CALLBACK` instead of AbortError. This is explicitly a historical app-lifecycle fixture, not a claim that941e857 has native schema5 support. Historical red `_artifacts/quality-station-historical-ABA-red.txt`, SHA256 **c0dfbc32e124980e1adceda3aa0aa5ea4b8cb4fdc42b8fe14891b6a3277068d3**, stays preserved. The exact95e9260 positive log `_artifacts/quality-station-final.txt` SHA256 **12099faf1cd0ab377db14fcf5752cdc1d4a161d7e563b6c1aba498797ef8e3b6** records8/8. Default source imports remain relative to the checkout; no feature-based skip or automatic historical-source fallback is present. A byte-identical copy staged under the ignored exact95 archive passes8/8 with both overrides removed, proving default-source mode. This review branch still has old941 runtime by design; importing the tests into95+ integration is required for its new schema, not an environment selection trick.

Preparation failures are preserved in `_artifacts/quality-station-first.txt` (**73700348a67b336268f9028e55693598714f3256f35a7e92aa7ce0087bbadc49**): the fixture expected400 for extra action fields, whereas actual rule rejection correctly returns409/INVALID_ACTION; its cleanup hook removed the directory before closing the restarted store. Only the fixture expectation and cleanup order were corrected. Neither failure is reported as a product defect.

### Native frozen941 baseline and explicit lease release

Chrome lease was explicitly lent for **baseline only**. Executed frozen **941e857f046ef7cc9bae25f0fcad27cf6ab7578a**, exact Beacon1, Chrome **156.0.8078.79**, actual native app/HTTP/WS/server/store, desktop1440x1000 and mobile390x844. Source archive SHA256 values were checked before and after. No runtime overlay, injected positions/views, fake winner, new task UI or paid model was used. Other seats were a labeled idle demo fixture; station staging uses accepted navigate and a labeled accelerated authoritative arrival clock. This is not a full human/all-AI watch.

**5 native checks passed,0 failed**,31 HTTP and42 WS safe-view inspections,0 browser errors,0 console errors,0 outbound requests and0 provider calls. Desktop uses real keyboard input; mobile uses native CDP touch events on the joystick. The remaining controls verify actual hidden-page stop and visible resume, a real map overlay, and legacy station opening without completion. Sound remains opt-in. Browser and local server are closed; owned private data/profile directories were removed. **Chrome lease released before station testing; no subsequent browser was launched.**

Evidence directory **D:/Widegames-work/ship-quality-audit-20261030/_artifacts/quality-browser-baseline-W9c8JK**:

- `report.json`, SHA256 **4aa89857a91734a9a6cb63d306d143d9ba34037e54b6cf55b8d766e5277b1ae0**.
- `desktop-start.png`, `desktop-walking.png`, `mobile-walking.png`, `mobile-map-snapshot.png`, `mobile-legacy-station.png`.
- `desktop-move-idle.cpuprofile` and `mobile-move-idle.cpuprofile` retain actual V8 samples; raw rAF intervals and per-method Canvas counts/times are in the report.

| Instrumented window | rAF samples / median / p95 / max interval ms | Canvas calls / dispatch wall ms | CDP TaskDuration delta seconds | V8 samples |
| --- | --- | --- | --- | --- |
| Desktop move + idle | 110 /11.4 /12.8 /23.6 | 193917 /113.400 | 0.314513 | 803 |
| Mobile touch + idle | 123 /11.5 /12.5 /12.7 | 216628 /110.100 | 0.299127 | 864 |

These are host-specific, instrumented observations, not GPU completion time, a claimed FPS, a production latency grade or a benchmark threshold. The extra rAF monitor and Canvas wrappers add overhead; the V8 sampling interval is1000 microseconds and includes instrumentation itself. CDP metrics cover the measured browser main-thread window. Report wallMs additionally includes profile setup/stop and artifact serialization/write; it must not be divided into the rAF sample count as an FPS estimate. Node CPU fields include the server/harness, not isolated browser CPU. Top sampled functions are mainly idle/program plus Canvas wrapper/value/now work; no GPU bottleneck attribution is inferred. This baseline is only before-evidence for a later identical instrumented committed UI comparison.

First native run is preserved at `_artifacts/quality-browser-baseline-hdUwMF/report.json` (**2c94680bdbe9167391a35d1b713887596d76e239facb45eb1de17b5cc74e7ee0**) and its failure screenshot. It passed lobby/desktop but falsely expected mobile movement while Puppeteer's switch to isMobile reloaded the page and reopened the legitimate role dialog. The corrected fixture acknowledges the dialog after viewport changes and uses actual mobile touch. This was a harness preparation failure, not a hidden product failure or skipped assertion.

### Commands, prepared harness and remaining qualification

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
npm ci --offline --ignore-scripts --no-audit --no-fund
$env:QUALITY_BROWSER_ROOT=(Resolve-Path '_artifacts/quality-source-941e857').Path
node scripts/quality-browser-check.mjs
# Chrome and local baseline server closed; lease released here.
Remove-Item Env:WORLD_ENGINE_GEOMETRY_MODULE -ErrorAction SilentlyContinue
$env:QUALITY_REVIEW_ROOT=(Resolve-Path '_artifacts/quality-source-95e9260').Path
node --test tests/quality-review-stations.test.mjs
$env:QUALITY_STATION_APP_ROOT=(Resolve-Path '_artifacts/quality-source-941e857').Path
node --test --test-name-pattern='glyph ABA' tests/quality-review-stations.test.mjs
# Expected historical exit1, not a closure failure.
Remove-Item Env:QUALITY_STATION_APP_ROOT
Remove-Item Env:QUALITY_REVIEW_ROOT
node --test _artifacts/quality-source-95e9260/tests/quality-review-stations.test.mjs
node --check scripts/quality-browser-check.mjs
node --check tests/quality-review-stations.test.mjs
git diff --check
git diff --exit-code 941e857f046ef7cc9bae25f0fcad27cf6ab7578a -- server public shared
```

The baseline driver accepts only the two authorized historical manifests and defaults to no paid calls. Exported preparation helpers exercise actual native controls for all six station kinds (including the nine-tile glyph grid), four generated human jobs and actual DEMO human/all-AI outcome observation with bounded timeout and no fallback winner. They import without launching Chrome. Their pending renderer selector assumptions were read-only inspected in the Frontend candidate; **they have not been executed or qualified against that mutable source**, and no full schema5 native UI/game claim is made. The next committed integration must supply the real human/all-AI fixtures, verify these selectors, cover the six-kind union across generated watches, and provide a new Chrome lease before running the final native workflows. The baseline remains distinct from those future new-UI scenarios.

No additional station-root product defect was found in these eight bounded checks. **Q-A1 and Q-A2 remain OPEN** with their original unchanged positive assertions/red receipts. The manager reports a smaller early camera gap but has not supplied an independently qualified closure; no before/after improvement or MotionTrack delegation approval is claimed here. No full suite, broad browser gate, hosted CI, deployment, provider call, main edit, push or other worker mutation was performed.

## Native development candidate911522d receipt, 2026-10-30

Exact authorized product source **911522d1c74feda96283785d5d45927be4794072**, extracted without overlays to `_artifacts/quality-source-911522d`:82 committed runtime/package files. Raw manifest SHA256 **4db2a6e5ee7e83e478288c5d24d9c495b8bec3a6979ede12384301f81ab32f4c**. The final lifecycle/autonomous runs verify all manifest file hashes before and after, including failure cleanup. Source inspection covers the14 runtime files changed since95e9260, including actual station renderer integration **f7af9d6f0a0eb42ae5f26e4701037e693878713b**, spatial legality cache **c203712abfa97986b09dfe3c3561485e0f58e9f8**, and911522d normal stationTasksMode/default startup preparation. The root app lifecycle blob remains the previously reviewed bc47ba5759d98575898044fa975845917d53d18b. No product source is edited by this review.

| Exact911 source | Blob |
| --- | --- |
| public/features/tasks/station.mjs | 3b7bad4a40b8ef40796c717e365366276c9b639f |
| public/world/experience.mjs | fff2fcd9d9eadda0e40c8262ce1059458c8ebf63 |
| public/game.css | b94cfba0c373f0ed2b5153198d56d079652005d1 |
| server/config.mjs | da021d8dd90c1e443b61488c1c1fa2474abfff82 |
| server/transport.mjs | c27eb368fdd0f0c1fad59abacf61dcb9220cacfb |
| server/engine/index.mjs | c4ebdd17e96e4fb8931c71760cf0f5c459cc1dcb |
| server/engine/world/geometry.mjs | dc33078c2f9b58d69d17bd895a7bd4ac9befbd95 |

### Native puzzle, layout and lifecycle evidence

The runner has explicit `baseline` and `candidate` modes. Baseline still accepts only frozen941/d551 and retains its historical5-check receipt unchanged. Candidate accepts **only911522d**, requires its raw manifest, installs no source overlays, and writes profile/data/evidence under this assigned D: worktree. Chrome156.0.8078.79 is native headless Chrome; app, engine, HTTP, WS, authenticated cookies and persistent store are real. Node/browser outbound guards and zero-call/cost DEMO config prevent paid/provider traffic.

Staged console coverage explicitly uses idle/scripted other seats, with a visible AUDIT STAGED notice. It never counts as an autonomous watch. Two actual four-job generated crew watches use `quality-native-39` (circuit/glyphs/sequence/signal) and `quality-native-1` (alignment/sequence/glyphs/manifolds); no task, position, role, response or winner is injected. Real navigate actions and authoritative accelerated arrival time stage access to stations. Native input controls then confirm each server step. Eight real jobs complete with steps4,5,4,1 and3,4,4,5 respectively, covering all six kinds, including real nine-tile glyph grids. These are not local solved flags or direct completion requests.

The main coverage run `_artifacts/quality-browser-911522d-mRR2cL/report.json` has **16 passing checks followed by one fixture failure**, not an all-green run. SHA256 **0b2b8fd8c9e4dbe662c76cf24e9e6e3ab4941ebe241508bbc67cd300d2d7c0cb**. Its positives include native create/start/secret role, actual room4/match5/default four jobs, Beacon2 whole-map view and fourteen exact room names in a readable numbered legend, desktop keyboard/mobile390 touch movement and two profiling windows, real spectator HTTP/WS privacy, all eight jobs/six kinds, actual current-error feedback and pending/moved-away stale rejection. It records202 HTTP and202 WS safe-view inspections, zero page/console errors and only explicitly scoped401 join bootstrap /409 incorrect/stale task rejections. Its overall failure is preserved and explained below rather than silently called a passing suite.

Focused remaining lifecycle run `_artifacts/quality-browser-911522d-jj8gvj/report.json` is **4/4 pass**, archive intact,47 HTTP/60 WS inspections,0 page/console errors, no outbound requests. SHA256 **0608666e31b23214398f651ce06734efb87493a4b8473f94aa05c83f9717ea05**. It confirms:

- A genuinely wrong native sequence control displays the literal actual409 error and retains its unchanged empty server progress; a rejection is not reported successful.
- A held real task request disables controls. Actual movement away closes the station, then releasing the request produces the real engine INVALID_TASK rejection. Its late error cannot repaint the new station or disable its valid controls.
- A different staged keeper legally walks to the bell, waits for its actual cooldown and calls council through a queued, engine-validated action. Council revokes equipment. Mobile320 chat submits a literal `<img ...>` string through the real form: the actual chat log contains that text, creates no image, and executes no handler. Landscape native skip voting is acknowledged by the actual meeting state.
- A real hidden page stops its direction lease; visible resume does not resurrect equipment. No synthetic visibility event or fabricated state is used.

Portrait320x740,390x844 and landscape844x390 glyph layouts are exercised. Each rendered control is scrolled into view and its center is checked against actual elementFromPoint, including close/verify controls; the dialog need not fit as one unscrollable card. This is bounded native reachability evidence, not a blanket accessibility or all-device approval. The fourteen-room whole-map screenshot is visually inspected. Controls, map and council screenshots are retained for the manager's visual review.

Screenshot roots, all under `D:/Widegames-work/ship-quality-audit-20261030/_artifacts/`:

- `quality-browser-911522d-mRR2cL/desktop-whole-map-fourteen-room-key.png` and `desktop-beacon2-start.png`.
- Same root: `watch0-circuit-open.png`, `watch0-signal-open.png`, `watch0-sequence-open.png`, `watch0-glyphs-open.png`, `watch1-alignment-open.png`, `watch1-manifolds-open.png`, with corresponding `-confirmed.png` images.
- Same root: `watch0-glyph-grid-320x740.png`, `watch0-glyph-grid-390x844.png`, `watch0-glyph-grid-844x390.png` and the second watch's three grid variants. Scroll positions are real and may show the card header partly above the fixed bar; all tested control centers remain reachable after scrolling.
- `quality-browser-911522d-jj8gvj/mobile320-council-literal-message.png`, `landscape-council.png`, `landscape-vote-recorded.png`, `mobile-pending-task-controls.png`, `mobile-current-literal-task-error.png`, `mobile-new-station-after-stale-rejection.png`, `landscape-resumed-world.png`.

### Two actual completed DEMO watches

These are separate from staged idle/scripted seats. Every nonhuman proposal delegates to the actual packaged createAiController with provider DEMO; no no-op AI is counted. Config/rules stay normal, including four jobs. Only the authoritative clock is accelerated by800ms per bounded observation loop, in addition to actual elapsed host time. The human-mode seat is intentionally idle; the active human six-kind console coverage is the staged section above. These cases do not claim a skilled active-human win or that AI completed every job before the saboteur won.

| Real watch, seed3 | Actual outcome | Jobs | Real taskInteract proposals | Accepted / denied receipts | Ended replay / snapshots |
| --- | --- | --- | --- | --- | --- |
| Human mode, human idle | saboteur / parity | 5/20 | 24 | 260 /1 UNAVAILABLE | 729 /68 |
| All-AI spectator mode | saboteur / parity | 6/20 | 27 | 240 /0 | 689 /61 |

Human result is preserved in `_artifacts/quality-browser-911522d-3s2DF8/report.json` SHA256 **8f6624c9cb8b3b707954d22992528a66a90915e05dc0e1bdbaedcf0d9f66c2a9**. Its human-watch check passes, actual elapsed observation47141ms. The enclosing run later fails on a spectator-start fixture race, so its report truthfully says1 pass/1 fail; the human result is not discarded or rerun to obtain a preferred outcome.433 HTTP/713 WS inspections,0 page/console errors; archive intact. Every observation asserts actual DEMO mode, zero AI calls and cost. Its top-level providerCalls field is absent because the later fixture failure bypassed success-only finalization, not because a live call occurred. Both network guards prohibit provider access. **One human-mode proposal was denied UNAVAILABLE**; its code/count is retained, but the original failed-run receipt did not retain enough action/time detail to classify that single denial as a product defect. This is explicitly not zero-denial qualification.

All-AI result is `_artifacts/quality-browser-911522d-0vmOJ0/report.json`: **1/1 pass**, SHA256 **be9b68c8805c2ef0529ec2917fd329b5b94c45dc8e072f3ba80311b889d1bc81**, elapsed observation42100ms,388 HTTP/645 WS inspections,0 errors/console errors/outbound requests/provider calls, archive intact. All240 recorded proposals are accepted; jobs were genuinely progressed by27 structured inputs. Six completed jobs here does not imply one of each kind; six-kind human-native coverage is separately established above.

Both load the actual role-revealed replay through the results UI and real GET. Event and snapshot timestamps are checked nondecreasing. Complete public-ended replay artifacts are `autonomous-human-public-ended-replay.json` under3s2DF8 and `autonomous-spectator-public-ended-replay.json` under0vmOJ0, with actual outcome/replay screenshots beside them. Before ended, safe views forbid peer roles/tasks/motion/private evidence and spectator owner data; ended roles/replay are deliberately authorized. No fallback winner, state replacement or skipped incomplete-game timeout is used. These workflow checks exercise historically self-authored AI as a dependency; they do not independently self-approve its implementation or any live-model behavior.

### Same-probe real profiling, with limits

The exact rAF monitor, Canvas dispatch wrappers and CDP/V8 measurement body from the941 baseline are shared by both runner modes. Two quiet windows per coverage attempt, desktop1440x1000 and mobile390x844, use400ms native movement plus850ms idle. Initial fixture corrections required three coverage attempts; **all three raw reports/profiles are preserved**, not a selected best trial. The table uses the16-positive-check coverage run mRR2cL, chosen for its full puzzle evidence, not for favorable timing. Baseline W9c8JK remains separate; maps/art/content differ, so this is not a controlled causal attribution to one cache change or a walking-fix approval.

| Instrumented source/window | rAF samples /median /p95 /max interval ms | Canvas calls /dispatch wall ms | CDP TaskDuration delta s | V8 samples |
| --- | --- | --- | --- | --- |
| Frozen941 desktop baseline | 110 /11.4 /12.8 /23.6 | 193917 /113.400 | 0.314513 | 803 |
| Frozen941 mobile baseline | 123 /11.5 /12.5 /12.7 | 216628 /110.100 | 0.299127 | 864 |
| Exact911 desktop development | 118 /11.8 /12.0 /23.7 | 112114 /65.400 | 0.218164 | 827 |
| Exact911 mobile390 development | 123 /11.4 /12.7 /12.8 | 116436 /78.600 | 0.244382 | 860 |

Actual raw intervals, per-method counts/times and `desktop-move-idle.cpuprofile` / `mobile390-move-idle.cpuprofile` are in mRR2cL. These measure instrumented JS/native dispatch and sampled main-thread CPU, never GPU completion, guaranteed FPS, full-machine CPU or absolute hardware performance. Profiling overhead, headless scheduling and different map content limit inference. No perf threshold, score or GPU-bottleneck claim is invented. Walking Q-A1/Q-A2 stay open regardless of these measurements.

### Preserved preparation failures and exact classification

Every interrupted run has its own report/failure screenshot; none is overwritten or presented as an all-green workflow:

- `quality-browser-911522d-OKS7j8`:6 positives then the harness incorrectly required an entire320px glyph card to fit onscreen. Actual parent scrolling and control hit tests establish reachability. This was a fixture assumption, not a proven unusable UI.
- `...-lr6lFj`:9 positives then the harness returned to `/` expecting a new menu; the real app correctly resumed its remembered watch. Corrected by leaving through the actual Exit control before creating another room. A spectator's initial expected GET401/join bootstrap is now explicitly scoped, not a generic ignored error.
- `...-mRR2cL` and diagnostic `...-wkgjms`: a staged navigation helper let a station descriptor's id overwrite its fresh request ID. Returning to station-cargo replayed the original accepted request while the actor remained at station-engine; own receipts/fingerprints expose the collision. The server correctly preserved idempotency. The final helper submits only{x,y} and puts its fresh id/type after supplied fields. **No Core walking counterexample is established by this fixture failure.**
- `...-kyPdZo` / `...-pknRTf`: attempted global network-idle/request-object waiting strategies failed during emulation/lifecycle traffic. These were harness synchronization attempts, not evidence of a server action failure; they are removed, not used to excuse an engine assertion. The receipt diagnosis above supplies the reproducible cause of the original stationary route.
- `...-nuIk3Q`: actual staged council caller correctly returned COOLDOWN. The fixture now advances only to its actual declared meetingAt before proposing a fresh legal meeting action.
- `...-3s2DF8`: human DEMO completion passes; the spectator fixture reads game before the asynchronous start acknowledgement, while lobby connection is already true. The final runner waits for an actual started match, then the focused all-AI watch passes without repeating the human game.

No new reproducible product counterexample is established in this bounded development run. The reports retain real failures and one human-AI denial, so this is not an unqualified all-green or all-proposals-accepted statement. The original Q-A1/Q-A2 tests and historical red remain untouched.

`tests/quality-review-browser-helper.test.mjs` adds **two passing driver-unit controls**, not a native UI claim. Actual legal engine actions complete the other keepers' generated one-job fixture, then the helper's last real signal action produces actual crew/tasks ended outcome. The helper permits that completed final acknowledgement. A separate actual council interruption with the owner's task incomplete is rejected. Views are actual engine projections; only the browser-control surface is stubbed. Default imports use the current checkout; QUALITY_REVIEW_ROOT remains the explicit optional raw source root.

```powershell
$env:TEMP='D:/Widegames-work/temp'; $env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:QUALITY_BROWSER_MODE='candidate'
$env:QUALITY_BROWSER_ROOT=(Resolve-Path '_artifacts/quality-source-911522d').Path
# Full candidate attempt captured mRR2cL; failures remain in its report.
# The runner now supports focused continuations without rerunning passed puzzles:
$env:QUALITY_BROWSER_SECTION='lifecycle'
node scripts/quality-browser-check.mjs
$env:QUALITY_BROWSER_SECTION='autonomous'
Remove-Item Env:QUALITY_BROWSER_WATCH -ErrorAction SilentlyContinue
node scripts/quality-browser-check.mjs
# Human passed before spectator fixture race; focused remaining all-AI command:
$env:QUALITY_BROWSER_WATCH='spectator'
node scripts/quality-browser-check.mjs
$env:QUALITY_REVIEW_ROOT=$env:QUALITY_BROWSER_ROOT
node --test tests/quality-review-browser-helper.test.mjs
node --check scripts/quality-browser-check.mjs
node --check tests/quality-review-browser-helper.test.mjs
git diff --check
git diff --exit-code 941e857f046ef7cc9bae25f0fcad27cf6ab7578a -- server public shared
```

All browser processes/local servers are closed and the owned private profile/data directories removed. **Chrome lease explicitly released after the all-AI completion, before this receipt/commit; no further Chrome launch.** Manager may use Chrome now. This is a development source911 qualification with scoped native evidence, not final walking closure, every device/match strategy approval, paid-provider qualification, full suite/hosted CI, main, push or deployment. Final native qualification waits for the forthcoming committed walking closure source and renewed explicit lease.
