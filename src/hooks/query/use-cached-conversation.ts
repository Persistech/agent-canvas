import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  AppConversation,
  AppConversationPage,
} from "#/api/conversation-service/agent-server-conversation-service.types";
import { useActiveBackend } from "#/contexts/active-backend-context";

interface InfiniteQueryData {
  pages?: AppConversationPage[];
}

/**
 * Returns a conversation from the React Query cache if available.
 * This is useful for getting immediate access to conversation metadata
 * that was already fetched as part of the paginated conversation list,
 * without triggering an additional API call.
 *
 * Returns undefined if the conversation is not in the cache.
 */
export function useCachedConversation(
  conversationId: string | null | undefined,
): AppConversation | undefined {
  const queryClient = useQueryClient();
  const active = useActiveBackend();

  return useMemo(() => {
    if (!conversationId) return undefined;

    // Try to find the conversation in any paginated conversations cache.
    // Use getQueriesData with a partial key match to find the cache regardless
    // of what limit parameter was used when fetching.
    const paginatedQueries = queryClient.getQueriesData<InfiniteQueryData>({
      queryKey: ["user", "conversations", "paginated"],
    });

    for (const [, data] of paginatedQueries) {
      if (data?.pages) {
        for (const page of data.pages) {
          const found = page.items?.find((c) => c.id === conversationId);
          if (found) {
            return found;
          }
        }
      }
    }

    // Also check the single conversation cache (from useUserConversation)
    const singleData = queryClient.getQueryData<AppConversation | null>([
      "user",
      "conversation",
      conversationId,
      active.backend.id,
      active.orgId,
    ]);

    return singleData ?? undefined;
  }, [conversationId, queryClient, active.backend.id, active.orgId]);
}
