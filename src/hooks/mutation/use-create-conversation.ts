import { useMutation, useQueryClient } from "@tanstack/react-query";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import { PluginSpec } from "#/api/conversation-service/agent-server-conversation-service.types";
import { SuggestedTask } from "#/utils/types";
import { Provider, type SettingsValue } from "#/types/settings";
import { useTracking } from "#/hooks/use-tracking";

interface CreateConversationVariables {
  query?: string;
  repository?: {
    name: string;
    gitProvider: Provider;
    branch?: string;
  };
  suggestedTask?: SuggestedTask;
  conversationInstructions?: string;
  parentConversationId?: string;
  agentType?: "default" | "plan";
  plugins?: PluginSpec[];
  workingDir?: string;
  /**
   * Per-launch agent/model override (local only) — used by the picker's
   * "start a new conversation with X" fork so the new conversation runs a
   * different agent/model than the saved default, without persisting it.
   */
  agentSettingsOverride?: Record<string, SettingsValue>;
}

interface CreateConversationResponse {
  conversation_id: string;
  session_api_key: string | null;
  url: string | null;
  task_id?: string;
}

export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  const { trackConversationCreated } = useTracking();

  return useMutation({
    mutationKey: ["create-conversation"],
    mutationFn: async (
      variables: CreateConversationVariables,
    ): Promise<CreateConversationResponse> => {
      const {
        query,
        conversationInstructions,
        plugins,
        repository,
        workingDir,
        parentConversationId,
        agentType,
        agentSettingsOverride,
      } = variables;

      const metadata = repository
        ? {
            selected_repository: repository.name,
            selected_branch: repository.branch ?? null,
            git_provider: repository.gitProvider,
          }
        : null;

      // Dedupe the shared positional args while keeping the common-path call
      // shape unchanged (no trailing ``undefined`` slots), so existing
      // ``toHaveBeenCalledWith`` assertions across callers stay valid and a
      // future signature change only needs to be made in one place.
      const baseArgs = [
        query,
        conversationInstructions,
        plugins,
        metadata,
        workingDir,
        parentConversationId,
        agentType,
      ] as const;
      const conversation = agentSettingsOverride
        ? await AgentServerConversationService.createConversation(
            ...baseArgs,
            undefined, // sandboxId — cloud-only, unused on the local fork path
            agentSettingsOverride,
          )
        : await AgentServerConversationService.createConversation(...baseArgs);

      // OpenHands cloud pattern: when the start task isn't immediately
      // READY (cloud sandbox is still provisioning),
      // app_conversation_id is null. We return a `task-{id}` URL so the
      // conversation route's useTaskPolling can drive it to READY and
      // then redirect to the real `/conversations/{app_conversation_id}`.
      const conversationId = conversation.app_conversation_id
        ? conversation.app_conversation_id
        : `task-${conversation.id}`;

      return {
        conversation_id: conversationId,
        session_api_key: null,
        url: conversation.agent_server_url,
        task_id: conversation.id,
      };
    },
    onSuccess: async (_, { repository }) => {
      trackConversationCreated({
        hasRepository: !!repository,
      });

      // Invalidate (rather than remove) so the existing paginated list stays
      // rendered while a background refetch picks up the new conversation.
      // `removeQueries` would wipe the cache and force the panel back to its
      // initial loading state, dropping loaded pages and scroll position.
      queryClient.invalidateQueries({
        queryKey: ["user", "conversations"],
      });
      // The cloud path returns a start task (no app_conversation_id
      // yet); the sidebar surfaces those via `useStartTasks` which doesn't
      // poll, so invalidate it explicitly so the in-flight task shows up
      // in the conversation list immediately.
      queryClient.invalidateQueries({
        queryKey: ["start-tasks"],
      });
    },
  });
};
