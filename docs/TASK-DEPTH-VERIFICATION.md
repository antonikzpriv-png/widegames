# Detailed tasks and waiting-room qualification

The task extension is checked independently of its task-engine and UI builders. All fixtures use local or mocked providers. No paid calls, deployment or changes to main are part of qualification.

## Independent automated audit

```sh
node --test tests/task-depth-audit.test.mjs
CHROME_PATH=/workspace/.cloud-setup/bin/chromium-cloud node scripts/task-depth-browser-check.mjs
```

`tests/task-depth-oracle.mjs` interprets the public challenge display independently; the audit does not call the engine's `taskInput` answer function. The unit suite covers every edition-3 family, rejects wrong/future inputs and direct completion, exercises duplicate receipts and real semantic completion, checks private HTTP-view shapes, and validates intermediate snapshots. Additional scenarios cover strict disk save/reload at 4, 6 and 15 keepers, byte-preserving checkpoint reads, no quarantine of valid data, server-timed sample incubation, interrupted transfers and fabricated progress metadata.

The browser fixture covers the actual launch app and its native computer/wardrobe controls, settings and profile persistence into a real authenticated room, play/watch choices, mobile widths, and the actual task panel module against the real transport, engine and private store. Each exhaustive task-family scenario deliberately selects the first human task's kind **before match start** and places its station at Bridge. The human follows legal navigation to that station. An isolated test-only panel host mounts the production component using only the authenticated owner's safe view and submits real HTTP actions. Accepted server snapshots are the only progress source. This design gives every family deterministic coverage without pretending random task generation produced a particular entire catalogue for one keeper.

The driver exercises real wire dragging, debris dragging into the collection chute, keyboard radio/steering sliders, visible memory playback with complete prefix entry, native touchscreen selection on mobile panels, wrong-input rejection, truthful timer locks, close/reopen persistence and server completion acknowledgements. It also checks that the task panel source hashes do not change during a run. The two-stage power scenario follows the updated task location to its distinct acceptance station. Broader world-app lifecycle, socket ownership, gameplay outcomes, map geometry and replay remain covered by the existing integrated suites rather than inferred from the isolated panel host.

## Observed integration run

On 2026-10-30, the first independent node audit passed **30 tests, zero failures/skips**. An exhaustive browser run passed **94 checks across all 25 families**, with **zero browser exceptions**, against the in-progress integration tree. Its source commit field records `61a1180` plus the modified paths; it is not represented as a clean final-commit run. Panel hashes stayed unchanged for that run. Reports and 19 screenshots are under `_artifacts/task-depth-browser-Kt3sHw/`.

That run found a real pointer defect before the passing result: a generic active-button transform displaced absolute course points between pointer-down and pointer-up. The fix preserves the course/debris anchor transform, and the subsequent run completed course and debris controls successfully. A separate initial driver timeout was a fixture wait mistake: a panel host polling every 100 ms cannot reach Puppeteer's `networkidle0`; the driver now waits for DOM readiness and the actual panel.

After this integration run, the builders improved the truthful steering preview and changed power diversion to require a distinct station. The driver and independent oracle tests were adapted for those changes. The coordinator's final frozen-source run and consolidated qualification supersede the intermediate counts above; do not claim those later changes were covered by this earlier capture.

## Reference and interpretation

[Task reference research](TASK-REFERENCE-RESEARCH.md) records the requested Among Us wiki URLs and distinguishes retrieved source evidence from inaccessible pages and established mechanics. Wiki requests were blocked by the Cloud network policy, so this work does not claim the live wiki was successfully inspected. Lantern Wake uses original equipment artwork and game-specific labels. Countdown durations, task counts and some panel representations are deliberate adaptations; these are not third-party CAPTCHA services or claims of exact Among Us visual assets.
