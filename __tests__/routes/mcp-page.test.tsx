import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MCPPage from "#/routes/mcp";
import SettingsService from "#/api/settings-service/settings-service.api";
import McpService from "#/api/mcp-service/mcp-service.api";
import { MOCK_DEFAULT_USER_SETTINGS } from "#/mocks/handlers";
import { Settings } from "#/types/settings";
import { ActiveBackendProvider } from "#/contexts/active-backend-context";

function buildSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...MOCK_DEFAULT_USER_SETTINGS,
    ...overrides,
    agent_settings: {
      ...MOCK_DEFAULT_USER_SETTINGS.agent_settings,
      ...overrides.agent_settings,
    },
    mcp_config: overrides.mcp_config ?? MOCK_DEFAULT_USER_SETTINGS.mcp_config,
  };
}

function renderPage() {
  return render(<MCPPage />, {
    wrapper: ({ children }) => (
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ActiveBackendProvider>{children}</ActiveBackendProvider>
      </QueryClientProvider>
    ),
  });
}

describe("MCPPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Pre-flight connectivity test must pass so save mutations are reached.
    vi.spyOn(McpService, "testServer").mockResolvedValue({
      ok: true,
      tools: [],
    });
  });

  it("renders the empty installed state and the marketplace", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(buildSettings());

    renderPage();

    await screen.findByTestId("mcp-marketplace-section");
    expect(screen.getByTestId("mcp-installed-empty")).toBeInTheDocument();
    expect(screen.getByTestId("mcp-marketplace-grid")).toBeInTheDocument();
  });

  it("lists GitHub, Slack, and Tavily as the first three marketplace tiles", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(buildSettings());

    renderPage();

    await screen.findByTestId("mcp-marketplace-grid");

    const cards = screen.getAllByTestId(/^mcp-marketplace-card-/);
    expect(cards.length).toBeGreaterThan(3);
    expect(cards[0]).toHaveAttribute(
      "data-testid",
      "mcp-marketplace-card-github",
    );
    expect(cards[1]).toHaveAttribute(
      "data-testid",
      "mcp-marketplace-card-slack",
    );
    expect(cards[2]).toHaveAttribute(
      "data-testid",
      "mcp-marketplace-card-tavily",
    );
  });

  it("opens the install modal when clicking a marketplace tile", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(buildSettings());

    renderPage();

    await screen.findByTestId("mcp-marketplace-card-slack");
    fireEvent.click(screen.getByTestId("mcp-marketplace-card-slack"));

    await waitFor(() => {
      expect(screen.getByTestId("mcp-install-modal")).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("mcp-install-field-command-readonly"),
    ).toHaveValue("npx -y @zencoderai/slack-mcp-server");
    expect(
      screen.getByTestId("mcp-install-field-SLACK_BOT_TOKEN"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("mcp-install-field-SLACK_TEAM_ID"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("mcp-install-field-url")).toBeNull();
    expect(screen.queryByTestId("mcp-install-field-api_key")).toBeNull();
  });

  it("filters marketplace tiles by the search input", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(buildSettings());

    renderPage();

    const search = await screen.findByTestId("mcp-search-input");
    fireEvent.change(search, { target: { value: "Slack" } });

    await waitFor(() => {
      expect(
        screen.getByTestId("mcp-marketplace-card-slack"),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("mcp-marketplace-card-github"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("mcp-marketplace-card-gitlab"),
    ).not.toBeInTheDocument();
  });

  it("keeps installed custom servers visible and searchable even when they are not in the marketplace catalog", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(
      buildSettings({
        agent_settings: {
          ...MOCK_DEFAULT_USER_SETTINGS.agent_settings,
          mcp_config: {
            acme_internal: {
              command: "npx",
              args: ["-y", "@acme/internal-mcp-server"],
            },
          },
        },
      }),
    );

    renderPage();

    await screen.findByTestId("mcp-installed-list");
    expect(screen.getByText("acme_internal")).toBeInTheDocument();
    expect(
      screen.queryByTestId("mcp-marketplace-card-acme_internal"),
    ).not.toBeInTheDocument();

    const search = screen.getByTestId("mcp-search-input");
    fireEvent.change(search, { target: { value: "internal-mcp-server" } });

    await waitFor(() => {
      expect(screen.getByText("acme_internal")).toBeInTheDocument();
    });
    expect(screen.getByTestId("mcp-marketplace-empty")).toBeInTheDocument();
  });

  it("hides the library section when the section filter is Installed", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(buildSettings());

    renderPage();

    await screen.findByTestId("mcp-marketplace-section");

    const filter = screen.getByTestId("mcp-section-filter");
    fireEvent.click(within(filter).getByTestId("dropdown-trigger"));
    fireEvent.click(screen.getByTestId("mcp-section-filter-installed"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("mcp-marketplace-section"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("mcp-installed-empty")).toBeInTheDocument();
  });

  it("hides the installed section when the section filter is Library", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(buildSettings());

    renderPage();

    await screen.findByTestId("mcp-installed-empty");

    const filter = screen.getByTestId("mcp-section-filter");
    fireEvent.click(within(filter).getByTestId("dropdown-trigger"));
    fireEvent.click(screen.getByTestId("mcp-section-filter-library"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("mcp-installed-empty"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("mcp-marketplace-section")).toBeInTheDocument();
  });

  it("shows a search-empty state when the query matches nothing", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(buildSettings());

    renderPage();

    const search = await screen.findByTestId("mcp-search-input");
    fireEvent.change(search, {
      target: { value: "totally-not-a-real-server" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("mcp-marketplace-empty")).toBeInTheDocument();
    });
  });

  it("opens the server editor when an installed server card is clicked", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(
      buildSettings({
        agent_settings: {
          ...MOCK_DEFAULT_USER_SETTINGS.agent_settings,
          mcp_config: {
            slack: {
              command: "npx",
              args: ["-y", "@zencoderai/slack-mcp-server"],
              env: { SLACK_BOT_TOKEN: "xoxb-abc", SLACK_TEAM_ID: "T01" },
            },
          },
        },
      }),
    );

    renderPage();

    fireEvent.click(await screen.findByTestId("mcp-server-item"));

    expect(await screen.findByTestId("mcp-custom-editor")).toBeInTheDocument();
  });

  it("disables an installed stdio server via the card toggle", async () => {
    // Pre-install a Slack stdio server via the SDK-shaped mcp_config
    // the route reads from agent_settings.mcp_config.
    const settingsWithSlack = buildSettings({
      agent_settings: {
        ...MOCK_DEFAULT_USER_SETTINGS.agent_settings,
        mcp_config: {
          slack: {
            command: "npx",
            args: ["-y", "@zencoderai/slack-mcp-server"],
            env: { SLACK_BOT_TOKEN: "xoxb-abc", SLACK_TEAM_ID: "T01" },
          },
        },
      },
    });
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(
      settingsWithSlack,
    );
    const saveSpy = vi
      .spyOn(SettingsService, "saveSettings")
      .mockResolvedValue(true);

    renderPage();

    const toggle = await screen.findByTestId("mcp-installed-toggle-stdio-0");
    fireEvent.click(toggle);

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    // Disabling only touches the deny-list; mcp_config is left untouched so
    // nothing is re-configured or removed.
    expect(saveSpy.mock.calls[0][0]).toEqual({
      disabled_mcp_servers: ["slack"],
    });
  });

  it("re-enables a disabled server and shows the disabled badge", async () => {
    const settingsWithDisabledSlack = buildSettings({
      agent_settings: {
        ...MOCK_DEFAULT_USER_SETTINGS.agent_settings,
        mcp_config: {
          slack: {
            command: "npx",
            args: ["-y", "@zencoderai/slack-mcp-server"],
          },
        },
      },
      disabled_mcp_servers: ["slack"],
    });
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(
      settingsWithDisabledSlack,
    );
    const saveSpy = vi
      .spyOn(SettingsService, "saveSettings")
      .mockResolvedValue(true);

    renderPage();

    // Disabled badge reflects the deny-list membership.
    expect(
      await screen.findByTestId("mcp-server-disabled-badge-stdio-0"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mcp-installed-toggle-stdio-0"));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][0]).toEqual({ disabled_mcp_servers: [] });
  });

  it("optimistically flips the card enabled state before the save resolves", async () => {
    const settingsWithSlack = buildSettings({
      agent_settings: {
        ...MOCK_DEFAULT_USER_SETTINGS.agent_settings,
        mcp_config: {
          slack: {
            command: "npx",
            args: ["-y", "@zencoderai/slack-mcp-server"],
          },
        },
      },
    });
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(
      settingsWithSlack,
    );
    // Never resolve the save so we observe the pre-refetch UI state.
    vi.spyOn(SettingsService, "saveSettings").mockReturnValue(
      new Promise<boolean>(() => {}),
    );

    renderPage();

    const toggle = await screen.findByTestId("mcp-installed-toggle-stdio-0");
    expect(
      screen.queryByTestId("mcp-server-disabled-badge-stdio-0"),
    ).not.toBeInTheDocument();

    fireEvent.click(toggle);

    // Badge appears immediately from the optimistic cache update, without any
    // successful refetch (the save promise is still pending).
    expect(
      await screen.findByTestId("mcp-server-disabled-badge-stdio-0"),
    ).toBeInTheDocument();
  });

  it("shows the catalog description and URL on installed server cards", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(
      buildSettings({
        agent_settings: {
          ...MOCK_DEFAULT_USER_SETTINGS.agent_settings,
          mcp_config: {
            github: {
              url: "https://api.githubcopilot.com/mcp/",
              auth: { strategy: "bearer", value: "github_pat_test" },
            },
          },
        },
      }),
    );

    renderPage();

    const card = await screen.findByTestId("mcp-server-item");
    expect(
      within(card).getByTestId("mcp-server-description-shttp-0"),
    ).toHaveTextContent(
      "Search code, manage issues and pull requests, and inspect repos via the GitHub API.",
    );
    expect(
      within(card).getByTestId("mcp-server-detail-shttp-0"),
    ).toHaveTextContent("https://api.githubcopilot.com/mcp/");
  });

  it("shows Tavily marketplace toggle as add-only when installed", async () => {
    // Library cards always show the add (+) affordance so users can
    // install multiple instances of the same template.
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(
      buildSettings({
        agent_settings: {
          ...MOCK_DEFAULT_USER_SETTINGS.agent_settings,
          mcp_config: {
            tavily: {
              command: "npx",
              args: ["-y", "tavily-mcp"],
              env: { TAVILY_API_KEY: "tvly-secret" },
            },
          },
        },
      }),
    );

    renderPage();

    await screen.findByTestId("mcp-marketplace-card-tavily");
    expect(screen.getByTestId("mcp-marketplace-toggle-tavily")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByTestId("mcp-installed-list")).toBeInTheDocument();
  });

  it("opens the install modal in add-only mode for a marketplace tile that's already installed", async () => {
    // Regression test: clicking an installed marketplace tile must
    // open a fresh "Install" modal so the user can add a second
    // instance (e.g. a second Slack workspace). Previously this
    // coerced into edit mode and `Save changes` overwrote the
    // existing entry, so the second instance never landed and the
    // first one got clobbered.
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(
      buildSettings({
        agent_settings: {
          ...MOCK_DEFAULT_USER_SETTINGS.agent_settings,
          mcp_config: {
            slack: {
              command: "npx",
              args: ["-y", "@zencoderai/slack-mcp-server"],
              env: { SLACK_BOT_TOKEN: "xoxb-old", SLACK_TEAM_ID: "T01" },
            },
          },
        },
      }),
    );
    const saveSpy = vi
      .spyOn(SettingsService, "saveSettings")
      .mockResolvedValue(true);

    renderPage();

    const tile = await screen.findByTestId("mcp-marketplace-card-slack");
    expect(screen.getByTestId("mcp-marketplace-toggle-slack")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    fireEvent.click(tile);

    await screen.findByTestId("mcp-install-modal");
    // Action label confirms add-only semantics (no `Save changes`).
    expect(screen.getByTestId("mcp-install-submit")).toHaveTextContent(
      "MCP$INSTALL_BUTTON",
    );

    fireEvent.change(screen.getByTestId("mcp-install-field-SLACK_BOT_TOKEN"), {
      target: { value: "xoxb-new" },
    });
    fireEvent.change(screen.getByTestId("mcp-install-field-SLACK_TEAM_ID"), {
      target: { value: "T02" },
    });
    fireEvent.click(screen.getByTestId("mcp-install-submit"));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const sent = (saveSpy.mock.calls[0][0] as Record<string, unknown>)
      .agent_settings_diff as {
      mcp_config: Record<string, unknown>;
    };
    // The original Slack stdio entry is preserved and the new stdio
    // install is suffixed rather than overwriting it.
    expect(Object.keys(sent.mcp_config).sort()).toEqual(["slack", "slack_1"]);
    expect(sent.mcp_config).toMatchObject({
      slack: { env: { SLACK_BOT_TOKEN: "xoxb-old" } },
      slack_1: { env: { SLACK_BOT_TOKEN: "xoxb-new", SLACK_TEAM_ID: "T02" } },
    });
  });

  it("opens the custom server editor when the header 'Add custom server' button is clicked", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue(buildSettings());

    renderPage();

    const addCustomBtn = await screen.findByTestId("mcp-add-custom-server");
    fireEvent.click(addCustomBtn);

    await waitFor(() => {
      expect(screen.getByTestId("mcp-custom-editor")).toBeInTheDocument();
    });
  });
});
