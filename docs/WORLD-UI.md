# World UI

World-first visual slice based on `d5eed65eb4737ceccab594c6dad911ff9033d2ba`. Original canvas raincoat keepers, illustrated storm-beacon floors and rooms, follow camera, safe-position-only actor interpolation, HUD, lobby host Start, role reveal, contextual controls and movement input are in `public/world/`. No assets, packages, HTTP, credentials, engine internals or runtime mutations are owned here.

Integration: link `/game.css`, import `createWorldExperience` from `/world/experience.mjs`, create once for the current room, and call `update(room,{now,connected,pending,feedback})` on safe snapshots/timer updates. Supply callbacks `{action(type,fields),input({seq,dx,dy}),start(),leave(),loadReplay()}`. Dispose before changing network ownership/rooms. The coordinator's `/shared/world.mjs` is required and imported directly; no duplicate world geometry is invented. Renderer static decorations are illustrative; server/shared geometry controls collisions.

This first commit is the requested early visible slice. Task puzzles, council, results/replay and qualification follow in the same assigned scope. No integrated backend/browser pass is claimed in this slice.
