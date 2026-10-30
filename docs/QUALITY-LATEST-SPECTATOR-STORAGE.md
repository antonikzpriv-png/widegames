# Latest-main spectator storage integration

Source: candidate88b9646f1f577c1e12b2f2a10172aa51d5f9e38e, incoming mainaa1f58c7699acb53ecba96c977a089c54c41c340 compared with41b4c6e2ddfce65882ac635c6dc5b7e4cf1fc4ef. Work is confined to the new codex/ship-quality-spectator-storage-20261030 worktree. Prior worktrees are preserved.

## Private owner capability

Only an authenticated host identity in an all-AI room receives game.inspection. Both room and match must be spectator mode, with no actor seat. HTTP and WebSocket resolve identity from the same room's server-issued HttpOnly cookie; request fields/query flags cannot grant host status. Human hosts, human-room visitors, joined all-AI visitors and foreign-room cookies do not receive this projection. Existing engine/player/AI views retain their original redaction. The inspection is an explicitly private owner product, not the public spectator feed.

The projector resolves exact maps using mapFor, including permanent legacy mapId Beacon1, current Beacon2, Annex1, Foundry1 and Observatory1. It reports progress counts for six station challenge kinds and eleven taskStep kinds, without puzzle answers/inputs/challenges. Allowlisted action labels and time-bounded structural selected plans remain historical controller state with an uncertainty notice. Exact-map repair sites, devices and linked passages are checked. No whole memory, prompt, reasoning, provider error, key or fallen chat is copied. Recent events are capped at256, agents24, per-agent tasks32/actions6/public claims3, selected task-route IDs3. Private ghostSay is excluded.

## Copy and scheduler boundary

The transport copies only the room envelope when replacing it with an immutable engine result or a separately cloned AI context. It retains full clones for lobby/identity/start mutation and the defensive applyInput input copy. Engine input immutability is part of the existing executable contract; validation and durable store.save complete before room.data is published. A simulated durable failure leaves the prior room/state/context and generation untouched. No persisted schema is changed.

Scheduler eligibility reads local authoritative life/task state instead of constructing every NPC's view on every tick. Every fallen faction retains one local private message, deduplicated by accepted fallen-chat history or persisted ghostSpoken memory; idle observers stop scheduling. Fallen crew with unfinished jobs remain eligible. Controller/getCurrentView/generation fences and per-attempt room-context then deployment-budget reservation ordering remain intact. No engine/AI starvation policy is changed here.

## Focused evidence, 2026-10-30

The uniquely owned tests/latest-spectator-boundary-inspection.test.mjs adapts all eight incoming inspection controls, retaining their original positive projection, defensive-copy, phase, plan staleness, expanded-map, replay and selected-actor assertions. Its public-view expectation is intentionally tightened to host-only. Four added groups cover all maps/protocol summaries, tactical structural metadata and forbidden raw fields, immutable/durable failures, and native four-map HTTP start receipts/public catalog/private inspection.

Retained initial-red.txt:5 pass/3 fail before implementation. The candidate omitted owner inspection, its pure helper accepted a nonhost, and the scheduler constructed all six views. This is an expected initial candidate failure, not a claim that candidate HTTP already leaked inspection. Initial upstream helper semantics would expose it upon unguarded integration.

Extended-first.txt preserves two harness errors: query spoofing already returns400 (it is not a successful game response), and systems:true requires world:true. Those fixtures were corrected explicitly, with no runtime relaxation. Extended corrected11/11 passed, then the native four-map group was added.

Final command (ordinary current-checkout imports, no source overlays):

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
node --test --test-isolation=none tests/latest-spectator-boundary-inspection.test.mjs tests/quality-main-ghost-factions.test.mjs tests/transport-service.test.mjs tests/transport-terminal-ai.test.mjs tests/latest-main-start-restore.test.mjs tests/latest-main-storage-integration.test.mjs
```

43/43 pass,0 skips,23.319s. This comprises12 owned controls,13 unchanged actual ghost-faction/HTTP/store/controller controls,10 transport-service controls,3 terminal AI controls,2 strict start/restore controls and3 storage schema/map/budget controls. Native HTTP tests exercise all four current maps; the pure inspector additionally covers exact Beacon1. Actual legal ejection/ghost fixtures retain both faction privacy and private-message restart deduplication. Store checks cover schemas1..5, backup preservation, future protocol refusal and previously saved spending. Injected provider send counters are local mocks only. No network model requests occur.

Ignored evidence is under _artifacts/spectator-storage/, with source-manifest.json containing base/incoming pins, exact changed-source hashes and results. Generated rooms are under checkout-local ignored _artifacts/test-temp/. Only existing offline ws8.22.0 was copied into ignored node_modules; no install was performed. Syntax and git diff --check also pass.

## Coordinator integration limits

The original tests/spectator-inspection.test.mjs is outside this assignment's latest-spectator-boundary test ownership and remains unchanged. Its direct helper positives must supply the authenticated host identity; its joined-viewer HTTP/WS inspection positives must become negatives while retaining owner positives, as in the owned adaptation. Otherwise the old file asserts the superseded public entitlement and will fail. Coordinator-owned docs/SPECTATOR.md and related new-main receipts likewise still describe all seatless observers and must state host-only. Historical main browser/performance receipts are not qualification of this composed candidate.

Root18 null legacy creation, replay1 64KiB bound, source aliases, strict conflicting start-ID409/unchanged200 and future-record guards are retained; no config/store/shared/engine/client files are changed. The new inspector is tested server-side only; no browser, full suite, live provider, deployment, main change, push or approval was performed. Core owns engine copying/starvation work; coordinator must rerun final combined gates after all owner commits. Timing above describes this test harness, not a performance guarantee.
