# Tactical investigation implementation

Assigned source:265804446e37b8847d43b31875cf9f6ea3c81c33, branch codex/tactical-investigation-20261029. Only server/engine/investigation/**, tests/tactical-investigation*.test.mjs and this document are owned. These are author checks, not independent approval. Core/manager review remains required.

## First milestone: immutable map adapter and provenance

Existing module signatures and investigation.version1 are preserved. Device/camera fixtures, room identities, map dimensions and static walkability now come from getMap(state.map). Existing schema3 with absent map resolves the original Beacon; its sample IDs, session/frame/observation fields and private replay shapes remain unchanged. Tactical schema4 requires tacticalVersion1 and exact persisted map identity. Unknown map/version fails, never silently substitutes Beacon. No global current-map value or mutable fixture copy is used.

New schema4 sample fields are map:{id,version} and provenance:{type:'device',ownerId}. Existing id/deviceId/kind/at/data remain: deviceId identifies the actual source and at is the authoritative completion time. The owner-bound ID format remains obs:<owner>:<device>:<at> for compatibility with Core vitals adoption. These are actual typed device observations; no say claim, attacker attribution or decoy is synthesized. Schema4 sessions and private device records also carry map identity. Private records retain visibleTo:[owner]. No publicEvent or spectator omniscience is added.

Schema4 camera frames additionally contain field:{origin:{x,y},radius,facingRad,fovRad}, derived solely from their packaged camera and actual normal/lights radius at sampling. They retain cameraId/limited/players; at most six living visible nontransit actors per frame, at most eight public camera fixtures. Each actor row has only id and sampled position. Dynamic LOS comes from ctx.sees at the camera origin. Camera role never grants saboteur bonus. Restore validates exact map/source/owner, canonical field origin/FOV/radius and every sampled position inside that field and selected map. It does not re-test historical samples against present doors/lights/deaths: old frames remain historical data, never live tracking.

Occupancy enumerates every room in selected map.roomLayout and classifies positions using its canonical geometry.worldRoomAt, ignoring stale player.roomId. Corridors, dead actors and secret transit are excluded; no identities or roles are present. Vitals reads only roster id/alive values and returns statuses without roles/routes/positions or attack claims. No fixed roster/six-room/Bridge helper is used by investigation.

Start requires canonical actor, stationary point contact and ctx.nearby/ctx.sees. Deadline and read-only view/action checks revalidate anchor, motion/path, death, phase, transit, communications and dynamic access. Invalidating a read produces no sample. A late call fails stale rather than assigning old time to present telemetry. Root must keep its existing chronological deadline integration and advance after accepted movement/system/death changes. Pure view/validation never mutates state; mutation hooks cancel reads and charge cooldown on the engine clone. Communications reports unavailable and retains earlier dated samples. Histories remain bounded64 and owner-only, with defensive exported copies and strict JSON restore validation.

Integration requests: coordinator should preserve the schema4 map/provenance fields in evidence projections; frontend should label samples historical and draw the recorded field/entities, not the live global roster. Root selects ctx.geometry and ctx.nearby/sees from the same immutable map before initialization. No shared/root/AI/UI files are edited here. Sample map/provenance and camera field are additive only in schema4; old schema3 records do not require migration.

## First milestone checks and limits

Node24.20.0. TEMP/TMP D:/Widegames-work/temp, npm cache D:/Widegames-work/npm-cache. New tests import the current checkout by default; optional TACTICAL_INVESTIGATION_ROOT selects an explicit source layout. Every packaged MAP_CATALOG entry runs the same substantive map tests. At this milestone only Beacon is committed in the assigned registry; Annex is not falsely claimed tested or replaced with a synthetic six-room map. Author fixtures have12 custom IDs and inject authoritative positions solely for module boundary tests; ctx delegates real Core LOS. They are not played matches.

Commands: node --test tests/tactical-investigation-map.test.mjs; node --test tests/beacon-investigation-module.test.mjs tests/beacon-investigation-engine.test.mjs; node --check for both owned runtime files; git diff --check. Legacy32/32 passed. New checks cover provenance, camera bounds, privacy, anonymous actual-room occupancy, vitals forbidden-property getters, malformed restore, exact deadlines/restart, pure stale views/actions, movement/death/phase/transit/comms/LOS cancellation and legacy record compatibility.

Preparation errors are not product claims: an initial Python locale read converted the existing data.mjs UTF8 BOM into invalid text; syntax caught it before any test ran, and explicit UTF8 normalization fixed it. First tactical run15/16: a test incorrectly required a communications error string from an already-dead actor; dead access denial is also correct. The assertion was split to verify explicit communications unavailability while living and denied access after death. No test is skipped or defect hidden.

Annex fixture and actual schema4 engine integration remain pending the other owners' committed source; a subsequent receipt will pin/test them. No Chrome/provider calls/main/push/deploy, broad unrelated suite, other-worktree edits or independent approval is claimed.

## Committed Annex fixture qualification

Core map source **19e4bf6b0027590df3ea2245a164d5174aabb603**, combined only with investigation source **2119e021cd31dc9aad7d1727101af8c2b49a7466**, in ignored _artifacts/tactical-investigation-annex-19e4bf6. All server/shared files came from that committed Core tree; only the two investigation files were overlaid from the exact owned milestone. The source-manifest records both pins and SHA256 for every file. This is an explicit author composite, not claimed manager integration or independent Core approval. Manifest SHA256 **BC90C09BEAD376153B1516C577A72BBC882E702408B4027704F833233A446BF6**.

Both real packaged maps now run35/35 module checks, zero failure/skip. Annex occupancy explicitly returns its eight actual room IDs; living room occupants are counted anonymously while dead/transit/corridor actors are excluded. Added controls interleave Beacon/Annex reads with the same owner ID, compare map-derived console hints and all room IDs, and reject cross-map sample transplantation in both restore validation and safe view. Historical light-radius fields remain unchanged after lighting restoration. Each owner can retain exactly64 observations: read66 evicts only the first two dates, preserves the remaining source/map/owner metadata through JSON restart, and never shares history with another actor. Restore also rejects a sampled position that is walkable elsewhere on the selected map but outside the camera's recorded field.

Actual commands:

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:TACTICAL_INVESTIGATION_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-investigation-annex-19e4bf6')
node --test tests/tactical-investigation-map.test.mjs
Remove-Item Env:TACTICAL_INVESTIGATION_ROOT
node --test _artifacts/tactical-investigation-annex-19e4bf6/tests/tactical-investigation-map.test.mjs
```

For the second command, the owned test was copied unchanged into the ignored composite's tests directory to verify default relative source imports. Both invocations pass35/35 with zero skipped/todo/cancelled. Explicit-root evidence _artifacts/tactical-investigation-annex-bounds.txt SHA256 **51F3224A284B22CEE81055FD7F305F4462BF829C15BD70DF38D75BAC6AF5556B**. Default-import evidence _artifacts/tactical-investigation-annex-default.txt SHA256 **33FF084D10432050C23CAD2DAE8382C127E2DA50002C7570104C80D4078E3ECC**. First current-checkout milestone result48/48 (16 tactical Beacon +32 legacy) is preserved in _artifacts/tactical-investigation-milestone.txt SHA256 **7ADA86AFF243D1AF9ABEFC3A23AD949503600B0F436B1DFFB7BCC15192A19604**.

Manager integration gap reported promptly: server/features/strategy/index.mjs deviceFacts still truncates occupancy to six rooms; Annex's eight-room sample requires a map-aware bound there, along with preserving the new source/map/provenance metadata. That is coordinator/Group2 ownership and is not edited here. Prepared real schema4 engine tests require a committed coordinator runtime; current uncommitted candidate is not qualified as a final source. Module tests use actual map geometry and real Core LOS delegation, but this composite's Core spatial wrapper predates its forthcoming map-aware dynamic-door update; Annex dynamic-door physics is not claimed qualified by these module checks.

## Actual schema4 engine author qualification

Exact committed-source composite (all dependencies read-only): coordinator **58497fe0415d9c0654f4f9dc3debeab8ac03cd40** server/shared; Core **6f61f58e0ef8a1d30131b275fdcf7796dd2af37c** shared/maps/** and server/engine/world/**; Systems **b99d5327cdc5d45f2df907c45cabbd8b52e92c66** server/engine/systems/**; owned investigation **2119e021cd31dc9aad7d1727101af8c2b49a7466** server/engine/investigation/**. This is an explicit author qualification composite, not an invented single integrated commit. Files were extracted with git show exact-pin:path; no uncommitted candidate files were used. Ignored layout _artifacts/tactical-investigation-engine-58497fe, source-manifest.json SHA256 **EF176A5A7015620C75E9BEBD2B9FA1E554F93A8264EC70182FE5718F76FB0343** lists every final file's owning source pin/blob/SHA256.

New tests/tactical-investigation-engine.test.mjs uses actual createMatch({tactical:true,map:{id,version}}),12 custom keepers and real navigation/actions/input/ticks. Fixture clocks are accelerated only for100ms device reads/50ms cooldown and selected ordinary cooldowns. It asserts actual schema4 rather than silently skipping or treating legacy schema3 as success. The harness reads private role/path information only to stage actors and compute travel time, never feeds it to a client/AI and never edits player positions or manufactures outcomes.

All45 scoped tests pass (35 map/module +10 real engine), zero failure/skip/todo/cancelled. For both Beacon and Annex:

- A real stationary camera read restores at its50ms midpoint, then a late tick completes once at original100ms deadline, with exact map/provenance/frame field. A retained action ID repeats without another sample. Other actors/spectator get no session/history; replay remains locked and all device records carry only owner visibleTo.
- Actual movement input cancels the read. A stopped actor can start a later real occupancy read; its rows exactly equal selected map rooms, explicitly eight on Annex.
- Actual communications sabotage cancels immediately with truthful unavailable device reasons; a later deadline creates no fake successful empty telemetry.
- A real remote elimination followed by camera access shows the living attacker at the sampled camera but excludes the dead victim and creates no retrospective witness event/attacker field.
- A real remote elimination followed by a vitals read updates only the reader's learned death status. Another remote keeper and fixed spectator retain their earlier knowledge, no remote coordinates appear, and JSON restart preserves the private dated sample. No attacker witness is manufactured.

```powershell
Remove-Item Env:WORLD_ENGINE_GEOMETRY_MODULE -ErrorAction SilentlyContinue
$env:TACTICAL_INVESTIGATION_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-investigation-engine-58497fe')
node --test tests/tactical-investigation-map.test.mjs tests/tactical-investigation-engine.test.mjs
Remove-Item Env:TACTICAL_INVESTIGATION_ROOT
node --test _artifacts/tactical-investigation-engine-58497fe/tests/tactical-investigation-map.test.mjs _artifacts/tactical-investigation-engine-58497fe/tests/tactical-investigation-engine.test.mjs
```

Second invocation copies the two owned tests unchanged into the ignored committed-source layout, proving default relative imports exercise its actual runtime. Both45/45 and exit0. Explicit-root log _artifacts/tactical-investigation-engine-initial.txt SHA256 **9638C1CA275F9C76EC947633057D4157D84CE9C3F9CB88A827BBB2DC96F0026D**; default log _artifacts/tactical-investigation-engine-default.txt SHA256 **B0397E3F779ACAB9E02F3A69CC6592FD3BE2951DB5BBFA096DB18D374E589E75**. Syntax checks for both runtime files and both tactical tests plus git diff --check pass. The assigned tracked foundation still has the older engine until manager integration; default new engine tests correctly require schema4 there instead of skipping. Manager must integrate the root/Core/Systems dependencies before its ordinary suite.

Implementation is ready for manager/Core independent review. This worker's investigation implementation is never self-approved. No Chrome, full repository suite, HTTP durability, paid/live model, broad match ensemble, main/push/deployment or another worktree mutation is claimed. The requested independent review of another owner follows separately, within the owned test/doc namespace.

## Separate independent Systems/Core follow-up

After completing the authored investigation milestone and real-engine checks, performed the requested independent other-owner review. Owned tests/tactical-investigation-review-systems.test.mjs adds six new controls (three on each actual map). Source remains the exact documented composite: Systems **b99d5327cdc5d45f2df907c45cabbd8b52e92c66**, Core **6f61f58e0ef8a1d30131b275fdcf7796dd2af37c**, coordinator **58497fe0415d9c0654f4f9dc3debeab8ac03cd40**. No other owner's file was edited, and investigation approval is excluded.

Inspected actual system action validation/hints, faction reservation restoration, pending/jammed/closed door transitions, threshold contact, public projection and Core movement segment collision. Exact reviewed blobs:

| Source | Git blob |
| --- | --- |
| server/engine/systems/index.mjs | f55cd4dbcacded735617b830cc83780e81fd1ce9 |
| server/engine/systems/model.mjs | c12bec383a414ac362a9872562b074d0db70d2f0 |
| server/engine/systems/tactical-doors.mjs | e42ea29f0ec9a4aed688344e16a5ce55826aaa06 |
| server/engine/world/geometry.mjs | b74139683158cb29f417114041be79580ec692d6 |
| server/engine/world/motion.mjs | 95ad5c02e8f986af1a3bae7dfd4567116dc98046 |

New independent controls, all6/6 passing with zero failure/skip/todo/cancelled:

1. Twelve custom keepers/two saboteurs: one accepted lights sabotage reserves the faction cooldown. JSON restart does not allow the other saboteur to immediately disrupt communications; exact cooldown boundary allows it. Both saboteurs see the same charged auxiliary deadline, crew gets only its personal passage cooldown, spectator gets none. Lowering a retained active-effect reservation to zero is rejected by the actual validator.
2. Labeled authoritative hidden-position counterfactual: identical clocks/permissions, but one hidden crew member occupies the future door threshold. Actual system action hints are identical before warning. Both actual actions create the same1s pending grace; at closure, the occupied case jams open without displacing/naming the keeper and the empty case closes. Public system records contain no playerId/occupantId/position/visibleTo, and the remote saboteur sees no hidden keeper coordinates. A JSON-restored jam reopens at its scheduled expiry without moving the occupant. Public jam status itself is intended operational information, not asserted absent.
3. Labeled Core starting-position boundary fixture followed entirely by real engine actions/ticks: accept a finite route crossing a currently open doorway, issue warning, close after1s before arrival, then advance movement. The actor stops outside the collider with route cleared rather than tunneling through the newly closed door. At expiry a fresh accepted route reaches the original target. No fabricated arrival, teleport or forced outcome is used.

The position counterfactuals are isolated authoritative fixtures, not claims of reaching those initial coordinates through played routes. Subsequent permissions/warnings/closures/movement/expiry use the actual engine. These cases are novel boundary checks, not a rerun of the other owner's full suite. No concrete Systems/Core defect surfaced in this bounded scope; this does not approve all door combinations, critical repairs, passage abuse, browser lifecycle or hosted deployment.

```powershell
$env:TACTICAL_INVESTIGATION_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-investigation-engine-58497fe')
node --test tests/tactical-investigation-review-systems.test.mjs
Remove-Item Env:TACTICAL_INVESTIGATION_ROOT
node --test _artifacts/tactical-investigation-engine-58497fe/tests/tactical-investigation-review-systems.test.mjs
node --check tests/tactical-investigation-review-systems.test.mjs
git diff --check
```

Both source-selection modes yield6/6 and exit0. Evidence _artifacts/tactical-investigation-independent-initial.txt SHA256 **C1A380AFB45B9C8B5A151CD7414BC6FBE213C68DF054A359CE9FFC4D3D1FC78D**, and _artifacts/tactical-investigation-independent-default.txt SHA256 **44306BB6EEB66DF06F2E0FF3FF214C4330DE87F145DDE052177D4DBAACCEC6B5**. Authored investigation45/45 remains a separate qualification, not independent self-approval. Manager owns integration/browser/full-suite qualification. No additional feature work is introduced by this audit.

## Independent coordinator integration audit: exact dfdcea4

Reviewed actual manager integration **dfdcea4348711986e430eeab0c17bb4112936b0e**, with historical control **3c064af50043435f17b35b112cc62b6c9e1f50d6**. Own changes only tests/tactical-coordinator-review-ai.test.mjs, tests/tactical-coordinator-review-http.test.mjs and this appended receipt. No runtime/root/other-owner edits. Result: **14 new boundary cases,14 passed, zero failure/skip/todo/cancelled** at the fixed source. No remaining concrete coordinator defect surfaced in the tested scope; this is bounded acceptance, not approval of all game/browser/deployment behavior or this worker's authored investigation module.

### Historical actual eyewitness failure and exact fix

A new eight-custom-keeper Annex fixture (seed independent-eyewitness, explicit offline clock) uses accepted navigation to position a crew witness and saboteur next to another crew member, then actual eliminate and report actions. No position, replay, role or outcome is forged. The harness reads roles only to stage actors; actual AI observe/candidates/makeRequest receives the real owner's safe view. The engine supplies a witness event in room muster at2645 and transitions to discussion after the lawful report.

At **3c064af50043435f17b35b112cc62b6c9e1f50d6**, the exact same positive test fails: observe leaves the actual attacker's memory.witnesses entry undefined. This is the real legacy rooms.has gate defect, not an expected-red wrapper or skipped assertion. Preserved _artifacts/tactical-coordinator-eyewitness-old-red.txt SHA256 **46B086C04EB2CF8474F042B2300AC6F7BD5669FA25A83CB93D6FCF62E08B42BB**; one selected case, zero pass/one failure, exit1.

At **dfdcea4348711986e430eeab0c17bb4112936b0e**, all three new AI cases pass: the actual witness remains attributed to the correct attacker/victim/time; candidates describes the attack in **Muster Hall** as firsthand; makeRequest carries that owner-authorized witness and public Annex identity/names. Only server/ai/demo.mjs and server/ai/anthropic.mjs differ between the two pins under server/shared, so the same actual engine/map sources stage the historical and fixed gameplay. No provider send occurs: any fetch in these three cases throws immediately. makeRequest is the actual request serializer, not a fabricated replacement.

A real timed Annex occupancy read produces exactly eight map-room count rows. deviceFacts retains every row, source ID, original timestamp and exact map identity; another keeper and spectator receive no facts. Injected private-marker fields/hiddenIds are stripped rather than forwarded. After a real emergency meeting, the actual provider request retains all eight dated rooms and map, with no attack-witness claim inferred from occupancy. Thus the previously reported six-room projection gap is closed at this pin.

Provider whitelist control uses the actual witness view plus labeled adversarial extra fields: map privateRoute, room geometry/privateRoute, other-player role/knowledge, self knowledge, configuration/replay/AI memory. makeRequest emits map id/version and eight room id/name pairs only; all injected private sentinels disappear. Other-player rows omit roles/knowledge; own self.role remains correctly permitted. No secret recipients, global replay, raw configuration or geometry is added to council context.

### Eleven new HTTP/store boundaries

Tests start the actual native transport and actual durable store on loopback with explicit config **tacticalMode:true**, worldMode/systemsMode enabled, seeded engine construction and a clearly labeled idle demo AI dependency (no provider actions). This does not claim the production default flag is enabled. Field-note tests exercise the existing Group2 ability baseline only, not a merged ghost/death implementation or new seat allocation.

- Room-scoped ownership: absent credentials, spectator cookie, another room's host cookie, a foreign token renamed to the target room cookie, and duplicate same-name cookies cannot change settings. The same settings ID remains independently usable by each rightful room host.
- Malformed/foreign requests: map objects, string/fractional revisions, extra version/actor fields, unknown prototype-like IDs and foreign origins cannot silently select a map or reserve a settings ID. The same ID is then usable for a valid request; settings success does not replace the human cookie.
- Concurrent identical retries charge one revision/receipt; same-ID conflicting bodies produce one success and REQUEST_CONFLICT, with persisted map/revision matching the winner.
- Accepted Annex -> Beacon reversal followed by retry of the old accepted request does not roll back the newer selection. A denied stale request remains denied after a later successful selection and restart. Receipt arrays and identity hashes remain unchanged on those retries.
- A real settings/start race may legally resolve in either order; the created schema4 match must use the selected map of that serialized ordering. Fresh changes after start fail. Retained accepted retries cannot change the running map, including after restart.
- Actual HTTP human/spectator views after map selection, start, a private field-note and restart preserve the original human seat/cookie identity. Spectator self/session/history/notes remain empty. Public room/game map identities agree; catalog entries contain metadata only. Recursive private-key checks exclude identity hashes, settings request fingerprints, AI memory, full configuration/knowledge/replay and faction ledgers. API responses use no-store/nosniff; private server/data paths return404; active replay remains409.
- A deliberate failure immediately before delegated store.save makes settings return generic503, with no success acknowledgement, private error text, bytes or memory mutation. The same-ID retry succeeds once and survives restart. This is a pre-persistence fault boundary, not an OS crash/after-rename/power-loss durability claim.
- Actual HTTP ledger exhaustion records64 requests/revisions, rejects a new ID without evicting old IDs, retains the first accepted ID across restart, returns the current map on its retry, and still permits a playable schema4 start. The fixture advances its clock at request50 to stay within the real per-minute actor limiter; it does not disable rate limiting.
- Three mixed-directory cases combine a current valid room with a future map version, room schema or match schema. load fails explicitly MAP_UNAVAILABLE/VERSION_UNAVAILABLE while preserving both original files byte-for-byte and creating no quarantine file. This tests preservation amid ordinary current data, not only an isolated future file.

### Exact source and qualification receipts

Both ignored archives contain71 tracked files from their exact committed server/shared/public/package trees, with no runtime overlay. All71 fixed files were byte-reverified against git show PIN:path before final default-mode qualification. Manifest SHA256: fixed _artifacts/tactical-coordinator-review-dfdcea4/source-manifest.json **AE974CDB67E47F4AC49B28D0C228DCE18C06B6625C52300F367FA55DF07446CA**; historical _artifacts/tactical-coordinator-review-3c064af/source-manifest.json **D143C4F40C289E0D8A2C57E8C51A9D38EF952694273686D49295D2B54B2877CA**. Existing installed ws8.22.0 (the lockfile version) was copied read-only from manager's dependency directory into the ignored fixed archive; no dependency install/network occurred. This is not an npm-ci/package-integrity qualification.

| Fixed source file | Exact Git blob |
| --- | --- |
| server/ai/demo.mjs | fffa0f19328003b45eccd68291333eab8ce2f51e |
| server/ai/anthropic.mjs | 5e0762b64f836b714fe907765f34ad90321d46a8 |
| server/features/strategy/index.mjs | 7d8050132f832da86dcd3634db5711c4b12cbe31 |
| server/map-settings.mjs | 95cf9c1b09585efb301669481b1bc235669a1bbc |
| server/rooms.mjs | 67e55fbc50b218c3c45ca2c09131fecf4e948097 |
| server/store.mjs | 145439c279dccaabc8e0e65b87ed32cf5108ec7b |
| server/transport.mjs | 6be634297bfc3b777ed35d8838b6a887a08beb96 |

Node24.20.0, source/temp/cache on assigned D: storage. Tests use paths relative to their checkout, ignored _artifacts temp directories and optional explicit TACTICAL_COORDINATOR_REVIEW_ROOT; no machine-specific path appears in either committed test. Default imports always exercise the current checkout, never silently choose the old/fixed archive or skip unavailable schema4. Reproduction, after preparing committed archives:

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
Remove-Item Env:WORLD_ENGINE_GEOMETRY_MODULE -ErrorAction SilentlyContinue
$env:TACTICAL_COORDINATOR_REVIEW_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-coordinator-review-3c064af')
node --test --test-name-pattern='actual Annex eyewitness' tests/tactical-coordinator-review-ai.test.mjs
# Expected old source: exit1 at the real missing-witness assertion.
$env:TACTICAL_COORDINATOR_REVIEW_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-coordinator-review-dfdcea4')
node --test tests/tactical-coordinator-review-ai.test.mjs
node --test tests/tactical-coordinator-review-http.test.mjs
# Fixed source:3/3 and11/11, both exit0.
Remove-Item Env:TACTICAL_COORDINATOR_REVIEW_ROOT
node --test _artifacts/tactical-coordinator-review-dfdcea4/tests/tactical-coordinator-review-ai.test.mjs _artifacts/tactical-coordinator-review-dfdcea4/tests/tactical-coordinator-review-http.test.mjs
# Owned tests copied unchanged there: default imports14/14, exit0.
node --check tests/tactical-coordinator-review-ai.test.mjs
node --check tests/tactical-coordinator-review-http.test.mjs
git diff --check
```

| Local evidence | SHA256 |
| --- | --- |
| tactical-coordinator-ai-fixed.txt | 7B5007A6A089559885429563C1882735CAEBE9A1D2481BDDCE97A64F3728C47F |
| tactical-coordinator-http-fixed.txt | 974FA8BDC17965983D2BE7D4F9EBF285FAC3E51834C9B84BA6B81610053429F8 |
| tactical-coordinator-review-default.txt | 33729634C11BF0561BBAB980D2933CCA8FD621271F7DBE87B6CEB6479081E06D |

Preparation failures remain separate evidence, not product findings. First eyewitness staging did not place a reporter close enough; that failed identically at both pins before reaching AI, so the fixture now legally navigates a witness to the scene before attack. Logs tactical-coordinator-eyewitness-preparation.txt **A8D7B337BAAD4EB55360C88E8EB1D427601084E828D621C1E4327E858FF7D595** and tactical-coordinator-ai-preparation.txt **3BAD838172B0472CDE01FC4EA9B5EEEAB7F37933259AB8A64A97B7D7EC201666**. Initial HTTP run3/11 had8 teardown failures because directory cleanup ran before server/store lock release; only fixture teardown ordering was corrected, then11/11 passed. Its preserved tactical-coordinator-http-initial.txt SHA256 **11BE0888A095EC74D0C616A7B4ECCFC21619FDCB1971C62E72857E805D0B6776**. No test assertion was skipped/inverted to turn an unresolved defect green.

Current audit covers coordinator-authored tactical AI/root integration. Earlier legacy AI/investigation authored by this worker is a dependency/self-check, not independently self-approved. Unintegrated Core62498 and Systems81e7353/d685 heads are outside this exact-pin receipt; no claim about their closure is made. No planner/role/seat-allocation extension, ghost implementation, full suite, Chrome/browser, paid/live provider, hosted CI, main/push/deployment or OS power-loss approval. Manager retains broader integration and publication responsibility. Bounded requested work is complete.

## Final exact-integration review: immediate strict-restore finding

Exact read-only manager source **b9c1a442b88024f659ea05e40b00737b6562413f**. New owned test tests/tactical-coordinator-review-final.test.mjs initially contains two active positive requirements; **both fail** at that pin, zero skipped/todo/cancelled. This is distinct from B1's already reported future-activation/time review: every sample/checkpoint timestamp here remains valid and unchanged.

**TCF-1: schema4 checkpoint validation does not enforce the selected map for field-note and snapshot coordinates.** Start from a valid actual Annex room/match. For the first case, create a field-note through actual accepted engine applyAction, verify the original checkpoint, then change only that note's persisted position to {x:-99999,y:99999}. validateRoomSnapshot resolves successfully instead of rejecting it. For the second case, verify an ordinary engine-created initial snapshot, then set one saved snapshot player position to the same off-map coordinate and roomId to foreign Beacon room bridge. validateRoomSnapshot again resolves successfully. Both are cloned checkpoint corruption fixtures, not illicit client movement, a new ghost/ability implementation or evidence of a remote write path.

Source: server/store.mjs blob **145439c279dccaabc8e0e65b87ed32cf5108ec7b**. validateBeaconStructure only requires finite point values for notes/snapshot players; notes check a room ID but snapshots do not. validateRoomSnapshot applies bounds/walkability only to current players/routes/destinations and bodies, omitting historical notes and snapshots. These admitted records can be returned through the existing owner note view / ended-only raw snapshot copy. The replay guard itself is not alleged bypassed. This is a persisted evidence/replay integrity defect against the tactical map-validation contract; it does not establish extra hidden-state access or paid-call risk.

Preserved actual failure output _artifacts/tactical-coordinator-final-restore-red.txt SHA256 **AD69D86EE4162F932CE5C0B68A1691ED45B8D109C9381353B6930C2E5530B508**. Node24.20.0 command: set TACTICAL_COORDINATOR_FINAL_ROOT to assigned ignored _artifacts/tactical-coordinator-final-b9c1a44, then node --test tests/tactical-coordinator-review-final.test.mjs. Exit1,0 pass/2 fail. Neither assertion is skipped or inverted; runtime remains unchanged. The archive uses exact committed tracked source with no overlay, and the installed ws8.22 dependency is copied locally as in the preceding receipt. Follow-up within the same six-check bound covers live projection/phase/client/reservation boundaries separately.
