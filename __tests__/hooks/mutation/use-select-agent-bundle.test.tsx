import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bundleId, type AgentModelBundle } from "#/types/agent-model-bundle";

const switchAndLog = vi.fn();
const switchAcpMutate = vi.fn();
const startNew = vi.fn();
// Hoisted so the use-conversation-id mock factory can read the per-test value.
const nav = vi.hoisted(() => ({ conversationId: null as string | null }));

vi.mock("#/hooks/use-conversation-id", () => ({
  useOptionalConversationId: () => ({ conversationId: nav.conversationId }),
}));
vi.mock("#/hooks/mutation/use-switch-llm-profile-and-log", () => ({
  useSwitchLlmProfileAndLog: () => ({ switchAndLog, isPending: false }),
}));
vi.mock("#/hooks/mutation/use-switch-acp-model", () => ({
  useSwitchAcpModel: () => ({ mutate: switchAcpMutate, isPending: false }),
}));
vi.mock("#/hooks/mutation/use-start-new-with-bundle", () => ({
  useStartNewWithBundle: () => ({ start: startNew, isPending: false }),
}));

import { useSelectAgentBundle } from "#/hooks/mutation/use-select-agent-bundle";

const native = (name: string): AgentModelBundle => ({
  kind: "openhands",
  id: bundleId.openhands(name),
  label: name,
  profileName: name,
  model: "m",
});
const acp = (provider: string, model: string): AgentModelBundle => ({
  kind: "acp",
  id: bundleId.acp(provider, model),
  label: model,
  provider,
  providerLabel: provider,
  model,
  supportsRuntimeSwitch: true,
});

describe("useSelectAgentBundle", () => {
  beforeEach(() => {
    switchAndLog.mockReset();
    switchAcpMutate.mockReset();
    startNew.mockReset();
    nav.conversationId = null;
  });

  it("native switch-live → switch_llm for the active conversation", () => {
    nav.conversationId = "c1";
    const { result } = renderHook(() => useSelectAgentBundle());
    result.current.select(native("gpt-5"), "switch-live");
    expect(switchAndLog).toHaveBeenCalledWith("c1", "gpt-5");
  });

  it("native set-default (home) → activate via null conversation", () => {
    const { result } = renderHook(() => useSelectAgentBundle());
    result.current.select(native("gpt-5"), "set-default");
    expect(switchAndLog).toHaveBeenCalledWith(null, "gpt-5");
  });

  it("ACP switch-live → switch_acp_model for the active conversation", () => {
    nav.conversationId = "c1";
    const { result } = renderHook(() => useSelectAgentBundle());
    result.current.select(acp("claude-code", "claude-opus-4-7"), "switch-live");
    expect(switchAcpMutate).toHaveBeenCalledWith({
      conversationId: "c1",
      model: "claude-opus-4-7",
    });
  });

  it("ACP set-default (home) → PATCH settings via null conversation", () => {
    const { result } = renderHook(() => useSelectAgentBundle());
    result.current.select(acp("codex", "gpt-5.5-codex"), "set-default");
    expect(switchAcpMutate).toHaveBeenCalledWith({
      conversationId: null,
      model: "gpt-5.5-codex",
    });
  });

  it("start-new-only → fork a new conversation", () => {
    const bundle = acp("codex", "gpt-5.5-codex");
    const { result } = renderHook(() => useSelectAgentBundle());
    result.current.select(bundle, "start-new-only");
    expect(startNew).toHaveBeenCalledWith(bundle);
  });

  it("current and disabled are no-ops", () => {
    const { result } = renderHook(() => useSelectAgentBundle());
    result.current.select(native("gpt-5"), "current");
    result.current.select(acp("codex", "x"), "disabled");
    expect(switchAndLog).not.toHaveBeenCalled();
    expect(switchAcpMutate).not.toHaveBeenCalled();
    expect(startNew).not.toHaveBeenCalled();
  });
});
