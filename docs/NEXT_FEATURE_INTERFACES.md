# Tactical integration addendum

The existing executable feature services below are retained. [TACTICAL-INTERFACES.md](TACTICAL-INTERFACES.md) adds exact map-aware registrations and integrated examples for task progression, strategic navigation, roster/factions, death/abilities, UI panels and ended replay. Group2 branches were not merged at the recorded main90bb6e8 and are not prerequisites. Resolve geometry from each persisted map, never fixed six-room constants; do not replace existing task, planner, lobby, ability or replay services.

---

# Group 2 executable feature interfaces

Group1 starts from main90bb6e881f75f77e85b8b49729971a710b4c91b4. The entry points remain npm start -> server/main.mjs -> native HTTP/ws -> server/engine/index.mjs; browser entry is public/app.mjs -> public/world/experience.mjs. No donor server or additional stack is required. Model calls remain council-only and budgeted. All examples below are trusted packaged code, not dynamically loaded client/model scripts.

## Ownership and registration

| Builder | Reserved server directory | Reserved client directory |
| --- | --- | --- |
| Interactive tasks | server/features/tasks/ | public/features/tasks/ |
| Strategic intentions | server/features/strategy/ | public/features/strategy/ |
| Multiplayer lobbies | server/features/lobbies/ | public/features/lobbies/ |
| Ghost/death policies and optional abilities | server/features/abilities/ | public/features/abilities/ |
| Spatial replay and spectator tools | server/features/replay/ | public/features/replay/ |

Coordinator retains shared/**, root routing/configuration, schema/store/authentication, engine/index.mjs orchestration and public/features/panels.mjs. Group1 retains server/engine/world, systems and investigation plus public/world. Ask for shared action/schema registrations instead of editing another builder's module. Separate branches/worktrees from latest origin/main; preserve all history and old rooms. Do not merge/deploy without direction. Read AGENTS.md and BEACON-GROUP1-CONTRACT.md.

## Common authority and lifetime

createMatch({id,mode,world:true,systems:true,roster,saboteurCount,humanPlayerIds,beaconRules,config,now,seed}) creates schema3 with worldVersion1 and beaconVersion1. config contains existing base rules; beaconRules contains only keys from DEFAULT_BEACON_RULES. Production uses secure random role selection; explicit seed is a fixture only. Existing schema1 and2 saves remain on their original rules and runtime, without rewriting identities, accepted actions, spending reservations or replay IDs. Never infer new features merely from worldVersion; check beaconVersion.

applyAction(state,actorId,{id,type,...fields},now) is the only discrete authority. applyInput accepts only {seq,dx,dy}, using authenticated identity, not client actorId. Validated requests (including rule denials) are retained per actor up to2048; identical retries repeat their original result, different content under one ID rejects, and requests are never evicted into eligibility. Movement sequence receipts remain separate. Returned state is a new value; modules mutate only the orchestrator's private clone. Time is passed by server, never Date.now in rule modules. Public and private event permissions are distinct. The normal HTTP action route remains /api/rooms/:roomId/action with existing HttpOnly identity and origin/rate/body checks.

Root module context is {record(state,type,at,data),publicEvent(state,type,at,data),nearby(state,player,position,range?),sees(state,player,position),stop(state,player,at,reason),geometry}. Every range/visibility check must use these dynamic functions (doors, lights, secret transit and death matter). geometry is public static map data; raw distance/static LOS cannot authorize an interaction. Return {code,message} or null from validation; validate must not mutate. Root records the request before applying exactly once. No model may call a mutation directly.

## Tasks: server/features/tasks/index.mjs

Exports createTaskRegistry(definitions), relayTask and taskService. createTaskRegistry accepts unique definitions {id,validate(task,action,state,player,now,ctx),apply(task,action,state,player,now,ctx)} and returns frozen {validate,apply,progress,kinds}. Packaged taskService registers relayTask. Root calls it for actual task and taskInteract actions in beacon matches; no unused demonstration-only route exists.

The common service validates actor crew membership, ownership of taskId, unfinished status, authoritative station range/LOS and equipment cooldown before calling the registered validator. apply records private task_progress, updates the actual task and cooldown, and root runs real victory checks. progress(task) returns {kind,completed,progress,total}, presently relay progress0/1. Group2 can extend persistent per-task state and progress under a new compatible task version; add strict store validation with the coordinator.

Existing action: {id,type:'task',taskId}. Interactive action: {id,type:'taskInteract',taskId,interactionId,value}; all three fields are bounded strings. The baseline relay accepts interactionId:'confirm',value:'complete' only after common authorization. New tasks must validate meaningful interaction steps on the server rather than trusting a frontend solved flag. Example registration: createTaskRegistry([relayTask,{id:'dial',validate:(task,a)=>a.interactionId==='turn'&&a.value==='north'?null:{code:'INVALID_TASK_INPUT',message:'Wrong dial input.'},apply:task=>{task.completed=true;}}]). Register the packaged kind in taskService and assign task.kind during match creation through coordinator wiring. Do not accept arbitrary client task kinds/definitions.

public/features/tasks/index.mjs exports tasksPanelModel(room)->{tasks,total}; source is only own permitted tasks and aggregate totals. Existing puzzles remain in public/world/puzzles.mjs and submit actual validated task actions. Integrate Group2 equipment using the panel registry below.

## Strategy: server/features/strategy/index.mjs

Exports createGoalRegistry(definitions), localGoals, localNavigationIntent(view,target) and deviceFacts(view). deviceFacts whitelists at most three owner-permitted source samples for actual council dialogue/model input, retaining dates and limits without coordinates or guilt inference. Definitions are {id,select(view,memory)}; select returns the first non-null result plus goalId. localGoals registers repair and task goals and is called by actual server/ai/world.mjs for beacon bots. Goals contain target public infrastructure, optional systemId/siteId/taskId; they are proposals, not engine mutations. localNavigationIntent returns wait or navigate{x,y}; existing accepted path/visibility/range and movement rules are still authoritative. It suppresses duplicate route renewal and secret-transit actions.

Example: createGoalRegistry([{id:'check-radio',select:view=>view.systems.communications.active?{target:{x:930,y:230}}:null}]). Use only getPlayerView output and per-actor memory. No raw state access, opponent paths, hidden death list, model-per-frame calls or prompted personas as evidence. Distinguish device samples, local observations, eyewitnesses and dialogue claims. Additional goals can register around the baseline defaults; coordinate final candidate prioritization with server/ai. Existing calls/tokens/cost limits and uncertain reservations must remain unchanged.

public/features/strategy/index.mjs exports strategyPanelModel(room)->{self,navigation}; it contains only the viewer's destination. Do not show private model reasoning.

## Lobbies: server/features/lobbies/index.mjs

Exports PLAYER_ID, normalizeRoster(options), publicRoster(state), aiRoster(state). normalizeRoster({roster,mode,saboteurCount,humanPlayerIds,humanPlayerId}) returns {players,saboteurCount,humanPlayerIds}. A public keeper is {id,name,color,persona};4..12 unique bounded IDs/names, validated hex color, bounded public persona,1..3 saboteurs and an initial crew majority. No roles are in roster definitions. Human mode needs at least one explicit/default human; spectator mode has none. IDs need not be p1..p6. The literal IDs constructor, prototype and __proto__ are rejected; valid inherited-name strings such as toString remain legal and every per-actor lookup must use own-property checks. Engine state stores normalized configuration, and the room validates it on restore.

Example: createMatch({id:'fixture',world:true,systems:true,roster:Array.from({length:4},(_,i)=>({id:i?'keeper-'+i:'captain',name:'Keeper '+i,color:'#edb66c',persona:'Practical keeper'})),humanPlayerIds:['captain'],saboteurCount:1,now:1000,seed:'fixture'}). Tests also exercise two human IDs and eight keepers/two saboteurs. Production defaults stay six keepers/one human or all AI. Configured room creation stores version2 lobby metadata and binds host cookie to its configured human ID; scheduling uses actual non-human players. The current public join endpoint still grants spectators only. Group2 must implement explicit authorized seat allocation/start rules through the coordinator; it must not just trust a requested seatId. Multiple declared human slots do not automatically grant browser identities.

public/features/lobbies/index.mjs exports lobbiesPanelModel(room)->{roster,isHost}. Frontend roster comes from room.roster or game.players; never create fake six-seat state in the client. Preserve room IDs, cookie hashes, host identity, startId and accepted IDs when changing lobby schema.

## Death policies and abilities: server/features/abilities/index.mjs

Exports deathPolicies, deathPolicy(state), createAbilityRegistry(definitions), fieldNote, abilityService, getAbilityView(state,id). Current policy redistribute-at-muster disallows dead actions and redistributes unfinished tasks at the next meeting after deaths become public by roster muster. Schema1/2 retain immediate redistribution. Group2 may add a ghost policy with coordinator schema/motion/rules changes; dead actors cannot gain actions merely through frontend controls.

Ability definitions: {id,validate(state,p,action,now,ctx),apply(state,p,action,now,ctx),hints?(state,p,now,ctx)}. Registered ability action {id,type:'ability',abilityId,targetId} is dispatched through root ownership/idempotency/phase/death checks. Packaged field-note is a working baseline: abilityId:'field-note',targetId equal own ID; it records one's actual position/time privately, with5s cooldown and32-note bound. It grants no extra role. Wrong target, cooldown, dead/phase/transit or unknown ability rejects. Root supplies its actual interaction descriptor, and getAbilityView returns only own notes. Custom ability definitions are packaged trusted functions, never JSON/model code.

public/features/abilities/index.mjs exports abilitiesPanelModel(room)->{notes,actions}. Group2 can add optional roles/factions with explicit safe-view treatment, budgets and migration. Seeing an unusual action does not justify transmitting a role label.

## Replay/spectator: server/features/replay/index.mjs

Exports captureReplaySnapshot(state,at), getReplaySnapshots(state). Root uses them in real create/tick/action paths. Private snapshots are sampled at actual server time, at most every5s plus final ended state, capped256 while preserving the starting snapshot. Snapshot shape {version:1,at,phase,players:[{id,position,roomId,alive}],doors,lights,tasks:{completed,total}}. The existing replay ring retains at most12,000 records, so long/high-input matches can lose early event detail; snapshots are bounded samples, not frame-perfect history. Existing attributed replay records keep their IDs/times and include eventVersion1 for new beacon records; getReplay returns a chronological defensive copy only after ended. Public event shape remains {id,type,at,...safeData}. Never send pre-end global snapshots to spectator or AI.

After ended, authenticated GET /api/rooms/:id/replay adds snapshots alongside replay and roomId for beacon matches; pre-end returns409. The engine's getReplaySnapshots returns null before ended and a defensive copy afterward. Group2 should build spatial scrubbing from these real samples/events, retain timestamps/attribution and distinguish interpolation from observation. It must preserve spectator viewpoint/knowledge policies until the match ends.

public/features/replay/index.mjs exports replayPanelModel(room)->{ended,canLoad}. Ended access is still enforced server-side.

## UI panels and lifecycle

public/features/panels.mjs exports createPanelRegistry(host,{onError?}). register({id,node,update,dispose?}) appends a trusted panel and returns its unregister function. update(room,options) supplies update(room,{...options,signal,isCurrent}); dispose aborts, disposes registered panels and removes nodes. Every accepted update revokes the preceding asynchronous update signal/generation; hiding, unregister and disposal also revoke it. Keep update rendering cheap and local, and never launch a remote request every frame. Action handlers use the existing root request lifecycle and their own current relevant context. Panel callbacks must check isCurrent before rendering awaited results and use the existing root action callback for requests. Do not retain private views in localStorage. Do not append HTML from dialogue/model/source records.

Example: const panels=createPanelRegistry(host); panels.register({id:'task-progress',node,update:(room,{isCurrent})=>{if(isCurrent())node.textContent=tasksPanelModel(room).tasks.filter(t=>!t.completed).length+' tasks remain';}}); panels.update(room); panels.dispose(). The actual root world entry registers public/features/watch-panels.mjs, a nonvisual Watch summary that uses all five safe panel models without creating duplicate navigation. Regression tests exercise update cancellation, hidden views, unregister and disposal. This registry owns UI lifecycle, not permission or gameplay decisions.

## Observations and safe controls

New getPlayerView adds beaconVersion, vision, systems, investigation, abilities and interactions to the previous common view. An interaction descriptor is {id,type,fields,label,enabled,position?,roomId?,reason?}. It is a proposed action affordance for this actor only; submit exact type/fields with a fresh request ID via existing action callback. New action schemas are in shared/beacon.mjs; they reject extra fields. Disabled/absent actions cannot be inferred into authority. Metadata must not reveal an unseen target through enabled state.

Roster status is explicit unknown/alive/dead knowledge. Unseen entities' coordinates, routes, actual undiscovered deaths and private observations stay server-side. A fixed Bridge spectator viewpoint replaces omniscient observation before resolution. At meetings roster muster makes deaths public; vitals are dated samples only for the reader. Device readings remain per-actor bounded history and are not attacker eyewitness proof. Group1 rules document exact lights/comms/doors/critical/hatch/device deadlines and limits. Never expose raw state, configuration, identity hashes, requests, AI context, repairer identities or private device sessions in a public response.

## Executable checks and handoff

Begin Group2 after the Group1 PR is merged, or from an explicitly approved integration pin containing these modules. Do not assume the old main already exports them. Run npm test, npm run check, npm run test:browser and npm run test:beacon-browser; see BEACON-VERIFICATION.md for exact qualification pins and fixture limits. tests/beacon-integration.test.mjs exercises real registered tasks/abilities/goals, custom rosters/humans, actual action idempotency, council victory, replay snapshots and authenticated HTTP persistence/reconnect. Builder tests cover dynamic spatial knowledge, sabotage and terminal permissions. Negative/source controls require a full Git clone and preserved original branches. Do not make paid provider calls. Handoff is complete only after the integrated playable group1 runtime, current rules, screenshots and exact verification pins are recorded.
