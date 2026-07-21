import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSettingsScreen from "#/routes/app-settings";
import SettingsService from "#/api/settings-service/settings-service.api";
import { MOCK_DEFAULT_USER_SETTINGS } from "#/mocks/handlers";
import { Settings } from "#/types/settings";

function buildSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...MOCK_DEFAULT_USER_SETTINGS,
    ...overrides,
    agent_settings: {
      ...MOCK_DEFAULT_USER_SETTINGS.agent_settings,
      ...overrides.agent_settings,
    },
    conversation_settings: {
      ...MOCK_DEFAULT_USER_SETTINGS.conversation_settings,
      ...overrides.conversation_settings,
    },
  };
}

function renderAppSettingsScreen() {
  return render(<AppSettingsScreen />, {
    wrapper: ({ children }) => (
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })}
      >
        {children}
      </QueryClientProvider>
    ),
  });
}

describe("AppSettingsScreen", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the OSS application settings form", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(
      buildSettings({
        git_user_name: "octocat",
        git_user_email: "octocat@example.com",
      }),
    );

    renderAppSettingsScreen();

    const analyticsSwitch = await screen.findByTestId(
      "enable-analytics-switch",
    );

    expect(analyticsSwitch).toBeInTheDocument();
    expect(screen.getByTestId("git-user-name-input")).toHaveValue("octocat");
    expect(screen.getByTestId("git-user-email-input")).toHaveValue(
      "octocat@example.com",
    );
    // Persistent memory is opt-in and defaults to off.
    expect(
      screen.getByTestId("enable-persistent-memory-switch"),
    ).not.toBeChecked();
  });

  it("renders the persistent-memory switch on when the preference is set", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(
      buildSettings({ enable_persistent_memory: true }),
    );

    renderAppSettingsScreen();

    expect(
      await screen.findByTestId("enable-persistent-memory-switch"),
    ).toBeChecked();
  });

  it("saves the persistent-memory preference when toggled", async () => {
    const saveSettingsSpy = vi
      .spyOn(SettingsService, "saveSettings")
      .mockResolvedValue(true);
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(buildSettings());

    renderAppSettingsScreen();

    const user = userEvent.setup();
    const memorySwitch = await screen.findByTestId(
      "enable-persistent-memory-switch",
    );
    await user.click(memorySwitch.closest("label")!);
    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(saveSettingsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ enable_persistent_memory: true }),
      );
    });
  });

  it("saves updated git author details in OSS mode", async () => {
    const saveSettingsSpy = vi
      .spyOn(SettingsService, "saveSettings")
      .mockResolvedValue(true);

    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(
      buildSettings({
        git_user_name: "octocat",
        git_user_email: "octocat@example.com",
      }),
    );

    renderAppSettingsScreen();

    const user = userEvent.setup();
    const nameInput = await screen.findByTestId("git-user-name-input");

    await user.clear(nameInput);
    await user.type(nameInput, "monalisa");
    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(saveSettingsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          git_user_name: "monalisa",
          git_user_email: "octocat@example.com",
        }),
      );
    });
  });
});
