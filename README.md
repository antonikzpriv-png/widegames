# Lantern Wake

An original web social-deduction game: six keepers maintain a drifting storm beacon; one is a hidden saboteur. Play one human with five AI characters or watch six AI characters. Demo bots require no credentials and are explicitly labeled.

Requires Node22.13+ (Node24 LTS recommended) and npm. There is no build step, CDN or external asset service.

```sh
npm ci
npm start
```

Open **http://localhost:3000**. Choose **Join the crew** for a human seat with five AI keepers, or **Watch the keepers** for six AI keepers. All seats are filled automatically; press **Start the watch**. Your assigned role appears privately. Use the room map to move along connections and the action cards to complete tasks, report a body, repair or sabotage. The emergency bell is on Bridge. During council, discuss what you saw, then vote for a keeper or skip. When the match ends, all roles reveal and the full attributed replay is available.

Crew wins by completing every required task or ejecting the saboteur. The saboteur wins at parity with surviving crew, or when a critical countdown expires. Unfinished tasks transfer from fallen crew to surviving crew. Critical repairs require two distinct living crew in Engine. Unique highest vote wins; a tie, winning skip or no votes ejects nobody. Missing votes abstain. Meetings do not stop a critical countdown. Each keeper has one emergency call; reports are separate.

Default timings: movement1.2s, task equipment4s, elimination22s (first18s), sabotage65s, critical75s, emergency cooldown35s, discussion30s and voting20s. An unattended four-minute roam calls council. The maximum15-minute duration pauses without inventing a winner. The host can leave: server timers and AI continue. A disconnected human stays idle, misses votes as abstentions, and reconnects using its original HttpOnly room cookie. Losing that cookie cannot grant another visitor the seat. See [complete rules](docs/RULES.md).

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

The first two run offline engine, AI, authorization, persistence and presentation regressions. Audit suites require a full Git checkout with historical commits; CI fetches that history. Browser qualification requires an installed Chrome/Chromium; `CHROME_PATH` overrides its location. On Windows the default is the standard Google Chrome installation; on Linux it is `/usr/bin/google-chrome`. It starts its own real local server and fresh private fixture, exercises both complete match modes and writes screenshots/report under `_artifacts/browser-*/`. These are explicitly seeded, accelerated demo fixtures, with no paid provider calls. Additional opt-in independent/browser suites and exact observed results are recorded in [verification](docs/VERIFICATION.md).

[Deployment and environment configuration](docs/DEPLOYMENT.md) includes the Docker build/run commands, exact public origin, HTTPS/WebSocket proxy and persistent-volume setup. One server process and one budget instance must own each data directory. A lock recovery claim left by an abrupt crash fails closed; stop all writers, back up the directory and verify the recorded PID/owner before operator recovery. Ordinary restart preserves seats, deadlines, action identities and uncertain spending reservations. [Transport details](docs/TRANSPORT.md).

The repository was initially empty, with no origin/main revision. The implementation is saved on `codex/lantern-wake-integration-20261029`; the first push made that the repository's default branch automatically. Main was not created or merged, and no deployment was performed.
