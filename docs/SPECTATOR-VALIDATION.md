# Spectator and movement qualification

The final runtime incorporates map/CAPTCHA main `41b4c6e` at `d362aca` without
discarding the earlier replay, strategic AI, ghost or ability work. Six parallel
agents implemented and independently reviewed the camera, inspector, server data,
movement, styles and browser checks. No paid provider calls or deployment occurred.

Dependency installation passed. `npm run check` checked 139 JavaScript modules.
`npm test` passed 620 tests, with zero failures and six skips. The independent
world UI browser test was subsequently enabled explicitly and passed.

All six browser suites passed, running sequentially to avoid timing contention:

| Suite | Checks |
| --- | ---: |
| Primary walking-world gameplay | 42 |
| Ghosts and abilities | 19 |
| Expanded maps and CAPTCHA equipment | 39 |
| Spatial replay | 21 |
| Independent world UI | 19 |
| Ghost spectator and inspection | 37 |

The spectator checks cover local WASD/touch control, stopping and disposal,
camera following, actual canvas agent/station/bell clicks, mobile layout, role
inspection, human-view privacy, no spectator gameplay writes, unfinished replay
denial, and camera bounds/inspection on both expanded maps. Server regressions
also verify room authorization, safe field allowlists, copied output, selected
plan freshness and omission of CAPTCHA answers/private context.

The independent engine comparison matched 720 sequential transactions against
`41b4c6e` across all three maps, both modes and both optional feature presets.
The checked-in reproduction script is `scripts/spectator-engine-equivalence.mjs`;
its receipt includes baseline extraction commands and source fingerprints.

Real application mean frame times were 16.67 ms for AI watch, 16.78 ms for human
play, 17.14 ms for Storm Foundry and 18.56 ms for Tidal Observatory. A separate
same-browser software-canvas comparison with the earlier beacon renderer measured
26.1%, 24.6% and 73.3% less draw time in overview, following and human views.
These are host/fixture measurements, not universal frame-rate guarantees. The
separate 12,000-record engine stress fixture retains the raw timing results,
including workloads with small or negligible changes.

Initial timing checks caught a bitmap resampling regression and expensive human
fog/glow rendering; capped map caches, nearest-neighbor static sampling and shared
fog/glow tiles addressed them. Early overlapping test/benchmark runs were noisy;
final browser runs were serial with unchanged source. Deliberate HTTP 409 task
denials and the unfinished-replay check produce expected browser console errors;
all final suites reported zero JavaScript exceptions and no unexpected errors.

[Final commands, counts and runtime hashes](spectator-final-validation.json).
[Browser details and screenshots](SPECTATOR.md#verification).
Earlier audit evidence and screenshots remain preserved.
