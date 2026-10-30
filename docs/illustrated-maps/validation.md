# Final illustrated-map validation — 2026-10-30

The complete redesign was integrated on main base `41b4c6e2ddfce65882ac635c6dc5b7e4cf1fc4ef`. Six contributors authored the three new layouts, illustrated renderer, revision/persistence/replay integration, and independent qualification. The original task, lobby, ghost/ability, AI and replay behavior remains covered. Current remote main was fetched again before handoff and had no intervening commits.

| Check | Final result | Cloud evidence |
| --- | --- | --- |
| `npm ci --ignore-scripts --cache /workspace/.cache/widegames-npm --no-audit --no-fund` | Passed; frozen dependencies installed | Terminal |
| `npm run check` | 140 JavaScript modules passed | `/tmp/illustrated-check-verified.log` |
| `TRANSPORT_TEST_TEMP=/workspace/widegames/_artifacts/test-temp npm_config_cache=/workspace/.cache/widegames-npm npm test` | 621 tests: 615 passed, 0 failed, 6 skipped | `/tmp/illustrated-full-tests-verified.log` |
| `npm run test:illustrated:browser` | 65 checks, 50 screenshots, all 32 rooms toured | `_artifacts/illustrated-maps-browser-TtKyH6/report.json` |
| `npm run test:maps:browser` | 39 checks; all six new CAPTCHA families solved on both redesigned expansions | `_artifacts/maps-captcha-browser-dE9kU3/report.json` |
| `npm run test:browser` | 42 checks; original gameplay and complete matches | `_artifacts/world-browser-gKSvQf/report.json` |
| `npm run test:features:browser` | 19 checks; ghost/ability controls and privacy | `_artifacts/ghost-abilities-browser-v27KvX/report.json` |
| `node scripts/spatial-replay-browser-check.mjs` | 21 checks; no page/console errors | `_artifacts/spatial-browser-yGFhaJ/report.json` |
| `LW_WORLD_BROWSER=1 node --test tests/world-ui-browser.test.mjs` | 19 checks in one passing test; no page errors | `_artifacts/world-ui-UOy76e/report.json` |

Browser commands used `CHROME_PATH=/workspace/.local/bin/widegames-chromium`. All six suites exited successfully: **205 checks total**, no page errors. Console HTTP 409 messages were the deliberately rejected direct-completion or collision probes; unexpected console errors were rejected by the respective fixtures. Main, independent UI, spatial replay and the full illustrated tour retained their source-integrity checks. The illustrated tour hashes every runtime module/style/HTML file, including all new map data and artwork.

## Independent authority and movement review

The normal suite includes a separate polygon/collider flood, body-radius checks at clipped corners, visible-equipment solidity, real task completion, save/restart binding and replay revision downgrade rejection. Three normal safe-view demo matches reach real rules-based victories, exercise server-confirmed task work and JSON restart; Tidal observes all eleven puzzle families. Ghost movement on each map preserves corpse positions and recipient filtering.

`tests/illustrated-map-motion.test.mjs` executes **all 376 directed station pairs and 5,424 waypoints**, both through shared movement and through real authoritative navigation/ticks. This catches a fractional corner-arrival failure found by the browser tour: the revision-2 obstacle comparison now uses the same `1e-7` rounding tolerance as its polygon walls. A negative control reproduces the old 5.923-unit shortfall. Genuine obstacle penetration still rejects; the revision-1 collision branch is unchanged. A separate read-only review checked 2,438 accepted circle centers at 180 boundary angles against an independent polygon oracle, with zero footprint leaks.

Actual desktop overviews, room closeups and mobile views were inspected. Selected [screenshots and the full-tour report](../ILLUSTRATED-MAPS.md) are committed; all 50 captures and earlier diagnostic artifacts remain in the ignored cloud artifact directory. Prior failures are retained rather than counted as passing evidence. They resulted in wider equipment access, the fractional-arrival correction, explicit map close controls and immediate restoration of movement/joystick state.

All validation used local demo or mocked providers. No paid/live provider requests or deployment were performed.
