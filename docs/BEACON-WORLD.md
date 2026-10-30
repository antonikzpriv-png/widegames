# Authoritative schema3 spatial world

Owned factory: createSpatialWorld(geometry), exported by server/engine/world/index.mjs. Foundation a431e5e80fad153d9aab892a1e9e727ef11fc5a3. Early geometry/motion milestone136caa206e319f6f1afcd2a7a3b8de22ff057f5b; the completed module adds bounded observation knowledge and safe projections. Only schema3 orchestration selects it. Legacy server/engine/world-runtime.mjs, engine orchestration and schema1/2 files remain untouched.

## Exact interface

Factory returns the frozen-contract surface: initialize(state,now), settle(state,until,record), stop(state,p,at,reason,record), stopAll(state,at,reason,record), navigation(p,target,now,state), navigate(p,target,path,now), input(p,{seq,dx,dy},now), moving(state,p,now), walkable(point,state?), station(roomId), bell, WORLD, point(value), sees(from,to,state?,observerId?), nearby(from,to,range?,state?,actorId?), observe(state,now,record), projectWorld(state,viewerIdOrNull,now). Additive helpers:

- validateSpatialState(state) returns true or throws on invalid motion/knowledge. Root/store should call this for schema3 restores, alongside systems/investigation validators.
- adoptVitals(state,playerId,{at,players:[{id,alive}]},now,record) accepts a normalized trusted terminal sample for one owner. It is not a client action endpoint. Future timestamps, unknown IDs, false death of a currently living actor, duplicates/extra fields and resurrection of known death are denied without mutation.

initialize modifies only player.position, player.roomId, player.motion, player.knowledge and state.spatial. It deliberately does not select schemas/roles/configuration. Existing geometry spawns are retained where distinct; public custom roster IDs receive deterministic collision-safe distinct Bridge fallback positions. Module limit32 players; current coordinator lobby limit is4?12. No assumption that a human must be p1. No Date.now, randomness, async/providers or per-match process/global caches.

## Geometry, movement and hints

Authoritative speed/radius/lease come from shared geometry:180 units/second, body radius14, input lease600ms; steering diagonals normalize. Movement uses small collision steps and bounded navigation grid searches. Closed rectangles come only from public BEACON_DOORS fixtures selected by systems.doors closed flags. A route proposed while a door is open stops physically if it later closes; no crossing or teleport occurs. Opening permits a newly computed route. Door-aware BFS caches are local to one call, so doors cannot leave stale cross-match cache entries. Targets and routes validate finite, walkable coordinates; returned paths end at the exact target and are bounded4096 points.

Both props and doors occlude line of sight; raw floor geometry is used rather than the legacy canSeeWorldPoint360 cap. visionRadius, lightsVisionRadius and saboteurVisionRadius are respected. Lights reduce crew/fixed-camera radius; saboteur radius remains its configured value. nearby requires configured sight as well as requested distance, preventing close-range actions/hints through walls, props, doors or darkness. Dead/transit observers cannot see/interact; moving returns false during transit and settlement clears preexisting movement. Context must pass state and actor ID for these permissions. The module owns proximity primitives; root/systems/investigation own hint descriptors and use those same primitives for validation.

Input helper validates integer axes/positive safe sequence, finite server time and exact input fields; old/equal sequences are inert. Root owns envelope denial receipts and conflict responses. Navigation copies waypoints/destination and rejects malformed or backward-time commands. State remains JSON-safe. Existing private motion shape is retained: seq,dx,dy,leaseUntil,at,manual,path,destination,recordedAt,error. Bounded samples/stop/arrival records go only to the supplied private record callback; no public event is emitted by this module.

## Private knowledge and safe projection

player.knowledge={version:1,roster:[{id,status,alive,at,source}],events:[],bodies:[],sequence,witnessCursor,traceCursor,musterId}. status is unknown/alive/dead; unknown alive is null, never inferred from hidden actual alive. A previously seen living player stays last-known alive after an unseen death. Position/room are only current permitted observations, not a remembered route. Death becomes known by current body sight, an explicitly authorized witness, own death, owner-only vitals, or meeting muster. Known death cannot be undone by stale samples.

Events cap at min(beaconRules.observationLimit,64); body dedup and roster knowledge cap at player count. Private IDs/cursors survive JSON restart and prevent old witnesses being reissued after history eviction. Body entries carry original death at and actual observedAt separately. No attacker attribution is invented for a body. Witnesses copy only permitted fields from private records carrying visibleTo; that recipient list is never sent to a client. Meetings disclose actual roster life status once per meeting to all viewers, without revealing remote coordinates or roles. No global elimination event is emitted here.

state.spatial={version:1,spectator:{position:{x:800,y:285},knowledge:...}}. Pre-end spectators have a fixed Bridge viewpoint and their own local knowledge, subject to lights/props/doors. The viewpoint does not follow players or secret transit. Remote deaths remain unknown/last-known until observed or disclosed by muster. Secret transit positions/metadata are withheld from others. Ended projection reveals every actual role/status/position. Invalid non-null viewer IDs reject. projectWorld returns fresh defensive players/localEvents/vision and never mutates state.

Native owner-only vitals adoption is built into observe: state.investigation.observations[playerId] entries matching the investigation owner's exact {id:'obs:<owner>:<device>:<at>',deviceId,kind:'vitals',at,data:{players:[{id,status:'alive'|'dead'}]}}. Known public vitals device, encoded owner, finite elapsed time and bounded roster are checked; normalized adoption updates only that owner. Cameras/occupancy never become death knowledge, and no other actor's read is consulted for this viewer. This shape was inspected read-only in the investigation owner's working data.mjs; its complete read/session implementation still needs coordinator integration qualification. The explicit normalized helper is available if that owner interface evolves.

## Root integration requirements and limits

Root must refresh observe after each movement settlement and accepted action, supply a private record function, use projected players/localEvents/vision, omit schema3 global eliminated events, and defer dead task transfer until meeting muster. Root must split settlement at system deadlines before doors/lights/transit change. Root must reject input/actions by actors in transit and explicitly exclude transit targets when enumerating action/hint targets: a plain point does not reliably identify a target actor. Self-owned transit state remains systems/root owned. Door travel/repair/vent permissions and arrival teleport belong exclusively to systems.

NEXT_FEATURE_INTERFACES.md was absent from the foundation; no group2 reserved feature implementation or other-owner source is edited. Observations are taken at supplied authoritative settle/action times; the module does not invent intermediate sightings during missed server ticks. World helper state is mutable only because root calls it on engine-cloned state. These are module/interop checks, not independent approval of Core's own code or full browser/production qualification.

## Meaningful checks and exact sources

17 module controls cover geometry/diagonal speed/lease/collision; door closure and reopening/path cache invalidation; props/doors/configured vision over360/lights; transit restrictions; hidden and last-known deaths; body discovery and separate death/observed times; fixed spectator; owner-only witnesses and bounded-history dedup over restart; muster; normalized/native owner vitals; defensive frozen projections; malformed state/input;100 muster histories and a deterministic300-input movement/JSON trace. Initial knowledge run13/14 passed: the remote-position muster assertion accidentally placed its observer next to the corpse. The corrected fixture moves that observer to Bridge; assertions retain actual remote privacy. Initial output remains _artifacts/beacon-world-knowledge-first.txt.

Three actual-engine controls use coordinator commit1fb059ea55bb7a319288d55ba721c1ed98eb1106 plus only this owned world module in _artifacts/interop-1fb059e. They prove actual custom-human schema3 creation/world markers, schema1/2 separation, physical navigation/remote hidden death/actual witness/report muster and deferred task transfer, plus an84-unit bell blocked by the chart table with both action hint and actual request denied. No hidden-state edits, teleports or fabricated results in these interop tests. This is an explicitly labeled composite, not a claim the manager already integrated the new module. Exact overlay hashes are in interop-1fb059e-manifest.json. The three interop cases skip only on an owner foundation lacking schema3 orchestration; an explicitly provided root that lacks schema3 fails. Ordinary geometry/knowledge tests never depend on that opt-in root.

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:BEACON_WORLD_ENGINE_ROOT=(Join-Path (Get-Location) '_artifacts/interop-1fb059e')
Remove-Item Env:WORLD_ENGINE_GEOMETRY_MODULE -ErrorAction SilentlyContinue
node --test tests/beacon-world*.test.mjs
node --check server/engine/world/index.mjs
node --check server/engine/world/geometry.mjs
node --check server/engine/world/motion.mjs
node --check server/engine/world/knowledge.mjs
git diff --check
~~~

Full scoped result:20 passed, zero failure/skip with the explicit actual-engine composite. Prior module-only17/17 output is _artifacts/beacon-world-module-final.txt; actual-engine first3/3 is beacon-world-interop-initial.txt; final all20 is beacon-world-final.txt. No npm/dependency updates, paid/provider calls, Chrome, push/main/deployment, legacy/runtime/shared/root edits or other-worker-tree changes. Manager independently reviews/integrates the exact commits.


## Follow-up: local hatch traces and checkpoint restoration

Exact references inspected read-only: coordinator cb00e33f25bf9ba561743818a5dc8f562fac6fb8, systems owner eb56920185cef5de4689b1bfb60d7eba85274620 and investigation owner35fb1e9f322062dcdeb7695a3f7b936fd2df0219. The coordinator's later group2 baseline0b0e9c3442bbc6605653e0be5e2e76fb7932ba1e is only a reference; no root/group2 code is imported into this tracked branch or edited.

observe now consumes private vent_enter/vent_exit replay records only for explicitly listed player recipients. The entry or exit is validated against its public BEACON_VENTS fixture and matching room/position. Source records with both endpoint IDs, unknown actors/hatches or mismatched positions are ignored. Current observer sight is not substituted for the recorded historical recipients. Empty visibleTo produces no trace; the fixed spectator receives no vent traces, even if an actor includes other recipient entries. Local fields are constructed individually, so recipient lists, roles, destinations and extra private source fields cannot cross the view boundary.

Frontend local event shapes:

~~~js
{id,type:'vent_enter',at,observedAt,playerId,roomId,position:{x,y},entryId}
{id,type:'vent_exit',at,observedAt,playerId,roomId,position:{x,y},exitId}
~~~

at is the original authoritative systems event time; observedAt is when that private record is adopted into the viewer's history. There is exactly one hatch ID, never the remote endpoint. Receiving a past trace can establish last-known alive status from that witnessed event; it cannot undo an already known death or reveal current hidden coordinates. Events share the existing64 cap. player.knowledge.traceCursor persists the highest eligible private trace record sequence, independent of witnessCursor, so restart and history eviction cannot reissue old traces. Previous knowledge without traceCursor remains valid and upgrades when trace records are processed. The spectator's cursor stays zero and its only allowed histories are body/muster; spectator knowledge cannot claim self/witness/vitals provenance.

Restore validation now requires a finite nonnegative state.updatedAt checkpoint and rejects every non-null roster knowledge at, event at or observedAt beyond it, including fractional overshoot. Equal-checkpoint values are accepted; timestamps are never clamped or rewritten. Fixed spectator state has exact allowed keys, exact Bridge x/y, no role/follow/radius/transit attributes or extra position dimensions. These checks validate persisted final state, not an orchestrator's intermediate mutation.

**Coordinator-time assumption:** observe/adoptVitals may legitimately run at the supplied now while state.updatedAt still names the previous checkpoint inside advance or applyInput. The coordinator must finish assigning updatedAt before validateSpatialState/store commit. Do not validate an intermediate state and do not advance clocks inside the world module to bypass this rule. Source inspection at cb00e33 confirms advance assigns updatedAt after chronological work and applyInput assigns it after knowledge refresh; real finalized vent/restart state passes. Normal creation and applyAction already have their current checkpoint. No coordinator change is made here.

Five new controls initially all failed on97b57d7, retained in _artifacts/beacon-world-traces-initial.txt. They now pass: recipient entry/exit separation with hidden-field sanitization; empty-list/spectator denial; original timestamps; defensive trace copies; malformed/future source rejection; bounded100-trace history; JSON/history-eviction dedup; old cursor compatibility; future row/event/observedAt restore rejection; exact spectator shape/provenance. Existing module fixtures now close an explicit updatedAt checkpoint when authoritative changes occur, matching root timing rather than weakening the new validator.

Real-engine composite: exact cb00e33 server/shared, overlaid with only the owned world files, in _artifacts/interop-cb00e33; hashes in interop-cb00e33-manifest.json. A new real vent test physically navigates entry witness, exit witness and saboteur, applies the actual systems vent action, ticks to its real deadline, verifies each local event/absence, and restores JSON without duplication. No hidden-state placement, invented timing or mock vent implementation in that interop case.

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:BEACON_WORLD_ENGINE_ROOT=(Join-Path (Get-Location) '_artifacts/interop-cb00e33')
Remove-Item Env:WORLD_ENGINE_GEOMETRY_MODULE -ErrorAction SilentlyContinue
node --test tests/beacon-world-traces.test.mjs tests/beacon-world-knowledge.test.mjs tests/beacon-world-engine.test.mjs
node --test --test-name-pattern='bounded generated steering' tests/beacon-world-geometry.test.mjs
node --check server/engine/world/knowledge.mjs
node --check server/engine/world/index.mjs
node --check tests/beacon-world-traces.test.mjs
git diff --check
~~~

Results:19/19 related/interop checks plus1/1 generated-motion checkpoint control,20 passed, zero failure/skip. Evidence: _artifacts/beacon-world-traces-focused.txt, beacon-world-traces-related.txt and beacon-world-traces-motion-checkpoint.txt. Original milestone/AI/death-knowledge evidence is preserved. This is bounded author verification, not independent approval; manager reviews/integrates. Only owned world/tests/document changed. No root/other-owner edits, Chrome, providers, installs, full repository suite, main/push/deployment.


## Independent investigation/systems/root audit ? exact6daa2d5

This section reviews other owners' investigation/systems implementations and actual root wiring. It is separate from Core's author checks above and does **not** independently approve Core's own world module.

Exact coordinator: **6daa2d50e4423c691475ae388c932b92df6c277a**. Investigation owner: **35fb1e9f322062dcdeb7695a3f7b936fd2df0219**; its directory tree d80a9e58d1069c9c7d834becb5529cb5edd3a1d7 is byte-identical at6daa2d5. Systems owner: **ce479d37966d16026d735c16db5880d032ebdb12**; its directory tree afcab724a2ab054bba28981eab8ecc5f68eb89d2 is byte-identical at6daa2d5. Actual diffs, module source and root deadline/projection/restore wiring were inspected read-only. No new concrete product failure was reproduced in this bounded review.

The qualification archive _artifacts/integration-review-6daa2d5 contains all30 server/shared files from raw committed Git blobs, with no overlays or runtime patches. SHA256/blob metadata is in integration-review-6daa2d5-manifest.json. Optional exact-pin test verifies all30 files. Tests default to current checkout source via ../; only BEACON_WORLD_INTEGRATION_REVIEW_ROOT selects an archive. Historical byte pinning is opt-in through BEACON_WORLD_INTEGRATION_REVIEW_PIN and does not freeze ordinary future-code regressions. This owner's foundation lacks the coordinator's schema3 orchestration, so its local run explicitly selects the archive; missing schema3 fails instead of silently skipping.

Fixture provenance: real createMatch/applyAction/applyInput/tick/getPlayerView, public devices/map and native modules. Deterministic fixture seeds select p6 as saboteur so roles are controllable to the external test oracle; no hidden state is attached to AI, clients or model prompts. All staged positions are reached by accepted authoritative navigate actions and elapsed server time. No teleport, fabricated winner, hand-edited hidden state, forged observation or mock device/system implementation is used. JSON round trips are exact state restoration. Shortened test rule values: device read1000ms, device cooldown1ms, auxiliary cooldown1ms, light/door durations1000/1001ms, comms1000ms, kill/initial kill/meeting/critical cooldown1ms, long roam600000ms and maximum900000ms. Tie fixtures explicitly calculate a10000ms boundary from public travel distance and supplied rule durations. These are labeled integration fixtures, not production timing or balance claims.

Independent controls (17 unique tests, all passed):

- Remote console access and extra client position fields reject; walking cannot start a read. Actual stationary proximity enables it. Same-ID retry and JSON restoration preserve the original read deadline. Other actor/spectator sessions and observations remain absent.
- Legitimate zero cleanup while stationary preserves a read. Real nonzero steering cancels immediately with movement reason; no sample appears at the former deadline. A fresh stationary read completes after its cooldown.
- A late engine tick settles a moving camera target at the read deadline before sampling: target x330 at the1000ms sample, x420 at the later final checkpoint. Sample timestamp remains the deadline, data is a defensive copy, and serialized/uninterrupted final states match.
- Active communications sabotage cancels the existing read immediately, rejects new reads and produces no delayed sample. Actual expiry restores matching enabled hints and successful access.
- Both camera light and door masking have a negative before-expiry control(duration1001) and exact-tie positive(duration1000) against a1000ms read. Systems expiry is processed before device sampling at a tie. Frames expose only permitted id/position fields to the owner, not roles or another owner's observations.
- A camera target behind the turbine is masked. A console viewer sees two remote living keepers on sampled footage, then a real remote elimination occurs. Footage is never promoted to witness/body events or death knowledge; the viewer keeps last-known alive/null current coordinates. No camera-created firsthand attribution appears.
- Actual owner vitals read changes remote death knowledge only for that reader. Another keeper and Bridge spectator retain last-known alive; no remote coordinates, roles, session or device observations leak. Sample rows contain only id/status and private device replay recipients remain the owner.
- A validated vent exit tied to camera completion is processed before sampling, so the frame sees the real exit position. It contains no hatch/route/role metadata, while the remote viewer's current roster position stays null and no physical hatch/witness event is invented.
- Roam, maximum and critical deadlines each precede a tied device read. They cancel the session without a fabricated sample. Roam enters discussion, maximum truthfully pauses with no winner/replay, and critical ends at its actual deadline with no device_observation record.
- Occupancy yields six bounded room counts totaling five living non-transit actors after an unseen remote death. There are no actor identities/positions in that sample, no camera-to-death promotion, and no observations for another actor or spectator.
- Actual reader death and validated vent entry cancel active sessions with dead/transit reasons. New requests reject PLAYER_DEAD/IN_TRANSIT. No sample is produced for the cancelled read.

Root source findings: ctx.nearby/sees are supplied to device validation and camera masking; device and systems deadlines are included in the same chronological loop. Critical, maximum and phase transitions precede systems/device work; systems expiry/transit precedes tied device work. Communications cancellation is refreshed after accepted actions. Canonical replay id/type/at are assigned after payload data. Store validation invokes systems/investigation/spatial validators on finalized checkpoint state. Safe system projections omit contributor identities. Those already-fixed boundaries were inspected, not reopened as hypothetical defects. Provider code is not entered by these engine-only tests.

Exact commands in this assigned D: checkout, after preparing the immutable archive:

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:BEACON_WORLD_INTEGRATION_REVIEW_ROOT=(Join-Path (Get-Location) '_artifacts/integration-review-6daa2d5')
$env:BEACON_WORLD_INTEGRATION_REVIEW_PIN='6daa2d50e4423c691475ae388c932b92df6c277a'
Remove-Item Env:WORLD_ENGINE_GEOMETRY_MODULE -ErrorAction SilentlyContinue
node --test tests/beacon-world-integration-review.test.mjs
node --test --test-name-pattern='occupancy is|actual death and' tests/beacon-world-integration-review.test.mjs
node --check tests/beacon-world-integration-review.test.mjs
git diff --check
~~~

Actual execution: initial15/15 passed in0.59s, evidence _artifacts/beacon-world-integration-review-initial.txt. After adding the final two controls, only those two were run:2/2 passed in0.28s, evidence beacon-world-integration-review-additional.txt. Thus17 distinct checks passed across two bounded invocations, no failures/skips; no repeated full suite. The full-file command above is the ordinary reproducible invocation of the final test file. No product assertion was weakened or fixture corrected to obtain these results.

Limits: real engine/module integration only; no HTTP identity/persistence process restart, browser/device UI, directional camera fixture, exhaustive roster/camera-cap/load coverage, paid/live provider or deployment qualification. Fixed radial fixtures, targeted seeded actors, supplied clocks and shortened rule values are the tested limits. Manager owns integration/browser qualification and another owner independently reviews Core's world implementation. Only the assigned review test/document changed; no runtime/other-worktree edits, installs, Chrome, push/main/deploy.


## Production-only schema3 qualification ? exact7272556

Exact coordinator source **7272556542b762e72a34450801fc762ba06d082c**. **19 checks passed on the first run**, no concrete blocker found. This independently exercises deployment/runtime boundaries; it is not a browser/full-match/live-model qualification or independent approval of Core's own spatial rules.

Fresh own ignored archive: _artifacts/beacon-production-7272556.tar, Git PAX commit comment verified, SHA256 **be5b485f447fbc3cecef7b9621bc1934de9bef399f7ab962d8fcf99cf8fbf70e**. Executable snapshot _artifacts/beacon-production-7272556 was materialized from all216 canonical raw Git blobs using ls-tree/cat-file --batch, checking their Git blob IDs before writing. Manifest beacon-production-7272556-manifest.json records every SHA256. All216 source hashes verify before and after execution. No runtime patch, overlay, source edit or other checkout dependency is involved.

Environment: Windows, Node24.20.0/npm11.19.0. Only production dependencies installed, offline, in that archive, with D: cache/temp. Exactly one package added: ws8.22.0. Installed package ledger contains only ws; require resolves within this archive. Puppeteer is absent on disk and cannot resolve. All60 server/public/shared files and local imports are present. Source-only package/Docker checks confirm actual main entry, systemsMode/worldMode defaults and recursive shipped groups. Docker is not executed. The new standalone tests/beacon-world-production-review.mjs is deliberately excluded from ordinary tests/*.test.mjs.

Runtime uses the actual server/main.mjs twice, NODE_ENV=production, real clock, unmodified loadConfig/createGameServer, demo provider and zero call/token/cost/daily budgets. A synthetic unused credential marker tests logging/boundaries; no live credentials or account environment are inherited. Outbound server global fetch is blocked/counted in an IPC wrapper before importing main. No engine/config/store/AI dependency is injected. Data is a newly created private fixture directory under this checkout's ignored _artifacts, never original or manager data.

Passed boundaries:

- Health readiness and isolated child-owned service.lock; normal-config human create/start produces worldVersion1 and beaconVersion1, persisted schema3, with no custom schema-enabling flag or clock override.
- All33 public/shared runtime assets served byte-for-byte against manifest, including public/features modules, shared/beacon.mjs and public/world/beacon.css. CSS/JS MIME, CSP and nosniff checked. Runtime source, package files, .env and private data paths return404.
- Actual cookie-authenticated HTTP and both owner/spectator WebSocket snapshots expose own role only, explicit unknown/alive/dead statuses, no private knowledge/request/replay/AI memory/recipient/contributor payloads. Spectator retains fixed Bridge view, null self, empty own notes/session/observations/acting hints. Descriptor field names match public action contracts. Only self-target field-note hints are enabled for the acting owner.
- Integer seq1 steering physically moves the human. Legitimate seq2 zero cleanup stops and persists. Foreign-origin and spectator input return403; unauthenticated room access401 and pre-end replay409.
- Real registered field-note action records one actual own location, absent from spectator/other audience. Note action's accepted request-ID receipt persists; no public field_note/device-private event appears.
- Real main's one registered SIGTERM handler is invoked through Windows IPC process.emit('SIGTERM'), then IPC disconnects. Both children exit naturally code0/signalnull within6s; first closes both authenticated WebSockets. service.lock and recovery claim disappear. No forced stop is used.
- A second real main on the same DATA_DIR acquires a fresh lock token and restores the original human cookie/seat/role, exact stopped position/inputSeq2 and exact private note. Both duplicate inputseq2 and original note action ID stay inert after restart. Original spectator cookie remains isolated. No quarantine or temporary write residue.
- All216 source blobs remain unchanged. Zero outbound provider fetch attempts, zero socket privacy errors, zero forced stops. Synthetic credential marker appears in neither HTTP/WS bodies nor child logs.

The harness is bounded to at most two owned child mains,6s startup,6s graceful shutdown,4s HTTP/WS operations and a fresh per-run artifact DATA_DIR. First successful PIDs1348/12708 and exit receipts are recorded only in ignored evidence. End-to-end harness timing3233ms. No full match or unit suite is repeated.

Exact preparation used git archive at the full pin and canonical raw blob extraction/manifest verification inside this assigned D: checkout. Install command's cwd was _artifacts/beacon-production-7272556:

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --offline --cache D:/Widegames-work/npm-cache
~~~

Then, from D:/Widegames-work/beacon-world-builder-20261029:

~~~powershell
$env:BEACON_PRODUCTION_REVIEW_ROOT=(Join-Path (Get-Location) '_artifacts/beacon-production-7272556')
node --check tests/beacon-world-production-review.mjs
node tests/beacon-world-production-review.mjs
git diff --check
~~~

Evidence: _artifacts/beacon-production-7272556-install.txt, beacon-production-7272556-run.txt, beacon-production-7272556-result.json, raw source manifest and tar archive. Private persisted fixture is _artifacts/beacon-production-private-EEGBw7. No initial failing run or relaxed assertion was needed.

Limits: real loopback Windows process/HTTP/WS/file restart, not Docker/Linux/hosted deployment, OS-delivered POSIX signal, Windows ACL or power-loss verification. This proves startup/default schema/projection/assets/receipts and normal graceful restart, not complete matches, browser rendering/input, exhaustive hint authorization or live original model adapter/provider behavior. Chrome, Docker, paid/live providers, npm updates, runtime edits, other worktrees/data, main/push/deployment were not used. Only the assigned standalone harness and this document changed.


## Exact-source production refresh: afc6b1a

Reviewed **afc6b1a94d201a943e84b955fcb492fc2ed031bc** against prior production-qualified **7272556542b762e72a34450801fc762ba06d082c**. The prior receipt above, commit0b2b4905dd89db2041d212908548d9b182e0c0b5, and all prior727 archive/results remain preserved. **The same19 production checks passed on the first new run**, with no fixture corrections or relaxed assertions. No production blocker found within these boundaries.

Exact scoped Git diff (server/shared/public/package.json/package-lock.json) contains only two paths:

- server/ai/world.mjs: saboteur elimination selection uses an enabled authoritative eliminate descriptor and proposal(target), replacing proximity-only target selection. No imports changed. This bounded production run does not independently exercise the multi-saboteur match fix or repeat the other reviewer's match tests.
- package.json: adds test:beacon-browser = node scripts/beacon-browser-check.mjs; start, ordinary tests, dependencies and existing browser script are unchanged. No browser script was run.

All60 deployed server/public/shared paths are unchanged; all124 parsed static/dynamic import edges are identical. All33 public/shared asset blobs are byte-identical. package-lock.json is identical (Git blob a230e19bd29173704b38878cf3719ab9f756fc95); dependency declarations are unchanged. Other changes in the complete Git diff are workflow, docs, browser-check scripts and tests; no other deployed source change. Compared with727, all-source file count increases216 to220. Thus the prior production graph/assets conclusions remain applicable, with the real runtime boundary checks freshly repeated on the new exact source rather than inferred solely from the diff.

Fresh ignored evidence prefix: _artifacts/beacon-production-afc6b1a. Tar Git PAX comment verifies the full commit; tar SHA256 **a4f542e96246c12fcdb7532859bbed65ba576bbe7f449c11e95902875b8afede**. Executable snapshot contains all220 canonical raw Git blobs, verified by Git blob ID while extracting and SHA256 manifest before/after execution. No overlays or source mutation. source-comparison.json records path/import/asset equality and lock blob. Separate manifest/install/run/result files retain this execution. The owned standalone harness changed only pin, artifact/output names and source count; every behavioral assertion remains unchanged. Ordinary *.test.mjs discovery is unaffected.

Offline production-only install added exactly ws8.22.0 in the archive. Puppeteer is physically absent and unresolvable. Real production main ran twice with demo provider, zero budgets, real time, isolated fixture DATA_DIR, synthetic unused credential marker and outbound fetch block/counter. All33 assets were fetched byte-exact, including public/features and world/beacon.css. Actual default human create/start exposed worldVersion1/beaconVersion1 and private persisted schema3. Authenticated HTTP/owner+spectator WS safe views, private-path404, origin/auth restrictions, legitimate seq1/seq2 stop, private note, request-ID dedup, graceful socket shutdown and same-DATA_DIR restart all passed. Original seat/role/input position/note and note receipt survived restart. Both lock/recovery claims were released; second main acquired a fresh token.

Actual child PIDs2732/21584 exited naturally code0/signalnull. **0 provider fetch attempts,0 socket privacy errors,0 forced stops**. Harness elapsed2774ms; at most two children,6s startup/stop and4s HTTP/WS bounds unchanged. Private fixture: D:/Widegames-work/beacon-world-builder-20261029/_artifacts/beacon-production-private-JhJDtS. All220 source blobs remained unchanged after execution.

Exact commands (archive install cwd _artifacts/beacon-production-afc6b1a; harness cwd assigned D: checkout):

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --offline --cache D:/Widegames-work/npm-cache
$env:BEACON_PRODUCTION_REVIEW_ROOT=(Join-Path (Get-Location) '_artifacts/beacon-production-afc6b1a')
node --check tests/beacon-world-production-review.mjs
node tests/beacon-world-production-review.mjs
git diff 7272556542b762e72a34450801fc762ba06d082c afc6b1a94d201a943e84b955fcb492fc2ed031bc -- server shared public package.json package-lock.json
git diff --check
~~~

Limits remain those of the727 receipt: loopback Windows HTTP/WS and normal file restart, not browser/Docker/Linux/hosted deployment, power-loss/ACL, full matches, exhaustive hint/rule coverage or original live model adapter/external provider qualification. Windows IPC invoked the actual registered SIGTERM handler; no OS-delivered POSIX signal claim. No Chrome, full suite/match repeats, paid calls, runtime edits, other worktree/data edits, main/push/deploy. This refresh changes only the owned standalone harness and this document.
