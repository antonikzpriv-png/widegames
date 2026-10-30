# Gameplay-quality verification

**Historical qualification against main43.** Subsequent main41/aa/668 integrations change application sources. The pins and green results below do not qualify that newer composition. See [current combined validation](QUALITY-FINAL-MAIN-VALIDATION.md), which remains in progress until all required gates pass.

Lantern Wake now has an original larger walking world, six server-authoritative station puzzles and integrated tactical systems. The comparison used the official Among Us guide; it does not claim identical art, proprietary map dimensions or feature parity. See [reference and differences](QUALITY-REFERENCE.md), [rules](QUALITY-RULES.md), and [actual screenshots](quality-screenshots/README.md).

## Source and preserved work

Started from actual origin/main **90bb6e881f75f77e85b8b49729971a710b4c91b4**, incorporated completed tactical revision **d55144dd3c71f5ad965814aee92f4612bc4084ba**, and merged newer main **43c079999506785196ab85750105ceb102ba9314** through **7d8532afdb47179b96ec56ead6a7f0ee1bc34941**. Original branches/worktrees and saved maps, seats, action receipts, replay records and spending reservations are preserved. No main mutation, deployment, paid provider calls, installer, signing or voice changes occurred.

The final **application/runtime pin is 3c1c206b65d7d44c71471450120ba23c43efad9e**. Subsequent commits change only development runners, tests, receipts and documentation. Final native source **f0ea76d6702448a27a891598a2d7512bc0e5ea02** has an identical public/server/shared/package graph. The PR records its final head and CI run; historical receipts below explicitly name their own pins.

## Integrated behavior

| Area | Actual behavior |
| --- | --- |
| Walking | Canonical 600ms steering leases, normalized speed, swept collision/sliding, dynamic-door route invalidation; collision-safe bounded presentation and cadence-independent camera |
| Maps | Immutable Beacon2: 3200x2400, fourteen rooms, 56 collider props, fourteen stations; distinct Stormbreak Annex1 and original Beacon1 retained; actual lobby map selection |
| Tasks | Four distinct jobs per crew, six authoritative puzzles: circuit, signal, sequence, glyph inspection, alignment and manifolds; owner-only clues and validated incremental inputs; CAPTCHA-like glyph game has no external CAPTCHA service |
| Sabotage | Actual restricted lights, communications/device disruption, occupied-safe timed doors, two-site power/flood deadlines, validated linked maintenance passages |
| Investigation | Scoped camera cards, anonymous occupancy and dated vitals; access revoked on movement/death/phase changes; discovery-based death information and attributed private field notes |
| Current main | Existing taskStep progress, strategic intentions/budgets, ghost tasks/private fallen chat, Ward/Echo and spatial replay retained and integrated |
| Privacy/compatibility | Server-side permitted views, idempotency/conflict validation, private observations/chat, explicit saved-state versions and future-version refusal without destructive replacement |

The [quality interfaces](QUALITY-INTERFACES.md), [tactical interfaces](TACTICAL-INTERFACES.md), and [next-feature guide](NEXT_FEATURE_INTERFACES.md) describe exercised exports and registration examples. No alternate server, planner or model authority was introduced.

## Completed qualification

| Gate | Exact source and result |
| --- | --- |
| Install | npm ci: 25 packages installed, 26 audited, zero reported vulnerabilities; _artifacts/quality-final-install.txt |
| Full Windows offline suite | Runtime3c1c206: **1286 tests /1280 pass /0 fail /6 expected skips**,161.115s; _artifacts/quality-final-3c-full.txt |
| Full Linux CI | [Run41041792204](https://github.com/antonikzpriv-png/widegames/actions/runs/41041792204), branchfec804e/synthetic mergebea6eaf into main43c0799: check259 modules; **1292 tests /1286 pass /0 fail /6 expected skips**; all seven normal browser gates green |
| Final native Windows Chrome156 | Sourcef0ea76d: **22/22 pass**,1060 HTTP and863 WebSocket safe views,433 tracked Git blobs verified; no browser/console errors, cancellations, provider calls or external attempts |
| Production preparation | Runtime3c1c206: **35/35**,430 exact source blobs,57 byte-exact served assets; two actual server/main.mjs processes, restart/legacy/current/future-save and budget checks; zero provider/outbound attempts, forced stops or socket privacy errors; [independent receipt](QUALITY-PRODUCTION.md) |
| Independent final AI/privacy audit | Runtime3c1c206: **33/33**; unchanged seeded spending reservation, no provider calls; [receipt](QUALITY-MAIN-AI.md) |
| Final retained boundary controls | Raw sourcef0ea76d: **14/14**, no skips; actual movement/presentation, main boundaries and lifecycle/profile checks; _artifacts/quality-final-raw-f0-boundaries.txt |
| Audit-helper peer review | Core independently read exactf0ea76d and ran **6/6** lifecycle units; privacy assertions remain fatal and canceled reads never count as inspected; [receipt and tactical provenance limit](QUALITY-PRODUCTION.md) |

The six ordinary npm-test skips are opt-in native-browser tests, not failed or silently skipped gameplay assertions; their seven dedicated browser gates ran separately. Six audit-lifecycle tests account for the full-suite count increase after the Windows3c run. No product graph changed between those pins.

### Final native workflows and provenance

The final custom native run completed all six station puzzles across two generated four-job watches; actual keyboard/touch movement, collider blocking/reversal and acknowledged stop; map/legend; owner/spectator safe views; errors, cancellation and stale UI; both discussion and voting at320x740,390x844 and844x390; Ward on an explicitly selected other keeper and self with expiry/cooldown; legal elimination, ghost movement, positive USE hit, real ghost task and private fallen-chat acknowledgement. Separate spectator HTTP/WebSocket payloads excluded walking ghost positions and fallen chat. Both the real human-plus-AI controller (idle human fixture) and all-AI controller reached actual crew/ejection victories with chronological role-revealed replay. These are clearly labeled offline fixtures, not model or deployed sessions.

Source: _artifacts/quality-source-f0ea76d-raw-mlhJrl. Every tracked file was materialized from raw Git blobs, independently blob/SHA256 checked; no checkout line-ending filters or runtime overlays. Manifest SHA256 **3a23cd9ec570ee55ef4b8a4f34e3aacbb341f5a1b94a6afa62fa5e5cb825bd32**. Report: _artifacts/quality-browser-final-f0ea76d-6NLWB4/report.json, SHA256 **3753b50346b38e7ec3bd1a7dcf48a0d35e6dbaa20f22460f13d08cb2508bc45e**. Source, driver and executed helper remained stable. All owned browser/server processes closed; private test profile/data were removed. The tracked [compact native receipt](quality-screenshots/native-receipt.json) and [PNG manifest/gallery](quality-screenshots/README.md) preserve reviewable evidence.

The reviewer authored the strict harness and previously found the blocked ghost USE control. Its account reached quota before the final source/native run began. **The coordinator performed the final22-check run; this is not independent final Reviewer approval.** Core independently reviewed the exact body-audit helper. The UI builder's final screenshot self-inspection failed twice with an invalid transport response before doing work; earlier committed UI reviews remain, and the coordinator inspected the final captures. No account was substituted. These account failures do not conceal an unrun product gate.

The native final scenario does not separately activate new-map Echo UI; the retained19-check feature browser gate and mapped engine/action-descriptor tests cover Echo. Device/camera and two-map tactical complete flows are covered by the normal tactical gate below. Physical phones, operating-system keyboards, GPU/FPS, audio hardware, live model keys/accounts/billing/quality and container execution remain unverified.

### Normal browser matrix

| Command | Windows source / result / artifact |
| --- | --- |
| npm run test:browser |25ce070:26/26;1861 safe views; _artifacts/world-browser-nl3WjL |
| npm run test:task-browser |25ce070:42/42;1639 views; _artifacts/world-browser-31ez2K |
| npm run test:tactical-browser |4911f17:32/32;1568 views; _artifacts/tactical-browser-FQaqgR |
| npm run test:beacon-browser |25ce070:13/13;602 views; _artifacts/beacon-browser-MrTvSd |
| npm run test:features:browser |25ce070:19 checks,exit0; _artifacts/ghost-abilities-browser-9eJshB |
| npm run test:spatial-browser |25ce070:21 checks,passedtrue; _artifacts/spatial-browser-DPemkq |
| LW_WORLD_BROWSER=1 node --test tests/world-ui-browser.test.mjs |25ce070:1 native test/19 checks,0skip; _artifacts/world-ui-24qKGY |

These Windows receipts are historical pins, not tests re-executed atf0. All seven gates also passed on the final application graph in the Linux CI run above. Actual both-map critical/ejection outcomes, private devices, hatches, reconnects and native mobile equipment controls are in the tactical receipt. The final native run covers subsequent ghost/council/Ward changes. Archive artifacts remain on D:; CI reports/screenshots are uploaded by the workflow.

## Defects fixed and retained red evidence

Earlier independently reproduced interpolation through colliders and draw-cadence camera drift now pass unchanged positive controls. Doors were additionally fixed to treat all physical ghosts and undiscovered bodies as occupied. Ward now validates the actually chosen permitted target; mobile council and fallen chat no longer block task controls. The shared current-main ghost policy was restored for all fallen factions: fallen saboteurs can observe/move/private-chat but cannot do crew jobs or living powers. The real local scheduler sends one bounded private observer message, then stops idle planning and never spends or repeats after restart.

[Historical qualification chronology](QUALITY-VERIFICATION-HISTORY.md) and [audit receipts](QUALITY-AUDIT.md) preserve failures. They include a retained test DOM missing native contains, a tactical runner needing a legal repair approach after correctly asserted route cancellation, and a closed-CDP body-read teardown race. The body-audit helper only classifies recognized stale/closing reads as cancellations; available bodies and active/privacy errors still fail. Final native cancellations were zero. Tactical sourceUnchanged covers the application graph, not scripts/helper; only the final quality runner separately pins/rechecks its helper.

Earlier final-run attempts are retained, not passes:3c stopped before acknowledged collider reversal; fec stopped on an introduced missing drain helper;6b passed nineteen checks but selected self Ward before the rendered permission list refreshed. Final runner now requires actual stop ACK/displacement and rendered target permission, preserving positive effect-target assertions. An older f9 archive's line-ending-only differences led to the stronger raw Git-blob verifier. No false telemetry, invented model source or relaxed engine permission was used to obtain green checks.

### Final-head CI response-lifecycle correction

[Run41045145382](https://github.com/antonikzpriv-png/widegames/actions/runs/41045145382) at2141aec passed the full offline suite and completed both normal-browser task victories/replays, then failed its final error fence with one CDP ProtocolError: unavailable response body. It inspected1610 safe views; the unavailable body was not inspected. The old normal-browser listener had no request-generation or explicit observer-close attribution, so this is not claimed to prove that missing body safe. ZIP/report/screenshots remain in _artifacts/quality-ci78-evidence; ZIP SHA2561507733c6c632f821ba3feec8a4c827053fd1f6c4c3316a61e109c7c768eddbc.

The normal/retained-task driver now reuses the already peer-reviewed createPageBodyAudit helper, marking its own observer close and recording cancellations separately. Only a recognized unavailable-body error after main-frame navigation or owned teardown can cancel; active-view errors, malformed JSON, and all available-body privacy assertions still fail. No gameplay/assertion/deadline/budget changes. Six lifecycle units pass. The final PR head must pass its normal CI before review readiness; this failed run is preserved rather than counted as success.

## Reproduce final raw-source native check

Use Node24, an installed Chrome/Chromium and a full Git checkout. From the task repository on D: (PowerShell):

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
npm ci
npm run check
npm test
node scripts/prepare-quality-source.mjs f0ea76d6702448a27a891598a2d7512bc0e5ea02
$prepared=Get-Content _artifacts/quality-native-source-latest.json -Raw | ConvertFrom-Json
$env:QUALITY_BROWSER_ROOT=$prepared.root
$env:QUALITY_BROWSER_PIN=$prepared.pin
$env:QUALITY_BROWSER_MODE='final'
$env:QUALITY_BROWSER_SECTION='all'
node scripts/quality-browser-check.mjs
```

The preparer is Node-only and writes unique raw source/manifests under _artifacts; it does not require Python or change user rooms. CHROME_PATH overrides browser location. Run each normal browser command from the matrix for the complete regression set. Do not run paid provider tests to reproduce these fixtures.

## Practical limits, launch and upgrade

The default lobby remains one human plus five AI or six AI. Trusted contracts/tests support4..12 custom IDs and multiple saboteurs; public configurable multiplayer seating remains Group2's reserved extension. Live spectators receive only server-permitted observations. Authorized ended replay reveals recorded roles/routes, never fallen chat; bounded/partial history coverage is explicit. CPU/pathfinding/cache measurements in [movement](QUALITY-MOVEMENT.md) and [client](QUALITY-CLIENT.md) receipts are not FPS promises.

Demo is complete without credentials. The real Anthropic adapter exists with conservative persisted reservations; live key/account/latency/billing/output quality is unverified. Use a workspace-scoped key; unscoped keys require a workspace header the adapter does not configure. See [AI setup and official API review](AI.md) and [independent source review](QUALITY-MAIN-AI.md).

```powershell
cd D:\Widegames-work\ship-quality-coordinator-20261030
npm ci
$env:AI_PROVIDER='demo'
$env:PORT='3001'
$env:PUBLIC_ORIGIN='http://localhost:3001'
npm start
```

Leave the terminal running and open **http://localhost:3001**. This avoids your earlier server on3000; the default remains3000 when PORT/PUBLIC_ORIGIN are unset. Do not run two writers against one DATA_DIR. Back up the whole stopped-service data directory, including the daily ledger, before upgrade; legacy maps/protocols are not silently converted. See [deployment and storage](DEPLOYMENT.md). No deployment, Docker execution or frozen Windows executable qualification occurred; this source/browser application does not produce a new installer.
