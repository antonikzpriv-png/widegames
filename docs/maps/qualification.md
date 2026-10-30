# Expanded-map qualification

The subsequent user-authorized main merge has a [fresh independent audit and complete validation record](merge-validation.md).

Implemented on current main `43c0799` (including audited ghost gameplay, authoritative tasks, strategic AI and spatial replay). Six requested subagents contributed the two maps, CAPTCHA engine/UI, map UI, replay integration and independent validation/authority audit. Existing checkouts and feature branches were preserved; no worktree, deployment, provider spend or external CAPTCHA service was used.

## Current integrated results

- Frozen `npm ci --ignore-scripts --cache /workspace/.cache/widegames-npm --no-audit --no-fund` passed.
- `npm run check`: 128 JavaScript modules passed.
- `npm test`, with the existing cloud cache/temporary-directory settings: **592 tests, 586 passed, 0 failed, 6 opt-in checks skipped**.
- Expanded map browser: **39 checks passed**, no page errors, all six new puzzles solved through native controls on both maps, direct completion rejected, six saved completions restored after reload on each map, and mobile grid/touch/keyboard checks passed.
- Existing main browser: **42 checks passed**, including all five original station puzzles, human/all-AI rule-based wins, privacy and chronology. It recorded only the expected deliberately rejected task HTTP 409 console messages.
- Existing ghost/ability browser: **19 checks passed**, including authenticated ghost movement/task completion and private chat.
- Map authority audit: **10 passed**, including malformed map/task metadata, map tampering, selected-map route/station validation, and genuine witnessed attacks in added rooms.
- Replay integration: old recordings plus both new maps, v2 tasks, map-aware anchors/bounds, independent concurrent playback and routes passed in the normal suite.

The two full demo integration runs use real safe-view local bot policies, collision/pathfinding, task inputs, ghost/ability presets and actual rules-based victories (Foundry ejection; Observatory task completion with all eleven kinds observed). They validate the full persisted snapshot after every tick/action and exercise JSON restart. These are bounded seeded simulations, not claims of a paid strategic model or an unaccelerated human play session.

The browser fixture uses the actual app, map selector, native task controls, HTTP/cookies, engine and private persistent store. Role selection is seeded, AI scheduling is idle and movement time is accelerated to reach twelve different puzzle stations efficiently. The browser derives solutions from the displayed challenges, not the engine task-input helper. No API response, task completion or win is fabricated. Reports and their fixture statements remain available under `_artifacts`.

## Integration issues fixed during audit

- Per-map geometry and path caches replaced the single implicit world across engine, storage, AI, renderer and replay. The original map's named exports and absent-map saves retain old behavior.
- Saved room and engine map selection must agree. Expanded tasks must retain explicit kinds, valid room membership, unique IDs and the configured totals even with ghost/ability features disabled. Malformed task IDs/labels/flags and completed expanded-map tasks without confirmed progress are rejected.
- Demo observation/council logic now accepts genuine witnesses and room names from the selected map instead of discarding every room beyond the original six.
- Original historical-engine test dependency rewriting now resolves the new map data imports when running its immutable old engine in a data module. The historical failing behavior and all assertions are retained.
- Map lists use DOM operations supported by retained UI fixtures; mobile map names no longer overlap the AI-mode label. Original observer/session/focus tests stay enabled and pass.

## Retained evidence

- Current new-map report: `_artifacts/maps-captcha-browser-qaRDZm/report.json`; a copy is [browser-qualification.json](browser-qualification.json), with selected screenshots in [screenshots](screenshots/).
- Main game: `_artifacts/world-browser-R1BzyN/report.json`.
- Ghost/abilities: `_artifacts/ghost-abilities-browser-mLmXPl/report.json`.
- Independent world UI: **19 checks passed** (`_artifacts/world-ui-qz6ewz/report.json`). Spatial replay browser: **21 checks passed**, no page/console errors (`_artifacts/spatial-browser-JECEbx/report.json`).

CI runs the expanded-map browser script (`npm run test:maps:browser`) and uploads its JSON/PNG evidence alongside existing browser suites. No claim is made about publication, deployment or unrelated unmerged lobby/tactical branches.
