# Illustrated production preflight

Exact source pin: `a0c70704a8fff5e8069214dcc79de4bfd6500143`. New isolated branch/worktree: `codex/ship-quality-illustrated-production-20261030`, `D:/Widegames-work/ship-quality-illustrated-production-20261030`. Prior worktrees/branches are preserved. This is a bounded production preparation preflight, not final client, browser, container or deployment qualification; the final client is still changing and a final-pin rerun requires coordinator direction.

## Preparation and dependency boundary

Read the tracked preparer and production checker. Ran the unchanged `scripts/prepare-quality-source.mjs` on the exact full pin. It materialized562 tracked files through Git cat-file, verified original blob IDs, and wrote the raw source tree plus its source-manifest.json and the worktree's ignored quality-native-source-latest.json. No checkout filters or source overlays were used.

Raw root: `D:\Widegames-work\ship-quality-illustrated-production-20261030\_artifacts\quality-source-a0c7070-raw-nuwsb4`. Created the tar using `git -c core.autocrlf=false archive --format=tar` at the same pin. Every one of its562 regular-file entries independently matches the raw manifest SHA256. Converted only ignored manifest metadata into rawRoot+'-manifest.json': pin, tarSha256 and files array containing file/mode/blob/oid/sha256. The original tracked preparer, checker and app are unchanged.

Hashes:

| Artifact | SHA256 |
| --- | --- |
| Exact source tar | `36e8d7843e8bdc9d85f40effe03fc2deba4f58b005661bc54d2a78a45533e399` |
| Tracked preparer's source manifest | `f05640d5836dcc64b875554cb74fe6a5da87108bff9078397a2dc828dcea21cf` |
| Checker-compatible adjacent manifest | `8e6bf1f66d051dee3b91ad7011ed6c137f18ea8bc47244325d6e93511a343b0e` |
| Production report | `65d9fec1bd840fff4c8e5c4fd2f1a1f6ea9adae149ee7e976c02b99decba8ad2` |
| Unchanged checker source | `60b604d320a5451c6c243b6a004cd4fc7d51f7c91427dcb0e094358973cf5ad9` |
| Unchanged preparer source | `4af84f864e79bf0e53d8deff0f53f5033fce4c2d4dcd2367f7e7be014a47eb14` |
| package-lock.json | `69d8d16c85c641063313fb66033ecab494e56c6f3463d1319a725560b1d35162` |

From that raw root ran exactly `npm ci --omit=dev --offline --ignore-scripts --no-audit --no-fund`, with npm cache `D:/Widegames-work/npm-cache` and TEMP/TMP `D:/Widegames-work/temp`. It succeeded, adding one package. The raw node_modules/.package-lock.json contains only ws8.22.0; ws resolves inside that raw root. Both puppeteer and puppeteer-core are absent and unresolvable through ancestors; NODE_PATH is unset. The new worktree has no development node_modules, no coordinator dependency ancestor was used, and no Puppeteer package was installed.

## Unchanged checker result

Set QUALITY_PRODUCTION_REVIEW_PIN to the full pin above and QUALITY_PRODUCTION_REVIEW_ROOT to the raw root; ran `node tests/quality-production-review.mjs` from this worktree. Exit0, status passed,30 recorded checks,15.040s, Nodev24.20.0. Its original90-second overall budget and every assertion remain unchanged. The requested35 is not a fixed assertion count in this runner: each extra Beacon attempt to obtain a crew owner adds four per-room checks and one restart check. This run obtained crew on its first Beacon attempt, exercised Beacon2 and Annex1 once each, and therefore recorded30. No gate was removed or weakened to change that count; no artificial extra attempt was forced.

Measured scope/counts:

-562 source blobs unchanged before/after;103 runtime files,67 public/shared assets fetched byte-exact with MIME/CSP;249 local import edges and6 browser references resolve inside shipped groups.
-Production defaults room4/match5/stations1 and port3000; Docker COPY/omit-dev/start source contracts checked. Docker was not invoked; no container qualification is claimed.
-Two actual isolated main children, both exit0 via their actual SIGTERM handler, empty stderr, no forced stops, locks released and regenerated under a distinct owner token on restart.
-Authenticated owner/public-viewer HTTP and WebSocket scopes, missing/cross-room cookies, foreign origins, static/private/traversal denials, settings/start/action/input receipts and private notes checked on Beacon2 and Annex1.
-Four distinct crew station jobs; actual normal-speed882.103-unit route; range and incorrect-input denial, direct-completion refusal, one legal glyph step and exact-ID deduplication before/after restart. This fixture is not a complete-match or frame-rate test.
-Paused legacy schemas1/2/3/4/5 and ended replay history1/2 restore byte-exact; six future cases (room,match,history,features,station,map) refuse without quarantine and preserve files. Synthetic uncertain daily reservation$0.01 remains byte-identical across both mains; no provider send occurred.
-Zero provider fetch attempts, zero outbound attempts, zero forced stops and zero socket privacy errors. Checker error and cleanupError absent.

The first ancillary `node -e` dependency-proof command encountered a PowerShell/native-argument quoting SyntaxError after the offline install had succeeded. Reissued the same proof through stdin successfully before starting the checker. This was a preparation-command error, not a runner/app failure; the production checker ran once and passed without modification.

## Retained evidence and limits

Ignored artifacts are confined to this worktree: `_artifacts/illustrated-production/` holds preparation/install/checker output, exact tar, converted-manifest proof, dependency proof, source hashes and summary; `_artifacts/quality-production-a0c7070-run-1OIGSU/report.json` is the raw production report. Generated private fixtures remain isolated under that run directory. The preparer's raw tree and adjacent checker manifest are preserved.

No app, runner, preparer, lockfile or shared source edit; no Chrome, paid/model request, full suite, production build, main/push/merge or deployment. This receipt alone is committed. All qualification claims above apply only to a0c7070 and this unchanged WS-only fixture; final composed/browser qualification remains coordinator-owned.


## Frozen final-pin production qualification, 2026-10-30

Exact frozen source: `a739a7f511be8d70df88b75737cf9960517f1aaa` (app9a59e7d plus fixture-only a739). New separate worktree/branch: `D:/Widegames-work/ship-quality-illustrated-production-final-20261030`, `codex/ship-quality-illustrated-production-final-20261030`. Earlier a0c7070 preflight trees, artifacts and the full receipt above remain preserved. Only this appended documentation is committed.

Ran the original tracked raw Git-blob preparer, with no modifications, and verified566 original blobs. Raw root: `D:\Widegames-work\ship-quality-illustrated-production-final-20261030\_artifacts\quality-source-a739a7f-raw-qV1epo`. Created the exact-pin tar through `git -c core.autocrlf=false archive --format=tar`; independently checked all566 regular tar entries against the raw manifest SHA256. Converted only ignored metadata from source-manifest.json into the checker's adjacent rawRoot+'-manifest.json', preserving pin and file/mode/blob/oid/sha256 with the actual tar hash. No source overlay or checkout text normalization.

From that raw root, `npm ci --omit=dev --offline --ignore-scripts --no-audit --no-fund` succeeded, adding only ws8.22.0. TEMP/TMP were `D:/Widegames-work/temp`, npm cache `D:/Widegames-work/npm-cache`. Local installed package graph and resolution are WS-only; puppeteer and puppeteer-core are both absent and unresolvable, NODE_PATH unset. Neither this new worktree nor its ancestors supply development dependencies; no coordinator node_modules was used.

Executed once from the new worktree:

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:QUALITY_PRODUCTION_REVIEW_PIN='a739a7f511be8d70df88b75737cf9960517f1aaa'
$env:QUALITY_PRODUCTION_REVIEW_ROOT='D:/Widegames-work/ship-quality-illustrated-production-final-20261030/_artifacts/quality-source-a739a7f-raw-qV1epo'
node tests/quality-production-review.mjs
```

Exit0, status passed,30 recorded checks in24.220s, Nodev24.20.0. Original90s overall budget and all original assertions unchanged. This run needed no extra Beacon crew-selection attempt: the unchanged variable count is30+5 per extra attempt. There was no skip, retry to obtain a preferred result or runner/app edit.

Final measured coverage:

-566 tracked blobs unchanged throughout;103 runtime files,67 public/shared assets fetched byte-exact with expected MIME/CSP;249 local module edges and6 browser references resolve in shipped groups.
-Actual default room4/match5/station1 HTTP and authenticated owner/public-viewer WebSockets on tactical Beacon2 and Annex1, with host/cookie/origin/cross-room/privacy boundaries, settings/action/input receipts and private notes intact. All shipped static assets, including illustrated map modules, are fetched; this fixture's active-room probes are the two tactical maps.
-Actual normal-speed909.151-unit Beacon route, four distinct station jobs/kinds, glyphs task with one legal step; remote/incorrect/direct-completion denials and exact-ID deduplication before/after restart.
-Legacy schemas1/2/3/4/5 and ended histories1/2 preserved, with exact replay authorization/events/metadata/snapshots. Six known future types (room,match,history,features,station,map) refuse without quarantine; bytes and locks preserved.
-Prior labeled uncertain daily reservation$0.01 and sampled legacy files remain byte-identical across both production mains. No refund or budget reset.
-Two isolated actual main children, both exit0 through their real SIGTERM handler, empty stderr; sockets close, data/recovery locks release, restart uses a distinct lock token and preserves identities/deadlines/receipts.
-Zero provider fetch attempts, zero outbound attempts, zero forced stops, zero socket errors. No preparation, checker or cleanup error in this final run.

Exact final hashes:

| Artifact | SHA256 |
| --- | --- |
| Git source tar | `94d1f9b6a5f25b666cb71d0e4bf1699562f611de1ff88dfb0779fc0f54d7b045` |
| Preparer source manifest | `8214f2a8bebe0199f714ae469d4be40b07fb3d64dd77637a3e8e3e0dd5810846` |
| Checker-compatible adjacent manifest | `cf139987a7ed8d92a642c97e7017ac5c4e202b56dbbb4d963cd06d20b7ce671d` |
| Final production report | `97951a9efd1348fba21824afa5a46c0446f328540cb24a08d15e1aa323cb1c7e` |
| Unchanged production runner | `60b604d320a5451c6c243b6a004cd4fc7d51f7c91427dcb0e094358973cf5ad9` |
| Unchanged source preparer | `4af84f864e79bf0e53d8deff0f53f5033fce4c2d4dcd2367f7e7be014a47eb14` |
| package-lock.json | `69d8d16c85c641063313fb66033ecab494e56c6f3463d1319a725560b1d35162` |

Raw report: `_artifacts/quality-production-a739a7f-run-6GokT1/report.json`; preparation/tar/manifest conversion, offline install, dependency proof, checker output, source hashes and final-summary.json are under `_artifacts/illustrated-production-final/`. All generated rooms are isolated under this final run's private-data directory. Git confirms no differences in app/shared/runner/preparer/package sources from the frozen pin.

This closes the requested exact-pin offline production fixture qualification. It does not claim Chrome/browser, full-suite, CI, Docker container, live-provider account or deployment qualification; coordinator owns the parallel remaining gates. No model/paid call, main change, merge, push, deployment or prior-worktree edit.


## Superseding final Escape-fix production qualification, 2026-10-30

Exact frozen pin: `76105e25154c31b0da9a35149569e8a0444230c9`. This production result supersedes the a739 qualification above for the updated app5f94da4 Escape map-close/listener cleanup; every earlier receipt/tree remains preserved. New isolated worktree/branch: `D:/Widegames-work/ship-quality-production-escape-final-20261030`, `codex/ship-quality-production-escape-final-20261030`. Only this appended documentation changes.

Repeated the unchanged raw Git-blob preparer and verified574 tracked files, including all86 PNGs and the six newly added screenshot PNGs, without rewriting image bytes. Raw root: `D:\Widegames-work\ship-quality-production-escape-final-20261030\_artifacts\quality-source-76105e2-raw-AvWFFv`. The exact-pin `git -c core.autocrlf=false archive --format=tar` output has574 regular-file entries, all independently SHA256-matched against the raw blob manifest. Only ignored metadata was converted into the adjacent checker manifest with pin/tarSha256/files(file,mode,blob,oid,sha256). Source/preparer/runner/app/package files were not edited or overlaid.

Ran `npm ci --omit=dev --offline --ignore-scripts --no-audit --no-fund` inside the raw root, using `D:/Widegames-work/npm-cache` and TEMP/TMP `D:/Widegames-work/temp`. Install succeeded with one package. The production graph contains only local ws8.22.0; Puppeteer and puppeteer-core are unresolvable, NODE_PATH unset. No coordinator or development node_modules ancestor was used.

The original90s checker was executed once from the new worktree:

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:QUALITY_PRODUCTION_REVIEW_PIN='76105e25154c31b0da9a35149569e8a0444230c9'
$env:QUALITY_PRODUCTION_REVIEW_ROOT='D:/Widegames-work/ship-quality-production-escape-final-20261030/_artifacts/quality-source-76105e2-raw-AvWFFv'
node tests/quality-production-review.mjs
```

Exit0, passed35 recorded checks in22.910s on Nodev24.20.0; original assertions, timeout and runner are unchanged. The actual variable count is30+5 for one extra Beacon attempt needed to obtain a crew owner. Active HTTP/WS rooms are two Beacon2 attempts and one Annex1, all exercised through their actual production main. No manual rerun or assertion change was used to obtain this result.

Final coverage/counts:574 blobs unchanged before/after;103 runtime files;67 public/shared assets fetched byte-exact with MIME/CSP;249 local import edges and6 browser references resolve. Tracked documentation PNGs are verified raw source artifacts, not falsely claimed as public static assets. Default room4/match5/station1, static/private/traversal denials, host/origin/cookie/cross-room permissions, private notes, settings/start/action/input receipts and owner/public-viewer WebSockets pass. Four distinct station jobs/kinds, an actual normal-speed881.035-unit route, one legal glyphs step, remote/incorrect/direct-completion refusal and exact-ID duplicate handling are retained across restart.

Legacy schemas1/2/3/4/5 and ended histories1/2 preserve their bytes/metadata/events/snapshots/authorization. Six future types (room,match,history,features,station,map) refuse without quarantine and retain original files. The labeled synthetic uncertain daily reservation$0.01 remains byte-identical across both mains, without refund/reset or provider send. Both actual main children exit0 through their real SIGTERM handlers with empty stderr; sockets close, original locks release, restart uses a distinct ownership token, and receipt/identity state is retained. Provider fetch attempts0, outbound attempts0, forced stops0, socket errors0; no checker/preparation/cleanup error.

| Final artifact | SHA256 |
| --- | --- |
| Exact Git source tar | `d1669284e6b0cf29f03093fe2d246d8d2140c07f5a82f7f977fb4fc39a10a99f` |
| Preparer source manifest | `8bcb81290f1cc7afa852f6f5e9de789092f58de75155767df80ace98374fad19` |
| Adjacent checker manifest | `fd04e99d6f088592df1147787c3af1a489b61f5726d199a69dcd99beed6eb26e` |
| Production report | `0edc02d828f001c4d7e780bce0ed4c51b51cced349b6b30a2ca3e9a4561c18a1` |
| Unchanged checker | `60b604d320a5451c6c243b6a004cd4fc7d51f7c91427dcb0e094358973cf5ad9` |
| Unchanged preparer | `4af84f864e79bf0e53d8deff0f53f5033fce4c2d4dcd2367f7e7be014a47eb14` |
| package-lock.json | `69d8d16c85c641063313fb66033ecab494e56c6f3463d1319a725560b1d35162` |

Report: `_artifacts/quality-production-76105e2-run-AZGKJz/report.json`. Preparation/install/checker logs, raw tar, manifest/dependency proofs, frozen hashes and final-summary.json remain under `_artifacts/escape-final-production/`; generated private rooms stay inside this run's private-data directory. Earlier artifacts/worktrees are untouched. Git confirms app/runner/shared/config/package sources remain exactly the frozen pin.

This is the requested final WS-only actual-main production qualification at76105e2. The fixture does not itself operate a browser or the Escape key; coordinator's browser evidence covers those controls. No Chrome, paid/model call, full suite, Docker container run, main/push/merge or deployment is claimed or performed. Only this focused receipt is committed.


## Final focus-guard frozen asset qualification, 2026-10-30

Exact source: `25b39a75795d72cdcc98e99b15b4ebd478a31681`, app14ad207 with the higher-priority-dialog Escape guard. This is the current frozen production receipt, superseding76105e2 for the changed app; all earlier receipts/trees remain preserved. New isolated worktree/branch: `D:/Widegames-work/ship-quality-production-focus-final-20261030`, `codex/ship-quality-production-focus-final-20261030`. Only this appended documentation changes.

Repeated the unchanged tracked raw Git-blob preparer, exact `git -c core.autocrlf=false archive --format=tar`, and compatible adjacent checker-manifest conversion. All574 raw tracked files and574 regular tar entries match their committed hashes, including86 unedited PNGs. Raw root: `D:\Widegames-work\ship-quality-production-focus-final-20261030\_artifacts\quality-source-25b39a7-raw-Nhq2Uz`. Converted metadata contains pin/tarSha256/files(file,mode,blob,oid,sha256); no source overlays or text conversions.

Inside that raw root, `npm ci --omit=dev --offline --ignore-scripts --no-audit --no-fund` succeeded with one package. TEMP/TMP `D:/Widegames-work/temp`, npm cache `D:/Widegames-work/npm-cache`. Only ws8.22.0 is installed/resolved locally. Puppeteer and puppeteer-core are absent/unresolvable through ancestors; NODE_PATH unset. No coordinator or development dependency directory was used.

Executed the original checker once, unchanged, with QUALITY_PRODUCTION_REVIEW_PIN=`25b39a75795d72cdcc98e99b15b4ebd478a31681` and QUALITY_PRODUCTION_REVIEW_ROOT set to that raw root: `node tests/quality-production-review.mjs`. Exit0, status passed,30 checks in29.753s on Nodev24.20.0, within the original90s budget. The count is the unchanged30+5 per extra Beacon crew-selection attempt; no extra attempt was needed. No assertion change, omitted gate, result-seeking rerun or error.

Final counts/scope:574 blobs unchanged before/after;103 runtime files;67 public/shared assets fetched byte-exact with MIME/CSP;249 local import edges and6 browser references resolve. Actual production HTTP/owner-public WebSockets exercise Beacon2 and Annex1, including permissions/origins/cross-room cookies, static/private/traversal boundaries, map/settings/start/action/input receipts and private notes. Four distinct station jobs/kinds, actual normal-speed908.372-unit route, one legal glyphs step, invalid/remote/direct-completion denials and exact-ID deduplication survive restart. Legacy1..5 files and replay1/2 metadata/events/snapshots/authorization retain their bounds and bytes; six known future types (room,match,history,features,station,map) refuse without quarantine. The prior synthetic uncertain daily reservation$0.01 remains byte-exact, without refund/reset.

Both actual main children exited0 through their real SIGTERM handlers, empty stderr; sockets and ownership/recovery locks cleaned up, restart acquired a distinct lock token and retained identities/receipts. Provider fetch attempts0, outbound attempts0, forced stops0, socket errors0; no preparation/checker/cleanup error.

| Final artifact | SHA256 |
| --- | --- |
| Exact Git source tar | `5a192c32b8597cda5a853142d24769553ccf489c0a22eb697cfcd6c65fbdf0cd` |
| Preparer source manifest | `d419f16d103d8c66550ac32cb4d4a5ae21b9517e97cd4981ca0c79072df4f6c8` |
| Adjacent checker manifest | `7b94dbcdff899b8d05d354233a35f3b7996c175120881aba1590a1fb9bcffb59` |
| Production report | `74d6606fbb619aa192106d983f4e5ea3397ddbc3cb81672063af9808b67102a9` |
| Unchanged checker | `60b604d320a5451c6c243b6a004cd4fc7d51f7c91427dcb0e094358973cf5ad9` |
| Unchanged preparer | `4af84f864e79bf0e53d8deff0f53f5033fce4c2d4dcd2367f7e7be014a47eb14` |
| package-lock.json | `69d8d16c85c641063313fb66033ecab494e56c6f3463d1319a725560b1d35162` |

Report: `_artifacts/quality-production-25b39a7-run-ToaWRw/report.json`. Raw tar, manifests, offline-install/dependency proof, checker output, frozen hashes and final-summary.json are preserved under `_artifacts/focus-final-production/`, with generated private data isolated to this run. App/shared/config/runner/preparer/package sources remain exactly the frozen pin. This is the final requested actual-main WS-only production qualification; it does not itself exercise Escape/browser focus or claim full-suite, CI, Docker-container, live-provider or deployment qualification. No Chrome, model/paid calls, runtime edits, main/push/merge/deploy or prior-tree modification. Stop after this receipt commit.
