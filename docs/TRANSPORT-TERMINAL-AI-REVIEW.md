# Terminal AI transport review — 2026-10-29

Reviewed exact manager commit `9b31317c618ea12810a369edb84f87834f9218b9` against parent `6cd9ff5`. The production change is confined to `server/transport.mjs`: terminal `ended`/`paused` broadcasts abort the room controller, and `commitReservation` rejects those phases. The existing close cancellation is unchanged. The other changed file is the manager's integration test. No production sources were edited by this review.

`tests/transport-terminal-ai.test.mjs` compares these coordinator files against their exact committed contents before imports and again after the suite: `server/transport.mjs`, `server/rooms.mjs`, `server/store.mjs`, `server/budget.mjs`, `server/engine/index.mjs`, `server/static.mjs`, and `shared/contracts.mjs`. The coordinator runtime stayed frozen at the reviewed source contents. Only deterministic engine initialization and a pending AI controller are injected; HTTP, authentication, engine actions/deadlines/victory, persistence, budget reservations and restart use the pinned implementations. Tests neither read hidden state into an AI prompt nor call a provider.

Passed controls:

1. Actual HTTP crew victory. Deterministic initialization makes human p1 crew and AI p2 saboteur. A real human emergency meeting and one HTTP vote for p2 establish singleton plurality. Crossing the tally deadline with another HTTP action produces a committed crew/ejection victory and a safe `MATCH_INACTIVE` denial. The terminal broadcast aborts the already pending AI decision with no WebSocket, disconnect or server close. Its late returned proposal is discarded. A captured reservation callback rejects a new post-terminal request, and subsequent scheduler intervals produce no additional decision or simulated send. The completed match exposes its actual replay.
2. Unattended pause. The engine's maximum-duration deadline pauses a real started match while AI is pending. The timer broadcast aborts it, the late proposal is discarded, post-pause reservation is rejected, and no new decision/send appears. Outcome remains null and replay remains unavailable.
3. Ended restart. After the real HTTP ejection victory, the service closes and restores the same persisted room. The human cookie/seat, ended outcome, action request history, replay, private AI context and deployment budget survive. Further intervals schedule no AI or new simulated send.

Each case begins with a previously persisted private reservation/memory and then another persisted reservation for the pending simulated request. Both reservations remain: calls 2, tokens 500, cost $0.05; the deployment ledger remains byte-for-byte unchanged after terminal cancellation and after ended restart. Cancellation does not refund uncertain spend. A deliberately mutated private memory in the late AI response never overwrites that checkpoint, and private memory is absent from public room/replay payloads. Every actual provider-call count is zero; the only simulated send occurs before the terminal phase.

Validation from `D:/Widegames-work/transport`:

```powershell
node --test tests/transport-terminal-ai.test.mjs
node --check tests/transport-terminal-ai.test.mjs
git diff --check
```

Result: **3/3 passed**, exact source checks passed, syntax/diff checks passed. No concrete transport defect found in this reviewed scope. This transport review stubs pending provider behavior; it does not independently qualify a live provider's network cancellation. No paid calls or Chrome/browser sessions were used.

The original worker run used its sibling frozen coordinator. On integration the default source root was changed to the test's own repository, so ordinary full checkouts do not depend on a sibling named coordinator. `TRANSPORT_TERMINAL_ROOT` can still select an exact read-only archive. A source mismatch fails before testing. Default fixtures now live under this repository's ignored `_artifacts/test-temp`; `TRANSPORT_TEST_TEMP` can override that location. This portability adjustment changes test paths only, preserving the three terminal behavior controls above.
