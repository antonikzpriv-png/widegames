# Pre-merge audit

Audited feature commit: `0bc8b3234d38ce824bc5bb28b6efcf742c50d330`. Base: `origin/main` at `90bb6e881f75f77e85b8b49729971a710b4c91b4`. Scope: ghost/ability configuration, authoritative actions and expiry, task/death policies, private views/HTTP/WS delivery, persistence/restart validation, local AI, UI and CI. Other unmerged feature branches are preserved and outside this merge.

## Findings fixed

1. **Valid overlapping effects could fail persistence.** The validator used one unqualified target/source ID set for ward and echo effects. A ward targeting the saboteur plus that saboteur's echo reused the same player ID and was rejected with HTTP 503, despite both actions being legal. Effect uniqueness now includes the effect kind. Both activation orders have real HTTP/save/restart/expiry regressions.
2. **Enabled room settings could silently lose their match metadata on restore.** A room declaring ghost tasks/abilities could pass validation after all optional match metadata was removed. The validator now requires enabled declared presets to retain their engine metadata. Old saves and explicit classic defaults remain readable.
3. **Malformed snapshots could duplicate one ability owner.** Two wards from the same keeper with distinct targets and valid-looking timestamps could pass validation. Persisted effects now require unique owners as well as unique IDs/targets. This preserves the one-active-effect-per-owner semantics enforced by the real cooldowns.

All four added regression cases failed against the original implementation and passed after the validator correction. The twelve full demo simulations now validate a complete persistence snapshot after every tick and accepted action, so simulation-only successes cannot mask a save failure. The feature browser suite and its reports/screenshots are also registered in CI.

## Validation

- Frozen dependency installation passed (`npm ci --ignore-scripts --cache /workspace/.cache/widegames-npm --no-audit --no-fund`).
- `npm run check`: 97 JavaScript modules passed.
- `npm test`: 459 tests, 453 passed, 0 failed, 6 opt-in checks skipped.
- Focused feature suite after adding per-transition persistence validation: 27 tests passed, none failed/skipped. It includes 12 complete demo matches and HTTP/WS/restart checks.
- Feature browser: all 19 checks passed, no page errors. Evidence: `_artifacts/ghost-abilities-browser-Dk9qvX/report.json`.
- Main browser: all 26 checks passed, no page/console errors or unsafe views. Evidence: `_artifacts/world-browser-yaK3oy/report.json`.
- Independent world UI browser: 19 checks passed in one test; `_artifacts/world-ui-lQEJFe/report.json`.

No paid/live provider calls or deployment. The audit does not claim compatibility with unrelated unmerged task/lobby/strategic branches. The merge target is the current main branch; normal non-forced Git updates preserve concurrent work.

## Main advanced during final validation

The final integration fetch found `80dcc60` (server-authoritative interactive world tasks) on main. The counts above qualify the ghost audit before that integration. The final combined validation and any task compatibility changes are recorded below after integrating current main.
