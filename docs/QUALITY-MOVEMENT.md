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
