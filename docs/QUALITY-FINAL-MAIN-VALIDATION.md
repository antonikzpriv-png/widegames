# Final combined-main validation

The combined offline application is qualified at the exact pins below. Final integration additionally requires the complete normal CI on the current [PR6 head](https://github.com/antonikzpriv-png/widegames/pull/6); its Checks/Actions record is authoritative for the ten hosted browser gates. No green historical run is substituted for that requirement. The user authorized a main merge after those gates pass. Deployment, installers, signing and live-provider testing remain outside this work.

Latest incorporated main:668a867e069c7fb3aafbc69bbf9e6c42d1607eb7, including the expanded maps, spectator work and illustrated revisions. All original branches/worktrees remain preserved on D:. The three builders supplied independently isolated engine, storage and client commits. The Reviewer account exhausted its allowance; backend peer review, UI owner review and coordinator execution are explicitly not final independent Reviewer approval.

## Implemented and preserved

Five real lobby selections: fourteen-room tactical Beacon2, Stormbreak Annex1, Storm Foundry2, Tidal Observatory2 and separate Illustrated Beacon2. Original saved revisions remain exact. World2 canonical mapId/mapRevision and tactical map/version occupy permanent separate namespaces; the six-room illustrated Beacon never overwrites tactical Beacon's3200x2400 fourteen-room geometry. [Executable revision contract](ILLUSTRATED-INTEGRATION-CONTRACT.md).

Canonical steering/collision, coherent received motion, bounded prediction/caches, authoritative station tasks and11-kind expanded taskStep puzzles, real visibility-changing sabotage, doors, passages, scoped devices, discovery policy, private ghost tasks/chat, abilities, strategic budgets and completed-match replay remain integrated. Local demo task commitment, three-proposal device cap and authoritative own-contribution flags prevent repeated optional maintenance/terminal visits from starving jobs. Omniscient inspection is restricted to the authenticated seatless host of all-AI rooms; human rooms/public visitors retain limited role-private feeds. No raw AI memory, prompts, keys, reasoning or fallen chat appears in inspection.

## Exact verification

| Gate | Recorded result |
| --- | --- |
| Clean install/check at a739a7f511be8d70df88b75737cf9960517f1aaa | npm ci succeeded;322 modules checked |
| Windows full npm test at a739a7f |1560 tests;1554 pass,0 fail,6 opt-in skips;304450.877ms |
| Linux full npm test, CI41093104371 |1560 tests;1554 pass,0 fail,6 opt-in skips;104638.993ms. This whole CI was red later on an outdated tactical fixture; it is not final CI approval |
| Final raw-source Windows native, c471b154ce806a71846c25a9932f039aeab0ab15 |22/22;566 Git blobs verified;1617 HTTP +1293 WS safe views;0 browser/console errors, canceled reads, external attempts; owned browser/server/profile/data cleaned up |
| Real autonomous native matches | Human intentionally idle: saboteur critical victory after16/20 jobs; all-AI: saboteur parity after18/20. Seed3, original engine deadlines, actual demo controllers and chronological role-revealed replay; no fabricated outcome |
| Independent isolated production, a739a7f |30 recorded checks,24.220s within original90s;566 unchanged blobs,103 runtime files,67 byte-exact served assets,249 module edges; onlyws8.22.0 installed and Puppeteer unresolvable |
| Production boundaries/restart | Legacy1?5/replay1?2, future refusal, identities/receipts/reservations, actual two main children/real SIGTERM, lock release;0 outbound/provider attempts, forced stops or socket errors |

The production count is30+5 for each additional Beacon attempt needed to obtain a crew owner. This run needed none. [Full production receipt, commands and hashes](QUALITY-ILLUSTRATED-PRODUCTION.md). Static assets include illustrated modules; its active-room probes cover the two tactical maps. Incoming engine geometry tests additionally execute all376 directed illustrated station routes; current map/illustrated browser gates cover their actual selection/tasks/reconnect/public views. Focused owner groups overlap and are not summed as independent totals.

Native source manifest SHA256:a22722696c19d44154a76404c5cc786a73928d3b21d0ef825f8ec449c23d668b. Application/public/server/shared/package/Docker sources are byte-identical between a739a7f, nativec471b15 and the later fixture/docs/screenshot commits. Final CI runs the combined head and its required ten gates. Exact native report and image hashes are in the [unedited screenshot manifest](quality-final-screenshots/manifest.json).

The native gate exercises six generated puzzle kinds, measured collider blocking/reversal, mobile puzzle/council layouts, stale input rejection, actual socket disconnect/HTTP fallback/reconnect, OTHER/self Ward, real elimination/ghost station/private chat, and both complete autonomous outcomes. Terrain caches stay bounded; comparative canvas-command tests are not GPU/FPS claims.

## Retained failures and their corrections

No original red receipt was deleted. First composed run:1542 tests/1500 pass/36 fail/6 skips, _artifacts/final-combined-tests.txt. Scope-specific fixes retain privacy, scoring/rules, persistence, geometry and lifecycle assertions; the final full suite above is green. Historical main43 green results remain in QUALITY-VERIFICATION.md and are clearly marked historical.

Raw a739 native stopped16-pass/1-fail: a delayed moved-away input was resumed, but the fixture clicked its replacement after a fixed200ms while the real rejection was still pending. c471b15 waits for the actual409 and enabled replacement control; original progress, wrong-room rejection and no-stale-feedback assertions remain. All22 checks then passed. Final production raw a739 passed unchanged. CI41093104371 later failed5!==2 in the tactical driver's old catalog assertion; a50058e still runs exactly both tactical maps and separately asserts all five current lobby selections. The required subsequent current-head CI must pass.

Legacy ghost browser similarly waits for an accepted newer inputSeq, unchanged >5-unit displacement and authoritative stop instead of a stale fixed-delay read;19/19 green. Older raw44 native's paused all-AI match and invalid production fixture remain failed historical receipts, not passed coverage. [Detailed integration history](QUALITY-LATEST-MAIN-INTEGRATION.md).

## Reproduction and launch

Use Node24. From the repository root:

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

An installed Chrome is required; CHROME_PATH overrides the default. [Exact raw-source native reproduction](QUALITY-ILLUSTRATED-CLIENT.md) and the production guide preserve pins/commands/limits. Fixtures do not call paid providers.

To play, npm ci then npm start; leave the terminal open and open http://localhost:3000. If an older service owns3000, stop that terminal with Ctrl+C or use $env:PORT='3001'; npm start and open http://localhost:3001. Demo needs no keys. Never run two writers against one DATA_DIR; back up the complete stopped-service directory before upgrade. [Deployment/environment](DEPLOYMENT.md).

Live provider keys/accounts/billing/quality, physical phones/OS keyboards/audio hardware/GPU/FPS, Docker execution and frozen Windows executables remain unverified. No deployment is claimed. The original storm setting/art/maps remain; no copied Among Us assets or exact proprietary map-size parity is claimed. [Current screenshots](quality-final-screenshots/README.md).
