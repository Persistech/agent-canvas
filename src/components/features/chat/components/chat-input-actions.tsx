import { AgentStatus } from "#/components/features/controls/agent-status";
import { Tools } from "../../controls/tools";
import { useUnifiedPauseConversation } from "#/hooks/mutation/use-unified-stop-conversation";
import { useConversationId } from "#/hooks/use-conversation-id";
import { usePauseConversation } from "#/hooks/mutation/use-pause-conversation";
import { useResumeConversation } from "#/hooks/mutation/use-resume-conversation";

interface ChatInputActionsProps {
  disabled: boolean;
}

export function ChatInputActions({ disabled }: ChatInputActionsProps) {
  const unifiedPauseMutation = useUnifiedPauseConversation();
  const pauseConversationMutation = usePauseConversation();
  const resumeConversationMutation = useResumeConversation();
  const { conversationId } = useConversationId();

  const handlePauseAgent = () => {
    // Pause the conversation (agent execution)
    pauseConversationMutation.mutate({ conversationId });
  };

  const handleResumeAgentClick = () => {
    // Resume the conversation (agent execution)
    resumeConversationMutation.mutate({ conversationId });
  };

  const isPausing =
    unifiedPauseMutation.isPending || pauseConversationMutation.isPending;

  return (
    <div className="w-full flex items-center justify-between">
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-4">
          <Tools />
        </div>
      </div>
      <AgentStatus
        className="ml-2 md:ml-3"
        handleStop={handlePauseAgent}
        handleResumeAgent={handleResumeAgentClick}
        disabled={disabled}
        isPausing={isPausing}
      />
    </div>
  );
}
