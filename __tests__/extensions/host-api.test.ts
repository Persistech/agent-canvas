import { describe, expect, it, vi } from "vitest";
import {
  createHostMethods,
  type HostApiDeps,
} from "#/extensions/host/host-api";
import type { Capability } from "#/extensions/manifest";

function makeDeps(overrides: Partial<HostApiDeps> = {}): HostApiDeps {
  return {
    getActiveConversation: () => ({
      id: "c1",
      title: "Active",
      status: "running",
      model: "gpt-4",
      agentKind: "openhands",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      selectedRepository: null,
      workingDir: "/workspace",
      backend: "local",
      sandboxId: null,
      sandboxStatus: null,
    }),
    getEventStats: vi.fn(async () => ({
      total: 3,
      byKind: { MessageEvent: 1, ActionEvent: 2 },
      bySource: { user: 1, agent: 2 },
      firstTimestamp: "2024-01-01T00:00:00Z",
      lastTimestamp: "2024-01-01T00:05:00Z",
      durationMs: 300000,
      truncated: false,
    })),
    showInformationMessage: vi.fn(),
    executeCommand: vi.fn(async () => "executed"),
    storageGet: vi.fn(() => "stored"),
    storageSet: vi.fn(),
    ...overrides,
  };
}

function methodsFor(capabilities: Capability[], deps = makeDeps()) {
  return createHostMethods("acme.ext", capabilities, deps);
}

describe("createHostMethods (capability gating)", () => {
  it("exposes ungated UI affordances without capabilities", async () => {
    const deps = makeDeps();
    const methods = methodsFor([], deps);

    methods["window.showInformationMessage"]({ message: "hi" });
    expect(deps.showInformationMessage).toHaveBeenCalledWith("hi");

    await expect(
      methods["commands.execute"]({ command: "core.save", args: [] }),
    ).resolves.toBe("executed");
  });

  it("allows conversation.getActive when conversation:read is granted", () => {
    const methods = methodsFor(["conversation:read"]);
    expect(methods["conversation.getActive"](undefined)).toEqual({
      id: "c1",
      title: "Active",
      status: "running",
      model: "gpt-4",
      agentKind: "openhands",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      selectedRepository: null,
      workingDir: "/workspace",
      backend: "local",
      sandboxId: null,
      sandboxStatus: null,
    });
  });

  it("throws conversation.getActive without the capability", () => {
    const methods = methodsFor([]);
    expect(() => methods["conversation.getActive"](undefined)).toThrow(
      /missing capability: conversation:read/,
    );
  });

  it("allows conversation.getEventStats when conversation:read is granted", async () => {
    const deps = makeDeps();
    const methods = methodsFor(["conversation:read"], deps);
    await expect(
      methods["conversation.getEventStats"]({ conversationId: "c9" }),
    ).resolves.toMatchObject({ total: 3, durationMs: 300000 });
    expect(deps.getEventStats).toHaveBeenCalledWith("c9");
  });

  it("throws conversation.getEventStats without the capability", () => {
    const methods = methodsFor([]);
    expect(() => methods["conversation.getEventStats"]({})).toThrow(
      /missing capability: conversation:read/,
    );
  });

  it("gates storage behind the storage capability", () => {
    const denied = methodsFor([]);
    expect(() => denied["storage.get"]({ key: "k" })).toThrow(
      /missing capability: storage/,
    );

    const deps = makeDeps();
    const granted = methodsFor(["storage"], deps);
    expect(granted["storage.get"]({ key: "k" })).toBe("stored");
    granted["storage.set"]({ key: "k", value: 1 });
    expect(deps.storageSet).toHaveBeenCalledWith("acme.ext", "k", 1);
  });

  it("returns null from storage.get when nothing is stored", () => {
    const deps = makeDeps({ storageGet: () => undefined });
    const methods = methodsFor(["storage"], deps);
    expect(methods["storage.get"]({ key: "missing" })).toBeNull();
  });
});
