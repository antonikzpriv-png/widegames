# Independent PUBLIC_ORIGIN closure — 2026-10-29

**Exact reviewed fix: `5c698b92c1c465830d5ad52f0383072536f12d14`. Independent result: 8 passed, 0 failed, 0 skipped.** Both reported PUBLIC_ORIGIN gaps and the credential-bearing invalid-port raw-error variant are closed within the tested boundaries. No additional concrete failure was found. Integration/approval remains with the coordinator; this receipt is not worker self-approval.

## Exact source review

Reviewed the actual diff of 5c698b92 against its parent `d6aa36b50d0dbe240874375e7b860af8ae67ad4e`, specifically server/config.mjs, new server/origin.mjs, server/transport.mjs and unchanged server/main.mjs.

- A shared validatePublicOrigin rejects non-string/empty values, whitespace/control/backslash input, non-HTTP(S) schemes, userinfo, query/fragment, paths beyond a single root slash, and malformed hosts/ports. It checks supplied authority/path components before URL normalization can remove them.
- Parser failures are replaced with constant descriptive PUBLIC_ORIGIN errors. Raw input, credentials and the native parser error are not attached or echoed. The synthetic credential-bearing invalid-port case is rejected safely, rather than leaking via a raw URL exception.
- loadConfig returns the validated canonical origin; therefore the existing main startup log receives a safe value. Existing absent/empty environment defaults still select the configured localhost port.
- createGameServer independently invokes the same validator before engine/AI/store/budget initialization. Handcrafted configs cannot bypass the environment entry point. The real default-store path is never reached for invalid origins, confirmed by dependency-boundary observation and empty fixture directories.
- HTTP and WebSocket Origin comparisons, cross-site checks and cookie authentication are unchanged. Only configured-origin validation/canonicalization changes; incoming Origin headers are not permissively normalized.

No runtime files were modified, imported through a patched implementation, or cherry-picked into this worker. Exact Git archives were materialized under this worktree's ignored `_artifacts/origin-review-20261029/`, one directory per full commit. SHA-256 values of archived config/origin/transport/main files were compared before/after the final run and remained identical. The worker's tracked server/shared/public diff is empty. No changes were made to any other worktree.

## Same independent controls: original versus fix

The full eight-group portable test was run against both exact archives:

| Source | Result | Exit |
| --- | --- | --- |
| Original `0842a0090f1cfd1ec43b898f16e8191e5b9c2497` | 4 pass, 4 fail, 0 skipped | 1, expected negative control |
| Fix `5c698b92c1c465830d5ad52f0383072536f12d14` | 8 pass, 0 fail, 0 skipped | 0 |

The original fails the invalid environment matrix, direct-constructor matrix, CLI userinfo secrecy/rejection, and actual opaque Origin:null room-creation assertion. Valid origin/default/HTTP/WS cases pass on both sources. The earlier seven-group preparation output and separately retained null-origin counterexample are preserved, not rewritten as successes.

Fixed-source coverage includes all 14 invalid environment values and all 18 direct-constructor values; no store or budget dependency is read for invalid configurations. Both well-formed credential-bearing URLs and credential-bearing invalid-port URLs reject before listening/storage, and synthetic userinfo/provider markers are absent from complete stdout/stderr. Child output checks now await stream closure, including normal CLI shutdown, to avoid examining partially drained logs.

All ten valid HTTP(S) forms still allow canonical browser-origin room creation: HTTP localhost, root slash, default :80, custom port, IPv4 :0, HTTPS root/default :443/custom port, and IPv6 origin text. Secure-cookie selection remains correct. HTTP rejects absent/null/trailing-slash/attacker-suffixed Origin and explicit cross-site requests. WebSocket upgrades require the exact canonical origin and a valid newly issued fixture cookie; absent/null, trailing slash, explicit default port in the incoming header, wrong scheme, attacker suffix and wrong-room cookie remain denied. The invalid opaque configuration cannot reach a listening server to mint an Origin:null room.

## Portability without weakening checks

The test's default fixture root is now `path.join(checkoutRoot,'_artifacts','test-temp')`, created by the test. Synthetic file URL cases derive from that root rather than embedding a Windows drive. Child TEMP/TMP use that same checkout-local root. npm_config_cache is inherited when provided, otherwise it defaults to ignored checkout-local `_artifacts/npm-cache`; no npm install is needed by these tests. All of these paths remain on D: in this environment.

ORIGIN_REVIEW_ROOT selects only the source under review; it does not move normal temporary state to a sibling worker. With no override, all eight ordinary regression groups run against their own checkout. No skip, weakened assertion, conditional pass for the old bug or dependency on a specific D: worker path was added. Explicit pin archives/evidence are ignored artifacts, not a required default runtime dependency. The qualification archive reuses existing installed ws through a dependency junction; normal checkouts use their ordinary installed dependency.

## Exact commands and retained evidence

Executed from D:/Widegames-work/audit-rules-20261029:

```powershell
$env:TEMP=Join-Path (Get-Location) '_artifacts/test-temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$reviewArea=Join-Path (Get-Location) '_artifacts/origin-review-20261029'
# Directories above contain exact git archive extractions of their named full commit.
$env:ORIGIN_REVIEW_ROOT=Join-Path $reviewArea '0842a0090f1cfd1ec43b898f16e8191e5b9c2497'
node --test tests/audit-origin-review-20261029.test.mjs # expected 4 failures
$env:ORIGIN_REVIEW_ROOT=Join-Path $reviewArea '5c698b92c1c465830d5ad52f0383072536f12d14'
node --test tests/audit-origin-review-20261029.test.mjs # all 8 pass
node --check tests/audit-origin-review-20261029.test.mjs
git diff --check
git diff --name-only -- server shared public
git check-ignore _artifacts/test-temp _artifacts/origin-review-20261029
```

Final raw outputs are `_artifacts/origin-review-20261029/portable-tests-original-0842-drained.txt` and `independent-fix-5c698b92-final.txt`. The prior portable run outputs are retained too. Unchanged copies of the original preparation evidence are `original-preparation-retained.txt` and `original-null-counterexample-retained.txt`; the original D:/Widegames-work/temp files also remain untouched.

Observed final fixed run: Node v24.20.0, 6.004 seconds. Syntax, whitespace and ignore-boundary checks pass. No failed assertion was converted to a skip. Only this report and tests/audit-origin-review-20261029.test.mjs change in the closure commit.

Limitations: these are loopback native HTTP/WS and bounded CLI checks, not real TLS/proxy/DNS/IPv6-listener or browser qualification. Provider credentials are synthetic and AI stays demo-only; no live/paid request, Chrome, account substitution, deployment, main merge or push occurred. This review pins 5c698b92; Integrations' separately planned test-only portability follow-up is not implicitly qualified. The historical preparation text below remains evidence of the original unfixed revision and is superseded by this exact-pin closure for current status.

---

## Retained preparation receipt — before the fix was supplied

Assigned reviewer: Core, existing D:/Widegames-work/audit-rules-20261029 worktree. Own changes are limited to `tests/audit-origin-review-20261029.test.mjs` and this document. Integrations' `D:/Widegames-work/audit-boundaries-20261029/docs/AUDIT-BOUNDARIES-20261029.md` and its configuration/static test were read-only inputs.

**Historical preparation status at 7c395f8: runtime fix commit had not yet been supplied.** This is not closure or approval. Normative tests deliberately remain red against the saved source. They will be rerun without relaxing assertions against the forthcoming exact configuration/origin/transport fix.

## Exact preparation pin and findings

Tested unchanged saved runtime revision `0842a0090f1cfd1ec43b898f16e8191e5b9c2497` from a Git archive at D:/Widegames-work/temp/audit-origin-review-0842a009. The worker's HEAD before this preparation is `567b2b0ac3cbf91c0dbf08543b3d77ab0c219da9`; its earlier rules audit added tests/docs only. Existing dependencies are referenced from the installed coordinator/node_modules through the archive's junction. No install, runtime edit, change to another worker, push, main change, deployment, browser/Chrome or live/paid provider request occurred.

The independent controls confirm the two related reported findings:

1. **Invalid origin shapes reach server startup.** loadConfig accepts every one of the 14 supplied invalid forms without validation. Direct createGameServer also accepts opaque file/data/about origins, unsupported schemes, userinfo and non-root URL components, reaches the default real store and accesses the budget dependency. Under file-origin configuration, a real loopback HTTP POST with Origin:null creates a new fixture room and returns 201. The same request with Sec-Fetch-Site:cross-site returns 403. This remains a conditional administrator-configuration defect, not a demonstrated bypass under valid default HTTP(S) origin settings.
2. **Configured userinfo reaches CLI output.** The actual CLI starts with a synthetic userinfo URL and prints its synthetic username/password in stdout. A fake provider-key marker does not appear. No actual credential was used or disclosed.

**Additional variant of the same disclosure surface:** `http://<synthetic-user>:<synthetic-password>@localhost:999999` is rejected by new URL before any store/budget access, but the raw URL exception retains the input and the real CLI prints that synthetic userinfo in stderr. Rejecting malformed credentials is insufficient if the implementation rethrows the raw parser error or attaches the input as a logged cause. The fix needs a sanitized error at both loadConfig and direct-constructor boundaries. This variant is not counted as a new unrelated high-severity vulnerability.

## Prepared negative matrix

The environment validation test covers 14 labels:

- Opaque file/data/about URLs and literal null.
- ws, wss and ftp schemes.
- Username/password userinfo, username-only userinfo, and userinfo with an invalid numeric port.
- Non-root path, query, fragment and malformed URL text.

The direct-constructor test repeats that matrix and adds undefined, number, object and empty-string publicOrigin values. For every invalid value it requires rejection before reading either the store or dailyBudget dependency. The store getter returns undefined so any access would continue to the actual default store; its observed count therefore detects the acquisition boundary rather than merely checking that a lock was later removed. A real temporary data directory must remain empty. Errors are inspected for synthetic userinfo markers.

This is intentionally separate from loadConfig: a caller constructing the server directly must not bypass origin validation by providing a handcrafted config object. No test asserts that absent PUBLIC_ORIGIN in the environment is invalid; the documented localhost defaults remain required.

CLI tests use actual server/main.mjs in bounded child processes with isolated demo-only environment variables and synthetic markers. Both well-formed and malformed credential-bearing URLs must fail before listening or creating storage, and neither URL credentials nor the provider marker may appear on stdout/stderr. Child cleanup uses the owned process' IPC-triggered real SIGTERM handler; OS/container signal delivery is not claimed.

## Positive controls already passing on the saved source

Ten valid public-origin forms are exercised through loadConfig and an independently supplied raw constructor value:

| Input forms | Browser authorization origin |
| --- | --- |
| http://localhost, root slash, explicit :80 plus slash | http://localhost |
| http://localhost:3000/ | http://localhost:3000 |
| http://127.0.0.1:0/ | http://127.0.0.1:0 |
| https://example.test, root slash, explicit :443 plus slash | https://example.test |
| https://example.test:8443/ | https://example.test:8443 |
| http://[::1]:3000/ | http://[::1]:3000 |

All permit real fixture room creation with the canonical browser Origin. Secure cookie selection follows HTTPS; localhost HTTP remains usable. The actual listening socket is loopback HTTP, with these configured public origins simulating proxy-facing origin metadata. This is not real TLS, external DNS or an IPv6 listener qualification.

For every valid form, mutating HTTP requests reject absent, null, trailing-slash and attacker-suffixed Origin values, plus an explicit Sec-Fetch-Site:cross-site request with the otherwise correct origin. Defaults remain localhost ports 3000, 0 and 8080 as configured.

A real WebSocket control uses a newly created fixture identity and cookie. Only the exact canonical HTTPS Origin upgrades. Absent/null Origin, a slash, explicit default port in the incoming header, wrong scheme and attacker suffix all return 403; a wrong-room synthetic cookie with the correct Origin returns 401. Configuration normalization must not be implemented by broadening request-header authorization. Browser Origin serialization normally removes default ports; accepting those forms in PUBLIC_ORIGIN does not require accepting noncanonical incoming header strings.

A valid real CLI with HTTPS root/default-port configuration starts, serves health for the canonical Origin and keeps the synthetic provider marker out of stdout/stderr/health.

## Actual preparation results

The initial seven-group run returned **exit 1: 4 pass, 3 fail, 0 skipped**, 5.991 seconds. Failures are the environment invalid matrix, direct-constructor invalid matrix, and CLI credential rejection/secrecy group. These are actual source failures, not fixture errors or skipped controls.

The additional focused actual Origin:null reproduction returned **exit 1: 1 failure**, observing HTTP 201; its cross-site rejection control passed before the failing assertion. It was run separately after adding the eighth test, rather than claiming that an eight-test combined run was performed. The four positive groups in the seven-group run pass. Syntax check passes.

Retained evidence:

- D:/Widegames-work/temp/audit-origin-review-0842-preparation.txt
- D:/Widegames-work/temp/audit-origin-review-0842-null-counterexample.txt

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:ORIGIN_REVIEW_ROOT='D:/Widegames-work/temp/audit-origin-review-0842a009'
node --test tests/audit-origin-review-20261029.test.mjs
node --test --test-name-pattern='opaque origin cannot' tests/audit-origin-review-20261029.test.mjs
node --check tests/audit-origin-review-20261029.test.mjs
git diff --check
```

For the forthcoming fix, ORIGIN_REVIEW_ROOT can point to a separate exact Git archive; tests default to their checkout root when unset. The runtime files remain untouched. The reviewer will inspect the exact diff, repeat these independent controls, record any actual failure, and leave integration/approval with the coordinator. No current-runtime closure is claimed in this preparation receipt.
