# Backend Management Specs

---

### BM-001: Auto-switch on connect

- [x] Adding a backend shall automatically switch the active selection to it.

### BM-002: Switching backends keeps the user on the same page

- [x] Switching backends shall redirect to the same section but on the new backend. The user shall never see stale data from the previous backend.

### BM-003: Fallback on active backend removal

- [ ] Removing the currently active backend shall fall back to a remaining local backend. The user shall never be left without an active backend.

The executable Quint model and current-implementation counterexamples live in
[`quint/`](./quint/README.md). The model currently identifies two BM-003 gaps;
see the pending entries in [`quint/CHANGELOG.md`](./quint/CHANGELOG.md).
