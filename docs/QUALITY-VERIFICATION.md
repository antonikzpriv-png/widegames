# Gameplay-quality verification

This branch extends the existing Lantern Wake server and browser; it does not bundle Among Us assets or claim exact proprietary map dimensions. Primary reference and explicit differences are in [QUALITY-REFERENCE.md](QUALITY-REFERENCE.md).

## Source and preservation

Started from actual origin/main **90bb6e881f75f77e85b8b49729971a710b4c91b4** and incorporated the completed tactical PR5 revision **d55144dd3c71f5ad965814aee92f4612bc4084ba**. Main advanced during implementation to **43c079999506785196ab85750105ceb102ba9314**; it is preserved through merge **7d8532afdb47179b96ec56ead6a7f0ee1bc34941**. Original branches, worktrees, map1 saves, identities, action receipts, private evidence and uncertain spending reservations remain. No direct main changes, merge, deployment or live paid provider calls occurred.

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

Current final qualification and screenshot links are recorded after the final integrated runtime is frozen. No pending result is counted as a pass.

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
