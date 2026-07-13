import { afterEach, describe, expect, it, vi } from "vitest";
import { parseManifest } from "#/extensions/manifest";
import { loadExtension, type BundleSource } from "#/extensions/loader";
import { contributionRegistry } from "#/extensions/contribution-registry";

/**
 * Guards the extension manifest schema and loader against drift.
 * Uses an inline fixture that mirrors the hello-sidebar example extension
 * (now hosted at https://github.com/jpshackelford/agent-canvas-experimental-extensions).
 */
const rawManifest = {
  id: "test.hello",
  name: "Hello Page",
  version: "1.0.0",
  publisher: "test",
  engines: { agentCanvas: "^1.0.0" },
  main: "main.js",
  activationEvents: ["onCommand:hello.say"],
  capabilities: ["conversation:read", "storage"],
  contributes: {
    pages: [
      { id: "main", title: "Hello", icon: "icon.svg", page: "panel.html" },
    ],
    commands: [{ command: "hello.say", title: "Hello: Say hi" }],
    menus: {
      "chatInput/actions": [{ command: "hello.say", when: "emailVerified" }],
    },
    settingsPages: [{ id: "general", title: "Hello", page: "settings.html" }],
    conversationPanelTabs: [
      { id: "details", title: "Hello", icon: "icon.svg", page: "panel.html" },
    ],
  },
};

describe("extension manifest and loader", () => {
  afterEach(() => contributionRegistry.clear());

  it("validates against the manifest schema", () => {
    const result = parseManifest(rawManifest);
    expect(result.ok).toBe(true);
  });

  it("loads its declarative contributions through the loader", async () => {
    const source: BundleSource = {
      readManifest: async () => rawManifest,
      assetUrl: async (path) => `blob:${path}`,
    };
    const host = {
      activate: vi.fn(),
      runCommand: vi.fn(),
      openView: vi.fn(),
    };

    const result = await loadExtension(source, host);
    expect(result.ok).toBe(true);

    // Full-width pages are shown as sidebar nav items (like Customize/Automate).
    const pages = contributionRegistry.getPages();
    expect(pages.map((p) => p.title)).toEqual(["Hello"]);
    expect(pages[0].iconUrl).toBe("blob:icon.svg");
    expect(pages[0].pageUrl).toBe("blob:panel.html");
    expect(pages[0].capabilities).toEqual(["conversation:read", "storage"]);

    const commands = contributionRegistry.getCommands();
    expect(commands.map((c) => c.command)).toEqual(["hello.say"]);

    // The menu item targets the chat-input actions slot and carries a `when`
    // clause (host-fact gated; carried through the loader untouched).
    const chatItems =
      contributionRegistry.getMenuItemsForSlot("chatInput/actions");
    expect(chatItems.map((m) => m.command)).toEqual(["hello.say"]);
    expect(chatItems[0].when).toBe("emailVerified");

    // The conversationPanelTabs contribution adds a tab to the right panel.
    const panelTabs = contributionRegistry.getConversationPanelTabs();
    expect(panelTabs.map((t) => t.id)).toEqual(["details"]);
    expect(panelTabs[0].title).toBe("Hello");
    expect(panelTabs[0].iconUrl).toBe("blob:icon.svg");
    expect(panelTabs[0].pageUrl).toBe("blob:panel.html");
    expect(panelTabs[0].capabilities).toEqual(["conversation:read", "storage"]);

    // The settings page is resolved with its webview URL and inherits the
    // extension's capabilities (so its webview can persist via `storage`).
    const settingsPages = contributionRegistry.getSettingsPages();
    expect(settingsPages.map((p) => p.id)).toEqual(["general"]);
    expect(settingsPages[0].pageUrl).toBe("blob:settings.html");
    expect(settingsPages[0].capabilities).toEqual([
      "conversation:read",
      "storage",
    ]);
  });
});
