import React from "react";
import { useAgentState } from "#/hooks/use-agent-state";
import { useTaskPolling } from "#/hooks/query/use-task-polling";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useUnifiedPauseConversation } from "#/hooks/mutation/use-unified-stop-conversation";
import { useUnifiedResumeConversation } from "#/hooks/mutation/use-unified-start-conversation";
import { useConversationId } from "#/hooks/use-conversation-id";
import { useUserProviders } from "#/hooks/use-user-providers";
import { getStatusColor } from "#/utils/utils";
import { AgentState } from "#/types/agent-state";
import DebugStackframeDot from "#/icons/debug-stackframe-dot.svg?react";
import { ServerStatusContextMenu } from "../controls/server-status-context-menu";
import { ConversationName } from "./conversation-name";
import { RightPanelToggle } from "./right-panel-toggle";
import { TakeOwnershipModal } from "./take-ownership-modal";
import { SessionLoadFailedBanner } from "./session-load-failed-banner";
import { categorizeResumeError } from "#/utils/resume-error";
import {
  isExecutionActive,
  isExecutionErrored,
  isExecutionPaused,
} from "#/utils/status";

export function ConversationNameWithStatus() {
  const { conversationId } = useConversationId();
  const { data: conversation } = useActiveConversation();
  const { curAgentState } = useAgentState();
  const { isTask, taskStatus } = useTaskPolling();
  const { mutate: pauseConversation } = useUnifiedPauseConversation();
  const { mutate: resumeConversation } = useUnifiedResumeConversation();
  const { providers } = useUserProviders();

  // Local state — co-located per #601 (no global slice). The modal opens
  // when a resume hits a 409 lease conflict; the banner shows when the
  // ACP subprocess's session/load failed but resume otherwise succeeded
  // from canvas's perspective (the agent runs with a fresh session and
  // canvas keeps its event history).
  const [showTakeOwnershipModal, setShowTakeOwnershipModal] =
    React.useState(false);
  const [showSessionLoadBanner, setShowSessionLoadBanner] =
    React.useState(false);

  const executionStatus = conversation?.execution_status ?? null;
  const isStartingStatus =
    curAgentState === AgentState.LOADING || curAgentState === AgentState.INIT;
  const isStopStatus = isExecutionErrored(executionStatus);

  const statusColor = getStatusColor({
    isPausing: false,
    isTask,
    taskStatus,
    isStartingStatus,
    isStopStatus,
    curAgentState,
  });

  const triggerResume = React.useCallback(() => {
    if (!conversationId) return;
    resumeConversation(
      { conversationId, providers },
      {
        onError: (error) => {
          const info = categorizeResumeError(error);
          if (info.kind === "lease_held") {
            setShowTakeOwnershipModal(true);
          } else if (info.kind === "session_load_failed") {
            setShowSessionLoadBanner(true);
          }
        },
      },
    );
  }, [conversationId, resumeConversation, providers]);

  const handleStopServer = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (conversationId) {
      pauseConversation({ conversationId });
    }
  };

  const handleStartServer = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    triggerResume();
  };

  return (
    <>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          <div className="group relative">
            <DebugStackframeDot
              className="ml-[3.5px] w-6 h-6 cursor-pointer"
              color={statusColor}
            />
            <ServerStatusContextMenu
              onClose={() => {}}
              onStopServer={
                isExecutionActive(executionStatus)
                  ? handleStopServer
                  : undefined
              }
              onStartServer={
                isExecutionPaused(executionStatus)
                  ? handleStartServer
                  : undefined
              }
              executionStatus={executionStatus}
              position="bottom"
              className="opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto bottom-full left-0 mt-0 min-h-fit"
              isPausing={false}
            />
          </div>
          <ConversationName />
        </div>
        <RightPanelToggle className="mr-2" />
      </div>

      {showSessionLoadBanner && (
        <div className="px-4 pt-2">
          <SessionLoadFailedBanner
            onDismiss={() => setShowSessionLoadBanner(false)}
          />
        </div>
      )}

      {showTakeOwnershipModal && (
        <TakeOwnershipModal
          onConfirm={() => {
            setShowTakeOwnershipModal(false);
            triggerResume();
          }}
          onCancel={() => setShowTakeOwnershipModal(false)}
        />
      )}
    </>
  );
}
