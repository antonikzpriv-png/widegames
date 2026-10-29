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
