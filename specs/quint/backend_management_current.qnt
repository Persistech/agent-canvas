// -*- mode: Bluespec; -*-

/// Analysis model for the current fallback in
/// src/api/backend-registry/active-store.ts::pickFallbackBackend.
///
/// This module intentionally retains the first remaining backend regardless of
/// kind and permits the registry to become empty. Its tests are reachability
/// witnesses for the two BM-003 contract gaps; they are not desired behavior.
module backend_management_current {
  import backend_management.* from "./backend_management"

  pure def pureRemoveBackendLikeCurrent(
    state: State,
    id: BackendId
  ): TransitionResult =
    if (not(registeredIds(state.registry).contains(id))) {
      unchanged(state)
    } else {
      val remaining = state.registry.select(existing => existing != id)
      if (id != state.active) {
        { success: true, newState: { ...state, registry: remaining } }
      } else {
        val fallback =
          if (remaining.length() == 0) NO_BACKEND else remaining.head()
        { success: true, newState: {
          ...state,
          registry: remaining,
          active: fallback,
          visibleData: NoData,
        } }
      }
    }

  action removeBackendLikeCurrentAction(id: BackendId): bool =
    applyTransition(pureRemoveBackendLikeCurrent(currentState, id))

  /// Explore the actual first-entry/no-backend fallback alongside the other
  /// backend-management transitions. Running with activeIsPresent is expected
  /// to find a violation; that violation proves the no-backend state is reachable.
  action currentStep = any {
    nondet id = BACKEND_IDS.oneOf()
    any {
      addBackendAction(id),
      switchBackendAction(id),
      removeBackendLikeCurrentAction(id),
    },

    nondet nextSection = SECTIONS.oneOf()
    setSectionAction(nextSection),

    loadActiveDataAction,
  }
}
