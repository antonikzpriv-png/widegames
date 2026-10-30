# Final combined-main validation

Final application source: **14ad207d1065a90ce141b75e1b26900684aeabb6**. The independent production pin25b39a7 has exactly the same application graph. Later commits contain only qualification records, fixtures and unedited captures. Final integration requires green normal CI on the current [PR6 head](https://github.com/antonikzpriv-png/widegames/pull/6), including all ten browser gates; Checks/Actions supplies its exact head/run result. Historical green runs do not replace that requirement. The user authorized a main merge after validation, with no deployment.

Latest incorporated main:668a867e069c7fb3aafbc69bbf9e6c42d1607eb7, including expanded maps, private inspection and illustrated revisions. Original branches/worktrees remain preserved on D:. Three builders supplied isolated engine, storage and client work. The Reviewer account exhausted its allowance; source peer reviews, UI owner review and coordinator execution are not final independent Reviewer approval.

## Integrated behavior

Five actual lobby selections: fourteen-room tactical Beacon2, Stormbreak Annex1, Storm Foundry2, Tidal Observatory2 and separate six-room Illustrated Beacon2. Exact older saves remain readable. World2 canonical mapId/mapRevision and tactical map/version are permanent separate namespaces; illustrated Beacon never overwrites tactical Beacon's3200x2400 geometry. [Executable revision contract](ILLUSTRATED-INTEGRATION-CONTRACT.md).

Server-authoritative movement/collision and vision, one bounded received timeline/prediction, bounded terrain/viewport/overview caches, six station puzzles and11-kind expanded taskStep work, lights/comms, occupied-safe doors, two-location critical failures, passages, scoped devices, tactical death discovery, ghosts/private chat, Ward/Echo, strategic budgets and ended-only replay remain integrated. Task commitment, a three-proposal optional-device cap and authoritative own-contribution flags prevent optional systems from starving demo jobs. Omniscient inspection requires the authenticated seatless host of an all-AI room; human/public feeds remain role-private, excluding private AI context, secrets and fallen chat.

The final UI restores main668's Escape-to-close map behavior, returns focus to its trigger and removes its listener on disposal. A higher-priority council/dialog keeps Escape and focus. The regression creates an actual engine meeting, then verifies the textarea retains focus while the older map remains behind it. Field-note native fixtures wait for the rendered enabled/hit-tested control and require exact stop/note acknowledgements; no blind re-tap or privacy waiver.

## Exact verification

| Gate | Recorded result |
| --- | --- |
| Independent clean/offline install and check,76105e25154c31b0da9a35149569e8a0444230c9 |25 packages;322 modules;574 tracked files unchanged |
| Independent normal Windows suite, same pin |1561 tests;1555 pass,0 fail/cancel,6 opt-in skips;312.366s. This precedes the final council-focus guard and its extra test |
| Final focused client/council/ghost regression,14ad207 |49/49,0 skips; includes real-engine map-to-council Escape ownership |
| Final raw-source Windows native,14ad207 |22/22;574 Git blobs verified;1505 HTTP +1078 WS safe views;0 browser/console errors or external attempts; owned browser/server/profile/data cleaned up |
| Native audit cancellation |One response became unavailable after its consumer closed; explicitly classified consumer_closed and excluded from2583 inspected views. Not claimed inspected; no available-body/privacy assertion was waived |
| Actual autonomous native matches |Intentionally idle human match: saboteur parity after11/20 jobs. All-AI: crew ejection victory after12/20. Seed3, original deadlines, real demo controller, structured task inputs and role-revealed chronological replay |
| Final isolated production,25b39a75795d72cdcc98e99b15b4ebd478a31681 |30 checks,29.753s within original90s;574 unchanged blobs,103 runtime files,67 byte-exact served assets,249 module edges; onlyws8.22.0 installed; Puppeteer unresolvable |
| Production boundaries/restart |Actual two main children/real SIGTERM; legacy1?5/replay1?2, future refusal, identities/receipts/reservations;0 outbound/provider attempts, forced stops or socket errors |

The production count is30+5 per extra Beacon attempt needed to obtain a crew owner; the final run needed none. [Production commands/hashes](QUALITY-ILLUSTRATED-PRODUCTION.md), [independent full-suite receipt](QUALITY-FINAL-CHECKS.md). The final CI additionally executes the full suite with the council-focus regression and all ten normal browser gates on the final head; its live record is linked above.

The latest final native source-manifest SHA256 is7bb5e66f67cf8ff314323efdec0ace72b5f347ce4e13ce4ef51d04e149b821af. It exercises six generated station types, physical collider blocking/reversal, mobile councils, stale input rejection, real socket disconnect/HTTP fallback/reconnect, OTHER/self Ward, real elimination/ghost task/private chat, and both autonomous outcomes. [Unedited captures and report/image hashes](quality-final-screenshots/manifest.json).

Additional Windows real-route gates recorded: tactical32/32 (both maps and actual private note acknowledgements); illustrated65/65 (three maps, all room stations, M/Escape, tasks, colliders, restart/public views/mobile); private/public spectator47/47; expanded CAPTCHA39/39; spatial replay21/21; legacy world UI1/1. Those receipts retain their pre-final-focus-guard source pins; the final current-head CI reruns them. Focused groups overlap and are not summed as independent tests. Canvas command comparisons are not native GPU/FPS claims.

## Retained failures

Original red receipts remain. The first composition had1542 tests/1500 pass/36 fail/6 skips (_artifacts/final-combined-tests.txt). Scope-specific corrections retain privacy, persistence, geometry and lifecycle assertions. Historical main43 qualification is clearly marked in QUALITY-VERIFICATION.md.

Raw a739 native stopped16-pass/1-fail: a held moved-away request was resumed, but the fixture clicked its replacement after a fixed200ms while the actual rejection was pending. c471b15 waits for the real409 and enabled replacement control; its22 checks passed. The final14ad rerun also passes22/22. Legacy ghost movement similarly now waits for accepted input, unchanged displacement threshold and stop instead of a stale fixed-delay read.

CI41093104371 passed the full1560-test suite then failed the tactical driver's obsolete5!==2 catalog assertion. The corrected driver still exercises exactly both tactical maps and separately asserts all five lobby selections. CI41093774198 passed the first five browser gates then found obsolete inspector wording; cb8e950 checks the private-owner label and validates a mode-consistent legal replay fixture. CI41094576135 found an intermittent mobile note tap before the app accepted updated hints; the native fixture now hit-tests enabled UI and checks exact requests/acceptance rather than blind retries.

Local illustrated testing then found a real missing Escape handler;5f94da4 restored it. Peer review reproduced its background-map/council focus edge case;14ad207 adds higher-priority-dialog guards and a real-engine regression. Earlier source pins are superseded for the changed UI. Old raw44 paused-match and invalid production-fixture failures remain failures, not passed coverage. [Detailed history](QUALITY-LATEST-MAIN-INTEGRATION.md).

## Launch and reproduction

Use Node24. To play: npm ci, then npm start; leave the terminal running and open http://localhost:3000. If an older service owns3000, stop its terminal with Ctrl+C or use $env:PORT='3001'; npm start and open http://localhost:3001. Demo needs no keys. Back up the complete stopped-service DATA_DIR before upgrading and never run two writers against it. [Deployment/environment](DEPLOYMENT.md).

Normal qualification in PowerShell:

```powershell
npm ci
npm run check
npm test
npm run test:browser
npm run test:task-browser
npm run test:tactical-browser
npm run test:beacon-browser
npm run test:features:browser
npm run test:spatial-browser
npm run test:spectator:browser
$env:LW_WORLD_BROWSER='1'
node --test tests/world-ui-browser.test.mjs
Remove-Item Env:LW_WORLD_BROWSER
npm run test:maps:browser
npm run test:illustrated:browser
```

Chrome is required; CHROME_PATH overrides the default. Exact raw-source native reproduction from a full checkout with development dependencies:

```powershell
node scripts/prepare-quality-source.mjs 14ad207d1065a90ce141b75e1b26900684aeabb6
$prepared=Get-Content _artifacts/quality-native-source-latest.json -Raw | ConvertFrom-Json
$env:QUALITY_BROWSER_ROOT=$prepared.root
$env:QUALITY_BROWSER_PIN=$prepared.pin
$env:QUALITY_BROWSER_MODE='final'
$env:QUALITY_BROWSER_SECTION='all'
node scripts/quality-browser-check.mjs
```

The snapshot verifies every raw Git blob before running. Production has a separate isolated ws-only guide. No paid model calls were made. Live provider accounts/keys/billing/quality, physical phones/OS keyboards/audio/GPU/FPS, Docker execution and frozen Windows executables remain unverified. No deployment, installer, signing or voice change is claimed. Original setting/art/maps remain, with no copied Among Us assets or proprietary map-scale parity claim. [Final unedited screenshots](quality-final-screenshots/README.md).
