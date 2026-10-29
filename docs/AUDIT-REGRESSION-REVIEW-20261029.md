# Bounded independent regression-source review — 2026-10-29

**Result: bounded acceptance of the reviewed source-selection, labeling and temporary-path changes. No new blocking defect found.** This is a source review with narrow guard/VM probes, not a repeated full suite, a current frontend recovery qualification or worker self-approval.

Only this report is added in D:/Widegames-work/audit-rules-20261029. D:/Widegames-work/coordinator was read-only; its preexisting untracked docs/AUDIT-CLOSURE-20261029.md was left untouched. No manager test/runtime, prior review/evidence, other worktree, main, deployment, browser/Chrome or provider was changed/used.

## Exact source reviewed

- `e9b0dd25aac2d586076f3aac6e5742a9cbc61b94` — historical/current source handling and checkout-local privacy temporary files.
- `ce75f104a98af24329e27cac631eb7ebc76c427b` — explicit historical labels, terminal test labels and exact-origin documentation.
- Coordinator HEAD observed read-only: `b5bfe5d1209f4d446a4365909e8e53e1041c5daa`. The three affected test files have no committed difference from ce75f10 to that observed HEAD; tracked coordinator files were clean. The ownership test's working content was also compared to ce75f10, with CRLF normalized.

Exact Git blobs at ce75f10 unless otherwise stated:

| File | Blob |
| --- | --- |
| tests/transport-terminal-ai.test.mjs | `03cdf82f75ec1f44f48a73d68cc27eb356e73091` |
| tests/audit-privacy-20261029-ownership.test.mjs | `190c6daeb4120f9d0f36c65089a9ae00deef81ed` |
| tests/audit-privacy-20261029-http.test.mjs | `a511840407d978f0e39a3341e0a29e5963e81c38` |
| docs/DEPLOYMENT.md | `71fcd1fe38cef357dce8d182cd22f6966df73aea` |
| .env.example | `15cece98ff50ff84ef5c93703b4197409cdec48a` |
| e9b0dd2 docs/AUDIT-REGRESSION-INTEGRATION-20261029.md | `60edb4fb577a7866ceaa3f24f3d3b4ae6c137eee` |
| historical 0842a009 public/app.mjs | `676615bd2350d1f6cbf00ec33cd1d12ac0dbe56a` |

## Historical ownership evidence is immutable

The ownership helper no longer reads working public/app.mjs or requires the current frontend to match the broken audit snapshot. It invokes Git directly with `show 0842a0090f1cfd1ec43b898f16e8191e5b9c2497:public/app.mjs`, where the full commit is a constant. There is no branch-name/current-HEAD/environment fallback for this source.

A bounded probe independently fetched that exact content and hashed it through git hash-object --stdin; it matches the historical blob above. The helper extracts the saved ownership functions into a VM and stubs unrelated DOM/socket wiring. It is not a native browser import. The two saved-source VM fixtures ran: **2 pass, 0 fail, 0 skipped**, 0.212 seconds. The negative control explicitly reproduces the old stale-401 join with the newer abort owner, then verifies that stale room data still does not replace the current room. ce75f10 also changes its diagnostic from a new-finding claim to an explicit historical control.

Important interpretation limit: the second test's positive stale-owner countercases also use the same historical helper. They establish properties of 0842, not the corrected/current frontend. e9b0dd2 correctly states that current frontend recovery needs separate positive regressions. This review does not convert either historical result into current UI closure.

## Current terminal-AI behavior remains checked

Without a nonempty TRANSPORT_TERMINAL_ROOT, root resolves relative to the current test checkout. The actual engine, transport, store and budget imports remain relative to that selected root. Historical content comparisons and their after-hook are no longer installed for the ordinary run, so unrelated future transport corrections are not automatically rejected as source drift.

A source equality control compared everything from async function fixture through the end of transport-terminal-ai.test.mjs before e9b0dd2 and after ce75f10, allowing only the three test-title replacements. Those sections are identical. In particular, the existing real HTTP victory, unattended pause and restart assertions remain:

- Pending AI aborts exactly once, settles, and cannot reserve after terminal state; decision/send/finish counts cannot grow afterward.
- Durable private context and already reserved uncertain spend remain unchanged; the delayed returned proposal and private-memory mutation cannot overwrite the checkpoint.
- Real crew ejection/tally/replay and pause-without-outcome behavior are asserted; paused replay stays unavailable.
- Restarting an ended match preserves seat, outcome, request records, private context and budget without scheduling further AI.

The title changes do not skip, weaken or remove those assertions. The current three real HTTP terminal scenarios were not rerun in this bounded review; source preservation is what was verified here.

## Explicit historical terminal root remains pinned

When TRANSPORT_TERMINAL_ROOT is nonempty, assertPinned still compares all seven declared files to `9b31317c618ea12810a369edb84f87834f9218b9` before runtime imports, and registers the same check after the run:

server/transport.mjs, server/rooms.mjs, server/store.mjs, server/budget.mjs, server/engine/index.mjs, server/static.mjs and shared/contracts.mjs.

A narrow VM probe executed the actual source-selection/guard prefix from ce75f10 with filesystem/after-hook observation, using genuine committed 9b file contents as the fixture values. It established:

- Default mode: zero historical comparisons and no pinned after-hook.
- Explicit mode: seven comparisons at setup and seven more through the registered after-hook.
- A deliberately altered in-memory transport string rejects at setup before imports.
- A deliberately altered in-memory source string rejects through the after-hook too.

These are guard probes, not runtime mutants or filesystem changes. The pin remains exact for its original declared seven-file source scope, with the preexisting CRLF-to-LF normalization. It does not claim to pin Node, installed dependencies or every repository file. A supplied root is a URL, matching the existing test interface. Missing/mismatched Git objects do not silently fall back to current source.

## Privacy fixture paths and exact-origin text

The HTTP privacy fixture derives root with fileURLToPath(new URL('../', import.meta.url)), then creates `_artifacts/test-temp` beneath that checkout and a unique mkdtemp child prefixed audit-privacy-20261029-. Cleanup closes its own game first and checks the child's absolute prefix and basename before deleting it. The hardcoded D: temp parent was removed without changing behavior assertions. The source is portable across checkout locations and defaults to the correct D: checkout here; generated state does not point at another worker or the C: launcher. The terminal fixture likewise has a checkout-local default, while preserving its explicit TRANSPORT_TEST_TEMP override. No broad filesystem-hardening/symlink claim is made for these trusted test paths.

ce75f10's .env comment and deployment paragraph describe HTTP(S) origin-only setup, optional root slash, prohibited userinfo/path/query/fragment, canonicalization, safe validation errors and the browser-origin requirement. They align with the independently reviewed runtime fix `5c698b92c1c465830d5ad52f0383072536f12d14` and the prior independent 8/8 origin closure. ce75f10 itself is documentation/test-labeling work and did not implement that runtime validator; its isolated revision must not be treated as proof that setup validation already existed then. No earlier origin evidence is rewritten or reopened.

## Commands, evidence and actual probe failure

Read-only source commands included git show e9b0dd2, git show ce75f10, git show ce75f10:<affected-file>, git diff ce75f10 b5bfe5d1209f4d446a4365909e8e53e1041c5daa -- <three affected tests>, and git rev-parse for the blobs above. The two historical VM fixtures were run with:

```powershell
$env:TEMP=Join-Path (Get-Location) '_artifacts/test-temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
node --test D:/Widegames-work/coordinator/tests/audit-privacy-20261029-ownership.test.mjs
```

The first source-prefix probe failed before guard execution because the extraction regex did not remove the leading UTF-8 BOM before stripping import lines. That was a probe-harness SyntaxError, not a product assertion failure. Its output is retained at `_artifacts/regression-review-20261029/source-selection-guard-probes.txt`. Removing the BOM in the extracted in-memory prefix corrected the harness; the actual source was not edited.

Successful bounded-probe output is `_artifacts/regression-review-20261029/source-selection-guard-probes-final.txt`; the two historical fixture results are in `historical-ownership-fixture.txt` alongside it. All evidence is under this worker's ignored artifacts; prior audit/origin evidence remains unchanged. No full suite, server/HTTP terminal rerun, browser, paid request or deployment was performed. The acceptance above is limited to these exact commits and source-selection/fixture/documentation properties.
