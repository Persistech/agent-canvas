// -*- mode: Bluespec; -*-

/// Executable model for specs/backend-management.md (BM-001..BM-003).
///
/// The registry is a List because the implementation persists an ordered
/// Backend[] and its fallback behavior depends on that order. The desired
/// BM-003 transition below deliberately prefers the first remaining local
/// backend; backend_management_current.qnt models the current first-entry
/// fallback and demonstrates the contract gap.
module backend_management {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. TYPES
  // ───────────────────────────────────────────────────────────────────────────

  type BackendId = str

  type BackendKind =
    | Local
    | Cloud

  type Section =
    | Home
    | Conversations
    | Automations
    | Settings

  type VisibleData =
    | NoData
    | DataFrom(BackendId)

  type State = {
    registry: List[BackendId],
    active: BackendId,
    section: Section,
    visibleData: VisibleData,
  }

  type TransitionResult = {
    success: bool,
    newState: State,
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. CONSTANTS
  // ───────────────────────────────────────────────────────────────────────────

  pure val LOCAL_A: BackendId = "local-a"
  pure val LOCAL_B: BackendId = "local-b"
  pure val CLOUD_A: BackendId = "cloud-a"
  pure val NO_BACKEND: BackendId = "no-backend"

  pure val BACKEND_IDS: Set[BackendId] = Set(LOCAL_A, LOCAL_B, CLOUD_A)
  pure val SECTIONS: Set[Section] =
    Set(Home, Conversations, Automations, Settings)

  /// Pre-populated for every ID so all map lookups are defined.
  pure val backendKinds: BackendId -> BackendKind = Map(
    LOCAL_A -> Local,
    LOCAL_B -> Local,
    CLOUD_A -> Cloud,
    NO_BACKEND -> Local,
  )

  // ───────────────────────────────────────────────────────────────────────────
  // 3. PURE FUNCTIONS
  // ───────────────────────────────────────────────────────────────────────────

  pure def registeredIds(registry: List[BackendId]): Set[BackendId] =
    registry.indices().map(i => registry[i])

  pure def localRegistry(registry: List[BackendId]): List[BackendId] =
    registry.select(id => backendKinds.get(id) == Local)

  pure def unchanged(state: State): TransitionResult =
    { success: false, newState: state }

  /// @spec BM-001 — append and immediately select the new backend.
  pure def pureAddBackend(state: State, id: BackendId): TransitionResult =
    if (not(BACKEND_IDS.contains(id)) or registeredIds(state.registry).contains(id)) {
      unchanged(state)
    } else {
      { success: true, newState: {
        ...state,
        registry: state.registry.append(id),
        active: id,
        visibleData: NoData,
      } }
    }

  /// @spec BM-002 — preserve the section and clear data from the old backend.
  pure def pureSwitchBackend(state: State, id: BackendId): TransitionResult =
    if (not(registeredIds(state.registry).contains(id)) or id == state.active) {
      unchanged(state)
    } else {
      { success: true, newState: {
        ...state,
        active: id,
        visibleData: NoData,
      } }
    }

  /// @spec BM-003 — removing the active backend must select a remaining local
  /// backend. If no local fallback exists, reject the removal so the UI is
  /// never left without an active backend.
  pure def pureRemoveBackend(state: State, id: BackendId): TransitionResult =
    if (not(registeredIds(state.registry).contains(id))) {
      unchanged(state)
    } else {
      val remaining = state.registry.select(existing => existing != id)
      if (id != state.active) {
        { success: true, newState: { ...state, registry: remaining } }
      } else {
        val localFallbacks = localRegistry(remaining)
        if (localFallbacks.length() == 0) {
          unchanged(state)
        } else {
          { success: true, newState: {
            ...state,
            registry: remaining,
            active: localFallbacks.head(),
            visibleData: NoData,
          } }
        }
      }
    }

  pure def pureSetSection(state: State, nextSection: Section): TransitionResult =
    if (state.section == nextSection) {
      unchanged(state)
    } else {
      { success: true, newState: { ...state, section: nextSection } }
    }

  pure def pureLoadActiveData(state: State): TransitionResult =
    if (not(registeredIds(state.registry).contains(state.active))) {
      unchanged(state)
    } else {
      { success: true, newState: {
        ...state,
        visibleData: DataFrom(state.active),
      } }
    }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. STATE VARIABLES
  // ───────────────────────────────────────────────────────────────────────────

  var registry: List[BackendId]
  var active: BackendId
  var section: Section
  var visibleData: VisibleData

  val currentState: State = {
    registry: registry,
    active: active,
    section: section,
    visibleData: visibleData,
  }

  val registered: Set[BackendId] = registeredIds(registry)

  // ───────────────────────────────────────────────────────────────────────────
  // 5. INVARIANTS
  // ───────────────────────────────────────────────────────────────────────────

  val registryContainsKnownUniqueIds: bool = and {
    registered.subseteq(BACKEND_IDS),
    registered.size() == registry.length(),
  }

  val activeIsPresent: bool = active != NO_BACKEND

  val activeIsRegistered: bool = registered.contains(active)

  /// @spec BM-002 — rendered backend data is empty during a switch or belongs
  /// to the currently selected backend; stale data is never exposed.
  val visibleDataMatchesActive: bool = match visibleData {
    | NoData => true
    | DataFrom(owner) => owner == active and registered.contains(owner)
  }

  val allSafetyProperties: bool = and {
    registryContainsKnownUniqueIds,
    activeIsPresent,
    activeIsRegistered,
    visibleDataMatchesActive,
  }

  temporal safetyAlwaysHolds = always(allSafetyProperties)

  // ───────────────────────────────────────────────────────────────────────────
  // 6. THIN ACTIONS
  // ───────────────────────────────────────────────────────────────────────────

  action applyTransition(result: TransitionResult): bool = all {
    result.success,
    registry' = result.newState.registry,
    active' = result.newState.active,
    section' = result.newState.section,
    visibleData' = result.newState.visibleData,
  }

  action addBackendAction(id: BackendId): bool =
    applyTransition(pureAddBackend(currentState, id))

  action switchBackendAction(id: BackendId): bool =
    applyTransition(pureSwitchBackend(currentState, id))

  action removeBackendAction(id: BackendId): bool =
    applyTransition(pureRemoveBackend(currentState, id))

  action setSectionAction(nextSection: Section): bool =
    applyTransition(pureSetSection(currentState, nextSection))

  action loadActiveDataAction: bool =
    applyTransition(pureLoadActiveData(currentState))

  // ───────────────────────────────────────────────────────────────────────────
  // 7. INITIALIZATION
  // ───────────────────────────────────────────────────────────────────────────

  action init = all {
    registry' = [LOCAL_A],
    active' = LOCAL_A,
    section' = Home,
    visibleData' = NoData,
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 8. NONDETERMINISTIC EXPLORATION
  // ───────────────────────────────────────────────────────────────────────────

  action step = any {
    nondet id = BACKEND_IDS.oneOf()
    any {
      addBackendAction(id),
      switchBackendAction(id),
      removeBackendAction(id),
    },

    nondet nextSection = SECTIONS.oneOf()
    setSectionAction(nextSection),

    loadActiveDataAction,
  }
}
