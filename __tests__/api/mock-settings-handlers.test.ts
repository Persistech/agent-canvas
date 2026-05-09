import { describe, expect, it } from "vitest";
import SettingsService from "#/api/settings-service/settings-service.api";

describe("mock settings handlers", () => {
  it("returns the agent settings schema on the paths used by the UI", async () => {
    const schema = await SettingsService.getSettingsSchema();

    expect(schema.sections.some((section) => section.key === "llm")).toBe(true);
  });

  it("returns the conversation settings schema on the paths used by the UI", async () => {
    const schema = await SettingsService.getConversationSettingsSchema();

    expect(
      schema.sections.some((section) => section.key === "verification"),
    ).toBe(true);
  });
  it("supports the local agent-server LLM profiles endpoints used by the UI", async () => {
    await SettingsService.saveSettings({
      agent_settings_diff: {
        llm: { model: "openai/gpt-4o", api_key: "test-key" },
      },
    });

    const ProfilesService = (
      await import("#/api/settings-service/profiles-service.api")
    ).default;

    await ProfilesService.saveProfile("openai_gpt-4o", {
      include_secrets: true,
    });

    const { profiles } = await ProfilesService.listProfiles();

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      name: "openai_gpt-4o",
      model: "openai/gpt-4o",
      api_key_set: true,
    });
  });
});
