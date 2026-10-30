# Final illustrated-map validation — 2026-10-30

The complete redesign was integrated with current main `aa1f58c`, preserving its ghost spectator inspector and movement/rendering optimizations. Six contributors authored the three new layouts, illustrated renderer, revision/persistence/replay integration, and independent qualification. The original task, lobby, ghost/ability, AI and replay behavior remains covered. Main advanced five commits during final handoff, so the overlapping scene, controls, room projection and package changes were merged and all checks were rerun on the combined runtime.

| Check | Final result | Cloud evidence |
| --- | --- | --- |
| `npm ci --ignore-scripts --cache /workspace/.cache/widegames-npm --no-audit --no-fund` | Passed; frozen dependencies installed | Terminal |
| `npm run check` | 154 JavaScript modules passed | `/tmp/illustrated-integrated-check.log` |
| `TRANSPORT_TEST_TEMP=/workspace/widegames/_artifacts/test-temp npm_config_cache=/workspace/.cache/widegames-npm npm test` | 664 tests: 658 passed, 0 failed, 6 skipped | `/tmp/illustrated-integrated-tests.log` |
| `npm run test:illustrated:browser` | 65 checks, 50 screenshots, all 32 rooms toured | `_artifacts/illustrated-maps-browser-sjGec5/report.json` |
| `npm run test:maps:browser` | 39 checks; all six new CAPTCHA families solved on both redesigned expansions | `_artifacts/maps-captcha-browser-yNbqOD/report.json` |
| `npm run test:browser` | 42 checks; original gameplay and complete matches | `_artifacts/world-browser-XgungW/report.json` |
| `npm run test:features:browser` | 19 checks; ghost/ability controls and privacy | `_artifacts/ghost-abilities-browser-VNDJWe/report.json` |
| `node scripts/spatial-replay-browser-check.mjs` | 21 checks; no page/console errors | `_artifacts/spatial-browser-nsG0cM/report.json` |
| `LW_WORLD_BROWSER=1 node --test tests/world-ui-browser.test.mjs` | 19 checks in one passing test; no page errors | `_artifacts/world-ui-W7hkKk/report.json` |

| `npm run test:spectator:browser` | 46 checks; inspector, free camera and native ghost traversal on all three revised maps | `_artifacts/spectator-browser-4zkwwZ/report.json` |

Browser commands used `CHROME_PATH=/workspace/.local/bin/widegames-chromium`. All seven suites exited successfully: **251 checks total**, no page errors. The main-game, illustrated and spectator fixtures recorded only their expected HTTP 409 probes (incomplete tasks, collisions or unfinished replay); the spatial replay fixture recorded no console errors. Main, independent UI, spatial replay and the full illustrated tour retained their source-integrity checks. The illustrated tour hashes every runtime module/style/HTML file, including all new map data and artwork.

The new spectator renderer retains its bounded 2048-pixel static layer; the illustrated art paints directly into that layer instead of keeping a duplicate full-map bitmap. Actor interpolation, UI selection, controller plans and inspector descriptions all resolve by both map and revision. The combined suite checks that all-AI inspection stays confined to its authenticated room, while human-room observers and living players retain their established filtering.

The offline engine-equivalence check compared **720 transactions** across three maps, two modes and two feature presets against `41b4c6e`, with identical original-revision states/events/receipts (`/tmp/illustrated-integrated-equivalence.log`). `npm run perf:spectator` also completed (`/tmp/illustrated-integrated-performance.log`); concurrent cloud timings are diagnostic, not a device frame-rate guarantee.

## Independent authority and movement review

The normal suite includes a separate polygon/collider flood, body-radius checks at clipped corners, visible-equipment solidity, real task completion, save/restart binding and replay revision downgrade rejection. Three normal safe-view demo matches reach real rules-based victories, exercise server-confirmed task work and JSON restart; Tidal observes all eleven puzzle families. Ghost movement on each map preserves corpse positions and recipient filtering.

`tests/illustrated-map-motion.test.mjs` executes **all 376 directed station pairs and 5,424 waypoints**, both through shared movement and through real authoritative navigation/ticks. This catches a fractional corner-arrival failure found by the browser tour: the revision-2 obstacle comparison now uses the same `1e-7` rounding tolerance as its polygon walls. A negative control reproduces the old 5.923-unit shortfall. Genuine obstacle penetration still rejects; the revision-1 collision branch is unchanged. A separate read-only review checked 2,438 accepted circle centers at 180 boundary angles against an independent polygon oracle, with zero footprint leaks.

Actual desktop overviews, room closeups and mobile views were inspected. Selected [screenshots and the full-tour report](../ILLUSTRATED-MAPS.md) are committed; all 50 captures and earlier diagnostic artifacts remain in the ignored cloud artifact directory. Prior failures are retained rather than counted as passing evidence. They resulted in wider equipment access, the fractional-arrival correction, explicit map close controls and immediate restoration of movement/joystick state.

All validation used local demo or mocked providers. No paid/live provider requests or deployment were performed.
