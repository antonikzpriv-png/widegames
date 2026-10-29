# Spatial systems and investigation qualification

Group1 extends the existing Lantern Wake application; it does not replace its stack or data directory. Work started from latest origin/main **90bb6e881f75f77e85b8b49729971a710b4c91b4**, also the actual GitHub default branch. A final fetch found main unchanged. All five participants used separate task branches/worktrees under D:/Widegames-work. No deployment, main update, installer or live-provider call was performed.

## Integrated implementation

| Responsibility | Actual integration | Visible workflow |
| --- | --- | --- |
| Spatial authority | server/engine/world, root validation/projections | Collision-limited walking, dynamic doors/prop occlusion, configurable lights-sensitive sight, exact permitted targets and private death knowledge. |
| Sabotage and routes | server/engine/systems, chronological root deadlines | Lights, communications, up to two closed doors, two-site power/flood repairs, explicit hatch destination and locally witnessed entry/exit evidence. |
| Investigation | server/engine/investigation, owner-only samples | Stationary timed security, anonymous occupancy and vitals terminals. Communications cancels reads; samples retain their actual time and collection limits. |
| Spatial client | public/world, existing public/app entry | Original storm-beacon map/characters, keyboard/touch controls, task puzzles, Systems & evidence, fog/doors/critical feedback, councils and replay. |
| Coordinator | root engine/store/transport/AI/config and server/public features | Schema3 checkpoints, identity/action/budget continuity, safe bot navigation, extensible tasks/goals/rosters/death abilities/panels and ended-only replay snapshots. |

The executable module contract was committed before builder implementation. The integrated source keeps normal npm start entry points. New rooms use room schema2/match schema3 with beaconVersion1; existing schema1 board/schema2 walking-world saves stay on their own rules. Undiscovered deaths do not become global notifications. Spectators observe from the Bridge until resolution. Contributor identities, secret destinations, device sessions, observations, private requests and AI context do not enter another player's HTTP/WebSocket view.

Group2 has reserved directories and working registrations, not disconnected stubs. Existing tasks mutate real progress through taskService; local goals drive actual bots; configured IDs/faction counts reach engine/authenticated transport; field-note records an actual private location from the UI; panel updates are cancellable; real ended replay routes return sampled snapshots. Read [exact extension instructions](NEXT_FEATURE_INTERFACES.md), [rules](RULES.md) and [contract](BEACON-GROUP1-CONTRACT.md). Public multiplayer human-seat allocation, new interactive task protocols, ghost roles, strategic model planning and spatial replay scrubbing remain Group2 work.

## Exact source and evidence

The final runtime is byte-identical at the Git-blob level to **afc6b1a94d201a943e84b955fcb492fc2ed031bc** across all60 server/public/shared paths. Package dependency declarations/lockfile are unchanged. Later commits contain only harness/test/documentation/evidence changes. [Runtime manifest](evidence/beacon-runtime-manifest.json) records every deployed blob; the browser runs separately checked their working runtime bytes before/after execution. Receipt source pins below are retained, rather than relabeled as the final documentation commit.

| Check | Exact source pin | Observed result |
| --- | --- | --- |
| Complete offline regression suite | 26e1e0348bb533ed25bd8c747175d6c974ef9e47 | 661 registered:655 passed,0 failed,6 explicit skips;69.995s. |
| Syntax preparation | Same integrated runtime | npm run check:140 JavaScript modules; git diff --check clean. No bundle/build step exists. |
| Full autonomous browser matches | 0525738d6e5a66a8e660ada27d0ec7be00852403 |26/26 checks,505 safe-view inspections,0 runtime/console errors; human-plus-AI and all-AI both won by tasks and opened chronological role-revealed replays. |
| Systems/investigation browser scenarios | c5583457795bb65e493f05544e124ee7d3bd05c4 |13/13 checks,632 safe-view inspections,0 runtime/console errors; owned browser/server/data cleanup succeeded. |
| Production-only actual main and restart | afc6b1a94d201a943e84b955fcb492fc2ed031bc |19/19 checks,33 byte-exact public/shared assets; ws8.22.0 only, no Puppeteer; two natural code0 exits,0 provider fetches/socket privacy errors/forced stops. |
| Legacy walking-world browser compatibility | 26e1e0348bb533ed25bd8c747175d6c974ef9e47 | 19/19 recorded checks in one passing browser test,37.894s; real touch joystick/keyboard, three puzzles, council, replay and critical deadline;0 runtime errors, source unchanged and cleanup succeeded. |

Windows Node24.20.0 and Chrome156.0.8078.73 were used. The [full passing test log](evidence/beacon-offline-tests.txt) preserves all names and diagnostics. Full-suite discovery skips six explicitly opt-in/browser or historical harness cases; those skips are not passes. Individual targeted counts overlap the complete suite and must not be added as unique tests. Machine-readable [full-match browser](evidence/beacon-full-match-browser-report.json), [systems browser](evidence/beacon-browser-report.json) and [production](evidence/beacon-production-report.json) and extracted [legacy browser](evidence/beacon-legacy-browser-report.json) receipts accompany the screenshots.

The full browser uses the actual demo AI controller, real cookies, native HTTP/WS, persistent store and unmodified authoritative rules implementation. Seeded roles/clock acceleration and explicit shortened auxiliary effects (one second), longer first critical/kill cooldowns, and shorter council timings make task/council coverage deterministic. These are labeled fixtures, not default-duration or live-provider performance claims. The separate systems scenario uses explicitly server-directed demo queues through the real scheduler to stage legal sabotage, travel, kills and device actions; it never assigns a winner or fabricates an API response. Its native mobile tap logs a real field note; keyboard Escape closes a focused panel. Layout checks cover390x844,320x740 and844x390. No physical phone was tested.

Default-rule engine simulations separately finish human/spectator seeds3/17 with safe-view-only actual bots and JSON restart, plus eight custom IDs/two saboteurs. The complete suite checks speed/collision, doors, radius/LOS, unknown deaths, terminal permission/sample caps, deterministic deadline precedence, ties/skips/parity/tasks/ejection/critical wins, stale UI completions, reconnect/duplicate IDs, authentication/origin/cross-room boundaries and malformed checkpoint quarantine. Mocked provider tests and zero-budget fixtures do not constitute a live model test.

## Independent audits and retained failures

All four builders completed implementation and then bounded independent integration reviews. The coordinator inspected actual diffs, integrated focused commits and ran the combined code. Two concrete audit defects were closed:

- BS-R1: valid inherited-name player IDs could be mistaken for transit entries. The independent old-source control failed three IDs. Own-property lookup/write fixes preserve those IDs, owner notes and immutable request receipts; the independent12-check closure passes. [Systems review receipt](BEACON-SYSTEMS.md).
- BIR-1: a multi-saboteur demo actor could target its teammate despite permitted crew targets. The bot now proposes an enabled authoritative target. The independent old6a97c798 control still fails; the corrected afc6b1a runtime passes13/13. A separate sequential control verifies an accepted kill is followed by a legal report, instead of incorrectly forcing a second kill. [Projection/AI review receipt](BEACON-INVESTIGATION-REVIEW.md).

Additional reviews covered private critical repairers across actual HTTP/WS/restart, camera sight independent of its reader's faction, stale equipment success/error/retry handling, private hatch endpoints, strict knowledge restore and production packaging boundaries. [World receipt](BEACON-WORLD.md), [client receipt](BEACON-CLIENT.md) and [device rules](BEACON-INVESTIGATION.md) state their exact scopes and limitations.

Initial full-suite evidence is preserved at _artifacts/beacon-final-tests.txt:652 pass,3 fail,6 skip. One legacy board fixture inherited the newly enabled systems flag; two draw VMs omitted newly imported real scene helpers. Their owners reproduced each failure and repaired only fixture configuration/dependency wiring, retaining every original assertion. The final totals above supersede that run.

Failed browser-development reports/screenshots remain under _artifacts. They caught a root-path cookie probe, role-acknowledgment/touch-capability reload races, unfocused Escape, a clock advanced before the ballot receipt, and a task key pressed before the new visible station affordance arrived. Harness fixes wait for real permitted state, focus and acknowledgments; no runtime permissions or assertions were relaxed. Successful final receipt directories are beacon-browser-ROTtnt and world-browser-TSOtuD. The production archive and independent red/green evidence remain in each original D: worktree.

## Launch and repeat

From the development machine (stop the old npm start terminal with Ctrl+C first if it owns port3000):

~~~powershell
cd D:\Widegames-work\beacon-systems-coordinator-20261029
npm ci
npm start
~~~

Open **http://localhost:3000** in a browser; the terminal remains running as the server. Choose Play as a keeper or Watch the AI, then Begin the watch. Create a fresh room for systems/investigation; restored old rooms intentionally keep their version. Demo requires no credentials. See [deployment/env instructions](DEPLOYMENT.md) for .env, HTTPS/origin, data volume and bounded live-provider setup.

~~~powershell
npm test
npm run check
npm run test:browser
npm run test:beacon-browser
$env:LW_WORLD_BROWSER='1'
node --test tests/world-ui-browser.test.mjs
Remove-Item Env:LW_WORLD_BROWSER
~~~

Use a full Git clone with history for retained historical-source controls, installed Chrome (or CHROME_PATH), and no concurrent browser qualification. On this machine set TEMP/TMP to D:/Widegames-work/temp and npm_config_cache to D:/Widegames-work/npm-cache. Production-only reproduction is documented in BEACON-WORLD.md: materialize the exact pinned archive/manifest, npm ci --omit=dev, then run tests/beacon-world-production-review.mjs against it.

## Practical limits

No known failing runtime check remains within the recorded scope. Default fifteen-minute timeout can pause a match; no invented winner is used. Device history is bounded64 samples per owner, field notes32, snapshots256 at five-second intervals plus final resolution, existing replay12,000 events. A long/high-input match may lose early replay detail; this is not frame-perfect video. A spectator's fixed Bridge view is deliberately limited. There is no new sound feature or voice control.

Live Anthropic credentials/billing, Docker execution, hosted Linux/proxy deployment, real mobile hardware, power-loss/ACL behavior and OS-delivered POSIX shutdown are unverified. Windows production shutdown qualification invokes the actual registered SIGTERM handler through IPC and observes natural exits; it does not claim a POSIX signal was delivered by Windows. No installer or frozen executable is produced by this native web application. Group2 should begin after review/merge or from an explicitly approved integration pin; this group does not auto-enable the next phase.

## Screenshots from actual fixtures

[World](beacon-screenshots/01-beacon-world.png) ? [Camera sample](beacon-screenshots/02-camera-evidence.png) ? [Lights](beacon-screenshots/06-lights.png) ? [Flood repair](beacon-screenshots/08-flood-repair.png) ? [Critical council](beacon-screenshots/09-critical-council.png) ? [Hatch transit](beacon-screenshots/11-hatch-transit.png) ? [Mobile evidence](beacon-screenshots/13-mobile-evidence.png) ? [Ejection result](beacon-screenshots/14-ejection-results.png) ? [Task puzzle](beacon-screenshots/04-task-wires.png) ? [Discussion](beacon-screenshots/05-council.png) ? [All-AI replay](beacon-screenshots/09-all-ai-replay.png).
