# Gameplay-quality verification

This branch extends the existing Lantern Wake server and browser; it does not bundle Among Us assets or claim exact proprietary map dimensions. Primary reference and explicit differences are in [QUALITY-REFERENCE.md](QUALITY-REFERENCE.md).

## Source and preservation

Started from actual origin/main **90bb6e881f75f77e85b8b49729971a710b4c91b4** and incorporated the completed tactical PR5 revision **d55144dd3c71f5ad965814aee92f4612bc4084ba**. Main advanced during implementation to **43c079999506785196ab85750105ceb102ba9314**; it is preserved through merge **7d8532afdb47179b96ec56ead6a7f0ee1bc34941**. Original branches, worktrees, map1 saves, identities, action receipts, private evidence and uncertain spending reservations remain. No direct main changes, merge into main, deployment or live paid provider calls occurred.

## Integrated implementation

| Area | Actual integration | Regression coverage |
| --- | --- | --- |
| Walking | Core canonical steering leases, swept collision, bounded geometry/door caches; client MotionTrack and snapshot-anchored camera | Sparse/dense ticks, sliding, concave seams, stale/hidden actors, forged checkpoints, door routes |
| Map and art | Immutable latest Beacon2, 3200x2400, 14 rooms, 56 collider props; Annex1 and original Beacon1 retained | Safe spawns and station routes, geometry identity, two-map complete games |
| Tasks | Versioned station match5/room4; six authoritative puzzle kinds; four distinct jobs per crew; owner clues only | Every puzzle, wrong/duplicate input, restart, remote permission, human/bot completion |
| Tactical systems | Existing lights/comms, timed doors, two-site power/flood, passages and equipment integrated | Exact deadlines, concurrent repairs, device access revocation, hidden deaths, restart |
| Current main | Retained taskStep puzzles, strategic intentions, ghost tasks/fallen chat, Ward/Echo, spatial replay | Protocol separation, budget reservations, private views, map-aware replay1/2 |
| Root boundaries | Conflicting start IDs fail409; strict mapped replay/store; future feature/history preservation | Real HTTP/WS identity, request races, stale ABA contexts, historical/future saves |

The module exports and examples are [QUALITY-INTERFACES.md](QUALITY-INTERFACES.md), [TACTICAL-INTERFACES.md](TACTICAL-INTERFACES.md), and [NEXT_FEATURE_INTERFACES.md](NEXT_FEATURE_INTERFACES.md). Existing normal entry points remain npm start and server/main.mjs. No donor server, global match store or alternate planner was introduced.

## Qualification receipts

Historical receipts name their exact source and cannot qualify later edits. The first combined native workflow at **520cc3ce94d603ad04d94ff40f6b97c740aace88** passed **26/26**, inspecting **2126 safe views**: actual human crew/task victory and all-AI Annex sabotage victory, real actions, keyboard/touch, private roles, restart identity, council/skip and chronological replay. Artifact: _artifacts/world-browser-ayos0q/report.json. This is historical coverage; final qualification below follows later Ward/door fixes.

At **596b5bf74713e1c2e6f5d33e18bde15732fc797d**, npm test passed **1223 tests:1217 pass,0 fail,6 expected skips**,155.446s. The retained sustained strategic fixtures passed without increasing the120000-token production default. Provider calls are mocks. Afterward a separate two-map cross-feature test reproduced doors closing over physical task ghosts; **f465b645c8f4a8a280786a84a578664d747dee17** fixes this through the existing authoritative occupancy check. The focused closure/restart/systems/navigation run passed **21/21**. Red fixture receipts remain preserved.

The previous game-runtime qualification is **25ce0700fb16320fdd40f4192ef94b32fe3fb824**. A subsequent faction-compatibility audit found that Group2 ghost classification had been narrowed to crew, instead of current main's all-fallen policy. Its correction and refreshed final runtime qualification follow below;25ce is retained as a historical receipt, not approval of later code.

| Command / qualification | Exact game source | Result / artifact |
| --- | --- | --- |
| npm ci | Integrated D: tree |25 packages installed;26 audited;0 reported vulnerabilities |
| npm run check |25ce070 |255 JavaScript modules syntax-checked |
| npm run test:browser |25ce070 |26/26;1861 safe views; _artifacts/world-browser-nl3WjL |
| npm run test:task-browser |25ce070 |42/42;1639 safe views; _artifacts/world-browser-31ez2K |
| npm run test:tactical-browser |4911f17 |32/32;1568 safe views; _artifacts/tactical-browser-FQaqgR |
| npm run test:beacon-browser |25ce070 |13/13;602 safe views; _artifacts/beacon-browser-MrTvSd |
| npm run test:features:browser |25ce070 |19 checks; exit0; _artifacts/ghost-abilities-browser-9eJshB |
| npm run test:spatial-browser |25ce070 |21 checks; passedtrue; _artifacts/spatial-browser-DPemkq |
| LW_WORLD_BROWSER=1 node --test tests/world-ui-browser.test.mjs |25ce070 |1 real browser test/19 checks;0 skips; _artifacts/world-ui-24qKGY |
| Production preparation |25ce070 |30/30,22.243s;429 verified blobs;57 byte-exact assets; [receipt](QUALITY-PRODUCTION.md) |

Every successful browser command used real Windows Chrome156/native events and the actual server, engine and private room routes, with controlled offline fixtures. Critical/ejection outcomes on both maps are recorded in the tactical report. Current/retained task workflows each finish actual human and all-AI matches and export chronological replay. HTTP/WS views, hidden coordinates/roles and owner evidence are checked; zero paid provider calls occurred. The tactical gate predates only the later fallen-chat UI changes; current complete gates cover the retained workflow; the dedicated independent mobile hit-target check is pending.

The first new full suite at25ce reported1267 tests:1256 pass,5 fail,6 skip. All five failures came from a retained label-test DOM missing native Element.contains; actual Chrome flows passed. d05093d adds that DOM behavior without changing any assertion; focused5/5 pass. _artifacts/quality-final-frozen-full.txt retains the red result and quality-final-observer-stub-green.txt the unchanged positive controls. Final combined suite/CI and dedicated independent mobile hit-target requalification are recorded below after execution; pending results are not passes.

CI run [41032751954](https://github.com/antonikzpriv-png/widegames/actions/runs/41032751954) at57d52a3 passed install, syntax, full offline tests, normal browser and retained task browser. It failed the tactical driver when a cancelled route left the actor outside repair range.4911f17 explicitly walks to the accessible panel AFTER preserving the exact collision/cancellation assertions and checks its permission; Windows32/32 passes. Original CI ZIP/report/screenshot are retained in _artifacts/quality-ci57-evidence. A failed runner setup on Windows also preserved that two retained scripts defaulted to Linux Chromium;25ce makes all retained Chrome defaults consistent with the documented platform and CHROME_PATH override. No production permissions/deadlines were loosened.

## Canonical ghost-faction compatibility closure

Core cf73e84/64a0e84 restores current main's shared isGhost policy for all fallen factions. Fallen saboteurs regain private observation/movement/chat, without crew jobs or living powers. The coordinator's f433a4f connects the shared local dispatcher and actual room scheduler: an observer sends one private local message, then its idle planner stops. Restart does not repeat the message or spend. Crew ghosts continue their own real station work. The private Saboteur HUD explains observation rather than promising crew jobs.

The exact-base red Core controls, legal ejection/input/chat/store/authenticated HTTP evidence and forbidden-action assertions remain in QUALITY-PRODUCTION.md. Coordinator added two actual room/controller scheduler fixtures, with only the ejected observer configured nonhuman before match creation. Both fail before transport integration (quality-ghost-scheduler-red.txt) and pass after it. The focused composed run passes19/19 in6.353s, including13 ghost/faction/scheduler controls and retained engine/AI compatibility (quality-ghost-scheduler-green.txt). Provider fetches/reservations/calls/tokens/cost remain zero even with live strategic configuration; all provider boundaries are blocked mocks. No private chat reaches living/public views or replay.

The old merge fixture manufactured a dead saboteur and expected it not to be a ghost. That assertion contradicted current main. It is replaced with legal navigation, meeting, votes and ejection on exact Beacon1/Annex1, positive observer input and no crew jobs, retaining schema/map/history and default-transfer assertions. No saved-state version, identity, accepted receipt, cooldown, source configuration or production budget changed. Full combined/runtime/native requalification follows this last runtime change;25ce receipts above remain explicitly historical.

## Practical limits and setup

- Demo is complete and credential-free. Anthropic integration exists, but no live key/account, real latency, billing or output quality was verified. Use a workspace-scoped key; see [AI.md](AI.md) and [official-contract review](QUALITY-MAIN-AI.md).
- Default lobby is one human plus five AI or six AI. The trusted engine contract supports4..12/custom IDs and multiple saboteurs. Public configurable human seating remains the reserved Group2 lobby extension.
- Live public observers receive only supplied positions from the map's fixed viewpoint. Authorized postgame replay can reveal recorded roles/routes; fallen chat remains private and absent from replay. History bounds and partial coverage are visible.
- Physical task ghosts obey collision and have held server samples, without local movement prediction. They do not count as living crew and cannot repair critical systems.
- Mobile checks use real desktop Chrome with emulated viewport/touch; no physical phone/GPU or frozen Windows executable qualification is claimed. Browser/server tests do not qualify an installer.
- Map/pathfinding timing and counting-surface rendering comparisons are measured CPU results, not FPS promises. See [movement receipt](QUALITY-MOVEMENT.md) and [client receipt](QUALITY-CLIENT.md).

## Launch and upgrade

```powershell
cd D:\Widegames-work\ship-quality-coordinator-20261030
npm ci
npm start
```

Leave that terminal running and open **http://localhost:3000**. If your earlier own server still uses3000, stop it in its terminal with Ctrl+C, or set PORT=3001 and PUBLIC_ORIGIN=http://localhost:3001 before starting. Do not run two writers against one DATA_DIR. Back up the entire stopped-service DATA_DIR before upgrading; saved maps/protocols are not silently converted. See [deployment instructions](DEPLOYMENT.md) for persistent storage, HTTPS/proxy configuration and environment variables. No deployment was performed.
