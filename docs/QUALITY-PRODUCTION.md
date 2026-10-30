# Frozen f9 production/runtime qualification

Qualified source: **f9b32151e4dfab4f2525cee067a9859cd1a27dff**. Worker: D:/Widegames-work/ship-quality-production-final-20261030, branch codex/ship-quality-production-final-20261030, created from this exact pin. Only tests/quality-production-review.mjs and this receipt change. Existing engine/core branches, dirty merge-fixture staging and all older worktrees are preserved. The earlier f6 qualification at5ebe6f5c373a4a061086a42a73074a7325383dfa is **historical**, not approval of the merged Group2 runtime. Its original source/report remain in the original core worktree; a receipt copy is retained in this worker's _artifacts/QUALITY-PRODUCTION-f6-historical.md.

**Result:30/30 checks passed in16,751ms**, one bounded real-main qualification run. No runtime counterexample or blocker was found in this scope. Offline normal npm ci installed only ws8.22.0. Puppeteer and Puppeteer-core were absent and unresolvable. All422 raw source blobs remained unchanged. The shipped server/public/shared graph has91 files,57 public/shared assets,217 literal local module edges and5 additional literal browser references. All57 assets were fetched byte-exact with expected MIME/CSP/nosniff. These counts are computed, not inherited from older receipts.

## What actually ran

Two actual unmodified server/main.mjs instances used one synthetic private DATA_DIR, demo mode and zero configured budgets. Only loopback port/origin/data/provider-budget environment settings were supplied; world/systems/tactical/station defaults were not overridden. Normal creation persisted room schema4/match schema5, Beacon2 by default, transfer policy and abilitiesfalse. Both Beacon2 and Annex1 were selected through authenticated settings and started over native HTTP. The actual crew owner received four distinct station jobs, rooms and puzzle kinds. This run needed one normal Beacon room and one Annex room, without seeded production role selection.

The owner walked a real distance-derived route at normal180units/s to a station. Remote and incorrect station inputs were denied; direct legacy task opening did not solve the station. One legal taskInteract step persisted, deduplicated and survived restart. This is a bounded step/packaging check, not a full match, movement benchmark or browser qualification.

Owner/spectator HTTP and real ws connections retained exact map and private-data scopes. Remote roles were absent before end; observed positions were checked against actual spatial LOS/vision/doors, unseen positions and rooms remained null, and remote task/motion/destination/input fields were absent. Private notes, sessions, observations, cooldowns and transit stayed owner-only; spectators used the fixed map viewpoint. Runtime history/byte/sequence fields were also explicitly forbidden in live views. Missing/cross-room identities, foreign mutation/socket origins, spectator action attempts, private source/data/dependencies and traversal paths rejected. The synthetic unused credential marker appeared in no HTTP/WS payload or main log. Pre-end replay remained409.

The prior harness's strict descriptor allowlist now explicitly includes legitimate protect{targetId} and decoy{x,y} fields alongside existing task/system/field-note descriptors. It does not admit arbitrary client fields. Production feature defaults remainfalse. Separately labeled ended optional-preset fixtures used actual engine protect/decoy and sabotage/deadline transitions, with ghost-tasks/abilitiestrue. They exercise feature/history persistence and postgame transport, not a new live-provider or full-ghost-match qualification.

Paused fixtures for valid match schemas1/2/3/4/5 were created and saved through actual engine/store APIs, with real accepted wait receipts. Tactical/station legacy samples use explicit retained Beacon1. Their files remained byte-exact across both mains. This samples restore and format/receipt preservation, not every active legacy workflow. Actual saved new Beacon2/Annex1 histories were additionally inspected as version2 with their own exact map identities.

Two deterministic, explicitly short critical-deadline fixtures ended through actual engine transitions: legacy walking schema2/history1 and station schema5/history2 on Annex1. Authenticated HTTP replay was compared exactly to engine-exported metadata/events/snapshots before and after restart. It preserved map identity, chronological timestamps, real sequences, effects and ended role reveal; anonymous and wrong-match requests rejected. Postgame spectator self/chat/effects remained appropriately scoped. These fixtures are not ordinary complete demo matches; no task victory or all-AI outcome is claimed here.

Six future-version fixtures exercised actual store.load setup guards: room5, match6, history3, features2, station-challenge2 and unavailable map999. The first five throw VERSION_UNAVAILABLE; map throws MAP_UNAVAILABLE. Original files remain byte-identical, with no quarantine/replacement, and owned locks release. These guards were exercised through the real store module, not six additional main startups.

The real daily budget API seeded a labeled synthetic uncertain0.01 reservation with no provider send. Its entire ledger remained byte-exact through both zero-budget mains. Actual cookies/seats/roles/maps/settings receipts, private notes, input sequence2/stopped position and station accepted/denied receipts survived restart. Repeated original requests added no owner action receipts. No quarantine occurred in the main data directory.

Both main processes exited code0/signal null through their actual single SIGTERM cleanup handler. On Windows the IPC wrapper emits process SIGTERM and disconnects; this is real main cleanup, not OS/POSIX signal delivery qualification. Sockets closed, service/recovery locks disappeared, and restart acquired a distinct lock token. Actual counts: **0 provider fetch attempts,0 outbound attempts,0 forced stops,0 socket privacy errors**. The wrapper blocks fetch, http/https request/get and net connect/createConnection before main imports; harness HTTP/WS uses only its generated127.0.0.1 origins.

## Source and packaging review

Compared with historical f6, f9 changes37 runtime/package files for Group2 engine tasks/abilities/history, strategic AI, live-adapter prompt construction, store/config/rooms/transport, shared replay1/2 and UI lifecycle/replay. The package lock, Dockerfile and .dockerignore are unchanged. Normal start remains node server/main.mjs, port3000, server/shared/public COPY groups and ws-only production dependency. The original live model adapter was imported but no live request was made. Docker, hosted deployment, updater/installer and external-provider behavior are not qualified.

The spatial geometry diff from f6 is only the canWorldAct import and observer eligibility check for explicit ghost tasks. The navigation cache algorithm itself is unchanged: frozen map geometry, fixed grid legality, bounded canonical closed-door signature cache, no cached actor/target/state, and exact final route validation. This is a bounded source comparison, not independent approval of Core's authored physics/cache. Manager/Reviewer retain independent gameplay/browser review.

The first preparation archive was rejected before any server ran because host core.autocrlf=true made git archive bytes differ from raw Git blobs. It is preserved at _artifacts/quality-production-f9b3215/ and is **not qualified**. A fresh archive used command-local core.autocrlf=false/core.eol=lf; every extracted file was compared with git cat-file and its canonical blob SHA1, then recorded with SHA256. No global Git config or runtime source was changed. The qualified archive is the separate -raw directory below.

## Exact commands and evidence

From this worker root; TEMP/TMP=D:/Widegames-work/temp, npm cache D:/Widegames-work/npm-cache:

```powershell
node _artifacts/archive-production-raw.mjs
npm ci --omit=dev --offline --no-audit --no-fund --cache D:/Widegames-work/npm-cache --prefix _artifacts/quality-production-f9b3215-raw
node --check tests/quality-production-review.mjs
node tests/quality-production-review.mjs
node _artifacts/receipt-production-source.mjs
git diff --check
```

The archive script refuses to overwrite retained evidence. Its git command is git -c core.autocrlf=false -c core.eol=lf archive --format=tar f9b32151e4dfab4f2525cee067a9859cd1a27dff. npm ci is normal production offline install, without --ignore-scripts; this package has no install lifecycle scripts. Harness default pin is exactf9 and default archive is its -raw folder. QUALITY_PRODUCTION_REVIEW_PIN accepts only a full hash; QUALITY_PRODUCTION_REVIEW_ROOT remains constrained to the worker's ignored artifacts. Future pins require new manifests and qualification.

Copyable paths relative to D:/Widegames-work/ship-quality-production-final-20261030:

- Qualified archive: _artifacts/quality-production-f9b3215-raw/
- Raw Git tar: _artifacts/quality-production-f9b3215-raw.tar
- Manifest: _artifacts/quality-production-f9b3215-raw-manifest.json
- Final report: _artifacts/quality-production-f9b3215-run-pQbtqA/report.json
- Executed harness bytes: _artifacts/quality-production-f9b3215-run-pQbtqA/harness-executed.mjs
- Synthetic private files: _artifacts/quality-production-f9b3215-run-pQbtqA/private-data/
- Source comparison/hash receipt: _artifacts/quality-production-f9b3215-source-audit.json
- Archive verification: _artifacts/quality-production-f9b3215-raw-archive.txt
- Offline install: _artifacts/quality-production-f9b3215-raw-install.txt
- First/only production run: _artifacts/quality-production-f9b3215-first.txt

SHA256:

| Artifact | SHA256 |
| --- | --- |
| Raw Git tar | 9ab67bc7d9ee48852c01ef2c9bee1f548ae4d826310af1cce73558452f921746 |
| Manifest | 22c357d7ed97220aa7b5aaef7dedb69451e004b7b5ba77445a8db74c76b28947 |
| Report | 21d3fc2b4d1125c5dd04ff8267f9cdaff7e0b71abf7016f75eced50c110ff9dc |
| Executed harness bytes | b8e8d740d8629a1b2ed4aad60df618737cfd25f61b0bfee38e7d4159d7857f06 |

Bounds remain90s overall, two mains,10s startup,8s graceful stop,4s HTTP/WS, at most four normal Beacon attempts for a crew owner, and distance-derived station arrival capped25s. The standalone harness does not match ordinary *.test.mjs. No Chrome, profiling loop, full suite, live/paid provider, prod/user data, other-worker edit, push, main merge or deployment occurred. This qualifies exactf9 only; future runtime or asset changes need an exact-source refresh.
