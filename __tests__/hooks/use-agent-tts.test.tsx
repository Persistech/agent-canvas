import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import SettingsService from "#/api/settings-service/settings-service.api";
import { useAgentTts } from "#/hooks/use-agent-tts";
import { DEFAULT_SETTINGS } from "#/services/settings";
import { useEventStore } from "#/stores/use-event-store";
import { AgentState } from "#/types/agent-state";
import { SecurityRisk } from "#/types/agent-server/core";
import type { ActionEvent, MessageEvent as AgentMessageEvent } from "#/types/agent-server/core";

const audioInstances: MockAudio[] = [];

class MockAudio {
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  load = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  removeAttribute = vi.fn();
  currentTime = 0;
  volume = 1;
  loop = false;
  preload = "auto";
  src = "";

  constructor(src?: string) {
    if (src) {
      this.src = src;
    }
    audioInstances.push(this);
  }
}

class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  addEventListener = vi.fn();
  close = vi.fn();

  constructor(public url: string) {}
}

const mockActionEvent: ActionEvent = {
  id: "test-action-1",
  timestamp: Date.now().toString(),
  source: "agent",
  thought: [{ type: "text", text: "I need to execute a bash command" }],
  thinking_blocks: [],
  action: {
    kind: "ExecuteBashAction",
    command: "echo hello",
    is_input: false,
    timeout: null,
    reset: false,
  },
  tool_name: "execute_bash",
  tool_call_id: "call_123",
  tool_call: {
    id: "call_123",
    type: "function",
    function: {
      name: "execute_bash",
      arguments: '{"command": "echo hello"}',
    },
  },
  llm_response_id: "response_123",
  security_risk: SecurityRisk.UNKNOWN,
};

const mockAgentMessageEvent: AgentMessageEvent = {
  id: "test-agent-message-1",
  timestamp: Date.now().toString(),
  source: "agent",
  llm_message: {
    role: "assistant",
    content: [{ type: "text", text: "All done." }],
  },
  activated_microagents: [],
  extended_content: [],
};

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
};

describe("useAgentTts", () => {
  beforeEach(() => {
    audioInstances.length = 0;
    vi.stubEnv("VITE_TTS_ENDPOINT", "");
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(DEFAULT_SETTINGS);
    useEventStore.setState({
      events: [],
      eventIds: new Set(),
      uiEvents: [],
      loadedConversationId: null,
    });
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("renders without throwing when initialized", () => {
    const wrapper = createWrapper();
    const render = () =>
      renderHook(() => useAgentTts(AgentState.RUNNING), { wrapper });

    expect(render).not.toThrow();
  });

  it("plays cue and hold music when step TTS is queued", async () => {
    vi.stubEnv("VITE_TTS_ENDPOINT", "http://localhost:5002/tts");
    vi.mocked(SettingsService.getSettings).mockResolvedValue({
      ...DEFAULT_SETTINGS,
      enable_tts: true,
      enable_tts_steps: true,
      enable_tts_responses: false,
      enable_tts_hold_music: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    useEventStore.setState({
      events: [],
      eventIds: new Set(),
      uiEvents: [mockActionEvent],
      loadedConversationId: null,
    });

    const wrapper = createWrapper();
    renderHook(() => useAgentTts(AgentState.RUNNING), { wrapper });

    await waitFor(() => {
      const holdAudio = audioInstances.find((audio) => audio.loop);
      const cueAudio = audioInstances.find(
        (audio) => audio !== holdAudio && audio.src,
      );

      expect(holdAudio).toBeDefined();
      expect(cueAudio).toBeDefined();
      expect(holdAudio?.play).toHaveBeenCalled();
      expect(cueAudio?.play).toHaveBeenCalled();
    });
  });

  it("stops step TTS when the final response arrives", async () => {
    vi.stubEnv("VITE_TTS_ENDPOINT", "http://localhost:5002/tts");
    vi.mocked(SettingsService.getSettings).mockResolvedValue({
      ...DEFAULT_SETTINGS,
      enable_tts: true,
      enable_tts_steps: true,
      enable_tts_responses: true,
      enable_tts_hold_music: true,
    });
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    useEventStore.setState({
      events: [],
      eventIds: new Set(),
      uiEvents: [mockActionEvent],
      loadedConversationId: null,
    });

    const wrapper = createWrapper();
    const { rerender } = renderHook(
      ({ agentState }) => useAgentTts(agentState),
      {
        wrapper,
        initialProps: { agentState: AgentState.RUNNING },
      },
    );

    await waitFor(() => {
      expect(audioInstances.some((audio) => audio.loop)).toBe(true);
    });

    act(() => {
      useEventStore.setState({
        events: [],
        eventIds: new Set(),
        uiEvents: [mockActionEvent, mockAgentMessageEvent],
        loadedConversationId: null,
      });
    });

    rerender({ agentState: AgentState.AWAITING_USER_INPUT });

    await waitFor(() => {
      expect(abortSpy).toHaveBeenCalled();
    });
  });

});
