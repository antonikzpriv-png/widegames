# Spatial replay and the AI watch

On the all-AI watch, choose a keeper to follow or switch to an overview. This uses the same safe public positions as the live spectator view. Roles remain hidden until completion, and private model reasoning is never displayed.

After a completed watch, **Open the role-revealed replay** opens the illustrated map. Play/pause, 0.25×–4× speed, event and time sliders, event bookmarks, overview and character-following controls all operate locally. The renderer's explicit playback mode reads reconstructed positions directly and cannot translate pointer coordinates into actions. Playback has no action or input callback. The live game's input controller remains disabled in terminal phases.

The map shows recorded movement, fallen keepers, station activity and critical sabotage/repair. The event overlay and attributed log include meetings, eliminations, task transfers, ballots, outcomes and unknown events. Unknown types retain their original data in the API and their type in the log; an unrecognized ability's spatial effects are not fabricated. Final roles are a postgame overlay, not a claim that characters knew other roles during play.

## Recording contract

The authenticated `GET /api/rooms/:roomId/replay` response retains `roomId` and the `replay` event array. It adds `matchId`, a safe completion `ai` summary when available, and optional `metadata`:

```js
{
  version: 1,
  map: 'lantern-wake-v1',
  matchId,
  coverage: { startedAt, from, through, partial },
  anchor: { at, sequence, phase, players, bodies, sabotage, meeting, outcome } // or null
}
```

New schema-2 recordings save an initial gameplay checkpoint and periodic checkpoints outside the event ring, at completed engine transaction boundaries after all actors have settled. Checkpoints contain only selected gameplay fields: positions, roles, living status, tasks, bounded remaining routes, bodies, sabotage and current ballots. They exclude input receipts, requests, cooldowns, raw AI contexts, memories, provider errors and credentials. Metadata/history versions, map, shapes, times, sequences, sizes and geometry are validated. Returned metadata and event records are defensive copies.

New checkpoints also retain the bounded terminal outcome (`winner`, `reason`, exact numeric `at`), or null before completion. `outcome` is optional when reading earlier version-1 checkpoints. For an old terminal checkpoint, the viewer recovers the outcome only from a retained recorded `ended` event; it never substitutes the final browser view. A terminal checkpoint can reconstruct its outcome even if no event follows its sequence cutoff.

Retention is bounded by 12,000 records and a 2 MiB serialized-event budget, whichever fills first. At most 14 checkpoints are kept, normally spaced 1,024 records apart. If eviction would leave no valid checkpoint, the next completed transaction supplies one. Each checkpoint is limited to six characters, 100 total tasks, six bodies/ballots, 128 waypoints per route and 64 KiB of JSON characters. The room's existing 8 MiB hard storage limit remains enforced. This bounds the new recording overhead; existing request and private-context storage still shares that room budget.

An exported anchor is the earliest retained checkpoint whose sequence covers every evicted event. Events already represented by the anchor do not apply twice. Older retained records remain readable in the attributed log and are explicitly marked outside spatial coverage. Evicted records are unavailable. A truncated recording therefore starts spatial playback at a valid retained state, with an explicit partial-history notice. It does not promise coverage back to match creation.

Old recordings with a complete `started` record can reconstruct from its recorded positions, tasks and roles. Old/truncated histories without an anchor show only available samples and events, with partial coverage. Final player positions are never used as invented initial positions. Schema-1 recordings retain their text history and have no invented world coordinates.

## Time and movement accuracy

Timestamps remain numeric, including fractional arrivals. Stable numeric sorting retains causal append order for equal times. Event scrubbing and bookmarks use both the timestamp and event index, so equal-time stages remain individually inspectable. Playback and repeated backward/forward seeks derive from the same anchor and reducer.

An event-index seek pins that causal prefix through camera, role, perspective and resize redraws. Time scrubbing uses continuous time and includes all events through that timestamp. Playing a selected prefix at the terminal timestamp first consumes its remaining equal-time events; another Play from the completed replay restarts it.

New navigation records include the accepted route (at most 128 waypoints) and authoritative speed. Playback validates segments against the matching map and follows those waypoints; it never blends endpoints directly through walls. Routes absent from an old record, excessive routes, and manual steering use held recorded samples. Unrecorded travel between those samples is explicitly unknown. HTML range controls may serialize a double with fewer digits than JSON; only a nearest recorded boundary within floating-point serialization error is restored. Original records are never rounded or retimed.

## Perspective, claims and AI labels

Character history separates three sources:

- **Recorded observations**: the engine's elimination witness records, limited to their captured `visibleTo` character list.
- **Reconstructed visibility**: map visibility from available positions, clearly labeled as reconstruction rather than proof of attention or the model's exact input. Visibility uses both range and wall occlusion. Earlier observations can be missing after truncation.
- **Public claims**: literal council speech, compared with nearby recorded actions and witnesses. The viewer does not infer a claim's truth from proximity, absence of evidence, a role, or an automated verdict.

The character's own role comes from the recorded anchor or initial record. Final role overlays are labeled as postgame information. No unrestricted memories or private reasoning are reconstructed.

The AI summary describes recorded completion totals, not a per-event mode timeline. Demo, hybrid, strategic (if recorded) and fallback labels are distinct. Calls, token ceilings and conservative reserved USD counters are shown when available; they are not provider invoices. Missing summaries are labeled unavailable, with no invented zero usage.

## Authorization and lifecycle

Replay remains unavailable for unfinished and paused matches. An optional single `?matchId=...` selects the exact completed match in the authenticated room. Another room's cookie cannot authorize it. This version has one match per room and no archive/rematch endpoint: an unavailable archived generation or mismatched match ID returns 404. Completion never grants access to a different room or a current hidden match.

Requests use both the room connection's abort signal and the results controller's signal. Room/match changes, leave and disposal abort pending fetches and invalidate their generations; stale success/error/finally handlers cannot replace current playback or loading state. Hiding the page cancels pending replay loading and pauses playback. Disposing playback cancels its animation and removes visibility/resize listeners. New room/match identity resets the results surface.

## Validation

From the cloud checkout, with the installed browser launcher:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
CHROME_PATH=/workspace/cloud-setup/chromium npm run test:browser
CHROME_PATH=/workspace/cloud-setup/chromium LW_WORLD_BROWSER=1 node --test tests/world-ui-browser.test.mjs
CHROME_PATH=/workspace/cloud-setup/chromium node scripts/spatial-replay-browser-check.mjs
```

The new `tests/spatial-replay-*.test.mjs` cases exercise reconstruction/seek consistency, routes, causal ties, fractional range serialization, full/truncated/legacy recordings, malformed metadata, copies, bounded retention/storage, authorization, live/paused denial, unavailable archived selection, claims/observations, playback clocks, stale fetches, disposal and hidden-page cancellation.

Browser receipts are written to fresh ignored `_artifacts/spatial-browser-*` directories. The spatial browser uses actual HTTP, room cookies, WebSockets, frontend modules and the engine. Its completed recording comes from seeded legal engine actions and accelerated clocks with idle demo scheduling; it is not a paid-provider or AI strategy benchmark. Existing historical receipts and screenshots remain unchanged.

Observed cloud qualification: **101 modules checked; 444 tests passed, zero failed, six opt-in checks skipped**. Primary browser qualification passed 26 checks, independent UI qualification passed 19 checks, and spatial replay qualification passed 18 checks. All browser runs reported no exceptions; the primary and spatial runs also reported no console errors. The existing primary fixture now waits for app readiness after reload and advances from the current phase deadline, preserving assertions while removing its network-idle/fixed-clock races. Earlier evidence remains preserved.

[Qualification receipt and runtime SHA-256 hashes](spatial-replay-qualification-20261029.json). New screenshots:

- [Live AI watch](world-screenshots/spatial-replay-live-ai.png)
- [Spatial overview](world-screenshots/spatial-replay-overview.png)
- [Following a recorded route](world-screenshots/spatial-replay-follow.png)
- [Historical perspective, claims and ballots](world-screenshots/spatial-replay-perspective.png)
- [Mobile playback](world-screenshots/spatial-replay-mobile.png)
