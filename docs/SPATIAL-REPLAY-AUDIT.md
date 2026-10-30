# Spatial replay audit and merge validation

Reviewed feature head: `cb247986b0d8b72e7bba194a7793b9229270dd12`, against current main `90bb6e881f75f77e85b8b49729971a710b4c91b4`. The audit fixes and source fingerprints are recorded with this report. Earlier qualification receipts and screenshots remain unchanged.

Two P2 findings were reproduced with failing regression tests and corrected:

1. **Equal-time event selection could advance beyond the chosen causal step.** Seeking the final vote result selected the last role-reveal event at that same timestamp (index 25 instead of 21). The clock callback overwrote the selected index, and camera/perspective redraws reapplied every event through the time. The viewer now retains a separate event-index limit across redraws and resize. Play consumes remaining terminal ties before a subsequent restart. Controller and real-browser regressions cover this behavior.
2. **A terminal checkpoint could lose its outcome.** The anchor had ended state, but its snapshot omitted the outcome and the reducer correctly skipped events already covered by its cutoff. New checkpoints retain validated `winner`, `reason` and exact numeric `at`; readers also recover an earlier version-1 terminal anchor's outcome from a retained `ended` event. Tests cover terminal anchors with and without tail events, old anchors, malformed outcome fields and timestamps. Final browser state is never substituted for recorded history.

The review also checked ended-only API gating, room-cookie authorization and exact match selection; safe live spectator data; allowlisted checkpoint fields and private-context exclusion; event/byte/checkpoint retention and the room storage limit; defensive copies; stable numeric chronology; geometry-aware route playback; explicit sample/partial-history limits; and abort/disposal/stale-response ownership. No unresolved blocking finding remained in the reviewed scope. The existing limitations described in [SPATIAL-REPLAY.md](SPATIAL-REPLAY.md) still apply.

Validation completed on the corrected source:

| Check | Result |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund --cache /workspace/.cache/npm` | Passed |
| `npm run check` | 101 modules checked |
| `npm test` | 452 tests: 446 passed, 0 failed, 6 skipped |
| `node --test tests/spatial-replay-*.test.mjs` | 20 passed, 0 failed |
| `CHROME_PATH=/workspace/cloud-setup/chromium npm run test:browser` | 26 checks passed |
| `CHROME_PATH=/workspace/cloud-setup/chromium LW_WORLD_BROWSER=1 node --test tests/world-ui-browser.test.mjs` | 19 checks passed |
| `CHROME_PATH=/workspace/cloud-setup/chromium node scripts/spatial-replay-browser-check.mjs` | 21 checks passed |

The initial parallel run encountered timing failures in a 100 ms mocked provider test and existing task/touch browser fixtures while three Chromium sessions ran together. Isolated reruns passed without disabling assertions, increasing timeouts or changing those tests. Failed and successful logs remain in `_artifacts/spatial-merge-audit/`. Browser qualification used demo/seeded fixtures with no paid calls or deployment.

[Audit receipt, browser results and exact runtime SHA-256 hashes](spatial-replay-audit.json).
