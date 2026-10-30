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
