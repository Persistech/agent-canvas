// -*- mode: Bluespec; -*-

module backend_management_current_tests {
  import backend_management.* from "./backend_management"
  import backend_management_current.* from "./backend_management_current"

  /// Expected counterexample for BM-003: active-store.ts picks the first
  /// remaining entry, so a cloud backend can win even while a local exists.
  run currentCodeCanBypassLocalFallbackTest =
    init
      .then(addBackendAction(CLOUD_A))
      .then(addBackendAction(LOCAL_B))
      .then(switchBackendAction(LOCAL_A))
      .then(removeBackendLikeCurrentAction(LOCAL_A))
      .expect(and {
        registry == [CLOUD_A, LOCAL_B],
        active == CLOUD_A,
        backendKinds.get(active) == Cloud,
        localRegistry(registry).length() == 1,
      })

  /// Expected counterexample for BM-003: removing the final registered backend
  /// resolves to the no-backend sentinel rather than rejecting the removal.
  run currentCodeCanReachNoBackendTest =
    init
      .then(removeBackendLikeCurrentAction(LOCAL_A))
      .expect(and {
        registry == [],
        active == NO_BACKEND,
        not(activeIsPresent),
      })
}
