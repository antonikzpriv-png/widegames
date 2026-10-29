# Lantern Wake

An original top-down web social-deduction game: walk a keeper through an illustrated storm beacon while one hidden saboteur undermines the crew. Play one human with five AI characters or watch six AI characters. Demo bots require no credentials and are explicitly labeled.

Requires Node22.13+ (Node24 LTS recommended) and npm. There is no build step, CDN or external asset service.

```sh
npm ci
npm start
```

Open **http://localhost:3000**. Choose **PLAY AS A KEEPER** for a human seat with five AI keepers, or **WATCH THE AI** for six AI keepers. All seats are filled automatically; press **Begin the watch**. Your assigned role appears privately, then **Enter the beacon**.

Walk with **WASD/arrows**, click a clear destination, or use the touch joystick. Rooms, corridors, furniture and nearby keepers occupy an actual server-simulated world. Approach a glowing task station and press **E/Space** or **USE** to open its wiring, tuning, sequence, pressure-balancing or multistage repair equipment. Complete server-validated steps, then send the completed task. Confirmed progress survives interruptions; a running repair diagnostic restarts after movement or council. See [interactive tasks](docs/WORLD-TASKS.md). **R/REPORT** reports a nearby fallen keeper. Approach the Bridge bell and press **E/Space/USE** to call a meeting. During critical sabotage, approach the flashing repair station in Engine and use **E/Space/USE** to contribute a repair; two distinct living crew are required. A saboteur uses **Q/ELIMINATE** with confirmation for a nearby target, and **SABOTAGE** to start a critical countdown. **M/Map** shows the platform and currently permitted observed positions. The on-screen controls provide the same actions.

Council switches to a dedicated discussion and voting scene. Describe what you observed, then vote for a keeper or skip. When the match ends, all roles reveal and the attributed replay is available. Exit is always visible. For another watch, choose **Exit**, then **PLAY AS A KEEPER** or **WATCH THE AI**. Existing legacy board matches keep their original rules; choose **Leave room** and create a fresh room for the walking world. The game supports reduced motion and stops rendering and movement-input renewal while hidden; the server keeps the match running.

Crew wins by completing every required task or ejecting the saboteur. The saboteur wins at parity with surviving crew, or when a critical countdown expires. Unfinished tasks transfer from fallen crew to surviving crew. Critical repairs require two distinct living crew in Engine. Unique highest vote wins; a tie, winning skip or no votes ejects nobody. Missing votes abstain. Meetings do not stop a critical countdown. Each keeper has one emergency call; reports are separate.

World walking speed is180 units/second, with collision and server-owned diagonal normalization. Steering expires after600ms without renewal. Hiding, leaving or closing the page sends a bounded best-effort stop for both keyboard movement and a clicked route. If the connection fails before that stop reaches the server, manual steering expires; an already accepted click route can finish its finite path. Tasks, repair and the bell require proximity92; elimination70; reporting130, with visibility checks. Discrete room-route requests retain a1.2s cooldown; task equipment4s, elimination22s (first18s), sabotage65s, critical75s, emergency cooldown35s, discussion30s and voting20s. An unattended four-minute roam calls council. The maximum15-minute duration pauses without inventing a winner. The host can leave: server timers and AI continue. A disconnected human misses votes as abstentions and reconnects using its original HttpOnly room cookie. Losing that cookie cannot grant another visitor the seat. See [world contract](docs/WORLD-CONTRACT.md) and [complete rules](docs/RULES.md).

## AI and configuration

Demo is credential-free and visibly labeled. For live **hybrid** play, copy `.env.example` to `.env`, set `AI_PROVIDER=anthropic` and your server-side `ANTHROPIC_API_KEY`, then run:

```sh
node --env-file=.env server/main.mjs
```

The real Anthropic adapter uses the pinned Haiku model for council speech and votes; movement and deck actions remain local. Each model sees only its character's permitted view, observations and recent in-game dialogue. API keys, private memories and model reasoning never appear in browser responses. Live play sends that permitted game content to Anthropic. Missing credentials, provider failure or exhausted budgets explicitly select labeled demo for the match. No live provider test is implied by offline qualification. [AI setup, official API references and limits](docs/AI.md).

Calls, conservative token/cost reservations and retries are bounded per match; a separate persisted UTC-day cap bounds the deployment. Configure `MAX_AI_CALLS`, `MAX_AI_TOKENS`, `MAX_AI_COST_USD`, `MAX_DAILY_AI_COST_USD` and `MAX_ACTIVE_ROOMS` on the server. Counters are reserved ceilings, not an invoice. Never commit keys or serve the private `data/` directory.

## Checks and deployment

```sh
npm test
npm run check
npm run test:browser
```

The first two run offline engine, AI, authorization, persistence and presentation regressions. Audit suites require a full Git checkout with historical commits; CI fetches that history. Browser qualification requires an installed Chrome/Chromium; `CHROME_PATH` overrides its location. On Windows the default is the standard Google Chrome installation; on Linux it is `/usr/bin/google-chrome`. It starts its own real local server and fresh private fixture, exercises both complete match modes and writes screenshots/report under `_artifacts/world-browser-*/`. These are explicitly seeded, accelerated demo fixtures, with no paid provider calls. Additional opt-in independent/browser suites and exact observed results are recorded in [verification](docs/VERIFICATION.md).

[Deployment and environment configuration](docs/DEPLOYMENT.md) includes the Docker build/run commands, exact public origin, HTTPS/WebSocket proxy and persistent-volume setup. One server process and one budget instance must own each data directory. A lock recovery claim left by an abrupt crash fails closed; stop all writers, back up the directory and verify the recorded PID/owner before operator recovery. Ordinary restart preserves seats, deadlines, action identities and uncertain spending reservations. [Transport details](docs/TRANSPORT.md).

The repository was initially empty, with no origin/main revision. The original board implementation is saved on `codex/lantern-wake-integration-20261029`; the first push made that the repository's default branch automatically. The walking-world redesign starts from its exact saved revision `d5eed65eb4737ceccab594c6dad911ff9033d2ba` and is on `codex/lantern-world-20261029`. See [world qualification](docs/WORLD-VERIFICATION.md). Main was not created or merged, and no deployment was performed.
