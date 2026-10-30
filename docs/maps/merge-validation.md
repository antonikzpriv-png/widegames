# Expanded-map merge validation — 2026-10-30

The two-map/CAPTCHA implementation at `74c7ee76701eb06cb03ee5bac42a77e021037f3d` was independently audited and freshly validated against current main `43c079999506785196ab85750105ceb102ba9314` before the user-authorized merge. Main had no intervening commits. Server authority, geometry isolation, task ownership, legacy saves, ghost permissions, configuration, native controls and spatial replay had no blocking findings. The separate engine/storage/AI and UI/replay reviews also ran 34 and 17 focused tests, respectively; all passed.

## Fresh checks

| Command | Result | Evidence |
| --- | --- | --- |
| `npm ci --ignore-scripts --cache /workspace/.cache/widegames-npm --no-audit --no-fund` | Passed; 25 packages installed | Cloud terminal |
| `npm run check` | 128 JavaScript modules passed | Cloud terminal |
| `TRANSPORT_TEST_TEMP=/workspace/widegames/_artifacts/test-temp npm_config_cache=/workspace/.cache/widegames-npm npm test` | 592 tests: 586 passed, 0 failed, 6 skipped | `/tmp/maps-merge-unit-tests.log` |
| `npm run test:maps:browser` | 39 checks passed; no page errors; 20 screenshots | `_artifacts/maps-captcha-browser-apGBaW/report.json` |
| `npm run test:browser` | 42 checks passed; no page errors | `_artifacts/world-browser-zzPb5x/report.json` |
| `npm run test:features:browser` | 19 checks passed; no page errors | `_artifacts/ghost-abilities-browser-1D7QPg/report.json` |
| `node scripts/spatial-replay-browser-check.mjs` | 21 checks passed; no page or console errors | `_artifacts/spatial-browser-5Q8XaV/report.json` |
| `LW_WORLD_BROWSER=1 node --test tests/world-ui-browser.test.mjs` | 19 checks in one passing test; no errors | `_artifacts/world-ui-cYeiFO/report.json` |

All browser commands used `CHROME_PATH=/workspace/.local/bin/widegames-chromium`. The main browser's ten HTTP 409 console messages were the expected deliberate attempts to finish tasks without completing their server stages; no unexpected console failures occurred.

The normal suite includes both expanded-map full demo matches, all eleven task families, save/restart validation, map/task tamper rejection, old snapshots, ghost/ability integration and map-aware replay. The browser suite solves all six new puzzle families on both maps through actual controls, checks mobile and keyboard interaction, and reloads the six saved completions on each map. Original gameplay, optional features and replay suites remain enabled. No paid/live provider calls or deployment were performed.

The runtime tree validated above is unchanged by the subsequent documentation and merge commits. Existing [screenshots and map guide](../EXPANDED-MAPS.md) remain available; the ignored artifact reports and fresh screenshots are retained in this cloud checkout.
