# Lantern Wake interface

The frontend owns `public/**`, `tests/ui*.test.mjs`, `tests/ui-artifacts/**`, and this document. It is a plain browser-module application with no build step, external assets, fonts, CDN, or added dependencies. The coordinator integrates these commits with the real room, engine, and AI modules; the initial foundation transport alone returns 503 for room APIs.

## Behavior

- Create a human room (Iona plus five AI keepers) or a six-AI spectator room, start as host, and share `/r/:roomId`.
- Fetch the existing cookie-authenticated room first. Join as spectator only on HTTP 401, at most once per room per page lifetime. Existing human cookies are preserved. Reload restores the seat; a tab remembers only its room ID in sessionStorage.
- Send all actions to the real HTTP endpoints with same-origin credentials and fresh `crypto.randomUUID()` IDs. A lost response offers an explicit retry of that same envelope. No role, view, private task, dialogue, credential, or AI memory is persisted in browser storage.
- Use WebSocket snapshots and a two-second HTTP resync, falling back to polling when sockets are unavailable. Failures back off to thirty seconds. Requests time out after fifteen seconds. Room changes, hidden tabs, page disposal, and browser-history restoration cancel or reconnect the appropriate session. Older snapshots cannot restore a lobby or overwrite a newer game version.
- Show only the provided redacted game view: own role, own tasks, local targets and body sightings, aggregate task progress, public dialogue, and public events. Spectators never receive human controls. Server action hints govern controls; the engine remains authoritative.
- Show movement, task, critical repair, sabotage, elimination with confirmation, local report, and bridge emergency controls. Timers use the server clock offset. Critical countdown continues during council, including discussion and voting.
- Discussion uses a native labeled form and bounded textarea. Votes are final, include skip, and show cast counts without inventing hidden targets. Rules explain plurality, tie, skip, abstention, crew wins and saboteur wins. Fallen keepers observe; paused matches truthfully explain the maximum-duration pause.
- Results reveal the six roles and fetch the full replay only after the match ends. Replay provides a keyboard-operable range, previous/next buttons, and a complete readable event list.
- Demo/live mode and backend fallback notices are visible. No provider credentials or model reasoning are displayed.

## Accessibility and layout

Native buttons, labels, progress, timers, skip navigation, visible focus, reduced-motion support, and text-only dialogue work without a UI library. Room buttons remain inspectable with keyboard navigation and communicate whether movement is available. Mobile puts the lobby start control first and an active keeper's assignment ahead of the map; council and results take priority in their phases. Controls keep their DOM identity across live snapshots. Focus, message drafts, selection, and council scroll survive updates. No animation is required to play.

## Checks

From the frontend repository root:

```powershell
node --test tests/ui.test.mjs tests/foundation.test.mjs
node scripts/check.mjs
git diff --check
```

The browser check is opt-in and uses an already installed compatible Chromium browser and puppeteer-core. It never installs a dependency or calls a paid provider. After coordinator integration, the backend module overrides can be omitted. During parallel implementation the exact qualification command was:

```powershell
$env:LW_UI_BROWSER='1'
$env:LW_UI_PUPPETEER='D:/Widegames-work/coordinator/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
$env:LW_UI_TRANSPORT='D:/Widegames-work/transport/server/transport.mjs'
$env:LW_UI_ENGINE='D:/Widegames-work/engine/server/engine/index.mjs'
$env:LW_UI_AI='D:/Widegames-work/ai/server/ai/index.mjs'
$env:LW_UI_EXECUTABLE='C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'
node --test tests/ui-browser.test.mjs
```

The harness starts the actual transport, persistence store, engine and demo AI, serving this worktree's static UI. It sets deterministic engine test preconditions and advances the test clock, without stubbing HTTP responses or supplying fake game actions. It checks human and spectator creation, keyboard movement/tasks, cookie and seat restoration, one-time spectator joining, WebSocket fallback, message-node identity and draft/focus preservation, untrusted HTML as plain text, discussion, skip voting, genuine demo completion, results, replay, sabotage, elimination confirmation, body reporting, critical repair, no private browser storage, no browser exceptions, and mobile horizontal overflow. Screenshots are local, ignored artifacts in `tests/ui-artifacts/`.

During qualification an initial driver path was corrected to match the installed package layout. A default-sandbox multi-file test invocation failed with `spawn EPERM`; the same checks passed through the authorized D-worktree execution path. The expanded browser run exposed a detached-control race, which was fixed by reconciling DOM nodes. Discussion submission was then changed to a native submit button so its handler uses the current form. A test start-response race was fixed by waiting for the assignment panel before reading the new match.

The browser qualification covers desktop Chromium and a 390px mobile viewport. It does not claim Safari, Firefox, screen-reader, live-provider, or production deployment verification. The coordinator owns integration and publication; this task does not push, merge, change root configuration, or modify another worker's files.

## Source audit after hybrid integration

Reviewed coordinator `3ba5c8efd97e368e0d69a3a9aea9f5a8edbdb8cb` (and its integrated UI revision `6411e8d`) and AI `3b8fc3d`, including the actual AI summary, room allowlist, and manager-owned `scripts/browser-check.mjs`. The stable contract document still lists the older AI summary fields; the additive source contract explicitly provides `strategy`, `navigation`, and `council`, with a server notice for live hybrid mode. No server/shared/root files were changed.

Concrete frontend findings and fixes:

- The previous `Live` badge did not describe the hybrid policy. Both the badge and rules now say that model council discussion/votes are live while navigation/deck actions use local policy. Missing AI metadata is labeled pending, not silently labeled demo. The backend's safe notices remain visible.
- Index-based matching could replace the game subtree when an earlier notice disappeared. Stable IDs now anchor the game heading, phase timer, critical alert, and game layout. Source-level DOM regressions verify that removing a notice preserves the council and the same textarea object.
- Restoring selection on an already-focused textarea could disturb composition while typing. Current focus/selection is left alone; composing text is preserved until composition ends. An asynchronous action no longer returns focus to its original button after the user deliberately focuses something else.
- A transient polling error banner survived a valid subsequent snapshot. Valid state updates now clear connection-specific errors. Stale retry buttons are removed when a session stops or resynchronizes. Session epoch/abort guards, GET-before-401-join, one-time joining, and visibility restoration remain in place; they do not grant or replace a human seat.
- A null JSON error could lose the HTTP status, and cancellation during body parsing could become a generic response failure. Errors now retain HTTP status and cancellation identity. An unreadable successful mutation or HTTP 5xx can offer the original action envelope for idempotent retry; 401/403 remain explicit failures.
- Replay formerly displayed global witness records as `You saw` and abbreviated ballots as action arrows. The ended-match replay now names the actor and revealed role, exact ejection target or skip, tally ballots, ejected keeper, and recorded witnesses. It remains readable text in the selected event and complete log; no raw JSON or private reasoning is displayed. Live public timeline wording remains separate.

Audit checks (no browser, build, live provider, or production approval):

```powershell
node --test --test-isolation=none tests/ui.test.mjs tests/ui-audit.test.mjs tests/ui-dom.test.mjs tests/foundation.test.mjs
node --check public/app.mjs
node --check public/api.mjs
node --check public/panels.mjs
node --check public/presentation.mjs
node --check public/ui.mjs
git diff --check
```

Manager browser-script source gaps, reported without modifying that script:

- Line 41 waits for `!b.disabled` on room buttons. These inspectable map buttons express movement availability as `aria-disabled="false"`; they intentionally remain keyboard-inspectable. The check must wait for that attribute before clicking, otherwise it can click during cooldown and wait for a move that was never sent.
- Lines 99 and 105 assert that the replay range exists after loading. They do not yet assert named vote targets, skip ballots, revealed roles, actual witness attribution, next/previous navigation, or the complete readable log.
- Reload tests seat recovery, but the script does not explicitly exercise a hidden/visible cycle, a forced socket failure with polling recovery, a disappearing notice while typing, or a transient HTTP error followed by recovery. The new tests cover the source-level presentation/DOM/error cases; the manager retains the sole browser lease for integrated runtime checks.
- `finish()` completes later human tasks through HTTP actions. The initial task is played through the actual UI; the bounded completion loop therefore does not qualify every later task through a pointer/keyboard interaction.

The added DOM fixture is a small interface test, not a browser engine. IME, focus, socket/visibility timing, and hybrid display still require the manager's integrated browser verification. No production readiness is asserted by this audit.
