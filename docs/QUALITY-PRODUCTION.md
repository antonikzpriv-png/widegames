# Frozen f9 production/runtime qualification

Qualified source: **f9b32151e4dfab4f2525cee067a9859cd1a27dff**. Worker: D:/Widegames-work/ship-quality-production-final-20261030, branch codex/ship-quality-production-final-20261030, created from this exact pin. Only tests/quality-production-review.mjs and this receipt change. Existing engine/core branches, dirty merge-fixture staging and all older worktrees are preserved. The earlier f6 qualification at5ebe6f5c373a4a061086a42a73074a7325383dfa is **historical**, not approval of the merged Group2 runtime. Its original source/report remain in the original core worktree; a receipt copy is retained in this worker's _artifacts/QUALITY-PRODUCTION-f6-historical.md.

**Result:30/30 checks passed in16,751ms**, one bounded real-main qualification run. No runtime counterexample or blocker was found in this scope. Offline normal npm ci installed only ws8.22.0. Puppeteer and Puppeteer-core were absent and unresolvable. All422 raw source blobs remained unchanged. The shipped server/public/shared graph has91 files,57 public/shared assets,217 literal local module edges and5 additional literal browser references. All57 assets were fetched byte-exact with expected MIME/CSP/nosniff. These counts are computed, not inherited from older receipts.

## What actually ran

Two actual unmodified server/main.mjs instances used one synthetic private DATA_DIR, demo mode and zero configured budgets. Only loopback port/origin/data/provider-budget environment settings were supplied; world/systems/tactical/station defaults were not overridden. Normal creation persisted room schema4/match schema5, Beacon2 by default, transfer policy and abilitiesfalse. Both Beacon2 and Annex1 were selected through authenticated settings and started over native HTTP. The actual crew owner received four distinct station jobs, rooms and puzzle kinds. This run needed one normal Beacon room and one Annex room, without seeded production role selection.

The owner walked a real distance-derived route at normal180units/s to a station. Remote and incorrect station inputs were denied; direct legacy task opening did not solve the station. One legal taskInteract step persisted, deduplicated and survived restart. This is a bounded step/packaging check, not a full match, movement benchmark or browser qualification.

Owner/spectator HTTP and real ws connections retained exact map and private-data scopes. Remote roles were absent before end; observed positions were checked against actual spatial LOS/vision/doors, unseen positions and rooms remained null, and remote task/motion/destination/input fields were absent. Private notes, sessions, observations, cooldowns and transit stayed owner-only; spectators used the fixed map viewpoint. Runtime history/byte/sequence fields were also explicitly forbidden in live views. Missing/cross-room identities, foreign mutation/socket origins, spectator action attempts, private source/data/dependencies and traversal paths rejected. The synthetic unused credential marker appeared in no HTTP/WS payload or main log. Pre-end replay remained409.

The prior harness's strict descriptor allowlist now explicitly includes legitimate protect{targetId} and decoy{x,y} fields alongside existing task/system/field-note descriptors. It does not admit arbitrary client fields. Production feature defaults remainfalse. Separately labeled ended optional-preset fixtures used actual engine protect/decoy and sabotage/deadline transitions, with ghost-tasks/abilitiestrue. They exercise feature/history persistence and postgame transport, not a new live-provider or full-ghost-match qualification.

Paused fixtures for valid match schemas1/2/3/4/5 were created and saved through actual engine/store APIs, with real accepted wait receipts. Tactical/station legacy samples use explicit retained Beacon1. Their files remained byte-exact across both mains. This samples restore and format/receipt preservation, not every active legacy workflow. Actual saved new Beacon2/Annex1 histories were additionally inspected as version2 with their own exact map identities.

Two deterministic, explicitly short critical-deadline fixtures ended through actual engine transitions: legacy walking schema2/history1 and station schema5/history2 on Annex1. Authenticated HTTP replay was compared exactly to engine-exported metadata/events/snapshots before and after restart. It preserved map identity, chronological timestamps, real sequences, effects and ended role reveal; anonymous and wrong-match requests rejected. Postgame spectator self/chat/effects remained appropriately scoped. These fixtures are not ordinary complete demo matches; no task victory or all-AI outcome is claimed here.

Six future-version fixtures exercised actual store.load setup guards: room5, match6, history3, features2, station-challenge2 and unavailable map999. The first five throw VERSION_UNAVAILABLE; map throws MAP_UNAVAILABLE. Original files remain byte-identical, with no quarantine/replacement, and owned locks release. These guards were exercised through the real store module, not six additional main startups.

The real daily budget API seeded a labeled synthetic uncertain0.01 reservation with no provider send. Its entire ledger remained byte-exact through both zero-budget mains. Actual cookies/seats/roles/maps/settings receipts, private notes, input sequence2/stopped position and station accepted/denied receipts survived restart. Repeated original requests added no owner action receipts. No quarantine occurred in the main data directory.

Both main processes exited code0/signal null through their actual single SIGTERM cleanup handler. On Windows the IPC wrapper emits process SIGTERM and disconnects; this is real main cleanup, not OS/POSIX signal delivery qualification. Sockets closed, service/recovery locks disappeared, and restart acquired a distinct lock token. Actual counts: **0 provider fetch attempts,0 outbound attempts,0 forced stops,0 socket privacy errors**. The wrapper blocks fetch, http/https request/get and net connect/createConnection before main imports; harness HTTP/WS uses only its generated127.0.0.1 origins.

## Source and packaging review

Compared with historical f6, f9 changes37 runtime/package files for Group2 engine tasks/abilities/history, strategic AI, live-adapter prompt construction, store/config/rooms/transport, shared replay1/2 and UI lifecycle/replay. The package lock, Dockerfile and .dockerignore are unchanged. Normal start remains node server/main.mjs, port3000, server/shared/public COPY groups and ws-only production dependency. The original live model adapter was imported but no live request was made. Docker, hosted deployment, updater/installer and external-provider behavior are not qualified.

The spatial geometry diff from f6 is only the canWorldAct import and observer eligibility check for explicit ghost tasks. The navigation cache algorithm itself is unchanged: frozen map geometry, fixed grid legality, bounded canonical closed-door signature cache, no cached actor/target/state, and exact final route validation. This is a bounded source comparison, not independent approval of Core's authored physics/cache. Manager/Reviewer retain independent gameplay/browser review.

The first preparation archive was rejected before any server ran because host core.autocrlf=true made git archive bytes differ from raw Git blobs. It is preserved at _artifacts/quality-production-f9b3215/ and is **not qualified**. A fresh archive used command-local core.autocrlf=false/core.eol=lf; every extracted file was compared with git cat-file and its canonical blob SHA1, then recorded with SHA256. No global Git config or runtime source was changed. The qualified archive is the separate -raw directory below.

## Exact commands and evidence

From this worker root; TEMP/TMP=D:/Widegames-work/temp, npm cache D:/Widegames-work/npm-cache:

```powershell
node _artifacts/archive-production-raw.mjs
npm ci --omit=dev --offline --no-audit --no-fund --cache D:/Widegames-work/npm-cache --prefix _artifacts/quality-production-f9b3215-raw
node --check tests/quality-production-review.mjs
node tests/quality-production-review.mjs
node _artifacts/receipt-production-source.mjs
git diff --check
```

The archive script refuses to overwrite retained evidence. Its git command is git -c core.autocrlf=false -c core.eol=lf archive --format=tar f9b32151e4dfab4f2525cee067a9859cd1a27dff. npm ci is normal production offline install, without --ignore-scripts; this package has no install lifecycle scripts. Harness default pin is exactf9 and default archive is its -raw folder. QUALITY_PRODUCTION_REVIEW_PIN accepts only a full hash; QUALITY_PRODUCTION_REVIEW_ROOT remains constrained to the worker's ignored artifacts. Future pins require new manifests and qualification.

Copyable paths relative to D:/Widegames-work/ship-quality-production-final-20261030:

- Qualified archive: _artifacts/quality-production-f9b3215-raw/
- Raw Git tar: _artifacts/quality-production-f9b3215-raw.tar
- Manifest: _artifacts/quality-production-f9b3215-raw-manifest.json
- Final report: _artifacts/quality-production-f9b3215-run-pQbtqA/report.json
- Executed harness bytes: _artifacts/quality-production-f9b3215-run-pQbtqA/harness-executed.mjs
- Synthetic private files: _artifacts/quality-production-f9b3215-run-pQbtqA/private-data/
- Source comparison/hash receipt: _artifacts/quality-production-f9b3215-source-audit.json
- Archive verification: _artifacts/quality-production-f9b3215-raw-archive.txt
- Offline install: _artifacts/quality-production-f9b3215-raw-install.txt
- First/only production run: _artifacts/quality-production-f9b3215-first.txt

SHA256:

| Artifact | SHA256 |
| --- | --- |
| Raw Git tar | 9ab67bc7d9ee48852c01ef2c9bee1f548ae4d826310af1cce73558452f921746 |
| Manifest | 22c357d7ed97220aa7b5aaef7dedb69451e004b7b5ba77445a8db74c76b28947 |
| Report | 21d3fc2b4d1125c5dd04ff8267f9cdaff7e0b71abf7016f75eced50c110ff9dc |
| Executed harness bytes | b8e8d740d8629a1b2ed4aad60df618737cfd25f61b0bfee38e7d4159d7857f06 |

Bounds remain90s overall, two mains,10s startup,8s graceful stop,4s HTTP/WS, at most four normal Beacon attempts for a crew owner, and distance-derived station arrival capped25s. The standalone harness does not match ordinary *.test.mjs. No Chrome, profiling loop, full suite, live/paid provider, prod/user data, other-worker edit, push, main merge or deployment occurred. This qualifies exactf9 only; future runtime or asset changes need an exact-source refresh.

## Read-only door-delta review: f465 (2026-10-30)

Reviewed **f465b645c8f4a8a280786a84a578664d747dee17**, parent596b5bf74713e1c2e6f5d33e18bde15732fc797d. Commit changes only tactical-doors.mjs (4 additions/3 deletions) and the two-map ghost-door regression. This is a bounded source review, **not a new production qualification**. The f9 package report above is historical; no package install, main startup, suite, browser, provider call or runtime edit was performed for this follow-up. Manager's reported21/21 is not presented as an independently rerun result.

No blocking defect found in the door delta:

- The new dependency is the authoritative server/engine/features.mjs canWorldAct, which accepts living actors or dead crew under exactly deathPolicy ghost-tasks. It does not use shared/features.mjs's broader dead-actor helper. Dead saboteurs, default-transfer/ejected historical coordinates and actors with an own transit entry remain excluded. Actual unreported corpse positions still obstruct separately, preserving body/ghost separation. Generic IDs and immutable map fixtures remain supported; no six-seat or default-room assumption was added.
- There is no new dependency cycle. features.mjs imports only node:crypto and shared/features.mjs; shared/features.mjs has no imports and cannot lead back to systems. The existing tactical-doors <-> model dependency predates this change. Imported exact/time/validateDoorState are used inside functions, not called against uninitialized cyclic bindings during module evaluation. model's existing top-level hatch/repair fixture checks do not call the door validator. This conclusion is static source inspection, not a new executable import smoke test.
- Occupancy is computed locally from the current settled state only at scheduled closure. No actor/state/occupancy cache survives a call, no async work was added, and the function does not mutate players, bodies, motion, knowledge, requests or clocks. Root engine transitions clone state and execute synchronously. HTTP inputs/actions, scheduler ticks and AI commits remain serialized through the room queue, including durable commit. Arrival/steering at the same timestamp therefore follow existing tick-before-action order rather than racing an asynchronous closure predicate.
- Root advance settles motion to min(next deadline,now) before systems processing. Unchanged precedence is critical, maximum duration, phase, systems, effects, devices. A critical/phase/max tie cleans up doors before a closure can entrap anyone. Otherwise closure tests exact-boundary positions, changes pending to jammed/open-collider or closed, clears closeAt, retains the original expiry, then invalidates routes against the resulting geometry. A jam does not displace/stop an otherwise valid route, retry when an actor leaves, extend expiry or refund cooldown. Late ticks still process the original close/expiry times. Transit actors are excluded at their scheduled-arrival boundary; authorized ghosts cannot begin transit under the existing systems permission check. This delta does not change pre-existing simultaneous transit/door job ordering.
- Hidden occupancy is not consulted by action permission or hint generation: thresholdOccupied is called only by advanceSystems for door-close. Public output is still an unattributed door state/event: doorId, status jammed, closed/active false, original deadline and generic reason obstructed. No obstructing ID, position, role, alive/dead flag, recipient list or occupancy count is emitted or promoted into knowledge. Local death/witness knowledge and hidden-ghost position projection are unchanged, including520's postgame guard. Public jam status necessarily reveals that a physical obstruction existed at that public threshold; that aggregate physical outcome already belongs to the door contract and is not an actor-identity guarantee.

Nonblocking documentation finding for coordinator: docs/TACTICAL-RULES.md at this exact pin still describes threshold occupancy as living non-transit keepers plus unreported bodies and calls ejected-keeper coordinates historical without the ghost-tasks exception. It should explicitly distinguish authorized physical task ghosts from inactive dead-player coordinates. No unowned document was changed here.

Reviewed exact sources with git show/diff: tactical-doors, systems index/model, server features/shared features, engine advance/applyAction/applyInput/getPlayerView, spatial knowledge projection, rooms queue/commit, transport scheduler/input/action wiring, the new quality-main-ghost-door regression and tactical rules. Commands include git show --stat f465b64, git show f465b64 -- server/engine/systems, and git show f465b64:<each listed path>. The reported two-map regression uses real navigation/elimination/door actions, JSON restart and original close/expiry clocks; inspection found no fabricated death/position assignment in that fixture. This review does not extend the f9 package approval to f465 or the pending Ward UI change. Wait for the final immutable source pin before the requested production refresh.

## Independent source review: Ward selection70972b9

Reviewed exact **70972b9f6bcd8e173b4b8dce3f013a54bfec8f02**, parent4cd9aa77fa9f3349c30345e4360c45a22cbb9fa7. Runtime diff is25 additions/5 deletions in public/world/experience.mjs; the other changed files are owner tests/receipt. No blocker found in this bounded read-only review. No runtime/test edits, suite, Chrome, provider or production rerun occurred; author8+41 and manager10 results are reported upstream, not independently re-executed here. The earlier f9 package result remains historical and does not qualify this UI revision or pending council CSS.

- Beacon Ward options derive solely from actionDescriptors' exact protect{targetId} shape and enabled===true, additionally requiring live self, roam and no transit. Nearby roster positions and availableActions do not grant a target. Roster lookup supplies presentation names only; its ID fallback comes from the permitted descriptor. Legacy non-beacon capability selection stays explicitly separate.
- Initial/new-owner selection is the first permitted descriptor, synchronized into the select value. Activation recomputes current hints, matches the actual selected targetId, clones that descriptor's fields and requires both context and descriptor enabled. It cannot silently substitute the old first/self target, mutate descriptor fields or construct permission from distance/role claims. Disabled, missing, malformed or unrelated descriptors cannot be used through this path.
- A revoked selection becomes the empty placeholder. Returning permission in the same owner context leaves it blank until deliberate choice, preventing permission ABA from silently re-arming Ward. Ordinary descriptor reordering retains the selected ID/option node. equipmentOwner scopes selection by room, match, exact map, self, phase and alive state; a different owner context initializes afresh from its own current permissions.
- Pending/disconnection disable selection/submission; reconnect retains only a still-permitted explicit choice. Dead/ghost/phase/transit states produce no enabled Ward hints. Existing modal, map-error, pending and connection gates remain. The descriptor check and callback dispatch are synchronous, with no newly introduced async permission gap. Existing action-generation/key fences suppress stale request feedback across intervening context changes; root authority still validates every proposed action.
- Disposed change handlers return immediately; stale button activation also checks disposed before dispatch. Existing cleanup removes input/visibility/frame work and detaches the shell. The patch does not introduce deferred Ward callbacks, shared mutable selection or hidden-state inputs, and changes no server/shared/private-state path.

Inspected the added8 tests: actual engine-generated descriptors and genuine accepted Ward effects cover selected-other/default-self, permission removal/return, no-descriptor fail-closed behavior, reordering/node/focus, pending/disconnect/reconnect, legacy schema2 and disposal. The adversarial permission projections are correctly labeled; the minimal DOM is not native select/browser approval. Also traced actual beacon-model actionDescriptors/hasActionDescriptor/viewKey, model beaconContexts, map-model equipmentOwner and experience request/update/dispose. Commands: git show --stat70972b9, git show70972b9 -- public/tests, and git show70972b9:<these actual paths>. No production refresh should run until the manager supplies the final immutable UI/CSS source pin.

## Final frozen production refresh:25ce070

Qualified exact **25ce0700fb16320fdd40f4192ef94b32fe3fb824**, including Ward selection, council CSS, fallen-chat collapseQ-F1 and physical ghost-door fixes. This section supersedes f9 as the current package receipt; every earlier archive/report/failed preparation artifact remains preserved. Own branch/worktree unchanged: codex/ship-quality-production-final-20261030 in D:/Widegames-work/ship-quality-production-final-20261030. Only the standalone harness default pin and this receipt change; **all30 checks/assertions/bounds are unchanged** from the successful f9 harness.

**30/30 pass on the first/only qualification run;22,243ms.** Fresh clean git archive verifies **429 raw committed blobs**,91 runtime files and57 served public/shared assets. Every asset was fetched byte-exact. All218 literal local module edges and5 additional browser references resolve within shipped groups. Ordinary offline production npm ci added only ws8.22.0; Puppeteer/Puppeteer-core are absent and unresolvable. No real counterexample or packaging blocker was found.

Actual unmodified main instances20888 and12588 both exited code0/signal null through the real single SIGTERM handler, releasing service/recovery locks; the second acquired a fresh ownership token on the same synthetic DATA_DIR. Windows IPC emits process SIGTERM, so this is main cleanup/restart qualification rather than POSIX signal-delivery qualification. Actual totals: **0 provider fetch attempts,0 outbound attempts,0 forced stops,0 socket privacy errors**. Demo and deployment/provider budgets stayed zero; all child outbound paths were blocked before importing main.

Normal authenticated HTTP starts on both maps retained room4/match5/stations1, default Beacon2 and features transfer/abilitiesfalse. Owner/spectator HTTP and WS, legal input/stop, exact role/position/knowledge/note scopes, forbidden private paths/origins/identities, settings/action retries and restart all pass. The actual Beacon2 crew owner had four distinct job kinds/rooms; one glyph input step followed an879.3122284377272-unit normal-speed route. Incorrect/remote/direct-completion and duplicate/restarted station paths retained their original strict assertions. This is not a performance claim or complete-match/browser test.

Valid paused legacy1/2/3/4/5 files with wait receipts remain byte-identical across both mains. Ended optional-preset history1/schema2 and history2/schema5 fixtures still use genuine short-deadline engine transitions. Their authenticated, match-bound HTTP metadata/events/snapshots match engine exports before and after restart, with exact map identities and chronology. New normal Beacon2 and Annex1 saved histories are both version2 with their own maps. Six future room/match/history/features/challenge/map versions refuse through real store setup guards, retain original bytes without quarantine and release locks. The labeled uncertain daily0.01 reservation remains byte-exact, with no provider send or refund. Fixture provenance/limits in the f9 section continue to apply unchanged.

Exact source comparison f9 ->25ce changes only four runtime/asset paths: public/world/beacon.css; public/world/experience.mjs; server/ai/anthropic.mjs; server/engine/systems/tactical-doors.mjs. The adapter difference conditionally omits beacon-specific observation wording from historical non-beacon prompts; no provider request was exercised. shared, package.json, package-lock.json, Dockerfile and .dockerignore are unchanged. Movement/station/map geometry and cache are unchanged. Script/test/doc differences are outside the served runtime graph. Source comparison details and computed graph fingerprint are saved with the receipt. A later handoff HEAD is compatible only if its runtime/served graph remains exact; this receipt does not automatically approve future runtime changes.

Commands (D: worker root, TEMP/TMP=D:/Widegames-work/temp, npm cache D:/Widegames-work/npm-cache):

```powershell
node _artifacts/archive-production-25ce070.mjs
npm ci --omit=dev --offline --no-audit --no-fund --cache D:/Widegames-work/npm-cache --prefix _artifacts/quality-production-25ce070-raw
node --check tests/quality-production-review.mjs
$env:QUALITY_PRODUCTION_REVIEW_PIN='25ce0700fb16320fdd40f4192ef94b32fe3fb824'
$env:QUALITY_PRODUCTION_REVIEW_ROOT='D:/Widegames-work/ship-quality-production-final-20261030/_artifacts/quality-production-25ce070-raw'
node tests/quality-production-review.mjs
node _artifacts/receipt-production-25ce070-source.mjs
git diff --check
```

The fresh archive again uses command-local core.autocrlf=false/core.eol=lf. Extracted bytes match git cat-file and canonical blob OIDs; all source SHA256 values are checked before and after execution. Normal npm ci does not use --ignore-scripts and cannot fall back online. The harness default is now exact25ce070; prior f9 executed harness bytes remain separately preserved. No source overlay or runtime mutation.

Copyable paths, relative to this D: worktree:

- Archive: _artifacts/quality-production-25ce070-raw/
- Raw tar: _artifacts/quality-production-25ce070-raw.tar
- Manifest: _artifacts/quality-production-25ce070-raw-manifest.json
- Final report: _artifacts/quality-production-25ce070-run-D4pzNg/report.json
- Executed harness: _artifacts/quality-production-25ce070-run-D4pzNg/harness-executed.mjs
- Source/graph/hash receipt: _artifacts/quality-production-25ce070-source-audit.json
- Logs: _artifacts/quality-production-25ce070-raw-archive.txt, _artifacts/quality-production-25ce070-raw-install.txt, _artifacts/quality-production-25ce070-first.txt
- Synthetic files: _artifacts/quality-production-25ce070-run-D4pzNg/private-data/

| Artifact | SHA256 |
| --- | --- |
| Raw tar | 5953d64d1ae732ff19460d993f15425154af3845db1ddb1c591453d4950934b1 |
| Manifest | d82f81279d41a02e8cb623126c21a38ec1d931f65322eb9e26fbcfcafce2deb3 |
| Report | f060f10c8a11f2d2f576f0ab55bc7c41f26b8ba9158f781f6edbd8ad25dc36b2 |
| Executed harness | 029c8aa7c7601002f28ce9d2fee0df5d472774960fab488bc73ef2ae23efa969 |
| Runtime/served graph (ordered file,SHA256 pairs) | d0b6e6aadba2d60dabd85f01c86f985f921aec9ac32f4ca6aba7aa0697b959e9 |

No Chrome, full suite, profiling, live/paid model, real user data, Docker execution, other-owner edit, main/push/deployment or updater/installer claim. Manager/Reviewer retain independent frozen-source native/browser qualification. This bounded exact-source production refresh is complete.

## Canonical fallen-faction repair (after25ce; production receipt historical)

Foundation **433ebb7e53a537d31ff015ce352fcbe8355999b9**; separate D:/Widegames-work/ship-quality-ghost-factions-20261030, branch codex/ship-quality-ghost-factions-20261030. Prior branches, artifacts and the30/30 exact25ce package receipt remain preserved and historical. This runtime correction requires independent manager/Reviewer review and a new production pin; no package/browser/full-suite qualification is claimed here.

Confirmed compatibility/security defect: actual main43 shared/features.mjs classifies all dead factions under ghost-tasks and its server engine reexports that helper. The quality integration instead added a crew-only server helper and AI guards. That revoked fallen saboteur movement/private-chat readership and allowed their saved ghost coordinates through legacy and mapped public ended-view gates. The old crew-only intention was not canonical main policy and is reversed here.

Minimal owned runtime repair: engine/features imports/reexports canonical isGhost, retaining canWorldAct and all existing engine restrictions. No schemas, features versions, action fields, clocks, cooldowns, permissions whitelist or private-chat/replay contract change. Dead saboteurs can move and read/send the same private fallen channel as main; they gain no crew tasks or living kill/sabotage/repair/devices/report/emergency/council/vote/ability actions. Existing world projection, motion, door and feature-validation consumers now agree through the canonical classification. AI worldRoute accepts any actual safe-view ghost. Local ghost planning sends a truthful private fallen message for a saboteur, then wait; only crew inspect/perform their owned task list. The controller routes all fallen world actors to this local planner, bypassing the old crew-only demo entry guard, with no provider reservation/send even in live strategic mode.

Owned regression: tests/quality-main-ghost-factions.test.mjs,10 checks. All deaths/ejections/outcomes and positions derive from actual navigation/elimination/meeting/vote/deadline/input APIs, with immutable-input assertions; no alive/position/outcome assignment. Tactical fixtures have8 custom IDs and2 saboteurs; the first ejection leaves a live match and the second ends it legally. Legacy2 has a crew-written private message before sole-saboteur ejection, proving fallen-saboteur postgame readership. Three separate postgame privacy cases cover legacy2/Beacon2/Annex1. Both maps additionally exercise navigation, positive input/stop/stale sequence, denied living/crew-task actions, JSON, actual store save/reopen and authenticated native HTTP before/after restart/end. HTTP identities are synthetic issued tokens occupying already configured human fixture seats; this is not a new public seat-allocation implementation. Private chat persists and deduplicates, but is absent from living/spectator views, public events and replay/metadata/snapshots. Four real controller modes (demo/live-config x hybrid/strategic) prove local truthful message then wait after JSON context restart,0 reservations/fetches/calls/tokens/cost; inputs are actual safe views only.

Evidence under this worker's ignored _artifacts:

- ghost-factions-original-valid-433ebb7.txt: **0/10 pass,10 fail,0 skip** against verified exact original source. All three independent postgame cases fail the coordinate-null assertion. Only the new owned test is added to a429-blob raw Git archive; product source is unchanged, not an overlay/mixed runtime. Archive/manifest are ghost-factions-base-433ebb7/ and ghost-factions-base-433ebb7-manifest.json.
- ghost-factions-green.txt: **10/10 pass,0 skip**,7055.1867ms on the repaired own checkout.
- Earlier red/intermediate logs remain. Two early extra privacy fixtures attempted a second meeting before its legitimate1ms cooldown; corrected submission uses the real cooldown boundary, without clock/state fabrication. The final red and green use the same corrected test file. An intermediate local-planner condition was incomplete and is also preserved in its first-run log.

Coordinator integration requirements discovered read-only: server/transport.mjs canScheduleActor still admits only ghost crew with unfinished tasks; it must schedule a fallen saboteur's permitted local message/wait if that behavior is desired in actual rooms. Owned controller now works without changing unowned demo.mjs, whose direct candidates export still has a crew-only guard; coordinator should either align that direct entry point or retain the controller as its supported dispatch. Existing tests/quality-main-engine-merge.test.mjs final test explicitly expects dead saboteur self.ghost=false and input PLAYER_DEAD, contradicting canonical main. Update that obsolete policy assertion with legal fixtures. AGENTS/README/ghost help prose also contain crew-only wording; coordinator owns current UI/help changes. No unowned files were changed.

Initial commands: TEMP/TMP=D:/Widegames-work/temp; node --test tests/quality-main-ghost-factions.test.mjs; node _artifacts/prepare-complete-red.mjs; node --test _artifacts/ghost-factions-base-433ebb7/tests/quality-main-ghost-factions.test.mjs; node --test tests/quality-main-ghost-factions.test.mjs. Dependency-only junction uses preserved25ce archive's ws8.22 node_modules read-only; no dependency/runtime install or production rerun. Focused compatibility results follow separately. No Chrome, providers, other-worktree edit, main/push/deploy/user data access.
