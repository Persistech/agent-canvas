import { useMutation, useQueryClient } from "@tanstack/react-query";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";

interface SwitchLlmProfileVars {
  conversationId: string;
  profileName: string;
}

export const useSwitchLlmProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, profileName }: SwitchLlmProfileVars) =>
      AgentServerConversationService.switchProfile(conversationId, profileName),
    onSuccess: (_data, { conversationId }) => {
      // Refetch the conversation so the chat header (and anything else
      // reading `conversation.llm_model`) picks up the new model. The
      // backend persisted it as part of the switch.
      queryClient.invalidateQueries({
        queryKey: ["user", "conversation", conversationId],
      });
    },
    meta: { disableToast: true },
  });
};
