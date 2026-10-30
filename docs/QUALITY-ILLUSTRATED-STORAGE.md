# Illustrated revision storage integration

Base537bccfd9fe0f8d40e1ae5ca19a5c858d8e433f4; incoming main668a867e069c7fb3aafbc69bbf9e6c42d1607eb7 compared withaa1f58c7699acb53ecba96c977a089c54c41c340. Changes are limited to assigned config/rooms/store/transport/feature validation, uniquely owned tests and this receipt. The new D: worktree preserves all prior worktrees. No shared/engine/client source is edited.

## Resolved identity and creation

Default loadConfig retains tactical/station Beacon2, fourteen rooms3200x2400. Its trusted legacy mapRevision2 default is added without passing that field to tactical matches. Explicit beacon-illustrated selects world2 canonical beacon/revision2, six rooms1600x1200. Latest Foundry/Observatory strings select revision2; absent revision in saved legacy data remains1. Non-tactical trusted config worldMode:true,mapRevision:2 selects illustrated canonical Beacon even with no mapId. Plain old direct constructors with no selection/revision retain their metadata-free shape and null legacy creation works.

Modern world2 lobbies retain an exact selection reference plus canonical mapId and revision2. The engine receives canonical legacyMapId/revision, never beacon-illustrated as a legacy engine mapId. Native map setting transitions preserve identities, request/settings ledgers and AI reservations. No authored tactical/station fixtures are invented for illustrated world2.

Saved bindings compare mapIdentity namespaces resolved by mapFor, not naked IDs/version or alias strings. Tactical Beacon2 and world2 illustrated Beacon2 cannot validate as one another. The world2 exact-map compatibility guard remains strict and requires matching canonical legacy ID/revision. Feature task locations and snapshot geometry use the resolved revision. An explicit saved mapRevision also suppresses unrelated fallback geometry bootstrap, including implicit canonical Beacon. Future integer revisions>2 raise a useful MAP_UNAVAILABLE error before quarantine; original file and backups remain untouched. Existing schemas1..5, task protocol guards, locking/quarantine/backup code and replay bounds remain.

Accepted start IDs bind physical maps. An unchanged raw canonical retry returns200 without reselecting the newest map or saving a new state. This applies to old main records and older modern exact records using that same canonical selection. A changed alias/namespace returns409 START_CONFLICT; original accepted state/features/receipts remain. Modern native beacon-illustrated and tactical beacon remain different selections. HTTP cannot supply mapRevision, host or another actor through request fields. Trusted revision config is validated before storage is opened.

## Privacy and spending

The prior3a27483 host-only inspection implementation is retained: only the server-cookie authenticated host of a spectator room receives game.inspection; joined viewers and human rooms retain normal permitted information. The inspector already uses mapFor and therefore follows legacy revisions automatically. Six station and eleven step summaries remain bounded allowlists; there are no raw puzzles, memory, prompts, reasoning, keys, provider errors or fallen chat. Normal engine/AI views do not acquire inspection. All-faction ghost local-message scheduling/deduplication and idle planner stop are unchanged. c78 selfContributed remains only in an actor's own systems view; no systems module or projection is changed here.

Private AI context and already reserved deployment/match spending are retained across restore and retry. Per-attempt durable room-context then daily-ledger reservation fences remain intact. No model or paid provider request is made.

## Source-pinned evidence

The new tests/latest-illustrated-storage-boundary.test.mjs imports the current checkout by default. ILLUSTRATED_STORAGE_ROOT optionally selects an explicit composition. It materializes incoming main668 server/shared modules from exact Git blobs under ignored own-worktree artifacts, without archive text conversion, and generates real raw-main saves with original schema1 room/schema2 engine, legal denied-action receipts and prior reservations. No running user data or manager worktree is touched.

The qualification fixture is exact Core8f92a0235bdbdb24cdc47fc92ae239f0c0c1bf55 (based on537bccf), with only six owned storage files overlaid inside this worktree's ignored archive. The tracked worker checkout does not incorporate Core's commit. This explicit dependency is required for engine/replay revision handling; no standalone full-suite qualification of the worker base is claimed. Existing offline ws8.22.0 is copied into ignored node_modules, with no install.

Six meaningful owned groups pass6/6,0 skips (8.895s): default/alias namespace isolation; pre-storage revision validation and public override denial; byte-identical original-main saves/backups on three canonical maps at both revisions; modern exact bindings/corruption/future refusal; five-selection native HTTP plus nonhost WebSocket privacy; accepted start retries/latest defaults/restart/spending preservation. Generated fixtures and cleanup are checkout-local ignored _artifacts/test-temp. Future file checks preserve valid backups and verify no quarantine; raw save checks verify original bytes, identities, state and AI ledger, not reconstructed equivalents.

Retained evidence under _artifacts/illustrated-storage:

- storage-original-red.txt:0/6 pass against exact Core8f with unadapted storage. This isolates the storage integration gap with engine revision handling present.
- storage-first-overlay.txt:3/6 pass. Two failures were fixture cleanup ordering (directory removed before server close); corrected fixture cleanup stops registered servers before removal. The third exposed native illustrated-to-tactical alias retry incorrectly returning200 and is fixed by the resolved alias/namespace comparison. Historical failures remain.
- storage-corrected-green.txt:6/6 pass after both corrections.
- retained-first-targeted.txt:37 registered,27 pass,10 fail,0 skips,13.025s. All25 unchanged transport/start-restore/ghost groups pass, including identity/HTTP/WS isolation, old constructors, budget send/storage/daily failures, restart receipts, actual ghost ejections/private chat and one local observer message with idle stop. The remaining tests are incoming map-revision-integration and spectator-revision2.
- Three of those failures correctly rejected mismatched room/state revisions but expected the useful word revision in the error. Error text now includes it; unchanged three backend task/navigation/persistence controls pass3/3,0 skips in revision-denials-corrected.txt (1.790s).
- Seven remaining failures are pre-adaptation client dependencies, not claimed green: three revision2 replay playback cases, one legacy replay revision-mismatch case, and three spectator technical-position cases. They occur in public/world/replay-model.mjs and public/world/spectator.mjs from the537/Core8f fixture. Frontend owns those files and revision adaptation; no client/test assertion is weakened here.

Command examples (all local fixtures, no full suite):

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:ILLUSTRATED_STORAGE_ROOT=(Resolve-Path _artifacts/illustrated-storage/core8f).Path
node --test --test-isolation=none tests/latest-illustrated-storage-boundary.test.mjs
node --test --test-isolation=none _artifacts/illustrated-storage/core8f/tests/map-revision-integration.test.mjs _artifacts/illustrated-storage/core8f/tests/spectator-revision2.test.mjs _artifacts/illustrated-storage/core8f/tests/transport-service.test.mjs _artifacts/illustrated-storage/core8f/tests/latest-main-start-restore.test.mjs _artifacts/illustrated-storage/core8f/tests/quality-main-ghost-factions.test.mjs
```

source-manifest.json records exact pins and SHA256s for owned/dependency sources. Syntax checks and git diff --check pass. Earlier four-selection/current-version1 catalog fixtures now need their owners to pin exact old maps or assert five latest selections; they are not silently rewritten here. Coordinator/Core/Frontend composition and final combined tests remain required. No Chrome, full suite, live provider, production build, main write, push, merge, deployment or user-data migration is performed.
