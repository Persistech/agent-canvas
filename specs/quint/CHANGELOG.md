# Spec Changelog

This is the research log for the executable Quint specifications. It records
open implementation discrepancies first, followed by dated model changes and
fixes verified by the specifications. Product release notes continue to live in
GitHub Releases.

When a pending item is resolved, remove it from `Pending` and add a new dated
entry above the older entries. Link the requirement, implementation change, and
Quint/TypeScript evidence that verifies the resolution.

## Pending

### BM-003/F1 — Ordered fallback may select Cloud while Local remains

BM-003 requires removal of the active backend to prefer a remaining Local
backend. The current resolver uses the first remaining array entry regardless
of kind:

```text
registry = [local-a, cloud-a, local-b]
active   = local-a
remove(local-a)
result   = active cloud-a, while local-b remains
```

Executable witness:
[`currentCodeCanBypassLocalFallbackTest`](./backend_management_current_tests.qnt).

Implementation source: `pickFallbackBackend` in
[`active-store.ts`](../../src/api/backend-registry/active-store.ts).

Resolution requires the implementation to prefer the first remaining Local
backend, a TypeScript regression scenario with Cloud ordered before Local, and
the current-code witness becoming unreachable.

### BM-003/F2 — Resolve the final-backend removal contract

BM-003 and the desired Quint model reject removal of the final backend because
the user must never be left without an active backend. The product code and an
existing TypeScript test intentionally allow the deletion, after which snapshot
resolution returns the `NO_BACKEND` sentinel. A product/spec decision is
required; this is not yet classified as an implementation defect.

Executable witness:
[`currentCodeCanReachNoBackendTest`](./backend_management_current_tests.qnt).
Existing TypeScript behavior:
[`active-backend-context.test.tsx`](../../__tests__/contexts/active-backend-context.test.tsx).

Resolution must either block final deletion and update the TypeScript test, or
amend BM-003 and the desired Quint model to permit `NO_BACKEND` explicitly.

### Quint milestones 2–3 not yet modeled

The following behaviors are tracked in `QUINT_PLAN.md` but do not yet have
executable specification coverage:

- **Milestone 2** — backend health and stale probe settlement
- **Milestone 3** — conversation creation affinity across asynchronous
  selection changes

---

## 2026-07-11 — Backend-management model added; two BM-003 discrepancies found

Added the bounded backend-management state machine for BM-001 through BM-003,
six deterministic desired-behavior scenarios, two current-code counterexample
witnesses, the `allSafetyProperties` simulation invariant, and targeted
[mutation evidence](./MUTATION_REPORT.md). The desired scenarios passed while
the current-code witnesses exposed the two pending BM-003 discrepancies above.
No application fix is verified by this entry.
