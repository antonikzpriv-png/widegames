# Beacon investigation implementation

Implementation assignment, Builder3: only server/engine/investigation/**, tests/beacon-investigation*.test.mjs and this document. Base a431e5e80fad153d9aab892a1e9e727ef11fc5a3, derived from main90bb6e881f75f77e85b8b49729971a710b4c91b4. This implementation needs manager/Core independent review; author tests are not independent approval. No root/schema/transport/client or other owner's files were edited.

## Baseline API and engine integration

Named exports preserve the executable baseline: INVESTIGATION_ACTIONS, initializeInvestigation(state,now), investigationDeadline(state), advanceInvestigation(state,at,ctx), onInvestigationPhaseChange(state,phase,at,ctx), validateInvestigationAction(state,p,action,now,ctx), applyInvestigationAction with the same arguments, investigationActionHints, getInvestigationView(state,viewerId,now,ctx), validateInvestigationState(state). No factory registration, providers, async work, clocks, random IDs or process-global match memory is added. initialize returns changed boolean and validates/preserves existing state instead of resetting restored observations. Apply and advance mutate only investigation fields on the engine-cloned state; context.record owns private replay writes. The coordinator retains envelope IDs, accepted/denied action receipts, authoritative time, cloning and persistence. Invalid direct apply returns false; validation returns {code,message} or null.

State: {version:1,sessions:{actorId:session},observations:{actorId:[sample]},cooldowns:{actorId:at}}. Dictionaries contain only current roster actors. Sessions have deviceId, startedAt, deadlineAt, anchor, status(reading/elapsed/failed), endedAt and fixed reason. No six-character or p1 assumption; maximum64 actors, at most64 observations per actor (configured lower limits apply), maximum6 visible living keepers per camera and at most8 shared cameras. All views/snapshots are JSON serializable and defensive copies; safe dictionary writes preserve unusual actual roster IDs through JSON/structuredClone. Stored observations are append-only values, not live references to actor state; bounded retention removes oldest complete values, never rewrites their content.

Required integration ordering:

1. Initialize only for new schema3 systems matches. Keep schema1/2 dispatch unchanged; do not initialize over old observations.
2. Include investigationDeadline in the engine's chronological deadline minimum. Settle authoritative world movement only to that time, then advance the read. It returns Infinity when no reading is active. A saved overdue session wakes at the saved updatedAt checkpoint, not a fictitious past time.
3. Call advanceInvestigation after every accepted movement/input/system/death mutation, not only at read completion. This cancels movement intent/changed position, out-of-range/LOS loss, death, transit or communications immediately. Call onInvestigationPhaseChange on leaving roam (including ended/paused). Device cancellation is not a witness/public event.
4. Only exact-deadline completion samples data. A late call without reconstructing its deadline snapshot fails with reason stale, rather than labeling current positions/health as past telemetry. Validate state after the coordinator updates updatedAt; newly produced observation timestamps must not exceed that checkpoint.
5. ValidateInvestigationState participates in root schema persistence/restore validation. Preserve sessions, private observation histories and cooldowns. Root must not attach these private maps to public views. Root may adopt only the owner's vitals sample into that owner's knowledge; this module never mutates global death discovery.

Context requirements: ctx.nearby(state,player,point,range?) and ctx.sees(state,observer,point) are synchronous, side-effect-free authority checks, using dynamic doors/lights/geometry. The nearby call uses the default interaction radius92 and sees is checked separately. For camera LOS, sees must honor the supplied observer.position (the camera point), rather than silently substituting the player's console position; observer.id remains the owner so world policy can select its observer profile. The module independently caps camera distance to shared normal/lights vision, so saboteur profile bonuses cannot enlarge camera coverage. ctx.geometry.worldRoomAt supplies actual physical occupancy; never use a corridor actor's stale roomId. ctx.record(state,type,at,data) is required, synchronous and private; ctx.publicEvent is never called. No mutation of other module fields is needed.

## Terminal behavior and privacy

Actions: investigate{deviceId} and deviceCancel{}. Only an existing living actor in roam can begin. It must be stationary, not in transit, in range and able to see the known console. Communications failure denies starting with COMMUNICATIONS_DOWN. Read duration and global per-actor cooldown use shared beaconRules/device defaults:2000ms and5000ms. Cooldown starts at completion/cancellation; cancelling cannot evade it. Starting while another read is active rejects. Actions and hints share the same side-effect-free validator. Root remains responsible for strict outer IDs and actor authentication.

All three positions/kinds/labels come from shared/beacon.mjs; there are no copied device coordinates in runtime. Cameras currently have only public points, not directional fixture fields. This milestone therefore uses radial normal/lights vision from shared defaults/rules (360/110), never omniscience; optional shared camera radius/facingRad/fovRad may narrow that field. A camera contract clarification was requested early; no shared file was edited or nonexistent directional coverage claimed. Cameras sample bounded living, non-transit keepers passing camera range/FOV and ctx.sees. Per-row output is id+position only. No role, route, destination, input, tasks, cause of death, attack event or dead-body record is sampled. A remote camera observation is never an attack eyewitness.

Occupancy samples {roomId,count} for living non-transit keepers physically inside each public room. Corridors, bodies and hidden hatch transit are excluded; no identities accompany counts. Vitals samples {id,status:alive/dead} for the roster, including living actors in transit, without reading their roles, positions or routes. It does not alter global knowledge. These are point-in-time observations at the authoritative read deadline, not continuously updating live consoles.

Observation shape: {id,deviceId,kind,at,data}; cameras data.frames[{cameraId,limited,players:[{id,position}]}], occupancy data.rooms[{roomId,count}], vitals data.players[{id,status}]. IDs are deterministic per actor/device/time. All activity is recorded as private device_session/device_observation with explicit visibleTo:[ownerId], never publicEvent or witness. Coordinator exposes the fully attributed replay only after actual end under its existing policy.

getInvestigationView returns public device fixtures/own enabled reasons, only that viewer's sanitized session (no anchor) and defensive observation history. Spectators/unknown IDs receive no session/history/cooldown. Completed samples remain dated and unchanged after actors move/die, lights/comms change or the game restarts. Communications sets status unavailable and truthful disabled reasons; it retains old dated samples instead of inventing a successful empty read. Reading that has become invalid but has not yet been advanced is projected stale. Completed/failed/cooldown states are explicit. Getters validate private observation shape before exporting it, and strict restore validation rejects hidden-field additions.

## Initial author qualification

```
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
node --test tests/beacon-investigation-module.test.mjs
node --check server/engine/investigation/index.mjs
node --check server/engine/investigation/data.mjs
```

19 tests passed, zero failed/skipped. Real shared static geometry plus a labeled dynamic-door/visibility fixture isolates ctx delegation. It does not yet qualify the other builder's authoritative world LOS or root schema3 scheduling. Tests cover pure strict validation/hints, canonical player authority, exact read boundary, limited cameras/lights/door occlusion, immutable private dated samples, no camera witness, occupancy/vitals hidden-field safety, movement/phase/death/transit/comms/LOS cancellation, cooldowns, stale reads, actor/spectator isolation, bounded history, strict malformed restore and JSON round trip. Initial two round-trip comparisons exposed null-prototype dictionary differences; switched to normal serializable maps with explicit safe own-property writes, preserving prototype safety after engine cloning. The final19-check run passes. No failed product assertion was skipped.

Pending integration qualification: exact committed Core/Systems/manager modules, actual schema3 engine deadlines/actions/restore, camera-context agreement and shared camera fixture clarification. Group2 NEXT_FEATURE_INTERFACES was absent in this foundation, found/read in the coordinator's later committed tree; no group2 feature implementation was added. No Chrome, paid/live provider, full unrelated suite, push/main/merge/deployment or OS durability claim.

## Follow-up author integration qualification

Early milestone **35fb1e9f322062dcdeb7695a3f7b936fd2df0219** was integrated by the coordinator as a663a8b. Follow-up adds strict shared-fixture validation, plausible static camera coordinates on restore, exact configured read-duration/cooldown integrity, and bounded-camera/prototype-key cases; no other owner's runtime is changed. All established wire/session/observation fields retain the milestone shape.

**32 tests passed, zero failed/skipped:**22 module controls and10 actual engine integration controls. These are author checks of this implementation, not independent approval. Exact tested coordinator dependencies: **58bdd512983363d1a8801b39bb34d3d4d4891b33**, including its committed full spatial knowledge and Systems implementation. Earlier seven/ten-engine checks used cb00e33f25bf9ba561743818a5dc8f562fac6fb8; the final32-check run uses58bdd51 and explicitly confirms owner-only vitals knowledge adoption. No uncommitted world/system dependency is claimed as qualified.

An ignored qualification copy `_artifacts/beacon-investigation-engine-58bdd51` was built using `git show 58bdd51:<path>` for every server/shared file, replacing only server/engine/investigation/** with this owned follow-up. Actual authoritative createMatch(world:true,systems:true), applyAction, applyInput, tick and getPlayerView execute in that copy. This is an explicitly pinned composite author fixture, not a new Git worktree or another owner's file edit. Actual seeded roles are inspected only by test staging; no AI/client receives full state. Tests use accepted navigation/actions and original engine world geometry, not teleports or invented winners. Only terminal duration/cooldown and several equipment initial cooldowns are shortened in the fixture.

```
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:BEACON_INVESTIGATION_ENGINE_ROOT=(Join-Path (Get-Location) '_artifacts/beacon-investigation-engine-58bdd51')
node --test tests/beacon-investigation-module.test.mjs tests/beacon-investigation-engine.test.mjs
node --check server/engine/investigation/index.mjs
node --check server/engine/investigation/data.mjs
git diff --check
```

Final combined result32/32, zero skipped, Node exit0. Log `_artifacts/beacon-investigation-58bdd51-author-checks.txt`, SHA256 `BA41CED56FD1A8FF1BB23B769128128AAE4A4A3227EF7DE67954630A209EAC80`.

Actual engine boundaries exercised:

- A late tick samples at the original exact scheduled deadline rather than its later receipt time. Repeated accepted request ID does not restart a read or duplicate its observation. Mid-read JSON engine-state restoration completes once, preserves dates and passes the current module validator.
- Shared world LOS actually originates at each camera. Normal/archive corridor sightings are present; real lights sabotage and a real closed west-upper door suppress the distant sighting. Other actors' role/tasks/motion do not enter samples. Six-per-camera bounds are also tested with a larger unit roster.
- Real communications sabotage cancels an in-progress read immediately, with unavailable status and no fake successful empty data. Real radio repair plus expired actor cooldown enables a subsequent read.
- Real steering, emergency discussion, reader death and private hatch entry cancel reading. A keeper within reach of both the Archive console and hatch can enter a real linked vent; its own read fails transit and another keeper's occupancy read excludes the underground actor despite its retained roomId.
- Real remote elimination in Engine is discovered by a Galley vitals reader after its timed sample. Only the entitled reader adopts dead status from that sample; spectator projection is unchanged and other investigation histories stay empty. Positions/roles are absent from vitals payload.
- Reading the later camera frame containing the real killer produces no attack-eyewitness evidence and no dead-body row. Private device records carry only explicit owner visibleTo. Live getReplay stays null; module records never enter the public timeline. Ended replay guarding remains the coordinator's engine responsibility.

Tests default to the current checkout's actual engine; BEACON_INVESTIGATION_ENGINE_ROOT is an explicit qualification override. Missing schema3 support fails clearly rather than skipping or counting a schema1/2 fixture as success. Default loading was separately exercised by copying the two owned tests into the ignored qualification layout, removing the override and running:

```
Remove-Item Env:BEACON_INVESTIGATION_ENGINE_ROOT -ErrorAction SilentlyContinue
node --test _artifacts/beacon-investigation-engine-58bdd51/tests/beacon-investigation*.test.mjs
```

Default result32/32 pass, zero skips. Log `_artifacts/beacon-investigation-default-author-checks.txt`, SHA256 `E3380165CD621AD90664CF3F616E6C60AB54A9911CF49689C1BC20BC44DAC441`.

The dependency snapshot still defines radial cameras via shared points and normal/lights vision defaults; no directional shared fixture was invented or copied into an owner file. Optional facingRad/fovRad/radius narrowing is implemented and validated when the coordinator supplies those public fields. The earlier requested camera-context agreement is confirmed by the real engine tests. Root's programmatic beacon-rule validator currently permits observationLimit up to128; this module intentionally enforces the group1 contract's maximum64, so root should align its accepted setting. The default64 works. Shared camera field clarification and root setting alignment remain coordinator-owned decisions, not permission to edit shared/root here.

No full unrelated suite, HTTP/OS persistence durability, browser/Chrome, provider, push/main/deploy or independent approval is claimed. Restoration here is actual JSON engine state, not a simulated filesystem crash. Additional independent audit of another builder waits for explicit assignment; this module itself still requires manager/Core independent review.
