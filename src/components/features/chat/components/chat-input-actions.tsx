import { AgentStatus } from "#/components/features/controls/agent-status";
import { Tools } from "../../controls/tools";
import { ChangeAgentButton } from "../change-agent-button";
import { ChatInputModel } from "./chat-input-model";
import { SwitchProfileButton } from "../switch-profile-button";
import { useUnifiedPauseConversation } from "#/hooks/mutation/use-unified-stop-conversation";
import { useConversationId } from "#/hooks/use-conversation-id";
import { usePauseConversation } from "#/hooks/mutation/use-pause-conversation";
import { useResumeConversation } from "#/hooks/mutation/use-resume-conversation";
import { useActiveBackend } from "#/contexts/active-backend-context";

interface ChatInputActionsProps {
  disabled: boolean;
}

export function ChatInputActions({ disabled }: ChatInputActionsProps) {
  const unifiedPauseMutation = useUnifiedPauseConversation();
  const pauseConversationMutation = usePauseConversation();
  const resumeConversationMutation = useResumeConversation();
  const { conversationId } = useConversationId();
  const isCloud = useActiveBackend().backend.kind === "cloud";

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
          {/* Local backends use the LLM profiles system, so render the
              clickable switcher in place of the read-only model badge.
              Cloud backends don't have profiles — keep the badge. */}
          {isCloud ? <ChatInputModel /> : <SwitchProfileButton />}
          {isCloud && <ChangeAgentButton />}
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
