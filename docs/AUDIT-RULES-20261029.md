# Fresh rules / state audit — 2026-10-29

Audited exact saved revision `0842a0090f1cfd1ec43b898f16e8191e5b9c2497` in the newly assigned `D:/Widegames-work/audit-rules-20261029` worktree, branch `codex/lantern-audit-rules-20261029`. Read AGENTS.md, CONTRACT.md and VERIFICATION.md before implementation. This is a bounded independent audit receipt, not runtime self-approval.

**Result: no reproducible runtime defect found within the tested limits.** Seven new tests pass, zero failures/skips in the final run. Runtime source is unchanged. Existing closed findings are treated as history; old full suites were not rerun as a substitute for this audit. Only the uniquely owned audit test and this document change.

## Source pin and inspected boundaries

| Source | Exact Git object |
| --- | --- |
| Saved revision | `0842a0090f1cfd1ec43b898f16e8191e5b9c2497` |
| server/engine/index.mjs | `e8c5d83bf050cf7ef8b958e23985cb17bcb46069` |
| server/ai/anthropic.mjs | `379283d22ab7450647bf7bfa96e937961b742574` |

Read the actual engine, shared rules/map, rules documentation, AI demo policy, provider request/response adapter, and controller's request construction/proposal paths. The engine applies deadlines before request replay/denial, retains actor-scoped IDs, checks gameplay after envelope validation, and owns all outcome assignments. AI uses its own safe view and public character; tools choose an enumerated action plus optional public speech. The adapter rejects extra tool fields, and transport-facing action proposals still require engine validation. No hidden engine state was supplied to the mocked provider prompt.

No runtime, launch, root/shared, other worker or C: source was edited. All tools ran from the assigned worktree. TEMP/TMP, logs and npm-cache setting use D:/Widegames-work. No install was needed; the new tests use Node built-ins and the real repository modules. No browser, paid/live provider, account substitution, main mutation, push or deployment occurred.

## New controls

All implementation is in `tests/audit-rules-20261029.test.mjs`. No copied engine implementation or fake winner is used.

### Exhaustive three-survivor ballot surface

The fixture legally eliminates three crew, leaving two crew and one saboteur, then legally opens discussion/voting. All **125 combinations** of three voters choosing abstention, skip or any living target are exercised. An independent count/plurality oracle predicts the ejection, including skip ties, split ballots and abstentions. A saboteur ejection must produce the crew ejection win; a crew ejection at this population must produce saboteur parity. No ejection must resume roaming with no outcome. This goes beyond the earlier handful of named ballot examples; it is exhaustive only for this three-voter fixture, not six-voter elections.

### Deadline collision grid with alternative delivery paths

Nine fixtures independently vary critical deadline and maximum duration over 6/7/8 while a winning vote tally is due at 7. This includes the three-way tie, pairwise ties and strict orderings. The expected priority is critical, then maximum pause, then phase/tally at simultaneous times, matching the documented rule.

Bulk late tick and unit-time partitioned ticks must produce the same game world and event sequence. Late retained duplicate, conflicting retained ID, and invalid actor deliveries must also preserve the same deadline-driven world and return the automatic events. A max pause before tally must keep its ballot targets hidden. Outcome timestamps must be the original deadline, not the late delivery time.

The comparison intentionally excludes version, updatedAt and request-ledger metadata: partitioned invocations can legitimately have more version increments, and new denials persist metadata. Their gameplay world, replay, automatic events and outcome must agree.

### Generated mixed-action state traces

Twelve deterministic seeds, **120 steps each = 1,440 deliveries**, use accelerated server-side rules. Policy choices come from each actor's frozen real safe view through the current demo proposal enumerator. The audit mixes legal options, malformed actor-spoofing envelopes, invalid task IDs, retained successful/denied duplicates and JSON restore points. Server time advances by 0–3 milliseconds per step.

Observed counts, including duplicates as a subset of accepted/denied deliveries:

| Measure | Observed |
| --- | --- |
| Accepted results | 460 |
| Denied results | 980 |
| Duplicate deliveries | 156 |
| Changes of phase across deliveries | 69 |
| Accepted generated action types | eliminate, meeting, move, report, sabotage, say, task, vote, wait |

Checks after each step include frozen-input immutability; JSON serialization; fixed roles and unique player IDs; task identity/total conservation and monotonic completion; no resurrection; no unfinished work stranded on dead crew; bounded requests/events/replay; unique repair contributors; valid outcome conditions; monotonically increasing versions on actual changes; and permanence of terminal gameplay.

For one actor and the spectator on every step, the test mutates every returned view subtree and then verifies that original state and a fresh view remain unchanged. It checks local position redaction, pre-end role redaction, untallied ballot secrecy, and witness visibility against recorded observer membership. Returned action events are separately poisoned to ensure no event/state alias. Duplicate results must preserve both deadline-baseline gameplay and the request ledger, including their original accepted/error result.

Generated traces do not happen to accept a repair; the separate two-critical-epoch test below covers repair through legal actions. These are bounded deterministic traces, not exhaustive state exploration or a load test. Request counts stay below saturation; this fresh audit does not claim to requalify the historical 2,048 full-cap test.

### Terminal permanence and unusual identity strings

Opaque IDs `__proto__`, `constructor`, case-distinct strings and the exact 100-character maximum execute as ordinary actor-scoped IDs, duplicate inertly and conflict on changed contents. Another actor may use the same string independently. Oversized, dotted, slash-containing, separator/control IDs reject.

Both ended and paused fixtures receive twelve subsequent fresh-ID actions. Gameplay, outcome and replay remain permanent, while metadata for valid denials may continue to persist as documented. No claim is made that all terminal state bytes remain identical: version, updatedAt and request records may change without resuming play.

### Hostile offline provider output and authoritative rule revalidation

The real makeRequest and send adapter execute with global fetch replaced by an in-memory Response fixture. No network/provider is contacted; `offline-fixture-only` is a dummy string used solely by that mock. The prompt originates from a real frozen player view, never raw state.

Seven malformed tool inputs test negative/out-of-range/string choices, actor spoofing, outcome/type injection and control-character speech. A two-tool response also rejects. Valid public speech claiming a winner is accepted solely as dialogue and leaves the outcome null. The same offered speech delivered at the discussion deadline rejects in voting. An actor-spoofing action envelope cannot become an elimination. These controls exercise adapter and engine boundaries, not provider quality or actual network cancellation.

### Same-time final task, elimination and critical expiry

A legal accelerated fixture finishes four of five tasks and positions the final task's crew owner with the saboteur. If the task arrives first at a shared timestamp, crew task victory is permanent and elimination rejects. If elimination arrives first, the dead actor's task rejects, its original task ID is transferred to a living crew member, and task totals remain conserved.

A related branch starts a real critical incident: final task completion at deadline minus one wins permanently for crew; the same completion at the exact critical deadline loses to critical expiry. This checks serialization and competing win triggers without mutating engine preconditions.

### Repair IDs across two real critical incidents

Two distinct crew legally repair an incident, then a new sabotage starts and state is JSON-restored. Replaying either earlier successful repair ID must remain an inert successful duplicate, without contributing repair progress to the new incident. Fresh repair IDs contribute exactly once each and resolve it. This exercises persisted idempotency across repeated action epochs, rather than merely repeating an action in the original room state.

## Actual failure and final commands

The first run had **4 passed / 1 failed**. The deadline-grid fixture attempted sabotage at time 1 while inheriting sabotageCooldownMs:3, so the real engine correctly returned COOLDOWN. This was a test-fixture setup error, not a runtime finding. The original output is retained unchanged at `D:/Widegames-work/temp/audit-rules-20261029-0842-initial.txt`. The fixture now explicitly sets sabotageCooldownMs:1. The later targeted race/critical-epoch controls were added, and the final seven-test run passes.

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:npm_config_cache='D:/Widegames-work/npm-cache'
node --test tests/audit-rules-20261029.test.mjs
node --check tests/audit-rules-20261029.test.mjs
git diff --check
```

Final observed runtime: Node v24.20.0; **7 passed, 0 failed, 0 skipped**, 3.929 seconds. Syntax check passes. Final test output is retained at `D:/Widegames-work/temp/audit-rules-20261029-0842-results.txt`.

These results apply to the exact source above and the labeled fixtures. They do not certify every legal trace, live provider behavior, persistence/HTTP deployment, browser UX, large-scale load or wall-clock/OS failure behavior. The coordinator remains responsible for independently reviewing and integrating this receipt.
