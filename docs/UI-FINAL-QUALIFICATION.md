# Frontend final qualification ? 2026-10-29

The authorized browser lease was used serially and released after both browser sessions and their game servers closed. All requested qualification runs passed. No application, server, shared, root, or existing test source was changed during this final qualification. This document is the only tracked change. No paid/live providers, package installs, builds, pushes, or production approval were performed.

## Exact source scope

| Source | Revision / version |
| --- | --- |
| Frontend public files and committed browser/unit/DOM suites | `85b6b963225f9af78f17255f53aaf37f9e70cba0` |
| Manager's integration of that refinement | `51cf694dc96f6b732771dc60202e523f6b94cb48` |
| Coordinator real backend at qualification start | `c99e309daaeef08fd6dc8b05ab67191544677ae2` |
| Coordinator HEAD at evidence collection | `70140b793a2c4652eb35aef4c66dba4f2d58a13b` |
| Node | `v24.20.0` |
| Puppeteer Core | `25.16.0` (existing coordinator installation) |
| Actual browser | `Chrome/156.0.8078.73` |
| Browser executable | `C:/Program Files/Google/Chrome/Application/chrome.exe` |

The suite imported the actual coordinator transport, engine and AI modules and served the unchanged frontend worktree's `public/**`. The manager-only favicon addition was intentionally not imported. The coordinator advanced during qualification, but SHA-256 fingerprints of all nine recorded backend/contract sources were identical before and after both browser runs. Metadata, fingerprints and logs are retained in the unique local evidence directory below. The frontend public-file fingerprints are recorded separately in `frontend-sha256.json`.

The coordinator's later presentation adjustment for anonymous repair progress (`b5496cf`) and readable spectator map styling (`7980bf7`) are outside this tested frontend snapshot. The 85b6b96 repair screenshot consequently contains the older generic public log wording; no hidden repair actor is present. Those later manager changes were preserved, not copied into or overwritten by this task.

## Commands and observed results

From `D:/Widegames-work/frontend`:

```powershell
$env:LW_UI_BROWSER='1'
$env:LW_UI_PUPPETEER='D:/Widegames-work/coordinator/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
$env:LW_UI_TRANSPORT='D:/Widegames-work/coordinator/server/transport.mjs'
$env:LW_UI_ENGINE='D:/Widegames-work/coordinator/server/engine/index.mjs'
$env:LW_UI_AI='D:/Widegames-work/coordinator/server/ai/index.mjs'
$env:LW_UI_EXECUTABLE='C:/Program Files/Google/Chrome/Application/chrome.exe'
node --test tests/ui-browser.test.mjs

$env:LW_UI_BROWSER='0'
node --test --test-isolation=none tests/ui.test.mjs tests/ui-audit.test.mjs tests/ui-dom.test.mjs

node tests/ui-artifacts/final-qualification-20261029-162830/supplement-attempt-1/supplement.mjs
git diff --check
```

- Committed browser suite: **1 passing Node subtest**, exit 0, 23.624 seconds in the subtest (23.839 seconds total). This is one scenario suite containing many assertions, not a claim of that many independent tests.
- UI unit/audit/DOM suites: **10 passing tests**, exit 0; none skipped.
- Supplemental real-browser script: **26 named checks passed**, exit 0, success true; zero browser runtime errors, zero privacy assertion errors, and zero cleanup errors. These checks are assertions within one supplemental script, not an additional independent test-suite count.
- Privacy assertions examined **26 actual HTTP views and 85 actual WebSocket views**. No complete private view, session token, provider key, AI memory or reasoning is written to the report.
- Before/after backend fingerprints matched; frontend working source remained at 85b6b96. Diff whitespace checks passed.

The manager previously reported **78 overall tests** and a separate **16-check integrated browser run** covering both complete matches. Those counts were not independently rerun here, overlap with this coverage, and must not be added to the 10 targeted tests or the 26 supplemental assertions as independent new tests.

## Coverage actually exercised

The unchanged committed browser suite used real engine fixtures and demo AI through the actual HTTP/WebSocket transport and persistence store. It exercised keyboard create/start, keyboard movement, real tasks, emergency discussion, stable typed-field identity/focus/draft, plain-text markup-like dialogue, skip voting, an engine-defined win, role reveal, replay loading and range keyboard input, human-seat reload, spectator cookie reuse, deliberately unavailable WebSocket fallback, six-AI spectator creation, saboteur sabotage, elimination confirmation, elimination, local body reporting, and critical repair. Desktop and 390px screenshots were captured. The human match completed; the saboteur/report and critical-repair fixtures exercised their requested interactions rather than claiming additional complete matches.

The supplemental run used deterministic real-engine seed `72`, local demo AI, and an accelerated test clock. It added actual incoming WebSocket state frames while slowly typing, actual Chrome tab hiding/foregrounding (`document.hidden`, socket closure, subsequent reconnection), preserved unsent draft and same human seat, an independent 320px spectator, spectator reload without a second join, forced closure of an actual socket followed by an HTTP-polled voting transition, a keyboard vote for Pax, live ballot-target redaction, actual engine completion, and readable replay ballots containing `Iona (crew) voted to eject Pax (saboteur).` and attributed skip votes. It also checked storage restrictions and both HTTP and WebSocket payload privacy. No HTTP response or provider was mocked; the socket wrapper observed real sockets and requested their normal closure. Pre-match deterministic fixtures use real engine functions and never become client rule overrides.

## Preserved evidence

Evidence root:

```text
D:/Widegames-work/frontend/tests/ui-artifacts/final-qualification-20261029-162830
```

The original eight PNG artifacts were copied to `prior-artifacts/` before the committed suite could overwrite its standard paths. Existing historical harness-failure records in `docs/UI.md` were left unchanged; this run does not erase or reclassify those failures. Both final browser invocations passed on their initial attempt. The supplemental source, report, console log, exit code, checks and screenshots remain under `supplement-attempt-1/`. Game data and browser profiles created by these runs were removed after clean shutdown; earlier worker artifacts and coordinator files were preserved.

| Evidence | Relative path under the evidence root |
| --- | --- |
| Exact revisions/tooling/start time | `run-metadata.json` |
| Runtime fingerprints | `backend-before.json`, `backend-after.json` |
| Frontend fingerprints | `frontend-sha256.json` |
| Evidence checksums | `evidence-sha256.json` |
| Original browser suite output | `ui-browser-initial.log`, `ui-browser-initial.exit.txt` |
| Targeted unit/DOM output | `ui-unit-dom.log`, `ui-unit-dom.exit.txt` |
| Supplemental report | `supplement-attempt-1/supplement-report.json` |
| Supplemental runnable source | `supplement-attempt-1/supplement.mjs` |
| Supplemental console/exit | `supplement-attempt-1/supplement.log`, `supplement-attempt-1/supplement.exit.txt` |

Screenshots (all under that same unique evidence root):

- `desktop-home.png`
- `mobile-lobby.png`
- `mobile-discussion.png`
- `mobile-voting.png`
- `mobile-results.png`
- `desktop-results.png`
- `desktop-saboteur-report.png`
- `desktop-critical-repair.png`
- `supplement-attempt-1/spectator-privacy-320.png`
- `supplement-attempt-1/keyboard-council-websocket.png`
- `supplement-attempt-1/keyboard-named-ballot-390.png`
- `supplement-attempt-1/actual-replay-ballots-390.png`

The images and raw local evidence are intentionally ignored UI artifacts, available in this shared workspace; only this report is committed. Selected screenshots were visually inspected. Screenshots illustrate the seeded qualification scenarios and do not assert production or live-model behavior.

## Runtime source fingerprints

| Coordinator path | SHA-256 before and after |
| --- | --- |
| `server/transport.mjs` | `84e54d1a9cc3927871ef378f3acf920723f391dbf80af456968ae6f9c4b946c6` |
| `server/engine/index.mjs` | `3b1e1c51fb6230150a0e893a0cda47d7b6189fe91f15895c51bb622421902225` |
| `server/ai/index.mjs` | `8aee16f68fe1d5ffaa806575d4ea5536f11b4370e39c9ff064a9eea87dd10f13` |
| `server/ai/demo.mjs` | `803e5614e24eebb7b4fef7ab5b44c914f50b43b369a745623b0cd15353feb619` |
| `server/ai/anthropic.mjs` | `f5cc45a84d7f423c072c3b5a25dc50555c15105e1043870f18cb2280fa149976` |
| `server/rooms.mjs` | `73f9b29538c3c57942bb5051ffc47de4c0dbf54d5c2bcee8f9db169f61ecb7a8` |
| `server/store.mjs` | `4915af15d85a016846c18c96de4877e22e2a005169e3a3b7cc33d050700a9ebc` |
| `server/budget.mjs` | `ba914cb9e7f35641f4d5a52214d71efb9301f9c3cedeab52286b96b4e08f724f` |
| `shared/contracts.mjs` | `b7488001b0107f92c12e7d8d80db15ee64b13c94308dc409239d142abd9434af` |

## Limits and lease receipt

This qualification covers the explicit 85b6b96 frontend with the fingerprinted integrated backend on desktop Chromium and 320/390px layouts. It does not establish Safari/Firefox, physical mobile hardware, a screen reader, native IME behavior, live-provider compatibility/billing, broad production concurrency, or later coordinator public-file revisions. The frontend hybrid label is covered by the existing offline tests; provider mode in every actual browser run was explicitly demo.

**Chrome lease released:** both frontend-started browser processes and both local test servers closed successfully before this report was prepared. The manager may resume sole-lease browser work. No production readiness or deployment approval is asserted.
