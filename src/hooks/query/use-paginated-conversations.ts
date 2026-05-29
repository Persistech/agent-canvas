import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import { useIsAuthed } from "./use-is-authed";
import { useActiveBackend } from "#/contexts/active-backend-context";
import { AppConversationPage } from "#/api/conversation-service/agent-server-conversation-service.types";

export const usePaginatedConversations = (limit: number = 20) => {
  const { data: userIsAuthenticated } = useIsAuthed();
  const active = useActiveBackend();
  const isEnabled = !!userIsAuthenticated;

  // [DEBUG] Log when the conversations query is enabled/disabled.
  // Flipping to false (because userIsAuthenticated briefly becomes undefined
  // after a 401 triggers auth invalidation) is the mechanism behind the
  // "conversations disappear then reappear" bug on Docker restart.
  const prevEnabled = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevEnabled.current !== null && prevEnabled.current !== isEnabled) {
      console.debug(
        `[agent-canvas] usePaginatedConversations: enabled changed ${prevEnabled.current} → ${isEnabled}` +
          (isEnabled
            ? " (conversations query re-enabled)"
            : " (conversations query DISABLED — userIsAuthenticated is falsy; list will appear empty)"),
      );
    }
    prevEnabled.current = isEnabled;
  }, [isEnabled]);

  return useInfiniteQuery({
    // Include the active backend identity so each (backend, org) pair
    // maintains its own paginated cache. Switching backends naturally
    // produces a new query and a fresh fetch — without it the previous
    // backend's conversations stay visible for staleTime.
    queryKey: [
      "user",
      "conversations",
      "paginated",
      limit,
      active.backend.id,
      active.orgId,
    ],
    queryFn: async ({ pageParam }) => {
      try {
        const result = await AgentServerConversationService.searchConversations(
          limit,
          pageParam,
        );
        // [DEBUG] Log how many conversations came back and whether there are more pages.
        console.debug(
          `[agent-canvas] searchConversations (page: ${pageParam ?? "first"}, limit: ${limit}): ` +
            `received ${result.items.length} conversations, ` +
            `nextPageId: ${result.next_page_id ?? "none"}, ` +
            `backend: ${active.backend.id}`,
        );
        return result;
      } catch (err: unknown) {
        // [DEBUG] Log conversation fetch errors with enough detail to identify
        // auth failures (401 = stale session key) vs connectivity issues.
        const status =
          (err as { response?: { status?: number }; status?: number })
            ?.response?.status ??
          (err as { status?: number })?.status ??
          "unknown";
        console.warn(
          `[agent-canvas] searchConversations FAILED: HTTP ${status} for backend "${active.backend.id}"` +
            (status === 401
              ? " — session key is likely stale (Docker restart without mounted volume?)"
              : ""),
          err,
        );
        throw err;
      }
    },
    enabled: isEnabled,
    getNextPageParam: (lastPage: AppConversationPage) => lastPage.next_page_id,
    initialPageParam: undefined as string | undefined,
    // Poll every 10s so titles, execution status, and timestamps stay fresh
    // without requiring the user to refresh. Consumers must gate initial-load
    // UI (e.g. skeletons) on `isLoading`, not `isFetching` — `isFetching`
    // flips back to true on every background refetch, which would cause the
    // skeleton to flicker every 10s when the list is empty.
    refetchInterval: 10_000,
    // A successful fetch proves the backend is reachable. The global
    // QueryCache onSuccess handler reads this to clear any persisted
    // failure state, re-arming the status dot without user intervention.
    meta: { backendId: active.backend.id },
  });
};
