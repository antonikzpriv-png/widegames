# World experience contract

**Current extension:** [Multiplayer lobbies and rematches](MULTIPLAYER.md) adds 4–15 actors, per-match speed/vision and options, multiple authenticated humans, private saboteur teammates and generation-aware rematches. Shared geometry/default constants remain immutable. Historical worktree paths and pre-main status below describe the original implementation, not current development requirements.

Base: latest remote integration `d5eed65eb4737ceccab594c6dad911ff9033d2ba` (there is still no origin/main). Every editor uses a separate `D:/Widegames-work/world-*-20261029` checkout. The user's original running checkout and data are preserved. Official reference: https://www.innersloth.com/games/among-us/ and https://innersloth.itch.io/among-us . Original Lantern Wake maps, characters, artwork and names remain ours; reference assets are not shipped.

The product becomes a full-screen illustrated top-down character game: WASD/arrows/touch movement, clickable navigation, nearby stations with minigames, bodies, sabotage, dedicated meetings/voting and reveal/replay scenes. AI uses the same authoritative world.

## Shared geometry (coordinator)

`shared/world.mjs` exports WORLD, WORLD_ROOMS, WORLD_FLOORS, WORLD_OBSTACLES, WORLD_STATIONS, WORLD_BELL, worldRoomAt, worldSpawn, distance, isWalkable, moveWorldPoint, canSeeWorldPoint and findWorldPath. Positions are `{x,y}`. Rectangles use `x,y,width,height`; rooms also have center. Stations are keyed by room ID. World size1600x1200; speed180 units/sec; body radius14; visibility360; interaction92; kill70; report130; input lease600ms. Routes return waypoint arrays excluding the start, ending at the exact target, or null if unreachable. No client-provided time, speed or position is authoritative.

## Engine (core)

`createMatch({...options,world=false})` preserves existing programmatic fixtures by default. New production matches explicitly opt in. Schema2 adds worldVersion1, positions, navigation and bounded input state; existing schema1 rooms retain their semantics. `applyInput(state,actor,{seq,dx,dy},now)` returns the same accepted/error/state shape as applyAction. Positive safe-integer sequence; integer axes -1..1; diagonal normalized; expiry600ms; stale/duplicate inputs cannot repeat movement. Input sequence is persisted separately from the lifetime discrete-action ID budget.

New discrete action `navigate` has x/y finite destination coordinates; engine pathfinds and validates collision. World `move {roomId}` starts a physical adjacent-room route ending near its station. Movement settles at server time alongside chronological deadlines, stops in non-roam phases, on death and lease expiry. `roomId` remains the last valid room while traversing corridors. Task/repair/bell/elimination/report proximity is authoritative. Body sightings carry actual death position/time. Movement replay records are bounded and useful, never per-render-frame model activity.

World safe views add `game.worldVersion:1`, `self.position`, `self.inputSeq`, `self.moving`, `self.destination` (own only). Other players have `position:null` when unseen and no hidden destination/input/role. Local body events include visible position. Spectators may observe physical public positions, with roles withheld until ended. Never attach complete hidden state to a browser or AI view.

## Transport (integrations)

`POST /api/rooms/:id/input` accepts exactly `{seq,dx,dy}` under existing room authentication/origin/body limits. Derive actor from cookie; spectators cannot steer. Separate bounded movement rate from discrete action60/min limit; retain global600/min HTTP ceiling. Serialize, persist and broadcast safe views. Core's applyInput performs game validation. Optional WS input may share the same boundary. Preserve budgets, account/room isolation, current source validation and restart behavior.

Production loadConfig sets worldMode true and tickMs100. The direct test constructor's unspecified worldMode stays legacy; start forwards `world:config.worldMode===true`. This is explicit backwards compatibility for existing fixtures, not the default user-facing mode. New world tests and browser qualification must opt in and exercise the actual production path.

## Browser (frontend + coordinator)

Frontend owns `public/world/**`, `public/game.css`, `tests/world-ui*.test.mjs`, WORLD-UI docs. Export `createWorldExperience(host,callbacks)` from `public/world/experience.mjs`, returning `update(room,{now,connected,pending,feedback})` and `dispose()`. Callbacks: async `action(type,fields)`, async `input({seq,dx,dy})`, async `start()`, `leave()`, async `loadReplay()` returning the actual replay envelope. Root owns app/network/config/static/index wiring and normal launch commands. No new keys/client fetches in renderer.

Full world rendering, room props, keeper animation, compact HUD, interaction/minigame modal, council/vote/results/replay are frontend-owned. Views drive actual phase and timers. Interpolation cannot reveal hidden actors. Preserve drafts/focus during updates; no controls while typing; dispose/hidden/blur stops rendering and sends zero input best-effort; lease is server fallback. Input refresh200ms while held only, sequence resumes from self.inputSeq. Task success submits only after solution and unchanged room/phase/proximity, then server validates. Keep exit/status/demo labels visible, reduced motion and touch support.

## AI (reviewer explicit implementation assignment)

Reviewer owns server/ai and world-ai tests/docs in its isolated branch. Use own safe position/destination and visible entities only. Wait while traversing when appropriate; navigate to known stations/visible bodies/targets when out of range. Models remain bounded council adapters, never pathfind every frame; demo stays clearly labeled. Legacy bot behavior remains compatible. The reviewer then independently inspects other owners' exact changes; self-authored AI requires separate verification.

## Verification

Preserve old evidence. New real-world engine/transport tests must cover collision, speed, ranges, input sequencing/expiry/restart, phases/deadlines and hidden coordinates. Real browser qualification must use worldMode true, movement and stations rather than old dashboard buttons, plus both complete match modes and replay. Do not run paid/live model calls. Frontend holds the development Chrome lease until explicitly released. Manager integrates inspected commits and runs final combined checks; no main, deploy or changes to the original running data.
