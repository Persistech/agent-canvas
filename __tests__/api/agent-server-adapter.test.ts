import { describe, expect, it, vi } from "vitest";

import {
  buildStartConversationRequest,
  getDefaultConversationTitle,
  toV1AppConversation,
  type DirectConversationInfo,
} from "#/api/agent-server-adapter";

vi.mock("#/api/agent-server-config", () => ({
  getAgentServerBaseUrl: vi.fn(() => "http://127.0.0.1:8000"),
  getAgentServerSessionApiKey: vi.fn(() => null),
  getAgentServerWorkingDir: vi.fn(() => "/workspace/project/agent-server-gui"),
}));

describe("buildStartConversationRequest", () => {
  it("builds a minimal payload with only initial_message when query is provided", () => {
    const payload = buildStartConversationRequest({
      query: "hello",
    }) as Record<string, unknown>;

    expect(payload.initial_message).toEqual({
      role: "user",
      content: [{ type: "text", text: "hello" }],
    });
    // Should not include agent, workspace, or other settings - server provides them
    expect(payload.agent).toBeUndefined();
    expect(payload.workspace).toBeUndefined();
    expect(payload.max_iterations).toBeUndefined();
  });

  it("includes conversation_id when provided", () => {
    const conversationId = "11111111-1111-4111-8111-111111111111";
    const payload = buildStartConversationRequest({
      conversationId,
    }) as Record<string, unknown>;

    expect(payload.conversation_id).toBe(conversationId);
    expect(payload.initial_message).toBeUndefined();
  });

  it("combines query and conversationInstructions into initial_message", () => {
    const payload = buildStartConversationRequest({
      query: "Fix the bug",
      conversationInstructions: "Follow the repo conventions.",
    }) as Record<string, unknown>;

    expect(payload.initial_message).toEqual({
      role: "user",
      content: [{ type: "text", text: "Fix the bug\n\nFollow the repo conventions." }],
    });
  });

  it("includes plugins when provided", () => {
    const payload = buildStartConversationRequest({
      plugins: [
        { source: "github.com/org/plugin", ref: "main", repo_path: "/" },
      ],
    }) as Record<string, unknown>;

    expect(payload.plugins).toEqual([
      { source: "github.com/org/plugin", ref: "main", repo_path: "/" },
    ]);
  });

  it("returns empty payload when no options are provided", () => {
    const payload = buildStartConversationRequest({});
    expect(payload).toEqual({});
  });
});

describe("getDefaultConversationTitle", () => {
  it("formats the title using the first 5 characters of the conversation id", () => {
    expect(getDefaultConversationTitle("372eb-1234-5678-9abc")).toBe(
      "Conversation 372eb",
    );
  });
});

describe("toV1AppConversation", () => {
  const baseInfo: DirectConversationInfo = {
    id: "372eb-1234-5678-9abc",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("falls back to the default title when the backend returns null", () => {
    const result = toV1AppConversation({ ...baseInfo, title: null });
    expect(result.title).toBe("Conversation 372eb");
  });

  it("falls back to the default title when the backend returns undefined", () => {
    const result = toV1AppConversation({ ...baseInfo });
    expect(result.title).toBe("Conversation 372eb");
  });

  it("falls back to the default title when the backend returns an empty string", () => {
    const result = toV1AppConversation({ ...baseInfo, title: "" });
    expect(result.title).toBe("Conversation 372eb");
  });

  it("falls back to the default title when the backend returns whitespace only", () => {
    const result = toV1AppConversation({ ...baseInfo, title: "   " });
    expect(result.title).toBe("Conversation 372eb");
  });

  it("preserves a backend-provided title when one is set", () => {
    const result = toV1AppConversation({
      ...baseInfo,
      title: "My real title",
    });
    expect(result.title).toBe("My real title");
  });
});
