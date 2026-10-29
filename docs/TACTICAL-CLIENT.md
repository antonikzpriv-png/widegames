# Tactical client handoff

Assigned D:/Widegames-work/tactical-client-builder-20261029, codex/tactical-client-20261029, foundation265804446e37b8847d43b31875cf9f6ea3c81c33. Only public/world/**, tactical-client tests and this report are edited. Root/shared/maps/backend/other worktrees stay with their owners. No Chrome, provider calls, main/push/deploy.

## First working milestone

The scene, navigation, labels and public doors/vents/repairs/devices resolve the immutable map from getMap(game.map ?? room.map), retaining the original beacon as the legacy default. Each scene instance retains its own descriptor/geometry; shared/world.mjs is untouched. Equipment sessions and panel contexts include map identity. No global current-map state or invented Annex geometry is added.

The existing lobby contains one native map selector using server availableMaps/map/settingsRevision. Only callbacks.settings(mapId) proposes settings; root owns HTTP, auth, request IDs/revision and persistence. The display stays server-confirmed, start waits for pending settings, and non-host/offline/pending/unwired states cannot send changes. Current denials remain useful. Obsolete failures cannot modify another room, revision, phase, host or visible session. Existing lobbies without selection metadata keep their old flow.

node --test tests/tactical-client-ui.test.mjs: 10 passed, zero failures. These are actual imported UI/minimal DOM plus clearly labeled catalog-only fixtures, not backend/browser workflows. They verify settings pending/error/permission/ownership and immutable original-map compatibility. The registry at this foundation contains only beacon. Core supplies the actual Annex fixture; no alternate-layout qualification is claimed yet. Distinct Annex art, dated camera cards and explicit default-muted synthesized sound follow this early increment.

Root action: wire callbacks.settings to the authenticated settings endpoint. The selector explicitly reports when this callback is absent. Old VM tests that strip imports must inject getMap plus owned map-model/lobby-map dependencies (or load their actual modules). Their original assertions must remain intact; this worker will not edit those tests outside tactical-client ownership. Manager retains the exclusive Chrome lease and final real browser qualification.
