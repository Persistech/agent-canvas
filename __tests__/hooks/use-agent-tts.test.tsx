import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import SettingsService from "#/api/settings-service/settings-service.api";
import { useAgentTts } from "#/hooks/use-agent-tts";
import { DEFAULT_SETTINGS } from "#/services/settings";
import { useEventStore } from "#/stores/use-event-store";
import { AgentState } from "#/types/agent-state";

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

  constructor(public url: string) {}
}

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
});
