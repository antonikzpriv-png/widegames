# Strategic AI offline verification

Cloud workspace `/workspace/widegames`, Node v24.19.0, audited/current main
`90bb6e8`. Author verification, 2026-10-29. No live/paid model requests or deployment.

- `npm ci`: passed using package-lock.json.
- `npm run check`: 94 JavaScript modules passed.
- `npm test`: 444 tests, 438 passed, zero failed, six existing opt-in skips.
- `CHROME_PATH=/usr/bin/chromium npm run test:browser`: passed both complete
  world match modes, minigames, movement, reload/identity, privacy, replay,
  desktop/mobile layouts and console checks. Local evidence:
  `_artifacts/world-browser-GJMyBE/report.json` and sibling screenshots.
- `git diff --check`: passed.

The initial sandbox test invocation hit `spawnSync git EPERM` in historical audit
subprocesses; the authorized run passed. During implementation a legacy hybrid
prompt test detected unintended position fields; strategic request fields were
scoped to intention requests, preserving that legacy test. The lifecycle unit
fixture initially lacked valid room/start identity; it was corrected to use a
valid persisted room. No product assertion was weakened or skipped.

`tests/ai-strategic.test.mjs` proves non-default model choice among task routes,
route persistence across JSON restore without another reservation, separate safe
observations/claims, no hidden roles in prompts, legal fake work, missing targets,
expiry, invalid output fallback, stale phase results, bounded retries with separate
authorizations, concurrent match caps, unchanged-condition replan suppression,
dynamic seventh-seat public profiles and generation changes across lifecycle
boundaries. Existing suites retain hybrid no-roaming-call assertions, deployment
budget concurrency, durable reservation ordering, cancellation and restart cases.

The real engine complete-match harness runs explicit strategic mode with an
in-process mocked Anthropic tool response and a six-call match cap; it then
exercises labeled demo fallback. Each proposed action must be accepted, every
safe view must stay unchanged, unseen coordinates must stay hidden, and JSON
state/context are restored mid-route. Simulated time uses real geometry, movement
speed and interaction radii with shortened council deadlines. Outcomes:

| Mode | Seed | Engine outcome | Simulated end |
| --- | --- | --- | --- |
| All AI | 1 | Crew tasks | 23,000 ms |
| All AI | 7 | Crew tasks | 37,000 ms |
| Idle human | 1 | Crew ejection | 93,000 ms |
| Idle human | 7 | Crew tasks | 37,000 ms |

Idle-human seed 1 exercised navigate, wait, task, eliminate, sabotage, repair,
report, say and vote. These are credential-free behavior fixtures; they do not
establish live model quality, latency or billing. Browser fixtures use demo mode;
strategic model selection is verified offline with deterministic mocked responses.
