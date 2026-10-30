# Exact production/runtime qualification

Reviewed source: **f6cb78b4c61e0859fcf0d0ddb5a8171d87e20789** (manager f6cb78b, including e511 safe-motion default and station schema5). Worker: D:/Widegames-work/ship-quality-core-20261030, codex/ship-quality-core-20261030. Only tests/quality-production-review.mjs and this receipt are owned changes. This qualifies this exact source, not a later package/runtime revision.

Result: **27/27 production checks passed on the first run**,16,346ms overall. Normal offline production install added exactly ws8.22.0; Puppeteer/Puppeteer-core are absent and unresolvable. Two actual unmodified server/main.mjs instances ran against one isolated private DATA_DIR. All338 source Git blobs remained unchanged. Runtime groups contain80 files, including51 public/shared assets; all51 were fetched byte-exact. The169 literal local module edges and5 additional literal browser references resolve inside deployed groups. Explicit movement, station UI/challenge/contract and Beacon2 modules are included. No runtime overlays, main changes, original/user-data access, other-worktree edits, Chrome, Docker execution, full suite or provider requests.

## Source review separate from the harness

Compared actual committed a20cf920?f6cb78b runtime changes: client station UI/camera/environment/motion delegation and input lifecycle integration, bounded spatial cache, normal station default, root navigation preparation, transport default wiring. shared, package.json, package-lock.json and Dockerfile are unchanged over that comparison. Runtime source list and exact cache blob are in _artifacts/quality-production-f6cb78b-source-audit.json. No concrete production blocker was found in this bounded source inspection.

The spatial cache is byte-identical to ad8b08230c13faa826f5cb3440fe119ce7f23e43. Inspection confirms it retains only fixed-grid legality bytes, one static graph plus at most four canonical sorted known closed-door signatures, not full routes/targets/actors/match state. Cache use requires frozen collision geometry. Each graph has N cell and2N edge bytes, N?50000; retained byte buffers are bounded by15N. Parent/queue arrays are query-local. Static proposals and final routes retain exact full-polyline sweeps and the4096-waypoint bound; dynamic edges add the exact door sweep. Door closures still invalidate accepted routes at the chronological root boundary. Mutable custom geometry does not retain cache results. This source review does not constitute independent approval of Core's previously authored cache algorithm; manager/Reviewer retain that review responsibility.

Root prepareNavigation warms only immutable registered map geometry with copied public spawn/station coordinates before rooms or provider work. Its prepared-map set and runtime map keys resolve through the finite versioned registry. It does not create match outcomes, observations, AI memory or private movement. Origin validation precedes preparation/store acquisition. Default configuration explicitly enables stationTasksMode; room4 maps to match5/stationTasksVersion1 in transport and store validation. Exact historical map references remain versioned.

The packaged ActorSamples default delegates actual world views to MotionTrack. The harness imports the actual packaged class using a real HTTP safe view and confirms delegated sampling and immediate removal when that view revokes an actor. This is module/runtime integration evidence, not browser execution or native visual/physical input qualification.

## Real production boundary evidence

Normal main keeps port3000/start command/ws-only dependencies and server/shared/public Docker COPY groups. Fixture overrides only loopback port/origin, private DATA_DIR, demo provider and zero budgets. Startup does not override world/tactical/station defaults. Default new rooms select exact Beacon2, carry room station marker1, and persist as room schema4/match schema5. Both Beacon2 and Annex1 select/start through actual authenticated settings/HTTP, with owner and spectator WebSockets.

Owner-only roles, tasks/challenges, notes and input fields stay scoped. Other roster members have no role before end, no private tasks/motion/destination/input sequence, unknown deaths retain nullable status, and unseen positions stay null. Every supplied remote position is checked against actual configured vision/LOS/public doors. Spectators retain the fixed map viewpoint, empty owner notes/sessions/observations/hints and no private transit/cooldowns. Private source/data/dependencies/traversal paths return404; missing/cross-room identities and foreign mutation/socket origins reject; replay remains409 before resolution. The synthetic unused credential marker appears in no HTTP/WS payload or main log.

The default Beacon2 crew owner received exactly four distinct task IDs, room IDs and station kinds. A906.829-unit route to an owned glyph station completed under the real normal-speed main and explicit arrival bound. Out-of-range valid puzzle input and incorrect legacy confirm/complete input returned persisted denials. A direct legacy task action opened but did not solve the station. One correct input derived solely from owner-provided clues progressed the real task once; same-ID retry added no progress. Spectators received no owner task IDs. Main restart preserved the exact challenge and both accepted/denied receipts; their original retries caused no extra owner actions.

Production roles use real crypto selection, not an injected seed. The harness may create at most four ordinary Beacon rooms to obtain a crew owner; this run needed only one Beacon room plus Annex. Every created room follows the same authentication/privacy/receipt checks. Private fixture files are synthetic, never production/user data.

Both actual main instances exited code0/signal null through their real single SIGTERM handler. On Windows the bounded IPC wrapper invokes process.emit('SIGTERM') and disconnects; this exercises actual main cleanup but is not OS/POSIX signal delivery qualification. WebSockets closed, lock/recovery paths disappeared, and restart acquired a different ownership token for the same DATA_DIR. Original cookies/seats/roles/maps/settings/private notes/input sequence2 and stopped position returned. Duplicate settings, note, input and station actions added no owner mutations/receipts. No quarantine occurred.

Paused synthetic legacy matches1/2/3/4, including tactical match4 with explicit retained Beacon1, were constructed by real engine/store APIs with accepted wait receipts. Their files remained byte-exact across both mains. This samples restore/format/receipt preservation, not active legacy gameplay. A real daily-budget API seeded a labeled synthetic uncertain0.01 reservation with no send; the complete ledger remained byte-exact across both zero-budget mains.

The wrapper blocks global fetch, http/https request/get and net connect/createConnection before loading main. Actual counts: **0 provider fetch attempts,0 outbound connection attempts,0 forced main stops,0 socket privacy errors**. The original live model adapter, external billing/provider latency and hosted deployment are untested.

## Exact commands and retained evidence

From the assigned worker root, a fresh ignored archive was written from git ls-tree/git cat-file raw blobs, checking every canonical blob SHA1 and recording per-file SHA256. No smudged working-copy source was used.

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
npm ci --omit=dev --offline --no-audit --no-fund --cache D:/Widegames-work/npm-cache --prefix _artifacts/quality-production-f6cb78b
node --check tests/quality-production-review.mjs
node tests/quality-production-review.mjs
git diff --check
~~~

This is normal npm ci without --ignore-scripts; the exact package has no lifecycle scripts and the sole installed dependency is ws. The standalone harness intentionally does not match ordinary *.test.mjs and defaults to the full reviewed pin. Optional QUALITY_PRODUCTION_REVIEW_PIN must be a full hash; QUALITY_PRODUCTION_REVIEW_ROOT must remain inside this worker's ignored artifacts. Archive/manifest/install are explicit preparation, not an implicit network fallback. Fixture bounds:90s total, at most two mains,10s startup,8s graceful stop,4s requests/WS; station arrival is distance-derived and capped25s.

Copyable evidence paths, all relative to this D: worktree:

- Source: _artifacts/quality-production-f6cb78b/
- Raw source manifest: _artifacts/quality-production-f6cb78b-manifest.json
- Successful report: _artifacts/quality-production-f6cb78b-run-L71K3g/report.json
- Synthetic private data: _artifacts/quality-production-f6cb78b-run-L71K3g/private-data/
- Install: _artifacts/quality-production-f6cb78b-install.txt
- First successful run: _artifacts/quality-production-f6cb78b-first.txt
- Source comparison: _artifacts/quality-production-f6cb78b-source-audit.json

An auxiliary post-run source-receipt command initially hit sandbox spawnSync git EPERM; the authorized D: command was rerun to finish the receipt. It did not affect or repeat the completed27-check main qualification. No later runtime or asset pin is implied by this report. Independent browser/native quality remains Reviewer/manager-owned.
