import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AcpModelContext } from "#/hooks/use-acp-model-context";

const useActiveConversationMock = vi.fn();
const useSettingsMock = vi.fn();
const useLlmProfilesMock = vi.fn();
const useActiveBackendMock = vi.fn();
const useAcpModelContextMock = vi.fn();
const useOptionalConversationIdMock = vi.fn();

// Mutable zustand state holders (hoisted so the vi.mock factories can read them).
const stores = vi.hoisted(() => ({
  events: [] as unknown[],
  activeProfileByConversation: {} as Record<string, string>,
}));

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => useActiveConversationMock(),
}));
vi.mock("#/hooks/query/use-settings", () => ({
  useSettings: () => useSettingsMock(),
}));
vi.mock("#/hooks/query/use-llm-profiles", () => ({
  useLlmProfiles: () => useLlmProfilesMock(),
}));
vi.mock("#/contexts/active-backend-context", async () => {
  const actual = await vi.importActual<
    typeof import("#/contexts/active-backend-context")
  >("#/contexts/active-backend-context");
  return { ...actual, useActiveBackend: () => useActiveBackendMock() };
});
vi.mock("#/hooks/use-acp-model-context", () => ({
  useAcpModelContext: () => useAcpModelContextMock(),
}));
vi.mock("#/hooks/use-conversation-id", () => ({
  useOptionalConversationId: () => useOptionalConversationIdMock(),
}));
vi.mock("#/stores/use-event-store", () => ({
  useEventStore: (selector: (s: { events: unknown[] }) => unknown) =>
    selector({ events: stores.events }),
}));
vi.mock("#/stores/model-store", () => ({
  useModelStore: (
    selector: (s: {
      activeProfileByConversation: Record<string, string>;
    }) => unknown,
  ) =>
    selector({
      activeProfileByConversation: stores.activeProfileByConversation,
    }),
}));

import { useActiveAgentBundleContext } from "#/hooks/use-active-agent-bundle-context";

const acpContext = (
  overrides: Partial<AcpModelContext> = {},
): AcpModelContext => ({
  isActiveAcpConversation: false,
  isHomeAcp: false,
  isAcpContext: false,
  destinationPath: "/settings",
  destinationLabel: "LLM Profiles",
  ...overrides,
});

describe("useActiveAgentBundleContext", () => {
  beforeEach(() => {
    stores.events = [];
    stores.activeProfileByConversation = {};
    useActiveConversationMock.mockReset();
    useActiveConversationMock.mockReturnValue({ data: undefined });
    useSettingsMock.mockReset();
    useSettingsMock.mockReturnValue({ data: undefined });
    useLlmProfilesMock.mockReset();
    useLlmProfilesMock.mockReturnValue({ data: { profiles: [] } });
    useActiveBackendMock.mockReset();
    useActiveBackendMock.mockReturnValue({ backend: { kind: "local" } });
    useAcpModelContextMock.mockReset();
    useAcpModelContextMock.mockReturnValue(acpContext());
    useOptionalConversationIdMock.mockReset();
    useOptionalConversationIdMock.mockReturnValue({ conversationId: null });
  });

  it("native conversation: current bundle/label resolve from the profile matching llm_model", () => {
    useActiveConversationMock.mockReturnValue({
      data: {
        conversation_id: "c1",
        agent_kind: "openhands",
        llm_model: "openai/gpt-5",
      },
    });
    useOptionalConversationIdMock.mockReturnValue({ conversationId: "c1" });
    useLlmProfilesMock.mockReturnValue({
      data: { profiles: [{ name: "gpt-5", model: "openai/gpt-5" }] },
    });

    const { result } = renderHook(() => useActiveAgentBundleContext());

    expect(result.current.conversationAgentKind).toBe("openhands");
    expect(result.current.currentBundleId).toBe("openhands:gpt-5");
    expect(result.current.currentLabel).toBe("gpt-5");
  });

  it("native home: current bundle resolves from the user's active profile", () => {
    useLlmProfilesMock.mockReturnValue({
      data: {
        profiles: [{ name: "gpt-5", model: "openai/gpt-5" }],
        active_profile: "gpt-5",
      },
    });

    const { result } = renderHook(() => useActiveAgentBundleContext());

    expect(result.current.hasConversation).toBe(false);
    expect(result.current.currentBundleId).toBe("openhands:gpt-5");
  });

  it("native: an optimistic active profile wins for instant feedback", () => {
    stores.activeProfileByConversation = { c1: "fast" };
    useActiveConversationMock.mockReturnValue({
      data: {
        conversation_id: "c1",
        agent_kind: "openhands",
        llm_model: "openai/gpt-5",
      },
    });
    useOptionalConversationIdMock.mockReturnValue({ conversationId: "c1" });

    const { result } = renderHook(() => useActiveAgentBundleContext());
    expect(result.current.currentBundleId).toBe("openhands:fast");
  });

  it("ACP conversation: current bundle id is acp:provider:model and label is the human model name", () => {
    useActiveConversationMock.mockReturnValue({
      data: {
        conversation_id: "c1",
        agent_kind: "acp",
        acp_server: "claude-code",
        llm_model: "claude-sonnet-4-6",
      },
    });
    useOptionalConversationIdMock.mockReturnValue({ conversationId: "c1" });
    useAcpModelContextMock.mockReturnValue(
      acpContext({ isActiveAcpConversation: true, isAcpContext: true }),
    );

    const { result } = renderHook(() => useActiveAgentBundleContext());

    expect(result.current.conversationAgentKind).toBe("acp");
    expect(result.current.conversationAcpProvider).toBe("claude-code");
    expect(result.current.currentBundleId).toBe(
      "acp:claude-code:claude-sonnet-4-6",
    );
    expect(result.current.currentLabel).toBe("Claude Sonnet 4.6");
  });

  it("sessionInitialized tracks whether the event store has any events", () => {
    useActiveConversationMock.mockReturnValue({
      data: {
        conversation_id: "c1",
        agent_kind: "acp",
        acp_server: "claude-code",
        llm_model: "claude-opus-4-7",
      },
    });
    useAcpModelContextMock.mockReturnValue(
      acpContext({ isActiveAcpConversation: true, isAcpContext: true }),
    );

    const before = renderHook(() => useActiveAgentBundleContext());
    expect(before.result.current.sessionInitialized).toBe(false);

    stores.events = [{ id: 1 }];
    const after = renderHook(() => useActiveAgentBundleContext());
    expect(after.result.current.sessionInitialized).toBe(true);
  });

  it("cloud backend is reported so the matrix can disable switching", () => {
    useActiveBackendMock.mockReturnValue({ backend: { kind: "cloud" } });
    const { result } = renderHook(() => useActiveAgentBundleContext());
    expect(result.current.backendKind).toBe("cloud");
  });
});
