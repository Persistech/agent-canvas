import { beforeEach, describe, expect, it } from "vitest";
import ProfilesService from "#/api/settings-service/profiles-service.api";
import SettingsService from "#/api/settings-service/settings-service.api";
import { resetTestHandlersMockSettings } from "#/mocks/settings-handlers";

describe("ProfilesService", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetTestHandlersMockSettings();
    SettingsService.invalidateCache();
  });

  it("saves the current encrypted LLM settings as a local agent-server profile", async () => {
    await SettingsService.saveSettings({
      agent_settings_diff: {
        llm: {
          model: "openai/gpt-4o",
          base_url: "https://api.openai.com/v1",
          api_key: "sk-test",
        },
      },
    });

    await ProfilesService.saveProfile("openai_gpt-4o", {
      include_secrets: true,
    });

    const { profiles, active_profile: activeProfile } =
      await ProfilesService.listProfiles();

    expect(profiles).toEqual([
      expect.objectContaining({
        name: "openai_gpt-4o",
        model: "openai/gpt-4o",
        base_url: "https://api.openai.com/v1",
        api_key_set: true,
      }),
    ]);
    expect(activeProfile).toBe("openai_gpt-4o");
  });

  it("activates a profile by writing its LLM config back to settings", async () => {
    await ProfilesService.saveProfile("fast", {
      include_secrets: true,
      llm: {
        model: "anthropic/claude-haiku-4-5-20251001",
        base_url: "https://anthropic.example.com/v1",
        api_key: "fast-key",
      },
    });

    await ProfilesService.activateProfile("fast");

    const settings = await SettingsService.getSettings();

    expect(settings.llm_model).toBe("anthropic/claude-haiku-4-5-20251001");
    expect(settings.llm_base_url).toBe("https://anthropic.example.com/v1");
  });
});
