# Boundary audit — 2026-10-29

Initial read-only source audit at exact saved Widegames revision `0842a0090f1cfd1ec43b898f16e8191e5b9c2497`. Assigned worktree: `D:/Widegames-work/audit-boundaries-20261029`; branch: `codex/lantern-audit-boundaries-20261029`. Read `AGENTS.md`, `docs/CONTRACT.md` and `docs/VERIFICATION.md` first. Historical closed findings were treated as history, not reopened. No runtime/root/config changes, deployment, main changes, paid/live provider calls, browser/Chrome use, existing account/seat substitution or changes to prior worktrees were made.

**Audit status: 20 targeted new controls, 18 passed and two related malformed-origin/configuration failures. Exit code 1. These failures remain open for coordinator triage; this is not approval or a passing qualification receipt.** Neither failure is a default-origin authorization bypass or a demonstrated leak of an actual provider key.

## Reproduced findings

### B01 — opaque public origin is accepted (conditional configuration validation defect)

Sources: `server/config.mjs` passes through `PUBLIC_ORIGIN`; `server/transport.mjs` converts it using `new URL(...).origin` without requiring HTTP(S). The labelled fixture sets `PUBLIC_ORIGIN=file:///D:/audit-origin-fixture`. Startup succeeds, the enforced origin becomes the string `null`, and a fresh HTTP `POST /api/rooms` with `Origin: null` and `{mode:'human'}` returns **201** and issues that new fixture's room identity. The retained normative assertion requires startup or authorization to reject this configuration and fails on the saved revision.

Impact is conditional on an administrator supplying an invalid opaque origin; documented defaults and ordinary valid HTTP(S) settings are not shown bypassed. This is a failure to enforce the documented exact browser-origin configuration boundary. The explicit `Sec-Fetch-Site: cross-site` control still returns **403**, so this audit does not assert a browser CSRF exploit. All identities used were newly created local fixtures.

### B02 — userinfo from public origin is printed (conditional log disclosure)

Sources: the same unvalidated `server/config.mjs` value reaches `server/main.mjs`'s `open ${config.publicOrigin}` startup log. With only synthetic data, `PUBLIC_ORIGIN=http://audit-user:origin-userinfo-fixture-secret@127.0.0.1:0` starts the CLI and prints the synthetic password in stdout. The retained normative no-userinfo-secret assertion fails. The provider key is a separate fake marker, `audit-provider-key-never-log`; it does **not** appear in stdout, stderr, health or static-page responses in the positive control.

This requires a credential-bearing origin misconfiguration and is not evidence that normal provider credentials are logged. B01 and B02 share an origin-validation surface; they should not be counted as two independent high-severity vulnerabilities. Suggested coordinator correction: parse and validate the public origin before creating storage/listening, accept the supported HTTP(S) origin forms only, reject userinfo/opaque URLs and inappropriate URL components, and log the validated origin rather than raw configuration. No correction was made by this worker.

Reproduction of just the retained failures:

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:npm_config_cache='D:/Widegames-work/npm-cache'
node --test --test-name-pattern='FINDING B0' tests/audit-boundaries-20261029-config-static.test.mjs
```

## Independent source and boundary controls

Reviewed coordinator-owned `server/config.mjs`, `server/static.mjs`, `server/main.mjs`, package scripts/lockfile, `Dockerfile`, `.dockerignore`, `.env.example`, README/deployment instructions and Actions workflow; reviewed Reviewer-owned `server/ai/anthropic.mjs`, `server/ai/index.mjs` and their documented contracts. Real engine views are used to prepare council fixtures. All provider fetches are mocked and real provider fetch is denied by default in that audit process.

| Control | Fixture and observed limit |
| --- | --- |
| Numeric config | Negative, nonfinite, fractional and over-maximum integer values rejected; port 0 accepted; 100 rooms accepted even via numeric exponent string; zero call/token/cost caps retained |
| Production dependency boundary | A uniquely named staged fixture copies exactly the Docker runtime source/package groups and performs `npm ci --omit=dev --offline --ignore-scripts --no-audit --no-fund` using the D: cache; only `ws` is installed; Puppeteer is absent; actual main/health/static startup succeeds |
| CLI and secrets | The documented Node env-file option is used with the actual main module and fake-only credentials; fake provider key is absent from logs/health/static; a synthetic IPC stop invokes the real SIGTERM handler and releases storage locks |
| Static traversal | 12 raw HTTP path probes, including mixed encoded slash/backslash, null byte, malformed percent encoding, double encoding and private source/config/data/node_modules paths, return 400/404; URL normalization by a fetch client cannot hide the supplied raw probe |
| Public content policy | Harbor, room shell, shared module and app module return 200 with nosniff and self-only scripts/connections, no inline/eval grants, no frames/base/form escape; HEAD has no body; unsupported static POST returns 405 |
| Prompt allowlist | Unexpected remote-role/key/replay fields and unused private memory markers omitted; own permitted role retained |
| Provider origin/redirects | Target remains `https://api.anthropic.com/v1/messages` despite a supplied request URL; redirect mode is `error`; mocked 301/302/303/307/308 responses are refused/cancelled, without another target request |
| Exact response byte ceiling | 32,768 bytes accepted, 32,769 rejected/cancelled, delivered in 137-byte chunks |
| Exact prompt byte ceiling | 12,000 bytes accepted and 12,001 rejected before send; constructor-only choice padding is explicitly synthetic, not a legal engine speech proposal |
| Tool/usage counterexamples | Over-total or over-output token usage, fractional usage, negative choice, extra input properties, 281-character/control dialogue and multiple tools rejected |
| Retry reservation ordering | Actual controller + deployment ledger, with a synced private checkpoint fixture: first mock 503 then success; both sends follow their own completed checkpoint/daily reservation and have distinct IDs; ignored provider text/reasoning is not retained in action/context/summary |
| Mid-body abort | Mock response headers arrive but body stalls; outer abort stops the decision without another request or refund |
| Late persistence/timeout | At 150ms timeout, a withheld acknowledgement selects safe demo with zero fetches; releasing it later cannot send, while its uncertain reservation remains |
| Timeout vs call cap | Stalled response times out after its first allowed send; `maxCalls=1` prevents retry/reservation number two and selects labeled budget fallback |
| Config-to-provider zero caps | Root environment zero token, cost or call allowance reaches controller without a provider request or reservation callback |

The mock redirect tests inspect the real fetch options and adapter refusal behavior; they do not claim live TLS, DNS or provider-side redirect qualification. Token/cost checks use the saved adapter's price constants and conservative reservations, not current billing or an actual invoice.

## Own transport self-checks, not independent approval

I authored earlier transport code. The following newly devised checks are explicitly self-checks of its interaction with coordinator configuration, not independent sign-off:

- `MAX_ACTIVE_ROOMS=2`, three simultaneous creates: exactly two 201 responses and one 429.
- Configured capacity 100, one actual socket address: first eight creates succeed and the ninth is limited with 429.
- Streaming JSON envelopes are exactly 8,192 and 8,193 bytes: the former passes the byte parser and reaches normal semantic rejection (`INVALID_ROOM`, 400); the latter returns 413. Together with 598 healthy requests, exactly 600 total API requests are admitted before request 601 returns 429.
- A malformed URL fails before touching an existing labelled corrupt budget checkpoint. A valid-origin startup with that corrupt checkpoint fails safely, preserves its exact bytes and releases only the acquired service/recovery lock files.

These do not exercise distributed writers, hostile filesystem replacement, a reverse proxy, broad traffic/load or power loss. The already closed lock, canonical-budget and terminal-cancellation findings were not reopened.

## Commands, evidence and limitations

Environment observed: Windows, Node **24.20.0**, npm **11.19.0**. Source, staged runtime, temporary state, env fixtures, evidence and npm cache were all on D:. No real provider credentials are needed or inherited by the CLI fixture. Only production dependencies were installed in this audit checkout, plus an independent offline production fixture. Minimum Node22.13, Linux and a built container were not executed.

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:npm_config_cache='D:/Widegames-work/npm-cache'
npm ci --omit=dev --offline --ignore-scripts --no-audit --no-fund
node --test --test-concurrency=2 tests/audit-boundaries-20261029-config-static.test.mjs tests/audit-boundaries-20261029-provider.test.mjs
node --check tests/audit-boundaries-20261029-config-static.test.mjs
node --check tests/audit-boundaries-20261029-provider.test.mjs
git diff --check
```

Final targeted run: **20 total / 18 pass / 2 fail / 0 skip / 0 todo**, actual test exit **1**, 4.521 seconds. Both syntax checks and diff whitespace check passed. No old full suite was rerun as a substitute for this audit. Final raw log: `D:/Widegames-work/temp/audit-boundaries-20261029-final-9c17e64a7696428fbe1ae1678dc01eb5.txt`. Earlier targeted logs with 19 controls remain in the same labelled D: directory. An initial exploratory run additionally had three teardown-order errors in the new harness; those were fixed by closing owned resources before deleting fixture directories and are not product findings. B01 and B02 remained genuinely failing throughout.

Actual `docker version` process launch returned **ENOENT**: Docker is unavailable on PATH. Dockerfile, production dependency grouping, unprivileged `USER node`, demo defaults, health command and documented build/run commands were inspected. No Docker image build, daemon health check, Linux user/volume ownership, proxy, live provider, hosted CI or deployment result is claimed. The CLI cleanup fixture invokes the SIGTERM handler through synthetic IPC; OS signal delivery inside a container was not qualified. The workflow's artifact allowlist excludes private state/browser profiles, but hosted Actions were not run.

`git diff` against the saved revision for runtime, shared/public assets, config/package files, Docker files, workflow, scripts and README was empty. Only the two uniquely owned `tests/audit-boundaries-20261029*.test.mjs` files and this report are committed. Coordinator correction and independent verification remain pending.

## Bounded correction — shared origin validation, 2026-10-29

The user explicitly granted implementation ownership of `server/config.mjs`, new `server/origin.mjs`, transport origin initialization and the owned audit tests/docs. The original audit above, its genuinely failing evidence at `0842a00`, and commit `d6aa36b50d0dbe240874375e7b860af8ae67ad4e` remain preserved. In particular, the original D: raw log still records 18 passes / two failures; this section does not relabel that invocation as passing. The correction below has owner checks and awaits Core's independent review.

`validatePublicOrigin` now supplies one shared policy to `loadConfig` and direct `createGameServer` calls. It accepts explicit absolute HTTP(S) origins, canonicalizing host/scheme casing, trailing root slash and default ports using the URL parser. It rejects opaque/non-HTTP(S) schemes, literal/actual null, credentials including empty userinfo, query/fragment delimiters (including empty ones), non-root paths, controls/whitespace and backslashes. Supplied paths are checked before URL normalization can collapse a forbidden `path/..`, dot segment or encoded dot into `/`. Invalid host/port input is rejected with a setup error.

Every error names `PUBLIC_ORIGIN`, explains the failed setup requirement and supplies safe localhost HTTP / public HTTPS examples. It never interpolates the supplied value or attaches the native parser error/input as a cause. Config loading returns only the validated canonical value, so the existing `main.mjs` startup log cannot receive raw userinfo and needs no source edit. Transport separately validates at initialization, before engine/controller/storage dependencies or locks/budget access, covering callers that bypass `loadConfig`. Unset/empty environment values keep the established localhost default; an absent/empty direct-server origin is rejected. Budget amounts, bounds and unrelated transport behavior are unchanged.

Added `tests/audit-boundaries-20261029-origin.test.mjs`:

- 35 invalid helper/direct-start inputs; 33 invalid environment values, with undefined/empty environment default behavior checked separately. Cases include opaque URLs, userinfo, empty query/fragment, non-root paths that URL normalization would otherwise erase, invalid ports, whitespace and backslashes.
- Useful, non-secret setup-error checks, with no attached native error cause.
- Direct-start dependency traps and a nonexistent data directory prove rejection precedes dependencies and storage. Separate labelled existing service/recovery locks and private budget evidence remain byte-for-byte intact.
- Eight valid localhost, loopback, HTTPS proxy and IPv6 forms canonicalize correctly. Config call/token/cost/daily/room limits retain their configured values.
- Actual direct-server HTTP requests use the canonical origin successfully, reject `Origin: null` and another origin, and issue Secure cookies for HTTPS proxy configuration only.

The original B01 assertion now passes because setup rejects the opaque URL. The strengthened B02 CLI assertion verifies nonzero setup exit, no listener, no created private data directory, a useful setup message, and no synthetic origin credential in either stdout or stderr. The production-only CLI fixture additionally verifies canonical logging for `HTTP://LOCALHOST:3000/`.

Validation after the bounded correction:

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:npm_config_cache='D:/Widegames-work/npm-cache'
node --test --test-concurrency=2 tests/audit-boundaries-20261029-config-static.test.mjs tests/audit-boundaries-20261029-origin.test.mjs tests/audit-boundaries-20261029-provider.test.mjs
node --check server/origin.mjs
node --check server/config.mjs
node --check server/transport.mjs
node --check tests/audit-boundaries-20261029-origin.test.mjs
node --check tests/audit-boundaries-20261029-config-static.test.mjs
git diff --check
```

Observed: **25/25 passed, zero failures/skips/todos**, actual test exit **0**, 5.094 seconds. Both previously failing assertions pass; the existing independent provider/mock budget/cancellation checks and explicitly labelled transport self-checks still pass. Syntax/diff checks pass. Reviewed diff scope: the shared helper, config wiring, transport import/origin initialization only, owned tests and this appended report. `server/main.mjs`, budget/provider/engine/static/public/root files are untouched. No deployment, paid/live provider call, browser or main-branch change occurred. Docker availability remains unqualified/unavailable as recorded above. Core must independently assess the exact correction commit; these are owner results, not worker self-approval.

## Audit test portability — 2026-10-29

Only the owned audit test files and this appended report change in this pass. Runtime/provider/config/shared sources are unchanged from correction commit `5c698b92c1c465830d5ad52f0383072536f12d14`. The original failing audit at `0842a00`, its D: raw logs, and the successful original production-only/correction evidence above remain preserved; the commands and fixture locations below supersede their platform-specific setup for future ordinary runs.

All generated audit fixtures now derive their root from each test's checkout URL and live in ignored `_artifacts/test-temp`. This works independently of the checkout drive/name and current working directory. Child TEMP, TMP and TMPDIR point there too. Cleanup still verifies the resolved target is inside that owned directory. The fake opaque URL fixtures no longer contain a drive-specific path. Fixture env-file DATA_DIR is quoted so checkout paths containing spaces or `#` remain intact.

Child processes preserve the inherited platform/CI environment, including HOME, USERPROFILE, PATH, platform-specific case spelling and loader settings. App/provider/config variables are removed case-insensitively before loading the synthetic demo env file, so inherited real credentials or production data-directory settings cannot override it. The npm cache is no longer fixed: the opt-in probe honors the normal npm environment/configuration, or `AUDIT_NPM_CACHE` supplies an explicit override. npm CLI discovery uses the inherited `npm_execpath` when available, standard Windows/POSIX installation locations otherwise, with `AUDIT_NPM_CLI` for nonstandard installations.

The existing positive CLI canonical-origin/health/static/key-exclusion/cleanup assertions have been split into an ordinary test that uses the already installed checkout dependencies. Every ordinary config, origin, provider, static, startup and cap assertion still runs. Only the additional isolated production **install** probe is skipped unless `AUDIT_PRODUCTION_ONLY=1`; it remains offline and therefore needs an appropriate prewarmed cache when explicitly requested. Its local dependency check inspects the staged `node_modules` directory rather than assuming `require.resolve` cannot see ancestor checkout dev dependencies.

Ordinary targeted invocation (no npm install or prewarmed cache needed beyond the normal checkout dependency installation):

```powershell
Remove-Item Env:AUDIT_PRODUCTION_ONLY -ErrorAction SilentlyContinue
node --test --test-concurrency=2 tests/audit-boundaries-20261029-config-static.test.mjs tests/audit-boundaries-20261029-origin.test.mjs tests/audit-boundaries-20261029-provider.test.mjs
```

Observed locally: **26 total / 25 passed / one explicit production-install skip / zero failures**, test exit **0**, 4.705 seconds. An explicitly nonexistent checkout-local `AUDIT_NPM_CACHE` was used for this run and remained uncreated, demonstrating that ordinary checks did not invoke npm or need the old D: cache. All three owned test files passed `node --check`; `git diff --check` passed. The fixture/evidence directory is ignored by the existing `.gitignore`; no root ignore/config changes were made.

Exact separately executed D: opt-in command, from `D:/Widegames-work/audit-boundaries-20261029`:

```powershell
$env:AUDIT_PRODUCTION_ONLY='1'
$env:AUDIT_NPM_CACHE='D:/Widegames-work/npm-cache'
node --test --test-name-pattern='opt-in production-only offline npm install' tests/audit-boundaries-20261029-config-static.test.mjs
Remove-Item Env:AUDIT_PRODUCTION_ONLY -ErrorAction SilentlyContinue
Remove-Item Env:AUDIT_NPM_CACHE -ErrorAction SilentlyContinue
```

Observed: **one selected production probe passed / zero failures/skips**, test exit **0**, 3.862 seconds. The staged fixture installed production dependencies offline, contained only `ws`, lacked a local Puppeteer package and booted/closed the actual CLI. For POSIX CI the corresponding opt-in form is `AUDIT_PRODUCTION_ONLY=1 AUDIT_NPM_CACHE=/path/to/prewarmed/cache node --test --test-name-pattern='opt-in production-only offline npm install' tests/audit-boundaries-20261029-config-static.test.mjs`; ordinary `npm test` requires no such flag.

New ignored evidence, relative to this checkout:

- `_artifacts/test-temp/audit-boundaries-portable-ordinary-d63c744d12f34a0982aa8e9466aa9a19.txt`
- `_artifacts/test-temp/audit-boundaries-portable-production-4734c827b25d4810954840d11cc73818.txt`

Actual execution remains Windows/Node24.20.0; a Linux runtime/hosted CI execution was not performed here. Docker remains unavailable (`ENOENT`); no container, Chrome, paid/live provider, deployment or main-branch operation occurred. No earlier negative evidence was deleted or rewritten. This is an owner portability receipt, pending coordinator integration and independent review.
