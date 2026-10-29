# World milestone integration notes

The coordinator inspected and integrated the early engine, transport, AI and renderer milestones. The first combined34-test run passed33 and failed one stale AI fixture: it asserted that WORLD_BELL was inside solid furniture. The foundation moved the usable bell point outside that collider so AI can reach it. The behavior checks (reachable approach and legal meeting) still matter; the obsolete solid-prop assertion needs updating in the AI owner's final commit.

The renderer produces normalized analogue directions for diagonal keys, touch and click paths; the input endpoint deliberately accepts only integer axes. The coordinator's world-input-envelope adapter validates and quantizes the local vector into eight directions before HTTP. The engine alone normalizes diagonal speed and validates movement. This keeps analogue UI details outside the authoritative wire contract. Browser verification must include diagonal/touch paths, not only horizontal key presses.

Network readiness now distinguishes usable authenticated HTTP polling from WebSocket status. The world remains playable through healthy HTTP fallback; actual connection failures disable input until a successful resynchronization.

Pending integration checks: all real generated task labels currently contain "relay", so the renderer's label-only taskKind rule may select only the wiring puzzle. Verify that the final normal workflow reaches all three puzzle types. Full browser qualification must cover phase transitions, root session cancellation, stale task completion, role reveal, both complete world match modes, and reconnect with old schema1 room compatibility. Early milestones are not a finished qualification receipt.
