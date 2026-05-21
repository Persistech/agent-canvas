# Backend Management Specs

---

### BM-001: Auto-switch on connect
- [x] Adding a backend shall automatically switch the active selection to it.

### BM-002: Switching backends keeps the user on the same page
- [x] Switching backends shall redirect to the same section but on the new backend. The user shall never see stale data from the previous backend.

### BM-003: Fallback on active backend removal
- [x] Removing the currently active backend shall fall back to a remaining local backend. The user shall never be left without an active backend.

### BM-004: Add a backend
- [x] The user shall be able to add a new backend (local or cloud) with host and API key.

### BM-005: Switch active backend
- [x] The user shall be able to switch the active backend from a list of registered backends.

### BM-006: Remove a backend
- [x] The user shall be able to remove a registered backend.

### BM-007: Default backend API key stays in sync with env
- [x] If the launcher rotates the session API key, the stored default backend shall pick up the new key on next page load.

### BM-008: Per-backend conversation memory
- [x] Switching back to a previously-used backend shall resume the last active conversation for that backend.