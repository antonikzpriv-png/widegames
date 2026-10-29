# Independent Beacon knowledge / coordinator projection review ? 2026-10-29

**Latest bounded closure:** BIR-1 is fixed at **afc6b1a94d201a943e84b955fcb492fc2ed031bc**. The isolated positive regression passes twice with consecutive private memory; the identical revised fixture still fails at historical6a97c798. Fixed suite13/13, historical suite12/13 with the original INVALID_TARGET counterexample active. Exact evidence and the separate sequential report control are recorded below. Initial findings/receipts remain historical evidence.

Exact reviewed integration: **6a97c7980ca91fdef67838febdb79a5f4d1d67fe**. Result: **11 passing checks, 1 failing positive regression, zero skipped/todo/cancelled**. This is a concrete-finding receipt, not integration approval. Runtime was inspected read-only; only this report and tests/beacon-investigation-review-projections.test.mjs are changed.

## Finding BIR-1: multi-saboteur local AI repeatedly chooses a forbidden teammate

Coordinator-authored server/ai/world.mjs:126?127 builds elimination targets from every nearby visible living player, then checks only the global availableActions type and radius. It ignores the exact enabled eliminate interaction fields. With multiple saboteurs, the engine correctly excludes a fellow saboteur, while a different valid nearby crew member keeps the global eliminate action available. AI then repeatedly proposes the forbidden teammate.

Minimal real-engine counterexample (no direct state placement or role information passed to AI):

- createMatch: world:true, systems:true, mode:spectator, now:0, seed:0, saboteurCount:2; eight public IDs alpha, bravo, charlie, delta, echo, foxtrot, golf, hotel; names equal IDs, valid colors; initialKillCooldownMs:1.
- Tick to1. echo is a saboteur. Its own safe view offers enabled eliminate targets delta, foxtrot, golf. Nearby charlie is also a saboteur, with no role transmitted in the public roster.
- createAiController in demo mode proposes eliminate charlie. applyAction rejects INVALID_TARGET. Tick to2, obtain the next actual safe view and decide again using the same private context: charlie is proposed and rejected again, while the three valid targets remain available. No successful elimination occurred between the decisions.
- The committed REGRESSION test asserts intended accepted/permitted behavior, so it fails on this source. It is neither skipped nor inverted to count the known defect as passing. A coordinator fix should select among permitted exact target descriptors, without adding hidden roles to AI views. No runtime fix is made here.

This can stall an actor's local elimination policy and waste its bounded action IDs. The engine still rejects friendly elimination; this is not evidence of unauthorized state mutation. The same local proposal path is used for roam in hybrid live mode; this run exercises demo and makes no claim about an entire multi-saboteur match outcome.

## Source pins inspected

Original Core knowledge milestone **97b57d79364855e657062929970ac440254f7fb6** was integrated as **2a5a5bbae008a97171f59a2cb01a56beacb8d6a0**. Core trace/restore follow-up **1f233ed141804e98254f9d481660144b6bf26da1** was integrated as **6daa2d50e4423c691475ae388c932b92df6c277a**. git diff 1f233ed141804e98254f9d481660144b6bf26da1 6a97c7980ca91fdef67838febdb79a5f4d1d67fe -- server/engine/world is empty: the actual four Core source files match the reviewed owner follow-up exactly.

Git blobs at the integration pin:

| File | Blob |
| --- | --- |
| server/engine/world/geometry.mjs | a4b58c3f0906d8be43c6dd4b59c0a09cbc361421 |
| server/engine/world/index.mjs | 2d0a6b312bb38a9d587dc5f4975341c89cb17ae0 |
| server/engine/world/knowledge.mjs | 0823423f21e553c06b88e0e43bdb814b2f7806a2 |
| server/engine/world/motion.mjs | 95ad5c02e8f986af1a3bae7dfd4567116dc98046 |
| server/engine/index.mjs | 9806fea426f68a4bf52e61e87187c9a9b60e43f5 |
| server/ai/world.mjs | 5758fa9e503b2cb0df6bf0f945bbf00ad9b8dbcd |
| server/ai/demo.mjs | b40811cf8bdd0ebef42de56092fb9f0fdfa7e01c |
| server/ai/anthropic.mjs | 91719efbb15086fbc82b85773f5f8812402e839d |
| server/ai/index.mjs | 29003704050d03ee27eb7bcc634a66a84c0640c0 |
| server/features/strategy/index.mjs | d9432d9fef6f1146e13bedd1582e0de74ded4207 |
| shared/beacon.mjs | 37d9e7d904a7b0caa350d8cc8f90dc3a44d6d6b0 |

All30 server/shared archive files were independently byte-compared to git show PIN:path. No runtime overlay was used. The ignored archive is _artifacts/beacon-investigation-review-6a97c79; source-manifest.json records the full commit plus every archived runtime/shared blob and SHA256. Its SHA256 is 8B5265B491814A8B584BC78BE3710A58E6A538EAE069C4C3710A890620B0F2D2.

## Positive boundaries actually exercised

- Isolated Core counterfactual fixture: changing a remote living actor into a dead actor with a remote body leaves the unaware actor and fixed spectator projections identical. Unknown remains status:unknown/alive:null. Actual local discovery produces original body time and later observation time; stale vitals cannot resurrect confirmed death.
- Fixed spectator projection stays at Bridge, does not follow a player, omits remote/transit coordinates, roles and private traces, and rejects restored replacement viewpoint coordinates. It is not an omniscient pre-end spectator.
- Core-native vitals integration: future samples are not adopted early; mismatched encoded owner/sample storage does not spread knowledge. The entitled actor receives dated dead status; another actor and spectator retain unknown. The local event is vitals, never witness. Private observation replay records explicitly name only the entitled owner.
- Actual engine with eight configurable IDs, including toString/valueOf/hasOwnProperty/isPrototypeOf, two human seats and two saboteurs: safe views and JSON-restored spatial state work without inherited transit/cooldown entries. Other players expose no role/tasks/motion/knowledge/transit/destination/persona/human flags. Own system cooldowns are allowed; spectator cooldowns are null.
- Actual accepted navigation, elimination, local body discovery and reporting: remote death retains last-known living status, hides body coordinates and report hints; later body discovery exposes no attacker. A real report/muster discloses roster death without exposing remote coordinates or roles.
- Actual accepted entry/arrival at linked vents: West witness receives entryId only; East witness receives exitId only at the exact arrival deadline. Remote actor and fixed spectator receive neither. Other actors cannot see the underground actor's position, transit object or target hint. JSON restart preserves original trace dates without duplication.
- Real closed-door LOS: a nearby target across west-upper is absent from the saboteur's position/hints; guessing its ID still fails engine validation.
- Actual timed vitals read / root adoption: only reader sees timestamped deviceFacts and updated victim status, including after JSON restart. Another actor and spectator get no facts and retain last-known status. No attack witness is created. This is a root/Core integration check, not independent approval of this worker's investigation implementation.
- Coordinator prompt projection preserves unknown as null and separates dated camera samples from attacker witnesses. A labeled adversarial sample includes extra private markers/coordinates; the strategy whitelist strips them and retains timestamp/source/limited/player IDs. A synthetic council view deliberately retains unknown to exercise serialization, even though normal council muster resolves current roster deaths.
- A fully intercepted mock provider response exercises the actual adapter/controller request, valid tool-use protocol and reservation-before-send hook with a custom actor. No actual HTTP request or billable provider call occurs. The resulting request contains only the supplied safe facts.
- A real timed meeting and unanimous ejection reaches ended without a fabricated outcome. Roles, replay and spatial replay remain unavailable beforehand; after ending, role reveal/replay are available and returned replay copies are defensive.

The earlier observationLimit discrepancy is closed historical evidence: fc1889b aligns root maximum64, present at this pin. Shared defaults explicitly include auxiliaryCooldownMs20000 and maxClosedDoors2. They are not reopened as findings.

## Reproduction and evidence

Node **v24.20.0**, assigned D: checkout; TEMP/TMP D:/Widegames-work/temp and npm cache D:/Widegames-work/npm-cache. No dependency install was needed. The test has no absolute drive paths: without BEACON_INVESTIGATION_REVIEW_ROOT it imports the current checkout's engine/Core/AI/shared sources. An explicit root is optional and never falls back to another tree or skips missing schema3 support. This worker's foundation engine is older; the exact committed integration is therefore qualified in its archive, not misrepresented as integrated into this branch.

Portable archive preparation from any checkout retaining the exact commit:

```powershell
New-Item -ItemType Directory -Force _artifacts/beacon-investigation-review-6a97c79 | Out-Null
git archive --format=tar --output=_artifacts/beacon-investigation-review-6a97c79.tar 6a97c7980ca91fdef67838febdb79a5f4d1d67fe server shared
tar -xf _artifacts/beacon-investigation-review-6a97c79.tar -C _artifacts/beacon-investigation-review-6a97c79
Remove-Item Env:WORLD_ENGINE_GEOMETRY_MODULE -ErrorAction SilentlyContinue
$env:BEACON_INVESTIGATION_REVIEW_ROOT=(Join-Path (Get-Location) '_artifacts/beacon-investigation-review-6a97c79')
node --test tests/beacon-investigation-review-projections.test.mjs
```

Actual exact-root command returned Node exit1: **11 pass,1 fail,0 skip**. _artifacts/beacon-investigation-review-pinned.txt SHA256 BFC8B2E57F95452A1A3B77EE0EF1880A15E0C05AFA8C089ADA1C5F4F2BE2C2AB.

Default relative-import behavior was separately exercised by copying this owned test unchanged into the archive's tests/ directory, removing BEACON_INVESTIGATION_REVIEW_ROOT and running node --test _artifacts/beacon-investigation-review-6a97c79/tests/beacon-investigation-review-projections.test.mjs. Same exit1 and **11 pass,1 fail,0 skip**, including the same repeated-denial assertion. _artifacts/beacon-investigation-review-default.txt SHA256 8D36A9A7253DD37F3ADD9E79FF00ADF83BB3706101636963C7E62C65B0FA835D. This is archive default-loading qualification; the manager's current checkout default run remains manager-owned.

Initial preparation output is preserved separately as _artifacts/beacon-investigation-review-preparation.txt, SHA256 A1FA2DADA7B97B5FDDE6065A26A3911083B2EE2C270477CCE4C162FBB97E99D5. It had6 passes/5 failures: three assertions wrongly disallowed documented own cooldowns/null selfTransit, the mock response lacked required stop_reason:tool_use, and the genuine target-selection regression. The four fixture/protocol mistakes were corrected; the genuine regression remains active. No product failure was silently skipped or relabeled as passing.

node --check tests/beacon-investigation-review-projections.test.mjs and git diff --check pass. No old full suite was run as a substitute for this review.

## Qualification limits

This is independent review of Core and the coordinator's new Beacon adaptation/projection. This worker authored the investigation module and earlier legacy AI: checks crossing those dependencies are self-checks/integration evidence, not self-approval. Core/manager independent investigation review is still required. No additional concrete privacy defect surfaced within these cases; BIR-1 prevents a clean acceptance of the audited integration.

Fixture clocks/seeds and custom actors are labeled. Core counterfactual placement/native samples are isolated module fixtures; gameplay cases use real accepted engine navigation/actions/ticks, not fake successes or manufactured winners. JSON restoration is not filesystem crash/durability qualification. No browser/Chrome, HTTP transport rerun, complete match ensemble, full repository suite, hosted CI, OS power-loss, paid/live provider, main/push/deployment or other-worktree edits are claimed. Manager owns remaining browser/full integration.

## BIR-1 exact-fix closure

Qualified coordinator source: **afc6b1a94d201a943e84b955fcb492fc2ed031bc**. Inspected the actual committed diff. server/ai/world.mjs now selects an enabled eliminate descriptor from the already-authoritative controls list and proposes its fields. It no longer picks the nearest/raw visible living player for elimination. New world.mjs blob: **b6ecc9b31b2ece7c00ce023f42d19ed452874349**.

Between the original and fixed pins, the only server/shared differences are this AI change and the root sees wrapper in server/engine/index.mjs. The latter gives synthetic observers a neutral null observer ID while real state player objects retain their own ID; fixed root blob **8a286fb46a13b85695656498c17be1d9ed8bf9bc**. All four Core world files and the remaining server/shared sources are unchanged. This closure uses the entire exact fixed server/shared tree, not a one-file overlay, and does not independently approve the investigation camera implementation or the separate browser/workflow changes in this commit.

The original test's first fixed-source failure was a fixture error: it propagated the first accepted elimination into the second target-choice attempt, thereby introducing a body that correctly takes priority for report. Requiring a second elimination after that successful mutation was invalid. Reproduced before editing tests: original regression at afc6b1a fails with actual report versus expected eliminate. Preserved local output: _artifacts/beacon-investigation-review-afc6-original-fixture.txt, SHA256 **B838A73057D84EC1ABCC8E65D78796ECFC00F3E4F4F29D70E5ABC05ED28812E3**. This reproduction ran just the selected regression, not the manager's separate combined17-check run.

The corrected regression uses a fresh clone of the same initial counterexample state for each of times1 and2, while reusing the same AI controller/private context. It asserts the stored lastDecisionAt advances on both steps, so the second decision is not a newly reset-memory run. Each attempt retains the original eliminate-type assertion, exact permitted target list delta/foxtrot/golf and real engine accepted:true requirement. Neither accepted nor rejected result is carried into the next isolated world. The original state must remain unchanged. No runtime/strategy behavior was changed to satisfy the test.

A separate sequential control uses actor charlie in the same seeded eight-player/two-saboteur world: actual AI proposes an enabled elimination, engine accepts, its newly observed body becomes reportable, the next AI decision reports exactly that body, and engine accepts the report into discussion. It passes at both historical and fixed pins; no literal second-elimination requirement is imposed on a world that now contains a body. No provider call or reservation is made for either local-policy control.

The original counterexample remains reproducible and active: the revised isolated fixture at **6a97c7980ca91fdef67838febdb79a5f4d1d67fe** still proposes charlie for echo twice and receives INVALID_TARGET twice, even though delta/foxtrot/golf remain enabled. Historical run: **12 pass,1 fail,0 skip/todo/cancelled**, exit1. The added sequential positive accounts for the extra passing test versus the original11-pass/1-fail receipt. Original output and original committed test at fd1b163f79f11f27ccd21662443e6931126953de are preserved; no historical red evidence was rewritten.

Exact fixed run: **13 pass,0 fail/skip/todo/cancelled**, exit0. Fixed default relative imports also yield **13/13**, exit0. The original eleven privacy/projection checks were not weakened. Tests still default to the checkout containing their source; optional BEACON_INVESTIGATION_REVIEW_ROOT remains the only test source override. No historical pin is silently selected by default.

Actual commands (Node24.20.0; TEMP/TMP and npm cache remain on D:):

```powershell
Remove-Item Env:WORLD_ENGINE_GEOMETRY_MODULE -ErrorAction SilentlyContinue
$env:BEACON_INVESTIGATION_REVIEW_ROOT=(Join-Path (Get-Location) '_artifacts/beacon-investigation-review-6a97c79')
node --test tests/beacon-investigation-review-projections.test.mjs
# Expected historical result: exit1, 12 pass and one real INVALID_TARGET regression.
$env:BEACON_INVESTIGATION_REVIEW_ROOT=(Join-Path (Get-Location) '_artifacts/beacon-investigation-review-afc6b1a')
node --test tests/beacon-investigation-review-projections.test.mjs
# Fixed result: exit0, 13 pass, zero skips.
Remove-Item Env:BEACON_INVESTIGATION_REVIEW_ROOT
node --test _artifacts/beacon-investigation-review-afc6b1a/tests/beacon-investigation-review-projections.test.mjs
# Fixed default-import result: exit0, 13 pass, zero skips.
node --check tests/beacon-investigation-review-projections.test.mjs
git diff --check
```

The fixed archive was prepared from git show afc6b1a94d201a943e84b955fcb492fc2ed031bc:path for all30 server/shared files, with source-manifest.json containing the exact revision, blobs and SHA256. Each archived file was byte-reverified against Git after the runs were prepared. For default loading, only the owned test is copied into the ignored archive tests directory; runtime files remain exact committed bytes. The portable git archive procedure above also works with the fixed revision and destination afc6b1a.

| Ignored local receipt | SHA256 |
| --- | --- |
| beacon-investigation-review-closure-old.txt | 392525233B58B19FAAE7C1F566854BCA4A7CC07B2663B99F29BBB2DAEBBA5F8C |
| beacon-investigation-review-closure-fixed.txt | 7E8E39BFF7434865044A07DF593931C357F64B741009B1E5F37A2FED720AF5FD |
| beacon-investigation-review-closure-default.txt | 11DE2347F470F44B450108E19876DB1D84D680FCB12DD5A4116E9FB85C45A020 |
| beacon-investigation-review-afc6b1a/source-manifest.json | 3500F53E2E79076AE9FC55C7370FEBD71E617EF03D4BC86A81FA7C46F3AAE16D |

Only the owned review test and this report changed. BIR-1 is independently closed for these exact isolated target-choice and sequential engine controls. No new exploration or claim of rerunning the manager's five completed AI games, broad suite, Chrome, browser workflow, transport, deployment, paid provider or hosted CI qualification. Previously authored investigation and legacy AI remain outside self-approval; manager/Core retain independent review responsibilities.
