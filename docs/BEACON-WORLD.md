# Schema3 spatial world

Foundation a431e5e80fad153d9aab892a1e9e727ef11fc5a3, owned factory createSpatialWorld(geometry) in server/engine/world/index.mjs. Only schema3 orchestration should select it; legacy world-runtime.mjs and schema1/2 engine paths are untouched.

Early milestone: dynamic door collision/pathfinding, occluding props/doors, configurable vision (including over360), crew lights/saboteur vision, authoritative proximity, steering/navigation, transit observer/motion denial, deterministic distinct custom-roster spawns and JSON restoration. Six scoped geometry/motion tests pass. Projection is deliberately conservative while observation knowledge is implemented next; this is not the complete knowledge milestone.

Root must exclude transit targets when enumerating target actions/hints: point-only sees cannot reliably identify a target actor. Root must use state-aware sees/nearby and pass state as navigation's fourth argument. It must include system deadlines before movement and disable schema3 global elimination events/defer task transfer until muster. NEXT_FEATURE_INTERFACES.md is absent from this foundation; no reserved group2 directories are implemented.

Factory currently exposes initialize, settle, stop, stopAll, navigation, navigate, input, moving, walkable, station, bell, WORLD, point, sees, nearby, observe and projectWorld. initialize modifies only player spatial fields and state.spatial; coordinator retains schema selection. No providers, async work, clocks or per-match global caches. Door-aware BFS caches exist only during one pathfinding call.
