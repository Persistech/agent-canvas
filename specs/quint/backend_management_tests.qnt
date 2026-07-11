// -*- mode: Bluespec; -*-

module backend_management_tests {
  import backend_management.* from "./backend_management"

  /// @spec BM-001 — Adding a backend selects it immediately while preserving
  /// the current section and clearing data owned by the previous backend.
  run bm001AddAutoSwitchTest =
    init
      .then(setSectionAction(Settings))
      .then(loadActiveDataAction)
      .then(addBackendAction(CLOUD_A))
      .expect(and {
        registered.contains(CLOUD_A),
        active == CLOUD_A,
        section == Settings,
        visibleData == NoData,
      })

  /// @spec BM-002 — Switching backend keeps the section, but stale data must
  /// disappear until the new backend's query resolves.
  run bm002SwitchPreservesSectionAndClearsStaleDataTest =
    init
      .then(addBackendAction(CLOUD_A))
      .then(setSectionAction(Conversations))
      .then(loadActiveDataAction)
      .expect(visibleData == DataFrom(CLOUD_A))
      .then(switchBackendAction(LOCAL_A))
      .expect(and {
        active == LOCAL_A,
        section == Conversations,
        visibleData == NoData,
        visibleDataMatchesActive,
      })

  /// @spec BM-002 — Data loaded after a switch belongs to the selected backend.
  run bm002ReloadUsesNewBackendTest =
    init
      .then(addBackendAction(CLOUD_A))
      .then(switchBackendAction(LOCAL_A))
      .then(loadActiveDataAction)
      .expect(and {
        visibleData == DataFrom(LOCAL_A),
        visibleDataMatchesActive,
      })

  /// @spec BM-003 — Removing the active backend chooses a remaining local
  /// backend, even when a cloud backend is also registered.
  run bm003ActiveRemovalUsesLocalFallbackTest =
    init
      .then(addBackendAction(LOCAL_B))
      .then(addBackendAction(CLOUD_A))
      .then(switchBackendAction(LOCAL_B))
      .then(removeBackendAction(LOCAL_B))
      .expect(and {
        not(registered.contains(LOCAL_B)),
        active == LOCAL_A,
        backendKinds.get(active) == Local,
        activeIsRegistered,
      })

  /// @spec BM-003 — The last local backend cannot be removed when that would
  /// leave the application without an active backend.
  run bm003LastActiveBackendRemovalFailsTest =
    init
      .then(removeBackendAction(LOCAL_A))
      .fail()

  /// Removing an inactive backend does not disturb the current selection.
  run inactiveRemovalPreservesSelectionTest =
    init
      .then(addBackendAction(CLOUD_A))
      .then(removeBackendAction(LOCAL_A))
      .expect(and {
        registered == Set(CLOUD_A),
        active == CLOUD_A,
        activeIsRegistered,
      })
}
