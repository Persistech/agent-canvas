import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import SettingsService from "#/api/settings-service/settings-service.api";
import { AgentStatus } from "#/components/features/controls/agent-status";
import { AgentState } from "#/types/agent-state";
import { useAgentState } from "#/hooks/use-agent-state";
import { DEFAULT_SETTINGS } from "#/services/settings";
import { useConversationStore } from "#/stores/conversation-store";
import { useEventStore } from "#/stores/use-event-store";

vi.mock("#/hooks/use-agent-state");

vi.mock("#/hooks/use-conversation-id", () => ({
  useConversationId: () => ({ conversationId: "test-id" }),
  useOptionalConversationId: () => ({ conversationId: "test-id" }),
}));

const eventSourceSpy = vi.fn();

class MockAudio {
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  currentTime = 0;
  volume = 1;
  loop = false;
  preload = "auto";
  src = "";
}

class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  addEventListener = vi.fn();
  close = vi.fn();

  constructor(public url: string) {
    eventSourceSpy(url);
  }
}

beforeEach(() => {
  vi.spyOn(SettingsService, "getSettings").mockResolvedValue(DEFAULT_SETTINGS);
  useEventStore.setState({
    events: [],
    eventIds: new Set(),
    uiEvents: [],
    loadedConversationId: null,
  });
  eventSourceSpy.mockClear();
  vi.stubGlobal("Audio", MockAudio);
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  </MemoryRouter>
);

const renderAgentStatus = ({
  isPausing = false,
}: { isPausing?: boolean } = {}) =>
  render(
    <AgentStatus
      handleStop={vi.fn()}
      handleResumeAgent={vi.fn()}
      isPausing={isPausing}
    />,
    { wrapper },
  );

describe("AgentStatus - isLoading logic", () => {
  it("should show loading when curAgentState is INIT", () => {
    vi.mocked(useAgentState).mockReturnValue({
      curAgentState: AgentState.INIT,
    });

    renderAgentStatus();

    expect(screen.getByTestId("agent-loading-spinner")).toBeInTheDocument();
  });

  it("should show loading when isPausing is true, even if shouldShownAgentLoading is false", () => {
    vi.mocked(useAgentState).mockReturnValue({
      curAgentState: AgentState.AWAITING_USER_INPUT,
    });

    renderAgentStatus({ isPausing: true });

    expect(screen.getByTestId("agent-loading-spinner")).toBeInTheDocument();
  });

  it("should NOT update global shouldShownAgentLoading when only isPausing is true", () => {
    vi.mocked(useAgentState).mockReturnValue({
      curAgentState: AgentState.AWAITING_USER_INPUT,
    });

    renderAgentStatus({ isPausing: true });

    // Loading spinner shows (because isPausing)
    expect(screen.getByTestId("agent-loading-spinner")).toBeInTheDocument();

    // But global state should be false (because shouldShownAgentLoading is false)
    const { shouldShownAgentLoading } = useConversationStore.getState();
    expect(shouldShownAgentLoading).toBe(false);
  });
});


describe("AgentStatus - TTS integration", () => {
  it("subscribes to the TTS control stream", async () => {
    vi.mocked(useAgentState).mockReturnValue({
      curAgentState: AgentState.RUNNING,
    });

    renderAgentStatus();

    await waitFor(() => {
      expect(eventSourceSpy).toHaveBeenCalledWith("/tts-control/stream");
    });
  });
});

