# Authoritative world engine

Milestone: schema-2 world state, continuous movement, input sequencing and physical navigation are implemented in server/engine/index.mjs and world-runtime.mjs. createMatch defaults world:false for schema-1 fixtures. Production passes world:true. The existing five exports remain and applyInput is added. Navigation is a discrete action {id,type:'navigate',x,y}; move {roomId} in a world starts a physical route to that adjacent room's station. WASD input overrides the route.

Dependency: coordinator shared geometry commit 6f6f7c023ed3727b9849cdf27040a0ca88ddb46e. Production imports shared/world.mjs. This isolated owner checkout may qualify against that read-only module with WORLD_ENGINE_GEOMETRY_MODULE=file:///D:/Widegames-work/world-coordinator-20261029/shared/world.mjs; no shared or other-owner source is copied or changed.

Schema 2 adds worldVersion:1 and player.position. Private player.motion contains seq, dx, dy, leaseUntil, at, manual, path, destination and recordedAt. All state is JSON-safe. Input {seq,dx,dy} validates a positive safe integer and integer axes -1..1. Speed is server-owned 180 units/second, diagonal magnitude is normalized, and input leases last 600 ms. Same-sequence/same-direction input is inert; changed contents conflict; older sequences reject. Steering does not consume discrete request IDs.

Movement settles before each chronological phase, critical or maximum deadline, and before actions/input. Meetings, death and terminal transitions stop navigation and manual movement. Input lease expiry stops steering even after a delayed tick or JSON restoration. Navigation persists to arrival unless overridden or stopped by lifecycle. While crossing corridors, roomId retains the last valid room.

World interaction checks use shared authoritative geometry: task at own room station within92; repair at Engine station within92; emergency bell within92; elimination within70 plus visibility; report within130 plus visibility. Navigation targets must be walkable and server-pathfindable. No caller supplies authoritative position, speed, clock or path.

Views add worldVersion:1, self.position/inputSeq/moving/destination. Other player positions are null unless currently visible; spectators may observe public positions but no private role before ended. No other actor's motion, input sequence, route or destination is exposed. Bodies are generated as safe local events with the real death position/time. Eyewitness attribution remains restricted to actual observers at the kill. Public repair progress has no actor identity. View/replay copies remain defensive.

Replay records validated navigation actions, direction changes, movement stop/arrival and samples at most once per second per moving keeper. Repeated same-direction heartbeats do not produce per-frame replay records. Existing replay bound12,000 and public timeline bound256 remain. Replay stays locked until ended.

Initial validation: node --test tests/world-engine.test.mjs tests/engine.test.mjs tests/engine-rules.test.mjs with the geometry module above: 36 pass, zero fail/skip. This includes all30 legacy engine controls and six world controls for opt-in, speed/diagonal/lease, persisted sequences, physical routing, input validation/override and private coordinates. Further world-specific collision/proximity/deadline/lifecycle controls follow this early milestone. No paid provider, browser, publication or runtime changes outside the owned engine paths were used.

## Completed world validation and integration details

Final world coverage adds tests/world-engine-lifecycle.test.mjs: 19 world controls plus all30 legacy controls pass, **49/49, zero failures/skips**. Rules/positions remain engine-authoritative in schema2. Tests use actual map routes/collision and legal actions, including:

- Actual outer walls and chart-table collision; no fast diagonal or wall tunneling.
- Exact station/bell92, elimination70 and report130 ranges, plus a nearby victim/body across a wall corner that remains invisible and cannot be killed/reported.
- Death-position and death-time body events; no false eyewitness when an observer sees the attacker but cannot see the victim; local body/view mutation cannot alter stored coordinates.
- JSON restart of partial navigation and remaining input lease, with action validation itself settling movement before an interaction.
- Movement only before roam/critical/max deadlines; coarse/partitioned deadline processing, no old navigation resumption after meetings, death freeze and permanent terminal coordinates. Critical retains its existing precedence over maximum on ties.
- More than2,048 input packets retain only the latest sequence without consuming any action ID, and fewer than40 replay entries in that heartbeat fixture.
- Physically reachable task, parity, critical and ejection victories. Legacy navigate remains an INVALID_ACTION instead of changing schema1 behavior.

A meaningful new boundary was initially failing: a well-formed input denied in discussion could be retried after council as new movement. The initial red run is retained at `_artifacts/world-input-denial-initial.txt`. The corrected engine acknowledges every well-formed newer sequence, including rule denials, in the bounded private motion state. motion.error stores the safe last denial (null for an accepted input); self.inputSeq acknowledges it. Same-sequence retries reproduce that accepted/error result and never refresh the lease or restart movement. Different payloads under that sequence conflict. Malformed envelopes are not acknowledged. Rejected movement inputs still consume no action IDs. Transport must persist returned state even on denial, matching applyAction's existing rule.

Final motion shape: `{seq,dx,dy,leaseUntil,at,manual,path,destination,recordedAt,error}`. dx/dy retain the last acknowledged payload for idempotency even after movement stops; manual/path and phase/alive state determine motion, so that retained vector cannot resume on its own. No private field is added to other player records.

Qualification commands, from this assigned D: checkout:

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:WORLD_ENGINE_GEOMETRY_MODULE='file:///D:/Widegames-work/world-coordinator-20261029/shared/world.mjs'
node --test tests/world-engine*.test.mjs tests/engine.test.mjs tests/engine-rules.test.mjs
node --check server/engine/index.mjs
node --check server/engine/world-runtime.mjs
git diff --check
```

The published shared module is read-only and pinned to 6f6f7c023ed3727b9849cdf27040a0ca88ddb46e. In the integrated repository no environment override is needed; default import resolves ../../shared/world.mjs. A coverage run before the final legacy-only navigation rejection asserted all49 tests and reported index99.67% lines /98.10% branches, world-runtime100% lines /87.65% branches. The final post-change49/49 run is retained in `_artifacts/world-engine-final-results.txt`; intermediate world checks are in world-engine-lifecycle-results.txt. Coordinator must independently integrate and qualify production transport/browser/AI world behavior; those are not claimed by these engine tests. No runtime source outside server/engine, root/shared file, main branch, provider, deployment or other worker tree was changed.
