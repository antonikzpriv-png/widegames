# Bounded production/runtime review

Exact coordinator source: **56c320a537d0cb2da7c5079f24bc26b9337d1f17**. Result: **17 checks pass**, no product blocker reproduced in this bounded qualification. Node24.20.0, npm11.19.0, Windows. This receipt qualifies production dependency/startup/HTTP/WS/shutdown boundaries; it is not deployment or independent approval of Core's own rules implementation.

Only this document and tests/world-core-production-review.mjs are changed on codex/lantern-world-core-20261029. Coordinator and all other worktrees/data were read-only. No runtime source changes, Chrome, Docker execution, full suite, repeated AI match simulations, provider calls, main operations, push or deployment.

## Exact archive and dependency boundary

Own ignored archive: _artifacts/world-production-56c320a.tar. Its Git PAX comment pins the exact hash above. Archive SHA256: 2bf87560e28d0df87b6af03d9feaeadb15145e7d8f8196b282ce94f1d1511554.

Executable snapshot: _artifacts/world-production-56c320a. To avoid Windows archive EOL conversions, every file was materialized from raw Git blobs using git ls-tree and buffered git cat-file --batch. All148 tracked blob IDs were checked on extraction; the SHA256 manifest is _artifacts/world-production-56c320a-manifest.json. The harness checks all148 files again before and after execution. No archive runtime file was patched. node_modules and isolated private fixture data are additional ignored artifacts, not tracked source.

Only the locked production dependency was installed, **offline**, with lifecycle scripts/audit/fund disabled and D: cache/temp. Install added one package. The archive's installed package ledger contains only node_modules/ws, version8.22.0, resolving inside this snapshot. Puppeteer is physically absent and cannot resolve. No dependency was installed in another checkout.

Source review and executable import/reference checks cover all35 server/public/shared files. Every local module reference resolves within those shipped groups, including server/engine/world-runtime.mjs, server/ai/world.mjs, shared/world.mjs, public/world-input-envelope.mjs and all eight public/world modules. Dockerfile copies those three complete directories, uses npm ci --omit=dev --ignore-scripts, and starts server/main.mjs. .dockerignore does not exclude those groups. This Docker assessment is source-only; no image build/run was attempted.

package.json start/dev point to actual server/main.mjs. Ordinary tests target tests/*.test.mjs, including committed world tests. test:browser targets scripts/world-browser-check.mjs, which obtains production worldMode:true via loadConfig and asserts worldVersion1. No browser/test script was executed for this receipt.

## Actual runtime controls

The harness spawns **real server/main.mjs** twice from the production-only archive, with NODE_ENV=production, loopback host/origin and ephemeral reserved ports. Both runs share only a newly created _artifacts/world-production-private-* DATA_DIR. An explicit child environment contains demo mode, zero model budgets and an unused synthetic credential marker; no live account credentials are inherited. The wrapper blocks/counts outbound global fetch. No engine/config/transport implementation is injected.

- Health returns exactly the public Lantern Wake readiness envelope. The actual child owns service.lock in the isolated data directory.
- All21 public/shared assets, including complete world modules, CSS, SVG icon and HTML, return200 with byte-for-byte SHA256 equality to the exact source snapshot, nosniff and CSP. JavaScript has the expected MIME type. Private data, runtime source and package metadata paths return404.
- Actual human create/start through HTTP yields worldVersion1, own role/position/input sequence and no other keeper roles/tasks/motion/input/destination. Visible other coordinates satisfy public line of sight. Spectator join has null self and withheld roles. Missing room auth returns401; pre-end replay returns409.
- Foreign-origin creation and movement return403. Authenticated integer steering physically changes position. The legitimate scoped seq2 zero cleanup packet stops movement, acknowledges inputSeq2 and does not relax origin checks.
- Actual installed ws serves an authenticated, role-safe world snapshot. A live socket remains open until main shutdown, exercising its real cleanup path.
- The Windows IPC wrapper emits SIGTERM into the process, invoking main's **one real registered SIGTERM handler**, then disconnects IPC. Both children exit naturally with code0/signalnull within6s. First shutdown closes the live WebSocket. Both service.lock and recovery claim disappear. No force stop was needed.
- A second real main acquires a new lock token, loads persisted schema2/worldVersion1 without quarantine, accepts the original human cookie, preserves exact stopped position/inputSeq2, and treats repeated seq2 zero as inert. It releases its own lock on shutdown.
- The synthetic credential marker appears in neither HTTP bodies nor child logs. Demo summaries report zero calls. Outbound provider fetch attempts0; forced stops0; all148 source hashes unchanged.

Final successful main child PIDs7944/15260 are recorded with exit code0 in the private artifact receipt. These identify only this completed fixture, not any original running service.

## Commands and evidence

From D:/Widegames-work/world-core-20261029, first resolve/archive the coordinator commit into this checkout's ignored artifacts and materialize/verify its raw tracked blobs as above. Install command ran with the snapshot itself as cwd:

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --offline --cache D:/Widegames-work/npm-cache
~~~

From the assigned worktree root, with that prepared immutable snapshot:

~~~powershell
$env:WORLD_PRODUCTION_REVIEW_ROOT=(Join-Path (Get-Location) '_artifacts/world-production-56c320a')
node tests/world-core-production-review.mjs
node --check tests/world-core-production-review.mjs
git diff --check
~~~

Final execution:17/17 checks,21 exact assets, two real main starts/stops,0 provider fetches,0 forced stops; ~3.16s shell run. Evidence: _artifacts/world-production-56c320a-install.txt, world-production-56c320a-run.txt, world-production-56c320a-result.json and the source manifest/archive. Fixture data is isolated under the recorded private artifact path.

Two initial harness failures are preserved honestly: initial-fixture.txt wrongly expected a literal world:true in the browser script instead of its actual loadConfig world default; initial-bytes.txt hashed Response.text(), which strips the CSS BOM. The corrected checks inspect the actual config path and hash raw HTTP bytes. Neither was a product failure. The interrupted second fixture's real main was closed through its handler in finally. No runtime assertion was weakened to accept incorrect behavior.

Limits: localhost Windows execution, IPC signal emission rather than an OS-delivered POSIX signal, no NTFS ACL or power-loss durability qualification, no Docker/Linux/image execution, no browser rendering/input events, no live providers, and no exhaustive load/origin/fault campaign. Source/reference and asset checks cannot establish browser behavior. The task intentionally exercises short real demo runtime rather than repeating full match or AI suites. Reviewer updates to historical abort/cleanup assertions are outside this source pin and were not edited here.
