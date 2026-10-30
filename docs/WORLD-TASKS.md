# Authoritative interactive tasks

World matches use five station types: Bridge wiring, Lantern tuning, Archive sequence, Engine/Galley pressure balancing, and Workshop repair. Wiring connects numbered sockets in order; tuning locks a generated frequency; sequence enters four generated tiles; pressure balancing selects flow direction and transfers pressure between unequal reservoirs until both reach 5 bar; repair isolates power, replaces the fuse, starts a diagnostic, then verifies after 1,500 server milliseconds. Wrong inputs leave confirmed progress intact and return specific feedback. Every accepted input advances one semantic step, never a frame counter.

The owner opens equipment at the normal station, reads instructions, and uses native buttons or the keyboard-accessible slider. The modal shows confirmed steps. After all steps, **Send completed task** commits the existing task action. Completion, equipment cooldown, aggregate accounting and last-task victory remain in the engine. There are at most four step writes plus one completion write per task, within the existing 60 writes/minute route limit and 2,048 persisted request IDs. No client time, solved flag, position, stage counter, or UI success can substitute for progress.

## Protocol and compatibility

`taskStep {id,type:'taskStep',taskId,step,input}` carries a bounded integer expected step (0–4) and a semantic string (maximum 40 characters). The engine validates the envelope, actor, living crew ownership, roam phase, authoritative station proximity, equipment cooldown, expected stage, correct input and diagnostic timing. Request fingerprints include both step and input. Accepted and denied well-formed requests retain normal idempotency: reuse returns the original receipt; changed content conflicts. A too-early verification needs a fresh request ID when retried. Existing `task {id,type,taskId}` rejects with `TASK_INCOMPLETE` until progress is complete. The reserved-looking request ID `hint` has no bypass privilege.

Optional task `progress` is `{v:1,kind,target,sequence,pressure,total,index,readyAt}`. Challenges derive from server-created task IDs and known station types, with bounded parameters. The server creates a deterministic initial challenge for an old or untouched task when making the private view; the first accepted step persists it. JSON/disk restart preserves subsequent progress and timer deadlines. Store validation permits absent metadata, but rejects unknown progress fields, inconsistent challenge parameters, invalid stages, inconsistent completion/timer state and deadlines outside the match checkpoint bounds. No room schemaVersion or worldVersion changes.

Legacy board matches keep immediate task semantics and reject taskStep. Old world saves retain completed tasks, IDs and totals; unfinished tasks without metadata begin at stage zero under the new authoritative protocol. No migration or destructive reset is needed. Local legacy puzzle presentation is retained for old/synthetic views without metadata; a current world server still refuses unearned completion.

## Lifecycle, privacy and bots

Movement/navigation or a meeting resets a running diagnostic to its start-diagnostic stage, retaining isolation and fuse replacement. Other confirmed task steps survive interruptions. Leaving the station closes the modal; returning opens saved progress. Merely reconnecting does not invalidate saved steps or manufacture progress: the original HttpOnly seat recovers the owner's view. A running diagnostic may finish its server wait across a disconnect if no movement/meeting interrupts it; verification still requires returning to the station. Meetings, dead actors and terminal/paused phases reject steps.

The existing death policy remains: unfinished tasks transfer to living crew with IDs and totals intact. Confirmed stages transfer; any running diagnostic must restart. Former owners lose both permission and private task details. No ghost controls are added. Other players and spectators receive only task aggregates; the permitted owner's self.tasks includes challenge/progress. Task inputs enter only the existing bounded, end-locked attributed replay, never the public live timeline.

The local world controller uses the same semantic input helper as the engine, receiving only its own safe view. It waits for diagnostic time, submits one step per decision, and performs the existing completion action after the final stage. Legacy controller behavior is preserved. No provider call is involved.

The modal retains existing room/match/task ownership checks and disposal guards. Late resolutions or rejections cannot close or update replacement equipment. Snapshot updates advance controls only after authoritative progress; no local solved state grants completion. Native controls, focus trapping, Escape, touch, and the existing reduced-motion presentation remain available.

## Verification

See WORLD-TASKS-VERIFICATION.md for exact commands, results, limitations and retained screenshots. Earlier world documentation describes historical qualification and local-only puzzles; this document supersedes that task protocol description.
