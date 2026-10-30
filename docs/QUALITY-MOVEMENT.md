# Movement quality receipt

Foundation: 941e857f046ef7cc9bae25f0fcad27cf6ab7578a; worktree ship-quality-core-20261030. Only owned spatial modules/tests and this receipt change. Original schema1/2 runtime and public map descriptors remain separate and unchanged.

## Reproduced defect and correction

Original real-map probes hold diagonal (1,1) for600ms: Beacon start(422,997), Annex start(1365,146). Settlement schedules [600],1ms,10ms,100ms and jittered clocks disagree by approximately66/78 units; both desired invariance controls fail against the immutable raw foundation snapshot. Original log: _artifacts/quality-movement-original-red.txt, snapshot _artifacts/quality-movement-941e857. These are physics fixtures, not browser measurements.

Spatial steering now retains a private optional motion.anchor {position,at,doors} for at most one600ms input lease. Each settlement evaluates the same fixed4-unit trajectory prefix from that origin; a closed-door geometry change rebases at the prior settled boundary. Input renewal/reversal, stop, navigation, death/transit/phase and lease expiry discard the old origin. Restored old motion without an anchor remains accepted; new anchors are JSON-safe and validated. No exported factory signature changed and no client position becomes authoritative. No public projection includes the anchor.

Contact movement clips to a wall rather than dropping a whole substep and projects onto rounded prop tangents, avoiding a diagonal snag. Static and dynamic walkability still constrain every step. Discrete accepted routes retain their validation/invalidation API. Root must settle to every geometry deadline before applying doors, as its existing loop does. Schema5 opt-in/root/store dispatch remains coordinator-owned; the owned module itself accepts the same explicit spatial state shape for3/4/5 without treating arbitrary future versions as tactical.

## Checks and measured limits

node --test tests/quality-movement-authority.test.mjs:8/8 pass, no skip. Controls include original counterexamples, per-tick speed tolerance0.002 units, actual slide progress, stop/reverse/diagonal normalization, lease expiry, route cancellation, duplicates, JSON restart,12 arbitrary IDs, explicit module-level schema5, closed-door rebasing, phase stop, real-engine immutable input receipts and private views. Initial combined focused run passed26/27; one new door-edge assertion used562 instead of actual580-14=566. It was corrected to derive its bound from the fixture; original output remains _artifacts/quality-movement-authority-focused.txt. Prior19 tactical spatial/boundary checks passed in that run.

Measured Node v24.20.0 on this host:50 independent600ms leases after5 warmups,12 colocated collision probes,100ms ticks,300 samples per map/scenario. This deliberately stresses spatial settle only; it excludes full-engine knowledge, network and rendering. Probe overlap is a labeled load fixture, not a normal spawn. Script/results: _artifacts/quality-profile.mjs and _artifacts/quality-movement-profile.json.

| Map/scenario | Original median/p95 ms | Corrected median/p95 ms |
| --- | --- | --- |
| Beacon room |0.111 /0.321 |0.337 /1.019 |
| Beacon corner |0.435 /0.555 |2.243 /4.335 |
| Annex room |0.190 /0.281 |0.588 /1.138 |
| Annex corner |0.531 /0.636 |2.523 /4.618 |

Correctness costs more CPU: observed maximum for12 actors was9.761ms in these bounded cases. These are actual local timings, not a claim of faster simulation or browser smoothness. The first provisional solver was slower; its preserved profile is _artifacts/quality-movement-profile-initial-solver.json. No provider, Chrome or full-suite run. New Beacon2 is not yet present in this checkout and needs later descriptor qualification.

## Optional client helper milestone

public/world/movement.mjs exports MotionTrack with exact constructor(options={}), update(game,at), at(id,time,reduced=false), clear(), setIntent({seq,dx,dy},at). Times use one caller-provided monotonic presentation clock. All inputs are redacted game views. Options interpolationMs (default90, capped140), predictionMs (default100, capped120), and mapResolver (default shared getMap) are bounded. The samples Map retains {from,to,at,player} compatibility for the current renderer; player contains permitted identity/status/position/animation fields only. Frontend can delegate ActorSamples methods and expose track.samples, then call setIntent on locally submitted direction inputs. No scene/model/input integration is included in this commit.

Remote actors interpolate only; no remote extrapolation. Missing/unknown/dead actors disappear immediately. Current vision, static props and public closed doors bound interpolated positions; invalid interpolating segments snap only to a permitted authoritative endpoint. Self prediction is direction-only, normalized, collision-checked, limited to100ms beyond the last received snapshot and the600ms input lease. Input renewal without a fresh snapshot cannot extend prediction. Reduced motion returns the last authority position. Stop/reversal take effect on the next sample; zero input freezes pending presentation until authority acknowledges or another context/input replaces it.

Phase, map, match, owner, death, transit, vision-radius/lights and closed-door context changes revoke pending motion. Same-owner older versions cannot resurrect prior visibility/phase. clear() releases all samples and intent; Frontend must call it on room/account/hidden/dispose boundaries because game alone carries no room/account lifecycle. This module sends no requests and confers no gameplay authority.

node --test tests/quality-movement-presentation.test.mjs:8/8 pass first run, zero skips. Original ActorSamples is retained in the immutable baseline archive for the separate bounded timing comparison. Pure next-frame16ms direction displacement is0 for original no-prediction samples and2.88 units for MotionTrack, not a browser/physical latency measurement. Timing artifact: _artifacts/quality-movement-presentation-profile.json. Manager/Reviewer independently qualify integration and native feel.

## Final continuous-collision closure and Beacon2 qualification

This follow-up supersedes the provisional solver in ee56faacba7b6236c49cd805f6771051d861c832 and refines helper milestone f40ba241426e7686662af573a4307de0de9eb237. Integrate all three commits in order. The public MotionTrack/factory APIs remain unchanged. Ended presentation retains permitted revealed role fields; pre-end private tasks/routes/motion are never stored in sample.player. Impossible steering anchors farther from current position than elapsed authoritative speed now reject restoration.

A bounded seeded extension found a real candidate flaw at Annex trace17: partial contact recomputation advanced4.34 units over20ms (limit3.6), and a subsequent candidate could interpolate into the concave floor seam. Preserved evidence: quality-movement-beacon2-first.txt, quality-movement-beacon2-contact-red.txt; an intermediate file named beacon2-green actually records a failure and is NOT passing evidence. Fix: each final partial step samples timed segments of the canonical full step. Continuous collision uses exact union-of-floor intervals for all nine existing body probes and rounded rectangle sweeps for props/doors. Steering, navigation and accepted-route invalidation share that segment check; helper presentation independently checks the same continuous boundary. Numerical stop margin is under0.000001 world unit per contact; test displacement tolerance is0.002. No actual timestamps or replay events are fabricated.

The short-seam case is independently a foundation defect: two legal Annex endpoints less than4 units apart contain an invalid body position; original sampled route validation accepts it. Original controls now reproduce3/3 failures at exact941e857; current checks pass, including a collision-safe planned detour. Historical logs/manifests remain local ignored artifacts. The retained raw foundation has308 verified Git blobs; the read-only map-owner snapshot has10 verified shared blobs at47cf97681eb5ba5c550e3ec4ea0cfe464c6ca639, not an assertion about its uncommitted files or full root integration.

Final commands from the assigned worktree (TEMP/TMP D:/Widegames-work/temp; no dependency install):

~~~powershell
$env:QUALITY_MOVEMENT_MAP_ROOT=(Join-Path (Get-Location) '_artifacts/quality-map-47cf976')
node --test tests/quality-movement-authority.test.mjs
Remove-Item Env:QUALITY_MOVEMENT_MAP_ROOT
node --test tests/quality-movement-presentation.test.mjs tests/world-engine-lifecycle.test.mjs tests/world-engine-replay.test.mjs tests/beacon-world-engine.test.mjs tests/tactical-map-boundary.test.mjs tests/tactical-map-spatial.test.mjs
~~~

Results:10/10 authority checks with original Beacon1, Annex1 and exact Beacon2;49/49 presentation/legacy/privacy/lifecycle/replay/map checks, zero skips/failures. New-map trace coverage is24 seeded starts per descriptor,72 leases/2160 timed settlements plus12 safe arbitrary-ID spawns per map and JSON restart. Ordinary tests use current checkout source; only explicit QUALITY_MOVEMENT_MAP_ROOT reads the pinned shared snapshot. Original fixtures explicitly select retained version1 rather than resolving a newer string default. No exhaustive new-map all-pairs or browser claim. Focused evidence: _artifacts/quality-movement-beacon2-final.txt and _artifacts/quality-movement-final-compatibility.txt. Original desired failures: _artifacts/quality-movement-original-three-red.txt.

Final spatial benchmark uses the same50-lease/12-actor/300-sample scenarios and is recorded in _artifacts/quality-movement-profile.json (script quality-profile.mjs). Values below supersede provisional timings above; original/initial/ee56 profiles remain separately retained.

| Map/scenario | Original median/p95 ms | Final median/p95 ms | Final max ms |
| --- | --- | --- | --- |
| Beacon room |0.109 /0.310 |0.561 /1.228 |2.506 |
| Beacon corner |0.406 /0.513 |1.600 /2.504 |2.601 |
| Annex room |0.186 /0.283 |0.651 /1.241 |2.465 |
| Annex corner |0.550 /0.650 |0.963 /1.783 |2.351 |

Presentation-only final profile (12 visible static keepers,100 warmup then1000 frames; timing at() for12 actors, snapshot updates excluded) measured median0.095ms/p950.211ms/max0.761ms versus original0.0014/0.0025/0.253ms. Exact fixture/script/result: _artifacts/quality-presentation-profile.mjs and quality-movement-presentation-profile.json. Additional collision/privacy work costs CPU. No unsupported FPS, physical input latency or full-server throughput claim.

Handoff: Frontend must delegate ActorSamples, forward local direction packets to setIntent and clear on hidden/room/account/dispose. Coordinator must retain chronological geometry settlement and explicit schema5 root/store dispatch. New maps were read-only geometry qualification, not station-task/default schema5 transport approval. Independent Reviewer/manager approval and native browser feel remain outstanding. No root/shared/other-owner edits, installs, providers, Chrome, full suite, main changes or pushes performed. This bounded implementation assignment is complete.
