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
