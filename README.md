# Lantern Wake

An original top-down web social-deduction game: walk a keeper through an illustrated storm beacon or Stormbreak Annex while hidden saboteurs undermine the crew. Play one human with five AI characters or watch six AI characters. Demo bots require no credentials and are explicitly labeled.

Requires Node22.13+ (Node24 LTS recommended) and npm. There is no build step, CDN or external asset service.

```sh
npm ci
npm start
```

Keep the terminal running and open **http://localhost:3000** in your browser. Choose **PLAY AS A KEEPER** for a human seat with five AI keepers, or **WATCH THE AI** for six AI keepers. All seats are filled automatically. Choose **Storm Beacon** or **Stormbreak Annex** in the host lobby, then press **Begin the watch**. Your role appears privately before entering your selected map. Map selection is fixed once started; a new room chooses independently.

New watches use the gameplay-quality preset: the original fourteen-room **Storm Beacon v2** (3200x2400 world units), or eight-room **Stormbreak Annex v1**. Both have map-specific stations, colliding furniture, detailed equipment and alternate routes. Older Beacon v1 saves retain their exact map. New crew receive four different station jobs. The preset includes map-specific sabotage, temporary doors, maintenance passages and timed investigation consoles. Stormbreak Annex has eight rooms, interlocking loops and an isolated observatory, with original copper/slate environmental art. **Systems & evidence** lists your server-permitted actions, cooldowns and historical samples. **E/Space/USE** opens nearby equipment and hatch destination choices.

Older schema2 watches retain the five server-validated step puzzles (including pressure balancing and timed multistage repair); see [interactive tasks](docs/WORLD-TASKS.md).

Walk with **WASD/arrows**, click a clear destination, or use the touch joystick. Rooms, corridors, furniture and nearby keepers occupy an actual server-simulated world. Approach a glowing task station and press **E/Space** or **USE** to open its station: match circuit symbols, tune a signal, enter a sequence, select the requested glyphs in a CAPTCHA-like inspection grid, align rotors, or open pressure valves in order. Every input waits for server confirmation; opening or locally modifying a panel cannot complete a job. The glyph grid is an original in-game puzzle that humans and demo bots solve from the same clues, with no external CAPTCHA service. **R/REPORT** reports a nearby fallen keeper. Approach the Bridge or Muster bell and press **E/Space/USE** to call a meeting. Power failure needs two distinct crew at Engine and Workshop on Beacon, or Condenser and Foundry on Annex. Flooding needs Galley and Archive on Beacon, or Ballast and Observatory on Annex. Approach the marked sites and use **E/Space/USE**. Each keeper may contribute once per failure. A saboteur uses **Q/ELIMINATE** with confirmation for a nearby target, and **SABOTAGE** to choose lights, communications, doors, power failure or flooding. **M/Map** shows the platform and currently permitted observed positions. The on-screen controls provide the same actions.

Council switches to a dedicated discussion and voting scene. Describe what you observed, then vote for a keeper or skip. When the match ends, all roles reveal and the attributed replay is available. Exit is always visible. For another watch, choose **Exit**, then **PLAY AS A KEEPER** or **WATCH THE AI**. Earlier board and walking-world matches keep their original versioned rules. Create a fresh room for systems and investigation. The game supports reduced motion and stops rendering and movement-input renewal while hidden; the server keeps the match running.

**WATCH THE AI** includes an overview and keeper-following controls limited to server-supplied positions, while live roles remain hidden. Completed matches have a spatial replay with play/pause, 0.25×–4× playback, time/event scrubbing, bookmarks, following, role and ballot overlays, and character-perspective history. Public claims, recorded witnesses and reconstructed visibility are labeled separately. Truncated/old recordings show their coverage limits; missing positions are never invented from the final state. [Replay controls, recording format, privacy and validation](docs/SPATIAL-REPLAY.md).


The optional ghost preset keeps fallen crew's owned jobs and private fallen chat; Ward/Echo and strategic intentions from current main are retained.

Crew wins by completing every required task or ejecting the saboteur. The saboteur wins at parity with surviving crew, or when a critical countdown expires. New watches redistribute unfinished tasks at meeting muster; an undiscovered death is not globally announced. Power and flood repairs each require two distinct living crew at two distinct marked sites. Unique highest vote wins; a tie, winning skip or no votes ejects nobody. Missing votes abstain. Meetings do not stop a critical countdown. Each keeper has one emergency call; reports are separate.

World walking speed is180 units/second, with collision and server-owned diagonal normalization. Steering expires after600ms without renewal. Hiding, leaving or closing the page sends a bounded best-effort stop for both keyboard movement and a clicked route. If the connection fails before that stop reaches the server, manual steering expires; an already accepted click route can finish its finite path. Tasks, repair and the bell require proximity92; elimination70; reporting130, with visibility checks. Discrete room-route requests retain a1.2s cooldown; task equipment4s, elimination22s (first18s), faction-shared critical sabotage65s, critical75s, emergency cooldown35s, discussion30s and voting20s. Auxiliary sabotage has a separate faction-shared20s cooldown: lights last45s, communications35s and tactical doors warn for1s, then remain closed for25s if clear, each repairable earlier. An occupied threshold jams open until expiry; no keeper is moved. At most two pending/closed/jammed door attempts coexist; council reopens doors and cancels hatch travel. Only saboteurs use linked hatches, with1.6s travel and15s exit cooldown. Lights reduce crew/public-camera sight to110; normal crew sight360 and saboteur sight400. Devices take2s stationary contact and5s personal cooldown; communications blocks all three. Cameras show limited dated frames (at most six keepers per camera), occupancy shows anonymous room counts, and vitals give dated status without location or role. A spectator observes from the map's fixed Bridge/Muster viewpoint until roles reveal at the end. Cameras show explicitly scoped dated cards. Optional local sound starts muted; use **Sound: off/on** to enable or mute synthesized cues. An unattended four-minute roam calls council. The maximum15-minute duration pauses without inventing a winner. The host can leave: server timers and AI continue. A disconnected human misses votes as abstentions and reconnects using its original HttpOnly room cookie. Losing that cookie cannot grant another visitor the seat. See [world contract](docs/WORLD-CONTRACT.md) and [complete rules](docs/RULES.md).

See [actual desktop/mobile screenshots](docs/quality-screenshots/README.md), [gameplay changes and measured limits](docs/QUALITY-RULES.md), [reference comparison](docs/QUALITY-REFERENCE.md), and [current verification](docs/QUALITY-VERIFICATION.md). Earlier qualification documents describe their exact historical revisions.

## AI and configuration

Demo is credential-free and visibly labeled. For live **hybrid** play, copy `.env.example` to `.env`, set `AI_PROVIDER=anthropic` and your server-side `ANTHROPIC_API_KEY`, then run:

```sh
node --env-file=.env server/main.mjs
```

The real Anthropic adapter uses the pinned Haiku model for council speech and votes; movement and deck actions remain local. Each model sees only its character's permitted view, observations and recent in-game dialogue. API keys, private memories and model reasoning never appear in browser responses. Live play sends that permitted game content to Anthropic. Missing credentials, provider failure or exhausted budgets explicitly select labeled demo for the match. Use a workspace-scoped Anthropic key; unscoped keys require a workspace header that this adapter does not configure. No live provider test is implied by offline qualification. [AI setup, official API references and limits](docs/AI.md).

Calls, conservative token/cost reservations and retries are bounded per match; a separate persisted UTC-day cap bounds the deployment. Configure `MAX_AI_CALLS`, `MAX_AI_TOKENS`, `MAX_AI_COST_USD`, `MAX_DAILY_AI_COST_USD` and `MAX_ACTIVE_ROOMS` on the server. Counters are reserved ceilings, not an invoice. Never commit keys or serve the private `data/` directory.

## Checks and deployment

```sh
npm test
npm run check
npm run test:browser
npm run test:task-browser
npm run test:tactical-browser
npm run test:beacon-browser
npm run test:features:browser
npm run test:spatial-browser
```

The first two run offline engine, AI, authorization, persistence and presentation regressions. Audit suites require a full Git checkout with historical commits; CI fetches that history. Browser qualification requires an installed Chrome/Chromium; `CHROME_PATH` overrides its location. On Windows the default is the standard Google Chrome installation; on Linux it is `/usr/bin/google-chrome`. It starts its own real local server and fresh private fixture, exercises both complete match modes and writes screenshots/report under `_artifacts/world-browser-*/`. These are explicitly seeded, accelerated demo fixtures, with no paid provider calls. The tactical browser audit additionally exercises both maps and checks sabotage, devices, hidden deaths, hatches, private notes, reconnect and native mobile equipment controls through real routes. See [tactical rules](docs/TACTICAL-RULES.md), [exact working interfaces](docs/TACTICAL-INTERFACES.md) and [tactical qualification](docs/TACTICAL-VERIFICATION.md). [Prior Group1 verification](docs/BEACON-VERIFICATION.md) and [earlier verification](docs/VERIFICATION.md) remain historical evidence, not qualification of the tactical revision.

[Deployment and environment configuration](docs/DEPLOYMENT.md) includes the Docker build/run commands, exact public origin, HTTPS/WebSocket proxy and persistent-volume setup. One server process and one budget instance must own each data directory. A lock recovery claim left by an abrupt crash fails closed; stop all writers, back up the directory and verify the recorded PID/owner before operator recovery. Ordinary restart preserves seats, deadlines, action identities and uncertain spending reservations. [Transport details](docs/TRANSPORT.md).

The repository was initially empty, with no origin/main revision. The original board implementation is saved on `codex/lantern-wake-integration-20261029`; the first push made that the repository's default branch automatically. The walking-world redesign starts from its exact saved revision `d5eed65eb4737ceccab594c6dad911ff9033d2ba` and is on `codex/lantern-world-20261029`. See [world qualification](docs/WORLD-VERIFICATION.md). The walking world was merged into main at90bb6e8; main is now the stable default. The completed systems/investigation work at559e135a is preserved in PR4. The additional tactical phase starts from actual main90bb6e8 and includes that completed work on codex/tactical-annex-20261029. No unmerged Group2 branch is a prerequisite. No deployment is performed. See [next feature interfaces](docs/NEXT_FEATURE_INTERFACES.md) and [group1 module contract](docs/BEACON-GROUP1-CONTRACT.md).

Optional strategic AI: set `AI_STRATEGY=strategic` alongside the live Anthropic
configuration to let models choose persistent gameplay intentions (task routes,
following, avoidance, investigation, repair, alibis and saboteur positioning).
Navigation and actions still execute locally through the authoritative engine.
The default `AI_STRATEGY=hybrid` keeps roaming credential-free and uses models only
for council. Both live modes share the existing budgets and labeled demo fallback.
See [strategic configuration and behavior](docs/AI.md#optional-strategic-gameplay-cloud-integration).

## Optional ghosts and ability roles

The host can select **Ghost tasks + fallen chat** and **Optional ability roles** in the lobby before beginning. Classic task transfer and no abilities remain the defaults. Fallen crew in the ghost preset retain their tasks, walk with normal collisions and use the same station puzzles, while remaining dead and excluded from living votes, repair, reports and parity. Only fallen seated keepers receive the private fallen chat.

**Harbor Ward** gives one crew keeper a nearby one-hit protection ability; **Signal Echo** gives the saboteur a clearly labeled distraction. To change server defaults, set `GAME_DEATH_POLICY=ghost-tasks` and `GAME_ABILITIES=true`. [Complete rules, privacy, configuration and screenshots](docs/GHOST-ABILITIES.md). Run `npm run test:features:browser` for the real browser fixture. No live model support is required.


## Expanded maps from current main

The lobby also offers **Storm Foundry** (12 rooms) and **Tidal Observatory** (14 rooms), preserved from main41b4c6e. These use their authored world2/taskStep protocol: twelve jobs per crew keeper, covering the original five puzzles plus glyph selection, counting, ascending order, rotation, odd-one-out and code transcription. Progress is authoritative and saved; no external CAPTCHA service or model call is required. Their original mapId-based saved games and replay geometry remain distinct from tactical station watches.

Beacon2 and Stormbreak Annex retain their tactical systems and six station challenge kinds. Original Beacon1 and prior map/protocol versions remain readable. Server defaults may use GAME_MAP; the host chooses the final map through the same lobby. Run npm run test:maps:browser for the expanded-map native fixture. [Authored map details and screenshots](docs/EXPANDED-MAPS.md), [newest integration qualification](docs/QUALITY-LATEST-MAIN-INTEGRATION.md).


## Private all-AI inspection

The authenticated host of a WATCH THE AI room can inspect the simulated keepers: recorded positions, ghost state, task progress, cooldowns, claims and bounded structural controller plans. This is an omniscient owner view; a recorded plan is not private thoughts or verified intent. Human rooms and public joined spectators retain the original limited, role-private feed. Keys, prompts, model reasoning, provider errors, memories and fallen chat are excluded. [Inspection controls and permissions](docs/SPECTATOR.md). Run npm run test:spectator:browser for the real inspection fixture; npm run perf:spectator is an optional measured benchmark, not an FPS promise.
