# Lantern Wake walking-world qualification

This redesign implements a real top-down walking game with original keeper art, six connected rooms, collision/visibility, nearby interactions, three equipment puzzles, council, voting, results and replay. Both human-plus-five-AI and six-AI watches use the same authoritative engine. This receipt supersedes dashboard presentation claims in VERIFICATION.md; old receipts remain historical.

The base is exact saved widegames revision d5eed65eb4737ceccab594c6dad911ff9033d2ba. The repository had no origin/main. Work remains on codex/lantern-world-20261029; no main creation/merge, live deployment, installer or paid provider call is claimed. All source/worktrees/temp/artifacts remain on D:. The old coordinator checkout and its saved matches are preserved.

## Integration and ownership

| Area | Integrated implementation |
| --- | --- |
| Foundation/integration | shared/world.mjs, root app/session/input bridge, configuration, launch/menu, real-browser qualification |
| Core | schema2 world simulation, validated steering/navigation, physical interactions, phase deadlines, safe views and chronological ended replay |
| Frontend | public/world modules and game.css: illustrated Canvas world, keyboard/touch/click controls, task puzzles, role/council/ejection/results/replay scenes |
| Integrations | authenticated room input endpoint, serialized persistence and restore, HttpOnly seat identity, bounded input rate and compatible denial receipts |
| AI/review | safe-view local physical navigation and council-only bounded model adapter; labeled demo fallback and independent UI/Core/root controls |

The new world is enabled by normal loadConfig/main startup. Existing schema1 board matches retain their rules and a legacy notice; leave the old room to create a new world. There is no forced data conversion. Keys, private memories and server state remain outside shipped assets. Ended replay sorts a defensive copy by actual timestamps; equal-time causal order is retained.

## Observed verification

Final clean runtime source 2e7a28c167e3bce225f0c4570dbbbb90933da0f0 passed the real primary browser workflow:26 named assertions,473 HTTP/WebSocket private-view checks, three real generated minigames, both match modes through engine-defined crew task victory and chronological replay,320/390 portrait and landscape, zero runtime/console/cleanup errors and unchanged runtime source. Rules-open viewport and native hover contrast checks also passed. These are seeded, accelerated demo fixtures, not default-speed performance measurements.

A separate opt-in Chrome audit at the same clean pin passed one Node test containing19 named scenarios: native keyboard/touch/click motion, station invalidation, spectator HTTP fallback, all puzzles, discussion focus/draft, voting and replay keyboard access, confirmed elimination/cancel focus, local reports, nonterminal ejection privacy, mobile critical repairs and countdown through council. It used real server/engine/transport with explicitly idle AI scheduling and legal fixture seat actions; it is distinct from the full demo matches. Source remained unchanged, no runtime errors, and owned browser/server/data cleanup passed.

Reports: [primary browser](world-browser-qualification.json), [extended UI](world-ui-qualification.json), [offline/preparation summary](world-test-summary.json). Selected actual [world](world-screenshots/world.png), [mobile](world-screenshots/mobile.png), [council](world-screenshots/council.png), [equipment](world-screenshots/task-wires.png), [critical repair](world-screenshots/mobile-critical-repair.png) and [replay](world-screenshots/replay.png) screenshots are committed beside this document. Overlapping suites and private-view counts are not added into a unique test total.

The first combined offline run registered427 tests:420 passed,6 explicit opt-in skips,1 failure in the legacy scheduler fixture's roughly one-second host-time wait under simultaneous Chrome load. Its failed log remains _artifacts/world-integration/final-offline.txt. All six actors, real victory and replay assertions remain required; the final test-only correction gives this single scenario a ten-second deadline and progress diagnostics while preserving every correctness assertion. Its focused original isolated run passed, and a two-second delayed local decision reproduces the old timeout and passes the corrected wait. Final npm test passed432 registered /426 passed /6 opt-in skips /0 failures in75.03 seconds, with no competing browser. npm run check passed91 JavaScript modules. These final logs are _artifacts/world-integration/{final-offline-rerun.txt,final-check.txt}; focused labels/transport15 checks also pass. The earlier clean101128a browser runs passed26 primary and19 supplemental checks as well; those receipts remain in ignored artifacts.

Core's independent production-only receipt remains pinned to56c320a537d0cb2da7c5079f24bc26b9337d1f17:17 checks passed, only ws installed offline,21 byte-exact shipped assets, real main startup/HTTP/WS, gracefully handled shutdown/restart and persistent seat/input identity, zero provider calls or forced stops. At the final2e7a28c pin, server/shared/package files are byte-identical, so those backend checks remain applicable by source identity. Changed public assets are separately browser-qualified and must not be relabeled as the older exact asset bytes. See WORLD-PRODUCTION-REVIEW.md.

## Audit closure

Independent receipts in WORLD-UI.md, WORLD-TRANSPORT.md and WORLD-AI.md retain the historical failing pins. Closed findings include integer steering/diagonal normalization, compatible legacy action hints, input outage readiness, room-bound exact-ID retries, one bounded independent keepalive stop, stale task callbacks including roam/council/roam return, obsolete puzzle failures, inaccessible primary hover colors, help displacing the full-screen world, and ended replay chronology. Final source reviews found no new backend/permission/spending boundary defect in the reviewed scope. The final minor labels now reserve walking guidance for living roaming keepers and say roles revealed for ended spectators, with five regression checks. README/help explain E/Space/USE for bell/repair and the finite clicked-route outage limit. CI explicitly runs the opt-in world UI audit and uploads actual world artifact paths; Linux execution is configured but not claimed verified locally.

## Reproduce

Run from the task checkout, with Node22.13+ and a full Git clone fetching all branches (historical negative controls load original committed source):

~~~powershell
cd D:/Widegames-work/world-coordinator-20261029
npm ci
npm test
npm run check
npm run test:browser
$env:LW_WORLD_BROWSER='1'
node --test tests/world-ui-browser.test.mjs
Remove-Item Env:LW_WORLD_BROWSER
~~~

Chrome/Chromium is required for browser checks; CHROME_PATH overrides the executable. Normal world test defaults resolve the current checkout; remove stale audit WORLD_*ROOT/PIN/MODULE source overrides. Retain codex/lantern-ui-20261029 as well as the world worker branches: ordinary historical controls require frontend0d93c1b, Core093d049/aa471eb and world UIb2cc6c3/9e571c7. Source ZIPs and shallow single-branch clones cannot run those controls. The standalone world-core-production-review.mjs is not part of npm test; follow its pinned archive preparation receipt, including its D: cache paths.

For play, stop the earlier npm start terminal with Ctrl+C (it may still own port3000), then use this new checkout and npm start. Open http://localhost:3000, choose PLAY AS A KEEPER or WATCH THE AI, Begin the watch, then Enter the beacon. Terminal listening output means the server is running; it does not automatically open a browser. For another watch use Exit and create a fresh room.

## Concrete limits

No live Anthropic credential/billing verification, Docker image execution, hosted CI, HTTPS/proxy deployment, public load test, physical mobile hardware, alternate browser or screen-reader qualification is claimed. Live council setup is documented in AI.md; demo is usable without credentials. Movement remains local policy even in hybrid mode. Custom data directories must stay outside public/shared. Single-process locking/restart is qualified; distributed writers, abrupt power-loss durability and NTFS ACL qualification are not.

If an outage prevents a best-effort stop from arriving, manual steering expires after600ms; an accepted finite click route can finish. The server continues independently of a hidden/disconnected host. Fixture clocks, roles and legal seat actions are explicitly controlled; no HTTP response, model judgment, location or winner is fabricated. No unrelated Calythe, voice, branding, signing or updater changes are part of this game.
