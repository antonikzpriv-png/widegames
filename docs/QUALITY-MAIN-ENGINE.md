# Group2 backend adaptation handoff

Manager foundation047ae494128fb76f7e474fac2cd8193a13add178; incoming actual main43c079999506785196ab85750105ceb102ba9314. New isolated D:/Widegames-work/ship-quality-main-engine-20261030, branch codex/ship-quality-main-engine-20261030. A local no-commit merge was staged; all conflicting unrelated paths retained manager versions as TEMPORARY build-fixture staging. Only explicitly owned backend/tests/this receipt are committed. Unrelated main additions/nonconflicting changes remain uncommitted fixture material and are NOT an approved integration. The completed ship-quality-core worktree remains intact.

## Coordinator integration requirements (early source finding)

- Preserve incoming shared/features.mjs and taskStep action registration; owned features will support explicit world schemas2/3/4/5 and dead CREW only. Config/rooms must pass validated features through createMatch and preserve room.features. Keep field-note ability{abilityId,targetId} distinct from incoming protect{targetId}, decoy{x,y}, ghostSay{text}; never weaken field validation to choose a handler client-side.
- Store must retain optional Group2 progress for schema2 (validProgress/task identity/clock), optional features/ability/effects/ghostChat, replayBytes and replayHistory while still validating schemas1..5 and exact map versions. For ghost-tasks, dead crew can retain active private motion; transfer remains default (schema2 immediate, beacon redistribute-at-muster). A dead saboteur is not a task ghost. Coordinate shared canWorldAct/isGhost accordingly.
- Existing shared/replay.mjs version1 validates exactly six p1..p6 actors, original six rooms and1600x1200. That is a concrete incompatibility with schema5/Beacon2/Annex/custom4..12 rosters. Preserve version1 readers for old schema2 histories; add version2 map identity {id,version}, bounded custom roster/map geometry and station challenge anchors. Owned replay-history will export validation for the new history shape; coordinator/shared/frontend must accept the same exact shape before exposing new replay metadata.
- AI must keep strategic intentions/controller hooks while selecting geometry from the safe view's exact map. It must branch task protocol: schema2 owner progress uses taskStep then task; schema5 owner challenge uses taskInteract and server confirmation. Do not feed hidden state to adapt the planner. Ghost local choices use self.ghost and permitted tasks only; optional abilities use exact legal action fields. Live strategic calls retain ordinary durable budget reservation rules.
- Root getReplayMetadata will remain ended-only alongside existing getReplaySnapshots. Legacy schema2 replay map remains the version1 string; schema3..5 histories/metadata carry actual versioned map identity. New canonical beacon event IDs remain protected; original effect identity is recorded separately. Store/transport must validate and return the proper version rather than relabeling a large map as Beacon1.

This is an implementation handoff, not independent approval or a claim that unrelated store/AI/UI/shared conflicts are solved. Focused test results and final exact owned patch follow below. No Chrome, paid calls, main change, push or deployment.

## Owned runtime milestone

Six owned controls pass (quality-main-engine-merge.test.mjs); first run exposed missing mapped-history initialization, corrected with original failure log retained. Implementation exports getReplayMetadata alongside getReplaySnapshots, plus validateReplayHistoryState(history,state) for store integration. ReplayHistory/metadata v2 is exactly {version:2,map:{id,version},checkpoints:[...]}/{version:2,map:{id,version},matchId,anchor,coverage}. Anchor player tasks may add kind/challenge for station tasks and preserve optional v1 progress/taskKind. No requests/AI/private fallen chat are copied. Legacy schema2 keeps shared version1 shape and map string; mixed v1 history in a mapped schema rejects.

All engine replay rows now retain sequence, bounded12000 events/2MiB. Canonical beacon r# IDs win over data IDs; effect_started retains native identity as effectId. Original schema2 fx IDs/sequence remain compatible with current Group2 replay model. Map-bearing started events and version2 history retain actual map identity. Navigation action replay additionally retains route<=128 and actual speed; taskInteract replay retains actual resulting stationChallenge/completed. These are private ended-only records, never public timeline payloads.

Core does not edit shared/replay, config/store/rooms/transport/AI/UI. Those remain TEMPORARY manager-side staging in this checkout. Bare047 does not contain shared/features.mjs or shared/replay.mjs; manager must add incoming files and complete their new-map validator extension. No schema numbers are inferred as future versions: explicit2..5 only. Ghost entry points take optional state on spatial navigate/input (existing arguments remain compatible); root supplies it. Local motion/vision validators permit only actual dead-crew task ghosts under the explicit preset. Fixed legacy5-kind room mapping remains v1 for old saves; new maps can explicitly carry taskKind when using that protocol, while schema5 stations keep their existing six challenge kinds/authoritative service.

Focused Group2 source runs have passed semantic task/ghost/replay runtime cases after fixing feature dispatch and a legacy adapter radius argument. Initial red runs and temporary-path errors are preserved under _artifacts/backend-*.txt. Full bounded Group2/store/config compatibility results follow; no full integration is claimed at this milestone.

## Final bounded checks and concrete remaining owner gaps

Runtime milestone1c228a0f57af934ad4d71fa5d408dda249be33a2 follows early handoffc21aa50ac560dfb9401d4a113783a534027fa57a. The final follow-up tightens mapped-anchor station completion/role/outcome validation and supplies task-only descriptors to eligible ghosts, using the same authoritative task range/LOS checks. It never supplies living-only device/repair/report/field-note hints to ghosts. Mapped histories reject unknown future schemas and mixed legacy version1 histories.

Commands, cwd this isolated D: tree, TEMP/TMP D:/Widegames-work/temp and npm cache D:/Widegames-work/npm-cache:

~~~powershell
npm ci --omit=dev --offline --ignore-scripts --no-audit --no-fund --cache D:/Widegames-work/npm-cache
node --test tests/quality-main-engine-merge.test.mjs
node --import ./_artifacts/portable-test-paths.mjs --test tests/world-tasks.test.mjs tests/world-task-protocol.test.mjs tests/ghost-abilities-engine.test.mjs tests/ghost-abilities-integration.test.mjs tests/spatial-replay-recording.test.mjs tests/spatial-replay-lifecycle.test.mjs tests/spatial-replay-main-integration.test.mjs tests/spatial-replay-transport.test.mjs
node --import ./_artifacts/portable-test-paths.mjs --test tests/quality-main-engine-merge.test.mjs tests/quality-stations.test.mjs tests/beacon-world-engine.test.mjs tests/tactical-map-boundary.test.mjs tests/spatial-replay-model.test.mjs
node --test tests/quality-main-engine-merge.test.mjs tests/spatial-replay-main-integration.test.mjs
~~~

Only ws8.22 installed offline. Incoming tests hardcode /tmp and /workspace/widegames/_artifacts; a fixture-only preload redirects mkdtemp calls for those two prefixes into this tree's ignored _artifacts/portable-temp. No assertion or product source is weakened, no C:/tmp is created, and normal D: paths are unaffected. Initial unredirected failures and corrected runtime failures are retained, not overwritten.

| Evidence | Actual result |
| --- | --- |
| backend-group2-compatibility.txt |53 tests:32 pass,21 fail,0 skip |
| backend-quality-tactical-final.txt |45/45 pass,0 skip |
| backend-final-owned-replay.txt |10/10 pass,0 skip (includes six owned tests plus four incoming replay integration cases) |
| backend-strategic-link-gap.txt |Actual staged strategic module fails to link: worldTaskAction missing from staged manager ai/world.mjs |

The45-check run covers original5-kind replay reconstruction/model, new6-kind station challenge and save checks, actual schema3 privacy/knowledge, tactical route/door invalidation including jam, and owned cross-schema/custom-roster controls. These are focused implementation checks, not a full suite or independent approval. The metadata-only ended fixture in one owned test is explicitly labeled and is not evidence of a naturally completed match. Incoming Group2 full demo tests were attempted and fail on the unadapted AI proposal protocol; no successful full integrated demo match is claimed.

Remaining21 failures are actual unresolved temporary integration, not passing qualification:

- Config does not expose validated GAME_DEATH_POLICY/GAME_ABILITIES/features yet. Transport room creation rejects incoming feature presets400, does not forward features on start, and does not schedule dead crew. This explains preset, missing ghost/ability, scheduling and two HTTP ward/echo failures.
- Store's living-only motion invariant rejects legal ghost checkpoints. Store also lacks validateFeatures, validProgress and replay byte-accounting/history hooks: malformed feature metadata, duplicate effect-owner state, impossible task stages and forged replayBytes are accepted instead of rejecting. These missing expected rejections are concrete security/restore gaps. Existing quality station validation itself still passes.
- The four incoming full demo cases currently propose task instead of taskStep and receive TASK_INCOMPLETE. AI merge must preserve strategic execution/budgets but use the two advertised task protocols and exact-map geometry. A direct link check additionally reports SyntaxError: ./world.mjs does not provide worldTaskAction. Preserve incoming visibleWorldPlayer/worldTaskAction exports or compatible server-side wrappers; do not solve by allowing unearned task completion.
- Five replay lifecycle cases hit staged UI seams (abort options, loading, playback controls and causal selection); Frontend owns them. Replay transport still rejects all query strings400 rather than the incoming exact-match binding404 contract. Coordinator must integrate matchId binding, metadata and ended guard with existing authentication.

These failures are preserved in full logs. Core did not rewrite other-owner runtime or historical assertions to make the fixture green. Schema2 pure task/ghost/ward/echo/replay engine cases pass; the incomplete config/store/AI/UI/transport fixture is intentionally not a finished integration.

## Applying only owned files

No merge commit or unrelated main files are committed on this branch. Its parent is exact manager047. Main43 source additions/nonconflicting changes remain uncommitted TEMPORARY staging for cross-owner linkage. Review/apply only the owned commits or the combined047?final owned patch under _artifacts/quality-main-engine-owned.patch, with per-file patches/manifest under _artifacts/quality-main-engine-patches/. They include only engine/index, world-runtime, tasks, features, replay-history, feature-validation, owned world modules, the new test and this receipt. Never import the whole working directory as a production merge.

No Chrome, paid/live providers, main/push/merge publication, user-data operations or other-worktree edits. Exact source pins and all negative evidence are preserved. Manager must independently review the owned transition and complete/qualify the owner gaps above before claiming the Group2+quality integration.
