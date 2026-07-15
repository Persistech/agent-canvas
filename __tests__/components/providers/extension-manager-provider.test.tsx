import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import {
  ExtensionManagerProviderInner,
  useExtensionContext,
} from "#/components/providers/extension-manager-provider";
import { useInstalledExtensionsStore } from "#/extensions/installed-store";
import { contributionRegistry } from "#/extensions/contribution-registry";
import type { ExtensionManifest } from "#/extensions/manifest";

// Keep the auto-install effect from touching the network with dev bundles.
vi.mock("#/extensions/feature-flag", () => ({
  EXTENSIONS_ENABLED: true,
  DEV_EXTENSION_BUNDLE_URLS: [],
}));

type Ctx = NonNullable<ReturnType<typeof useExtensionContext>>;

interface FetchState {
  latestVersion: string;
  manifests: Record<string, ExtensionManifest>;
}

function manifest(over: Partial<ExtensionManifest> = {}): ExtensionManifest {
  return {
    id: "acme.test",
    name: "Test",
    version: "1.0.0",
    engines: { agentCanvas: "^1.0.0" },
    ...over,
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

function installFetch(state: FetchState) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("data.jsdelivr.com")) {
      return jsonResponse({ version: state.latestVersion });
    }
    if (url.endsWith("/extension.json")) {
      const base = url.replace(/\/extension\.json$/, "");
      const m = state.manifests[base];
      return m ? jsonResponse(m) : jsonResponse(null, 404);
    }
    return jsonResponse(null, 404);
  }) as unknown as typeof fetch;
}

function base(version: string) {
  return `https://cdn.jsdelivr.net/npm/acme-test@${version}`;
}

async function mountProvider(): Promise<Ctx> {
  let ctx: Ctx | null = null;
  function Capture() {
    ctx = useExtensionContext();
    return null;
  }
  await act(async () => {
    render(
      <ExtensionManagerProviderInner>
        <Capture />
      </ExtensionManagerProviderInner>,
    );
  });
  if (!ctx) throw new Error("context not available");
  return ctx;
}

describe("ExtensionManagerProvider update detection", () => {
  beforeEach(() => {
    localStorage.clear();
    contributionRegistry.clear();
    useInstalledExtensionsStore.getState().clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    contributionRegistry.clear();
    useInstalledExtensionsStore.getState().clear();
  });

  it("reports no update when the resolved version is unchanged", async () => {
    const state: FetchState = {
      latestVersion: "1.0.0",
      manifests: { [base("1.0.0")]: manifest({ version: "1.0.0" }) },
    };
    vi.stubGlobal("fetch", installFetch(state));
    const ctx = await mountProvider();

    await act(async () => {
      await ctx.installFromUrl("npm:acme-test@^1");
    });
    expect(await ctx.checkForUpdate("acme.test")).toBeNull();
  });

  it("detects and applies a newer version within range", async () => {
    const state: FetchState = {
      latestVersion: "1.0.0",
      manifests: {
        [base("1.0.0")]: manifest({ version: "1.0.0" }),
        [base("1.5.0")]: manifest({ version: "1.5.0" }),
      },
    };
    vi.stubGlobal("fetch", installFetch(state));
    const ctx = await mountProvider();

    await act(async () => {
      await ctx.installFromUrl("npm:acme-test@^1");
    });

    // A newer release appears within the recorded range.
    state.latestVersion = "1.5.0";
    const update = await ctx.checkForUpdate("acme.test");
    expect(update).toEqual({
      id: "acme.test",
      currentVersion: "1.0.0",
      latestVersion: "1.5.0",
      sourceRef: "npm:acme-test@^1",
    });

    await act(async () => {
      await ctx.updateExtension("acme.test");
    });
    const installed = useInstalledExtensionsStore
      .getState()
      .installed.find((e) => e.id === "acme.test");
    expect(installed?.version).toBe("1.5.0");
    expect(installed?.sourceUrl).toBe(base("1.5.0"));
  });

  it("refuses (non-destructively) to update when the new version requests new capabilities", async () => {
    const state: FetchState = {
      latestVersion: "1.0.0",
      manifests: {
        [base("1.0.0")]: manifest({ version: "1.0.0", capabilities: [] }),
        [base("2.0.0")]: manifest({
          version: "2.0.0",
          capabilities: ["storage"],
        }),
      },
    };
    vi.stubGlobal("fetch", installFetch(state));
    const ctx = await mountProvider();

    await act(async () => {
      await ctx.installFromUrl("npm:acme-test@^1");
    });
    state.latestVersion = "2.0.0";

    await expect(ctx.updateExtension("acme.test")).rejects.toThrow(
      /new permissions/,
    );
    // The running version is untouched.
    const installed = useInstalledExtensionsStore
      .getState()
      .installed.find((e) => e.id === "acme.test");
    expect(installed?.version).toBe("1.0.0");
  });

  it("refuses (non-destructively) to update to a host-incompatible version", async () => {
    const state: FetchState = {
      latestVersion: "1.0.0",
      manifests: {
        [base("1.0.0")]: manifest({ version: "1.0.0" }),
        [base("2.0.0")]: manifest({
          version: "2.0.0",
          engines: { agentCanvas: "^99.0.0" },
        }),
      },
    };
    vi.stubGlobal("fetch", installFetch(state));
    const ctx = await mountProvider();

    await act(async () => {
      await ctx.installFromUrl("npm:acme-test@^1");
    });
    state.latestVersion = "2.0.0";

    await expect(ctx.updateExtension("acme.test")).rejects.toThrow(
      /requires Agent Canvas/,
    );
    const installed = useInstalledExtensionsStore
      .getState()
      .installed.find((e) => e.id === "acme.test");
    expect(installed?.version).toBe("1.0.0");
  });

  it("detectSource classifies a single-extension manifest URL", async () => {
    const state: FetchState = {
      latestVersion: "1.0.0",
      manifests: {
        "https://cdn.example.com/ext": manifest({ version: "1.0.0" }),
      },
    };
    // Marketplace catalog probes 404 for this source, so only the manifest resolves.
    vi.stubGlobal("fetch", installFetch(state));
    const ctx = await mountProvider();

    const detection = await ctx.detectSource("https://cdn.example.com/ext");
    expect(detection.kind).toBe("manifest");
    if (detection.kind === "manifest") {
      expect(detection.installSource).toBe("https://cdn.example.com/ext");
      expect(detection.preview.id).toBe("acme.test");
    }
  });

  it("detectSource returns 'none' when neither manifest nor catalog is found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(null, 404)) as unknown as typeof fetch,
    );
    const ctx = await mountProvider();
    const detection = await ctx.detectSource("https://cdn.example.com/missing");
    expect(detection.kind).toBe("none");
  });

  it("detectSource treats a catalog as marketplace and lists its entries", async () => {
    const catalog = {
      name: "Examples",
      owner: { name: "Acme" },
      uiExtensions: [
        { name: "a", source: "npm:@acme/a@^1" },
        { name: "b", source: "npm:@acme/b@^1" },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes(".plugin/marketplace.json")) {
          return jsonResponse(catalog);
        }
        return jsonResponse(null, 404);
      }) as unknown as typeof fetch,
    );
    const ctx = await mountProvider();

    const detection = await ctx.detectSource("github:acme/exts");
    expect(detection.kind).toBe("catalog");
    if (detection.kind === "catalog") {
      expect(detection.result.listings.map((l) => l.name)).toEqual(["a", "b"]);
    }
  });

  it("detectSource short-circuits a single-entry catalog to that entry's consent card", async () => {
    const catalog = {
      name: "Examples",
      owner: { name: "Acme" },
      uiExtensions: [{ name: "only", source: "npm:acme-test@^1" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes(".plugin/marketplace.json")) {
          return jsonResponse(catalog);
        }
        if (url.includes("data.jsdelivr.com")) {
          return jsonResponse({ version: "1.0.0" });
        }
        if (url.endsWith("/extension.json")) {
          return jsonResponse(manifest({ version: "1.0.0" }));
        }
        return jsonResponse(null, 404);
      }) as unknown as typeof fetch,
    );
    const ctx = await mountProvider();

    const detection = await ctx.detectSource("github:acme/exts");
    // Routing changes (skip the list), but the result is still a consent card.
    expect(detection.kind).toBe("manifest");
    if (detection.kind === "manifest") {
      expect(detection.installSource).toBe("npm:acme-test@^1");
      expect(detection.preview.id).toBe("acme.test");
    }
  });

  it("reports no update channel for url-kind installs", async () => {
    const state: FetchState = {
      latestVersion: "1.0.0",
      manifests: {
        "https://cdn.example.com/ext": manifest({ version: "1.0.0" }),
      },
    };
    vi.stubGlobal("fetch", installFetch(state));
    const ctx = await mountProvider();

    await act(async () => {
      await ctx.installFromUrl("https://cdn.example.com/ext");
    });
    expect(await ctx.checkForUpdate("acme.test")).toBeNull();
  });
});

describe("ExtensionManagerProvider local dev source", () => {
  const origin = window.location.origin;
  const localBase = `${origin}/__ext-local/localid123`;

  beforeEach(() => {
    localStorage.clear();
    contributionRegistry.clear();
    useInstalledExtensionsStore.getState().clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    contributionRegistry.clear();
    useInstalledExtensionsStore.getState().clear();
  });

  /**
   * fetch mock for the local flow: the register endpoint returns a fixed id, and the
   * resulting `/__ext-local/<id>/extension.json` serves a manifest. Records the register
   * body so tests can assert the raw `~` path was forwarded (NOT expanded in the browser).
   */
  function localFetch(registerCalls: string[]) {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/__ext-local/register")) {
        registerCalls.push(String(init?.body));
        return jsonResponse({ id: "localid123" });
      }
      if (url === `${localBase}/extension.json`) {
        return jsonResponse(manifest({ id: "acme.local", version: "0.1.0" }));
      }
      return jsonResponse(null, 404);
    }) as unknown as typeof fetch;
  }

  it("registers a ~/ path server-side (browser never expands ~) and installs it as a url source", async () => {
    const registerCalls: string[] = [];
    vi.stubGlobal("fetch", localFetch(registerCalls));
    const ctx = await mountProvider();

    await act(async () => {
      await ctx.installFromUrl("~/code/my-ext");
    });

    // The raw ~ path was forwarded to the server verbatim, not expanded in the browser.
    expect(registerCalls).toHaveLength(1);
    expect(JSON.parse(registerCalls[0])).toEqual({ path: "~/code/my-ext" });

    const installed = useInstalledExtensionsStore
      .getState()
      .installed.find((e) => e.id === "acme.local");
    expect(installed?.sourceUrl).toBe(localBase);
    // The raw path is kept as the sourceRef so reload/restart re-resolves it.
    expect(installed?.sourceRef).toBe("~/code/my-ext");
  });

  it("rejects file://~ before any network call with an actionable message", async () => {
    const registerCalls: string[] = [];
    vi.stubGlobal("fetch", localFetch(registerCalls));
    const ctx = await mountProvider();

    await expect(ctx.installFromUrl("file://~/code/my-ext")).rejects.toThrow(
      /file:\/\/~/,
    );
    // No register attempt was made for the invalid form.
    expect(registerCalls).toHaveLength(0);
  });

  it("reloads a local extension by re-registering and re-fetching", async () => {
    const registerCalls: string[] = [];
    vi.stubGlobal("fetch", localFetch(registerCalls));
    const ctx = await mountProvider();

    await act(async () => {
      await ctx.installFromUrl("~/code/my-ext");
    });
    await act(async () => {
      await ctx.reloadExtension("acme.local");
    });

    // Registered once for install, once for reload.
    expect(registerCalls).toHaveLength(2);
    const installed = useInstalledExtensionsStore
      .getState()
      .installed.find((e) => e.id === "acme.local");
    expect(installed?.sourceUrl).toBe(localBase);
  });

  it("refuses to reload a non-local extension", async () => {
    const state: FetchState = {
      latestVersion: "1.0.0",
      manifests: {
        "https://cdn.example.com/ext": manifest({ version: "1.0.0" }),
      },
    };
    vi.stubGlobal("fetch", installFetch(state));
    const ctx = await mountProvider();

    await act(async () => {
      await ctx.installFromUrl("https://cdn.example.com/ext");
    });
    await expect(ctx.reloadExtension("acme.test")).rejects.toThrow(
      /not a reloadable local extension/,
    );
  });
});
