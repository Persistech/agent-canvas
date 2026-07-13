import type { SVGProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentStatus } from "#/components/features/controls/agent-status";
import { AgentState } from "#/types/agent-state";
import { ExecutionStatus } from "#/types/agent-server/core/base/common";
import type { WebSocketConnectionState } from "#/contexts/conversation-websocket-context";
import type { AppConversationStartTaskStatus } from "#/api/conversation-service/agent-server-conversation-service.types";
import { I18nKey } from "#/i18n/declaration";

const agentStatusMocks = vi.hoisted(() => ({
  useActiveConversation: vi.fn(),
  useAgentNotification: vi.fn(),
  useAgentState: vi.fn(),
  useConversationStore: vi.fn(),
  useSubConversationTaskPolling: vi.fn(),
  useTaskPolling: vi.fn(),
  useUnifiedWebSocketStatus: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: agentStatusMocks.useActiveConversation,
}));

vi.mock("#/hooks/use-agent-notification", () => ({
  useAgentNotification: agentStatusMocks.useAgentNotification,
}));

vi.mock("#/hooks/use-agent-state", () => ({
  useAgentState: agentStatusMocks.useAgentState,
}));

vi.mock("#/stores/conversation-store", () => ({
  useConversationStore: agentStatusMocks.useConversationStore,
}));

vi.mock("#/hooks/query/use-sub-conversation-task-polling", () => ({
  useSubConversationTaskPolling: agentStatusMocks.useSubConversationTaskPolling,
}));

vi.mock("#/hooks/query/use-task-polling", () => ({
  useTaskPolling: agentStatusMocks.useTaskPolling,
}));

vi.mock("#/hooks/use-unified-websocket-status", () => ({
  useUnifiedWebSocketStatus: agentStatusMocks.useUnifiedWebSocketStatus,
}));

vi.mock("#/icons/u-clock-three.svg?react", () => ({
  default: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="clock-icon" {...props} />
  ),
}));

interface AgentStatusScenario {
  agentState?: AgentState;
  className?: string;
  conversationId?: string | null;
  disabled?: boolean;
  executionStatus?: ExecutionStatus | null;
  isPausing?: boolean;
  subConversationTaskId?: string | null;
  subConversationTaskStatus?: AppConversationStartTaskStatus;
  taskStatus?: AppConversationStartTaskStatus;
  webSocketStatus?: WebSocketConnectionState;
}

function renderAgentStatus({
  agentState = AgentState.AWAITING_USER_CONFIRMATION,
  className,
  conversationId = "conversation-1",
  disabled,
  executionStatus = ExecutionStatus.WAITING_FOR_CONFIRMATION,
  isPausing,
  subConversationTaskId = "sub-task-1",
  subConversationTaskStatus,
  taskStatus,
  webSocketStatus = "OPEN",
}: AgentStatusScenario = {}) {
  const handleResumeAgent = vi.fn();
  const handleStop = vi.fn();
  const setShouldShownAgentLoading = vi.fn();

  agentStatusMocks.useActiveConversation.mockReturnValue({
    data: conversationId ? { id: conversationId } : undefined,
  });
  agentStatusMocks.useAgentState.mockReturnValue({
    curAgentState: agentState,
    executionStatus,
  });
  agentStatusMocks.useConversationStore.mockReturnValue({
    setShouldShownAgentLoading,
    subConversationTaskId,
  });
  agentStatusMocks.useSubConversationTaskPolling.mockReturnValue({
    taskStatus: subConversationTaskStatus,
  });
  agentStatusMocks.useTaskPolling.mockReturnValue({ taskStatus });
  agentStatusMocks.useUnifiedWebSocketStatus.mockReturnValue(webSocketStatus);

  const view = render(
    <AgentStatus
      className={className}
      disabled={disabled}
      handleResumeAgent={handleResumeAgent}
      handleStop={handleStop}
      isPausing={isPausing}
    />,
  );

  return {
    ...view,
    handleResumeAgent,
    handleStop,
    setShouldShownAgentLoading,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("AgentStatus", () => {
  it.each([
    {
      label: "the runtime is initializing",
      scenario: {
        agentState: AgentState.INIT,
        conversationId: null,
        executionStatus: null,
      },
    },
    {
      label: "the runtime is loading",
      scenario: {
        agentState: AgentState.LOADING,
        executionStatus: null,
      },
    },
    {
      label: "the websocket is connecting",
      scenario: { webSocketStatus: "CONNECTING" as const },
    },
    {
      label: "the parent conversation task is polling",
      scenario: { taskStatus: "WORKING" as const },
    },
    {
      label: "the sub-conversation task is polling",
      scenario: {
        subConversationTaskStatus: "WORKING" as const,
        taskStatus: "READY" as const,
      },
    },
  ])("shows loading while $label", ({ scenario }) => {
    const { setShouldShownAgentLoading } = renderAgentStatus(scenario);

    expect(screen.getByTestId("agent-loading-spinner")).toBeInTheDocument();
    expect(setShouldShownAgentLoading).toHaveBeenCalledWith(true);
  });

  it("shows local pause progress without reporting the agent as loading", () => {
    const { setShouldShownAgentLoading } = renderAgentStatus({
      isPausing: true,
    });

    expect(screen.getByTestId("agent-loading-spinner")).toBeInTheDocument();
    expect(setShouldShownAgentLoading).toHaveBeenCalledWith(false);
  });

  it("stops a running agent from an interactive status control", () => {
    const { handleStop, setShouldShownAgentLoading } = renderAgentStatus({
      agentState: AgentState.RUNNING,
      className: "custom-status-class",
      executionStatus: ExecutionStatus.RUNNING,
    });

    const label = screen.getByText(I18nKey.AGENT_STATUS$RUNNING_TASK);
    const stopButton = screen.getByTestId("stop-button");
    expect(label).toHaveAttribute("title", I18nKey.AGENT_STATUS$RUNNING_TASK);
    expect(label.parentElement).toHaveClass("custom-status-class");
    expect(stopButton.parentElement).toHaveClass("cursor-pointer");

    fireEvent.click(stopButton);

    expect(handleStop).toHaveBeenCalledTimes(1);
    expect(setShouldShownAgentLoading).toHaveBeenCalledWith(false);
  });

  it("resumes a stopped agent", () => {
    const { handleResumeAgent } = renderAgentStatus({
      agentState: AgentState.STOPPED,
      executionStatus: ExecutionStatus.PAUSED,
    });

    const playButton = screen.getByTestId("play-button");
    expect(playButton).toBeEnabled();
    expect(playButton.parentElement).toHaveClass("cursor-pointer");

    fireEvent.click(playButton);

    expect(handleResumeAgent).toHaveBeenCalledTimes(1);
  });

  it("keeps a paused agent disabled when resuming is unavailable", () => {
    const { handleResumeAgent } = renderAgentStatus({
      agentState: AgentState.PAUSED,
      disabled: true,
      executionStatus: ExecutionStatus.PAUSED,
    });

    const playButton = screen.getByTestId("play-button");
    expect(playButton).toBeDisabled();

    fireEvent.click(playButton);

    expect(handleResumeAgent).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "agent failure",
      scenario: {
        agentState: AgentState.ERROR,
        executionStatus: ExecutionStatus.ERROR,
      },
    },
    {
      label: "rate limiting",
      scenario: { agentState: AgentState.RATE_LIMITED },
    },
    {
      label: "a closed websocket",
      scenario: { webSocketStatus: "CLOSED" as const },
    },
    {
      label: "a failed conversation task",
      scenario: {
        taskStatus: "ERROR" as const,
        webSocketStatus: "CONNECTING" as const,
      },
    },
  ])("shows an error indicator for $label", ({ scenario }) => {
    renderAgentStatus(scenario);

    expect(screen.getByTestId("circle-error-icon")).toBeInTheDocument();
    expect(
      screen.queryByTestId("agent-loading-spinner"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("stop-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("play-button")).not.toBeInTheDocument();
  });

  it("shows a non-interactive waiting indicator for user confirmation", () => {
    renderAgentStatus();

    const clockIcon = screen.getByTestId("clock-icon");
    expect(
      screen.getByText(I18nKey.AGENT_STATUS$WAITING_FOR_USER_CONFIRMATION),
    ).toBeInTheDocument();
    expect(clockIcon.parentElement).toHaveClass("cursor-default");
  });

  it("fades and hides a finished status after its brief confirmation", () => {
    vi.useFakeTimers();
    const { container } = renderAgentStatus({
      agentState: AgentState.FINISHED,
      executionStatus: ExecutionStatus.FINISHED,
    });

    const label = screen.getByText(
      I18nKey.CHAT_INTERFACE$AGENT_FINISHED_MESSAGE,
    );
    const status = label.parentElement;
    expect(status).toHaveClass("transition-opacity", "duration-500");
    expect(status).not.toHaveClass("opacity-0");
    expect(container.querySelector(".lucide-circle-check")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(status).toHaveClass("opacity-0");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(
      screen.queryByText(I18nKey.CHAT_INTERFACE$AGENT_FINISHED_MESSAGE),
    ).not.toBeInTheDocument();
  });

  it("cancels a ready-status timeout when the status unmounts", () => {
    vi.useFakeTimers();
    const { container, unmount } = renderAgentStatus({
      agentState: AgentState.AWAITING_USER_INPUT,
      executionStatus: ExecutionStatus.IDLE,
    });

    expect(
      screen.getByText(I18nKey.AGENT_STATUS$WAITING_FOR_TASK),
    ).toBeInTheDocument();
    expect(container.querySelector(".lucide-circle-check")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(2);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
