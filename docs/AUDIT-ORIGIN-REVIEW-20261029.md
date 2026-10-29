# Independent PUBLIC_ORIGIN review — preparation 2026-10-29

Assigned reviewer: Core, existing D:/Widegames-work/audit-rules-20261029 worktree. Own changes are limited to `tests/audit-origin-review-20261029.test.mjs` and this document. Integrations' `D:/Widegames-work/audit-boundaries-20261029/docs/AUDIT-BOUNDARIES-20261029.md` and its configuration/static test were read-only inputs.

**Status: preparation complete; runtime fix commit has not yet been supplied.** This is not closure or approval. Normative tests deliberately remain red against the saved source. They will be rerun without relaxing assertions against the forthcoming exact configuration/origin/transport fix.

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
