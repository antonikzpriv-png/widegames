# Final source checks

Exact tested source: **76105e25154c31b0da9a35149569e8a0444230c9**; Git tree **d7928fa4604d8cf6a1b6d829d251e4a15513989f**. Isolated worktree `D:/Widegames-work/ship-quality-final-checks-20261030`, branch `codex/ship-quality-final-checks-20261030`. Existing branches/worktrees were preserved. This receipt adds no application, fixture or test changes.

On 2026-10-30, Node **v24.20.0**, npm **11.19.0**, PowerShell/Windows. Every command used `TEMP=TMP=D:/Widegames-work/temp` and `npm_config_cache=D:/Widegames-work/npm-cache`.

| Exact command | Exit | Actual result |
| --- | --- | --- |
| `npm ci --offline --ignore-scripts --no-audit --no-fund` | 0 | 25 packages added, offline; no lifecycle install scripts |
| `npm run check` | 0 | 322 JavaScript modules syntax checked |
| `npm test` | 0 | 1,561 tests; 3 suites; 1,555 passed; 0 failed; 0 cancelled; 6 skipped; 0 todo; 312,366.2746 ms |

The unchanged normal test script was `node --test --test-concurrency=2 tests/*.test.mjs`. No custom isolation/concurrency settings, assertion changes or rerun-to-green were used. The six skips are the normal reported optional archive/browser gates, not newly introduced exclusions. The complete first full-run output and exit status are retained. All **574 tracked checkout files** matched their SHA-256 manifest after completion; `git diff --exit-code` also passed before writing this document.

## Evidence

All evidence is local and ignored under `D:/Widegames-work/ship-quality-final-checks-20261030/_artifacts/final-checks-76105e2/`.

| File | SHA-256 |
| --- | --- |
| `npm-ci.log` | `f6eeb09639c9d7206ed09c00daf3ffca2fbb5d059795d7d5bb327b0f4579557b` |
| `npm-check.log` | `119dee1ae6f4a0b0d7fdfd5ec5b1666bd9ba0a819ffb2066fe02fcfc09846358` |
| `npm-test.log` | `a9e4d6b460cc3581e211ac06678b12ff91017001eaf84039c56e97e9698ed208` |
| `npm-test-exit.txt` | `13bf7b3039c63bf5a50491fa3cfd8eb4e699d1ba1436315aef9cbe5711530354` |
| `source-tree.txt` | `7983339814f862d47fed3576f3a52c1a45c7d477d6eac794954f83bd8efceaf7` |
| `tracked-files-sha256.json` | `f23fa7b084aee8e7111f1e0c1db22e2bfca37692e95b27b71721dd04d17e4158` |
| `report.json` | `1eb19b30272e78e4a471ef48b0a7fecf7e6f428bffe866cb86aebfba40840357` |

`source-tree.txt` records tracked Git blob identities; `tracked-files-sha256.json` records actual checked-out bytes (574 files) and the source pin. `report.json` records command exits, counts, environment, evidence sizes/hashes and limits. This documentation commit is subsequent to the tested source and changes only this receipt.

## Focused Escape source review and limits

Reviewed the incorporated application change **5f94da4faa77d2709703bc5f5660f07f5930755e** at the tested pin. `public/world/experience.mjs` ignores non-Escape, already-handled, hidden, disposed and closed-map events; an eligible event prevents its default, closes the existing map through `toggleMap()` and restores the existing trigger. `restoreTrigger` checks connection, visibility, disabled state and layout before focusing. Disposal removes the exact registered keydown listener. The retained client test checks handled/hidden events, focus, no game actions and listener removal; the normal suite above passes. No concrete blocker found in this bounded source check.

This is exact-source package/module/unit/integration validation, not independent native Reviewer approval. No Chrome/native browser, production archive/install gate, full-match profiling, paid provider request, deployment, main change or push was performed. No live credentials or user data were supplied. Coordinator retains sole Chrome ownership. Earlier production/native receipts retain their own historical pins; this run does not relabel them.

## Coordinator integration note

This exact76105e2 suite predates peer-found council/background-map Escape focus ownership. Final application14ad207 adds the higher-priority-dialog guard and a real-engine regression;49 focused checks pass. Final current-head CI executes the complete suite including that extra case. This receipt retains its own1561-test source pin and does not relabel the newer application.
