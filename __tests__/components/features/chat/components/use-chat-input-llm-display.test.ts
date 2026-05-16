import { describe, expect, it } from "vitest";
import type { ProfileInfo } from "#/api/profiles-service/profiles-service.api";
import { resolveChatInputLlmDisplay } from "#/components/features/chat/components/use-chat-input-llm-display";

const profiles: ProfileInfo[] = [
  {
    name: "haiku",
    model: "anthropic/claude-3-5-haiku-20241022",
    base_url: null,
    api_key_set: true,
  },
  {
    name: "support-bot",
    model: "anthropic/claude-3-5-haiku-20241022",
    base_url: null,
    api_key_set: true,
  },
  {
    name: "sonnet",
    model: "anthropic/claude-sonnet-4-20250514",
    base_url: null,
    api_key_set: true,
  },
];

describe("resolveChatInputLlmDisplay", () => {
  it("returns null when there is no current model", () => {
    expect(
      resolveChatInputLlmDisplay({
        llmModel: null,
        profiles,
        activeProfileName: null,
        latestSwitchedProfileName: null,
        hasActiveConversation: true,
      }),
    ).toBeNull();
  });

  it("prefers the exact profile name from the latest conversation switch", () => {
    expect(
      resolveChatInputLlmDisplay({
        llmModel: "anthropic/claude-3-5-haiku-20241022",
        profiles,
        activeProfileName: null,
        latestSwitchedProfileName: "support-bot",
        hasActiveConversation: true,
      }),
    ).toEqual({
      label: "support-bot",
      model: "anthropic/claude-3-5-haiku-20241022",
      profileName: "support-bot",
      title: "support-bot (anthropic/claude-3-5-haiku-20241022)",
    });
  });

  it("uses the active profile name on the home page when it matches the model", () => {
    expect(
      resolveChatInputLlmDisplay({
        llmModel: "anthropic/claude-3-5-haiku-20241022",
        profiles,
        activeProfileName: "haiku",
        latestSwitchedProfileName: null,
        hasActiveConversation: false,
      }),
    ).toEqual({
      label: "haiku",
      model: "anthropic/claude-3-5-haiku-20241022",
      profileName: "haiku",
      title: "haiku (anthropic/claude-3-5-haiku-20241022)",
    });
  });

  it("uses the only matching profile when the model maps uniquely", () => {
    expect(
      resolveChatInputLlmDisplay({
        llmModel: "anthropic/claude-sonnet-4-20250514",
        profiles,
        activeProfileName: null,
        latestSwitchedProfileName: null,
        hasActiveConversation: true,
      }),
    ).toEqual({
      label: "sonnet",
      model: "anthropic/claude-sonnet-4-20250514",
      profileName: "sonnet",
      title: "sonnet (anthropic/claude-sonnet-4-20250514)",
    });
  });

  it("falls back to the raw model when multiple profiles share it and no exact profile is known", () => {
    expect(
      resolveChatInputLlmDisplay({
        llmModel: "anthropic/claude-3-5-haiku-20241022",
        profiles,
        activeProfileName: null,
        latestSwitchedProfileName: null,
        hasActiveConversation: true,
      }),
    ).toEqual({
      label: "anthropic/claude-3-5-haiku-20241022",
      model: "anthropic/claude-3-5-haiku-20241022",
      profileName: null,
      title: "anthropic/claude-3-5-haiku-20241022",
    });
  });
});
