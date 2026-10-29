# Independent privacy audit - 2026-10-29

Saved source: `0842a0090f1cfd1ec43b898f16e8191e5b9c2497` in `D:/Widegames-work/audit-privacy-20261029`, branch `codex/lantern-audit-privacy-20261029`. Read `AGENTS.md`, `docs/CONTRACT.md` and `docs/VERIFICATION.md`. This is a fresh inspection/counterexample pass, not a rerun of the old complete suites. Runtime source, prior worktrees, main and launcher were not changed. No paid/live provider, Chrome/browser lease, deployment or real user account was used.

## Result and new finding

No unauthorized role, task, identity or active-replay disclosure was observed in the tested real local HTTP/WebSocket flows. **One P3 frontend lifecycle finding is reproduced with a specifically labeled deferred-response VM fixture**, below. This report is independent review evidence for coordinator integration and verification, not worker self-approval.

### P3: stale unauthorized room-open completion starts an obsolete auto-join

At saved `public/app.mjs:77-79`, the unauthorized GET catch checks status and `attemptedJoins`, but does not check the captured `current` epoch before issuing the fallback `/join` POST. That request also reads the global `controller.signal`, which can now belong to another room. The epoch guard at line 81 is after the write has already started.

Reproduced sequence:

1. Begin `openRoom(A)` and retain its pending GET response.
2. Begin and complete `openRoom(B)`. A's signal is now aborted, B is the current rendered room.
3. Deliver A's deferred 401. The saved app starts `POST /api/rooms/A/join` with B's still-active controller signal.
4. Resolve that POST. The later epoch guard discards A's view and B stays current, but the obsolete join was already issued and A was added to `attemptedJoins`.

Impact: a departed room can get an unwanted join/identity operation using the new navigation lifetime. It can consume a join attempt and, if processed by the backend, issue an old-room spectator cookie. No private view from A was rendered in B by this control. Proposed coordinator/frontend correction: guard ownership before the fallback POST and capture the request controller locally instead of reading a later navigation's global controller. No runtime fix was made here.

**Fixture boundary:** the VM executes the saved app's actual open/accept logic, with imports replaced by explicit dependencies, rendering/socket setup disabled, and request completions controlled by the test. The deferred unauthorized completion deliberately cannot be canceled, modeling a queued completion. This is not a claim that native fetch routinely delivers 401 after abort, nor a measured Chrome race frequency or demonstrated cross-room role leak. The test is explicitly named `KNOWN P3` and asserts the observed unwanted POST; its passing result is not defect closure.

Positive ownership controls show late successful A responses and mismatched-room snapshots do not overwrite B.

## Exact reviewed runtime source

The worktree started at the full saved commit above; `git diff --exit-code` confirmed no tracked runtime changes before audit commit. The VM test additionally compares the loaded app file's Git hash with the saved object.

| File | Saved blob |
| --- | --- |
| `server/transport.mjs` | `98dfd92abe5b48a1ba9d4296f7c4a57869b2cd54` |
| `server/engine/index.mjs` | `e8c5d83bf050cf7ef8b958e23985cb17bcb46069` |
| `server/rooms.mjs` | `8bbc2122dfe9bee5f1f1595cd8f11b8cabe05cbb` |
| `server/store.mjs` | `e5a846a72d550413bbaafa6067fd7ef37397bf40` |
| `server/static.mjs` | `e3801ae2f1b38f24a86d9936b44e43f052157e37` |
| `public/app.mjs` | `676615bd2350d1f6cbf00ec33cd1d12ac0dbe56a` |
| `public/ui.mjs` | `8f7bf80b22d6551f56fd384cb74ea19899db69db` |
| `public/panels.mjs` | `f9598ec72795e4502d0a4b81b90066e801e13eef` |

Existing closed budget, repair-event, process-lock and terminal-AI findings were read as history and not reopened without new evidence. No new budget finding is asserted.

## New independent checks

`tests/audit-privacy-20261029-http.test.mjs` runs eight new scenario checks with real loopback native HTTP, real ws clients, real transport/engine/store/budget modules, actual serialized responses and on-disk restart. No API success or privacy payload is mocked.

- **Ambiguous/forged credential matrix:** missing, random, uppercase, truncated, foreign-room, renamed foreign-token and duplicate/empty same-name cookies reject with 401 over HTTP and WS. A legitimate room cookie coexisting with an unrelated room cookie still authenticates its own seat. Host rejoin preserves the seat without replacing the cookie; spectator host-flag injection cannot start a room.
- **Death/report/ejection/restart:** a remote legal NPC elimination produces no human witness/local-body event at the distant human seat, while the public spectator can see its permitted body sighting. A legal human report clears body sightings. During voting cast targets remain absent; exact-deadline late ballots deny after authoritative tally, named votes may then be public, and a crew ejection leaves remaining roles hidden. Host and spectator views remain redacted after real persistence/restart. Legal task completion reaches engine crew victory; only then do role-revealed replay and attributed witness records become available. Invalid replay credentials still reject.
- **Malformed/private paths:** null/array/action field/prototype/guessed-task inputs return safe errors, and API responses use `Cache-Control: no-store`. Query-token/player overrides reject. Private source, dotenv, Git, data and encoded traversal probes return 404. These are HTTP fetch URL probes, including fetch-normalized traversal paths, not a claim about every possible raw proxy request-target encoding. Public room shells have CSP frame denial and nosniff and contain no fixture token.
- **Expiry:** an established lobby WS closes with 1001 on controlled room TTL expiry. HTTP/replay/join/WS with the expired room credential cannot revive it, including after restart. This qualifies room/identity lifetime, not a browser cookie-expiry implementation.
- **Split-body phase boundary:** an authenticated vote POST starts while discussion is active, but its remaining body arrives exactly at the discussion deadline. The real engine judges it at completion and accepts voting. The real spectator WS sees cast-status only. Another ballot exactly at the voting deadline denies after tally; role redaction remains intact.
- **Maximum pause:** a request exactly at maximum duration persists paused state, rejects further action and does not reveal roles/replay. Restart and a much later clock leave that privacy boundary intact.
- **Human saboteur vs spectator:** paired WS views show the private role only to human p1, no saboteur tasks, no public per-player roles/tasks, and no spectator action hints. Extra actor/seat fields do not impersonate an NPC or human.
- **Dialogue rendering:** markup submitted as a real HTTP council message survives as exactly that text in the authorized response. The saved frontend council renderer, executed with a minimal DOM interface fixture, creates no IMG/SCRIPT elements from it. Role-revealed results do not render during discussion. This is not browser/XSS engine qualification.

Privacy assertions inspect public/private view fields and ensure identity hashes, request/replay internals, hidden repairers/witness recipients, NPC tasks and engine schema metadata are absent where unauthorized. Public spectator physical positions and post-tally named ballots are allowed by the contract and were not mislabeled leaks.

## Fixture labels and limits

Servers use a deterministic seed selected solely to create named crew/saboteur preconditions, a manually advanced server clock, and selected short rule durations. AI scheduling uses an **inert labeled fixture controller** returning null, with zero tokens/cost; the authored AI implementation is not exercised or independently approved. There are no AI self-check results in this pass.

The report/ejection scenario drives NPC preconditions with accepted real `engine.applyAction` calls on trusted fixture state, then exercises human actions, broadcasts, persistence and replay through real transport. Those trusted NPC actions do not test client authorization; separate real HTTP/WS credential tests do. Winners come from legal engine task completion, not fabricated outcome fields. Tests do not read private state through a client endpoint; only the trusted harness uses it to assert non-disclosure.

The frontend VM lifecycle fixture and minimal DOM renderer fixture are explicitly synthetic clients/interfaces. No Chrome, full browser, native fetch race frequency, mobile, CSP enforcement engine, proxy/CDN cache, production load or live provider is qualified. Static/API header checks establish actual response headers at the local server only. OS/power-loss durability remains outside this privacy pass.

## Actual commands and failures

Environment for install/test execution:

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:npm_config_cache='D:/Widegames-work/npm-cache'
npm ci --ignore-scripts --no-audit --no-fund
node --test --test-concurrency=2 tests/audit-privacy-20261029*.test.mjs
node --check tests/audit-privacy-20261029-http.test.mjs
node --check tests/audit-privacy-20261029-ownership.test.mjs
```

Install: 25 locked packages. Final targeted run: **10 passed, zero failures/skips**, including the labeled P3 reproducer; both syntax checks passed. The original full suites were not rerun as a substitute for this audit.

An earlier combined run had six passing real-server tests and two failing VM tests because the test fixture omitted `clearTimeout`; it also reported resulting asynchronous rejection activity. This was a fixture failure, not a product failure. Adding the actual timer globals corrected the fixture; its two tests and the final ten-test run then passed. No failure was reclassified as a skip.

All source and dependencies are in the new D: worktree. Test data uses uniquely named `D:/Widegames-work/temp/audit-privacy-20261029-*` directories, with resolved-path containment verified before cleanup; none remained after the final run. No user session/provider key was copied or substituted. This commit is a receipt for coordinator review, not approval to publish or merge.
