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
