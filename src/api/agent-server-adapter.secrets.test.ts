import { beforeEach, describe, expect, it, vi } from "vitest";

// The secret-building path reads the active backend for auth headers; stub it
// so the unit under test stays focused on secret *shape* (Static vs Lookup).
vi.mock("./backend-registry/active-store", () => ({
  getEffectiveLocalBackend: () => null,
}));
vi.mock("./backend-registry/auth", () => ({
  buildAuthHeaders: () => ({}),
}));

import { buildStartConversationRequest } from "./agent-server-adapter";
import type { Settings } from "#/types/settings";

const ACP_SETTINGS = {
  agent_settings: { agent_kind: "acp", acp_server: "claude-code" },
  conversation_settings: {},
} as unknown as Settings;

const OPENHANDS_SETTINGS = {
  agent_settings: { agent_kind: "openhands", llm: { model: "gpt-5.5" } },
  conversation_settings: {},
} as unknown as Settings;

describe("buildStartConversationRequest — ACP credential delivery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends ACP custom secrets inline as StaticSecret (regression: agent-canvas#1072)", () => {
    const payload = buildStartConversationRequest({
      settings: ACP_SETTINGS,
      secretsEncrypted: true,
      customSecrets: [{ name: "ANTHROPIC_API_KEY", description: "key" }],
      acpInlineSecretValues: { ANTHROPIC_API_KEY: "sk-ant-test" },
    });

    const secret = (payload.secrets as Record<string, unknown>)
      .ANTHROPIC_API_KEY;
    expect(secret).toEqual({
      kind: "StaticSecret",
      value: "sk-ant-test",
      description: "key",
    });

    // ACPAgent's spawn-time env loop reads agent_context.secrets, so the inline
    // value must be mirrored there too.
    const ctxSecrets = (
      payload.agent_settings.agent_context as Record<string, unknown>
    ).secrets as Record<string, unknown>;
    expect(ctxSecrets.ANTHROPIC_API_KEY).toEqual({
      kind: "StaticSecret",
      value: "sk-ant-test",
      description: "key",
    });

    // secrets_encrypted must NOT be set for ACP: the inline value is plaintext
    // and would be cipher-decrypted (→ dropped to None) on the server.
    expect(payload.secrets_encrypted).toBeUndefined();
  });

  it("falls back to a LookupSecret when no inline value is available", () => {
    const payload = buildStartConversationRequest({
      settings: ACP_SETTINGS,
      secretsEncrypted: true,
      customSecrets: [{ name: "ANTHROPIC_API_KEY", description: "key" }],
      acpInlineSecretValues: {},
    });

    const secret = (payload.secrets as Record<string, unknown>)
      .ANTHROPIC_API_KEY as Record<string, unknown>;
    expect(secret.kind).toBe("LookupSecret");
    expect(payload.secrets_encrypted).toBeUndefined();
  });

  it("leaves non-ACP conversations on LookupSecret with secrets_encrypted", () => {
    const payload = buildStartConversationRequest({
      settings: OPENHANDS_SETTINGS,
      secretsEncrypted: true,
      customSecrets: [{ name: "GITHUB_TOKEN", description: "tok" }],
      // An inline map must be ignored for non-ACP agents.
      acpInlineSecretValues: { GITHUB_TOKEN: "ghp-test" },
    });

    const secret = (payload.secrets as Record<string, unknown>)
      .GITHUB_TOKEN as Record<string, unknown>;
    expect(secret.kind).toBe("LookupSecret");
    expect(payload.secrets_encrypted).toBe(true);
    // Non-ACP agents must not get a surprise agent_context.secrets map.
    const ctx = payload.agent_settings.agent_context as
      | Record<string, unknown>
      | undefined;
    expect(ctx?.secrets).toBeUndefined();
  });
});
