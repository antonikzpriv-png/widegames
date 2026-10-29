# Implementation map

| Area | Integrated implementation | Contract / boundary |
| --- | --- | --- |
| Foundation, integration and launch | `shared/contracts.mjs`, `server/config.mjs`, `server/main.mjs`, `server/static.mjs`, root scripts/CI/Docker/docs | Node ESM/native HTTP, ws, plain browser modules; bounded server-only configuration and CSP/static allowlist |
| Authoritative engine | `server/engine/index.mjs` | Pure create/apply/tick, private/public views, ended-only replay; every human/model action is revalidated |
| AI players | `server/ai/{index,demo,anthropic}.mjs` | Six personas and separate memory; deterministic deck actions, optional model council; every paid attempt awaits durable reservation |
| Rooms and persistence | `server/{rooms,store,transport,budget}.mjs` | Per-room cookie identity, host start permission, serialized state, filtered HTTP/WS, atomic checkpoints and exclusive writer ownership |
| Browser | `public/{app,api,ui,panels,presentation}.mjs`, HTML/CSS/SVG | Create/play/watch, private assignment, map/tasks, council/voting, results/replay, abort/reconnect and responsive accessible controls |

The root contract was committed in the runnable foundation before four builders began on separate D: branches/worktrees. Engine, AI, frontend and rooms milestones were inspected and integrated throughout. The coordinator implemented the foundation, global budget, static boundaries, deployment, lifecycle integration fixes and complete browser qualification. Cross-owner reviews then qualified privacy, model budget, terminal cancellation and process ownership. Work remains saved on all five branches; no worker's worktree was edited by the coordinator.

Clients and models propose action envelopes. Room identity selects the actor; the engine decides legality and victory; storage commits before acknowledgment; the engine constructs each recipient's view. AI receives exactly its own permitted view and public character profile, never the hidden match object. The optional provider returns a choice from bounded actions and public speech, not arbitrary code, state or a winner. Browser traffic never includes private memories or keys. Spectators gain roles only after the engine ends the match.

The data directory is private local server state, not a browser asset directory. Normal restart retains seat hashes, accepted/denied action identities, deadlines and conservative model reservations. A single writer owns both room snapshots and the canonical daily budget. Inactive matches abort pending AI while preserving uncertain spend. Public hosting is a one-process deployment; scaling across replicas requires a different transactional store rather than sharing these files.
