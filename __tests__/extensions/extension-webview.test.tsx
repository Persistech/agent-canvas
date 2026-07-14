import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { ExtensionWebview } from "#/components/features/extensions/extension-webview";
import type { HostApiDeps } from "#/extensions/host/host-api";

function makeDeps(): HostApiDeps {
  return {
    getActiveConversation: () => null,
    getEventStats: vi.fn(async () => ({
      total: 0,
      byKind: {},
      bySource: {},
      firstTimestamp: null,
      lastTimestamp: null,
      durationMs: null,
      truncated: false,
    })),
    showInformationMessage: vi.fn(),
    executeCommand: vi.fn(),
    storageGet: vi.fn(),
    storageSet: vi.fn(),
  };
}

const panelTitle = "Policy Checks";

describe("ExtensionWebview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a sandboxed iframe without allow-same-origin", () => {
    render(
      <ExtensionWebview
        extensionId="acme.compliance"
        capabilities={["conversation:read"]}
        deps={makeDeps()}
        src="blob:panel-html"
        title={panelTitle}
      />,
    );

    const frame = screen.getByTestId(
      "extension-webview-acme.compliance",
    ) as HTMLIFrameElement;

    const sandbox = frame.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
    expect(frame).toHaveAttribute("src", "blob:panel-html");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(frame).toHaveAttribute("title", "Policy Checks");
  });

  describe("autoResize", () => {
    it("uses h-full class when autoResize is false (default)", () => {
      render(
        <ExtensionWebview
          extensionId="acme.compliance"
          capabilities={[]}
          deps={makeDeps()}
          src="blob:panel-html"
          title={panelTitle}
        />,
      );

      const frame = screen.getByTestId(
        "extension-webview-acme.compliance",
      ) as HTMLIFrameElement;
      expect(frame.className).toContain("h-full");
    });

    it("does not use h-full class when autoResize is true", () => {
      render(
        <ExtensionWebview
          extensionId="acme.compliance"
          capabilities={[]}
          deps={makeDeps()}
          src="blob:panel-html"
          title={panelTitle}
          autoResize
        />,
      );

      const frame = screen.getByTestId(
        "extension-webview-acme.compliance",
      ) as HTMLIFrameElement;
      expect(frame.className).not.toContain("h-full");
      expect(frame.className).toContain("w-full");
    });

    it("sets minHeight style when autoResize is enabled", () => {
      render(
        <ExtensionWebview
          extensionId="acme.compliance"
          capabilities={[]}
          deps={makeDeps()}
          src="blob:panel-html"
          title={panelTitle}
          autoResize
          minHeight={400}
        />,
      );

      const frame = screen.getByTestId(
        "extension-webview-acme.compliance",
      ) as HTMLIFrameElement;
      expect(frame.style.minHeight).toBe("400px");
      expect(frame.style.height).toBe("400px"); // Initial height = minHeight
    });

    it("updates height when receiving resize message from iframe", () => {
      render(
        <ExtensionWebview
          extensionId="acme.compliance"
          capabilities={[]}
          deps={makeDeps()}
          src="blob:panel-html"
          title={panelTitle}
          autoResize
          minHeight={200}
        />,
      );

      const frame = screen.getByTestId(
        "extension-webview-acme.compliance",
      ) as HTMLIFrameElement;

      // Simulate a resize message from the iframe
      act(() => {
        const event = new MessageEvent("message", {
          data: { type: "agentCanvas:resize", height: 600 },
          source: frame.contentWindow,
        });
        window.dispatchEvent(event);
      });

      expect(frame.style.height).toBe("600px");
    });

    it("enforces minHeight when resize message reports smaller height", () => {
      render(
        <ExtensionWebview
          extensionId="acme.compliance"
          capabilities={[]}
          deps={makeDeps()}
          src="blob:panel-html"
          title={panelTitle}
          autoResize
          minHeight={300}
        />,
      );

      const frame = screen.getByTestId(
        "extension-webview-acme.compliance",
      ) as HTMLIFrameElement;

      // Simulate a resize message with height smaller than minHeight
      act(() => {
        const event = new MessageEvent("message", {
          data: { type: "agentCanvas:resize", height: 100 },
          source: frame.contentWindow,
        });
        window.dispatchEvent(event);
      });

      // Should clamp to minHeight
      expect(frame.style.height).toBe("300px");
    });

    it("ignores resize messages from other sources", () => {
      render(
        <ExtensionWebview
          extensionId="acme.compliance"
          capabilities={[]}
          deps={makeDeps()}
          src="blob:panel-html"
          title={panelTitle}
          autoResize
          minHeight={200}
        />,
      );

      const frame = screen.getByTestId(
        "extension-webview-acme.compliance",
      ) as HTMLIFrameElement;

      // Simulate a resize message from a different source (not the iframe)
      act(() => {
        const event = new MessageEvent("message", {
          data: { type: "agentCanvas:resize", height: 999 },
          source: window, // Different source
        });
        window.dispatchEvent(event);
      });

      // Height should remain at minHeight (initial value)
      expect(frame.style.height).toBe("200px");
    });
  });
});
