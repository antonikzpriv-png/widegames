# Expanded maps and CAPTCHA task qualification

These checks exercise the current game authority and its actual browser UI. The CAPTCHA tasks are original in-game puzzles, not an external CAPTCHA service or anti-bot credential.

## Integrated engine, HTTP and persistence

Command:

```sh
node --test tests/maps-captcha-integration.test.mjs
```

Observed result: **8 tests passed, zero failed/skipped**.

The suite validates both expanded maps' scale, room/detail/collider counts, every keeper spawn, every station and the emergency bell, collision rejection, routes from spawn to every station, and map cache isolation across interleaved engine matches. It verifies that metadata-free original-map snapshots remain readable. Each expansion starts 60 unique tasks with 12 per crew and every new CAPTCHA family. Wrong semantic inputs reject without advancing progress; accepted step IDs remain idempotent after JSON restart. Task details remain absent from public and other-player records, and saved CAPTCHA progress survives actual private-store close/reopen.

The HTTP fixture uses real native HTTP, room cookies, host authorization, map selection and the private room store. Invalid maps reject, spectators cannot start, accepted start IDs cannot change the selected map, and two simultaneous rooms restore their distinct maps and task totals after a real server restart.

Two complete deterministic safe-view demo simulations use the real engine and local AI, physical navigation, optional ghost/ability presets, per-action snapshot validation and JSON/AI-context restart. Storm Foundry seed 7 reached a crew ejection win at server time 40,000; Tidal Observatory seed 7 reached a crew task win at 188,000 and exercised all eleven task types. The test asserts zero provider calls. These are controlled simulations, not a claim of unaccelerated live play.

An initial test-only failure reused `state.updatedAt` after an inert tick, so the next task correctly hit its equipment cooldown. The fixture now tracks server time explicitly. No authority, cooldown or assertion was disabled.

## Real browser

Command used in the cloud environment:

```sh
CHROME_PATH=/workspace/.local/bin/widegames-chromium node scripts/maps-captcha-browser-check.mjs
```

Observed result: **39 checks passed, no browser page errors**. Retained report and twenty screenshots: `_artifacts/maps-captcha-browser-3Ng47d/`.

For each new map, the driver selects the actual lobby map option, checks its description and 60-task assignment, opens the complete map overview, legally navigates to stations using the real geometry, and solves all six new puzzle families through native controls. Answers are derived independently from the visible challenge display, not by calling the engine's answer helper. Direct completion before the steps is explicitly rejected. The UI waits for each authoritative step acknowledgement and completion, then reloads the real cookie identity and confirms all six completed tasks survived.

Coverage includes symbol multi-selection, symbol counting, ascending-order tags, direction alignment, odd-symbol selection and six-character code entry with keyboard Enter. The glyph challenge is also opened at 390×844: it fits without horizontal overflow and its tile targets are at least 44 pixels wide. Both complete worlds fit that mobile viewport. The driver uses seeded real crew assignments, idle local demo bots and an accelerated server clock to keep the interaction fixture bounded; it does not fabricate task completion or winners, call a live provider or deploy anything.

The screenshots provide actual rendered map previews, overviews, all six puzzle panels on each expansion and mobile map/puzzle states. The final expanded-map desktop render was visually inspected after removing duplicated authored room labels. Broader required repository checks and final integration results are reported by the coordinator separately.
