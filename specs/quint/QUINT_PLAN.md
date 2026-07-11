# Quint specification plan: Agent Canvas

## System boundary

Agent Canvas is a frontend coordinator for multiple Local and Cloud agent
backends. The formal-modeling target is not React itself; it is the state and
ownership protocol underneath user-visible transitions where asynchronous work
or persisted state can create races.

## Milestone 1 — Backend management (implemented)

Requirements: BM-001, BM-002, and BM-003 from
[`../backend-management.md`](../backend-management.md).

“Implemented” means the desired and current-code models are executable, not
that the application satisfies every modeled requirement. Current application
discrepancies are tracked in [`CHANGELOG.md`](./CHANGELOG.md).

- [x] Preserve ordered backend registration.
- [x] Add a backend and select it atomically.
- [x] Switch the active backend without changing the UI section.
- [x] Clear old backend data on add/switch/fallback.
- [x] Load visible data only for the active backend.
- [x] Remove inactive backends without disturbing the selection.
- [x] Prefer a remaining Local backend when the active backend is removed.
- [x] Reject removal when no valid Local fallback exists.
- [x] Check state invariants through randomized simulation.
- [x] Encode current-code counterexample witnesses separately.

Finite bounds:

- Backends: `local-a`, `local-b`, `cloud-a`
- Sections: Home, Conversations, Automations, Settings
- Visible data: absent or owned by one backend

These bounds cover every relevant equivalence class for the modeled rules.

## Milestone 2 — Backend health and stale probe settlement (proposed)

- [ ] Model the five-failure disable cap.
- [ ] Model success and host/API-key edits resetting health.
- [ ] Preserve disabled state across cosmetic renames.
- [ ] Drop health state when a backend is removed.
- [ ] Model probe generations so late results cannot recreate deleted health or
      poison a newly edited backend configuration.

Relevant implementation:

- `src/api/backend-registry/health-store.ts`
- `src/api/backend-registry/health-storage.ts`
- `src/hooks/query/use-backends-health.ts`

## Milestone 3 — Conversation creation affinity (proposed)

- [ ] Capture the initiating `(backendId, orgId)` selection.
- [ ] Allow selection switches at each asynchronous profile/settings boundary.
- [ ] Require profiles, settings, secrets, request target, and resulting
      conversation ownership to agree with the captured selection.
- [ ] Prevent completion of an old request from navigating into a conversation
      owned by a backend the user has since left.

Relevant implementation:

- `src/hooks/mutation/use-create-conversation.ts`
- `src/api/conversation-service/agent-server-conversation-service.api.ts`
- `src/api/settings-service/settings-service.api.ts`

## Scope exclusions

- Component layout, CSS, animation, and accessibility rendering
- URL parsing and arbitrary string manipulation
- Backend API internals implemented in external Python repositories
- LLM behavior, tool execution, and sandbox internals
- Performance and network latency distributions

Those concerns are either outside Agent Canvas's ownership or better covered by
unit, integration, and browser tests.
