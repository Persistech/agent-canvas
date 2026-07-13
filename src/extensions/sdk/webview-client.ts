import { RpcEndpoint, type RpcMessage, type RpcTransport } from "../host/rpc";
import { createAgentCanvasApi } from "./api-proxy";
import type { AgentCanvasApi } from "./types";

/** Message type for iframe content height updates — must match host's RESIZE_MESSAGE_TYPE. */
const RESIZE_MESSAGE_TYPE = "agentCanvas:resize";

/** Message type for theme variable injection — must match host's THEME_MESSAGE_TYPE. */
const THEME_MESSAGE_TYPE = "agentCanvas:theme";

/**
 * Client used by webview documents (customer HTML/JS running inside the sandboxed
 * iframe) to obtain the `agentCanvas` API. It speaks the same RPC protocol to its
 * parent (the host) that the worker runtime does, so webviews get the identical,
 * capability-gated API surface.
 *
 * Usage inside a webview:
 * ```ts
 * import { acquireAgentCanvasApi } from "@agent-canvas/extension-api/webview";
 * const api = acquireAgentCanvasApi();
 * await api.window.showInformationMessage("hello from a webview");
 * ```
 */
export function acquireAgentCanvasApi(): AgentCanvasApi {
  const parentWindow = window.parent;

  const transport: RpcTransport = {
    post: (message) => parentWindow.postMessage(message, "*"),
    subscribe: (handler) => {
      const listener = (event: MessageEvent) => {
        // Only accept messages from the host (the parent window).
        if (event.source !== parentWindow) return;
        handler(event.data as RpcMessage);
      };
      window.addEventListener("message", listener);
      return () => window.removeEventListener("message", listener);
    },
  };

  const endpoint = new RpcEndpoint(transport);
  // Webviews don't receive host-driven command invocations in the initial version,
  // so the local handler map is unused by the host but keeps the API uniform.
  return createAgentCanvasApi(endpoint, new Map());
}

/**
 * Sends the current content height to the host so the iframe can be auto-resized.
 * Call this after your content has rendered or when content changes dynamically.
 *
 * @param height - The content height in pixels. If omitted, uses `document.body.scrollHeight`.
 *
 * @example
 * ```ts
 * import { reportContentHeight } from "@agent-canvas/extension-api/webview";
 *
 * // Report height after initial render
 * reportContentHeight();
 *
 * // Or report a specific height
 * reportContentHeight(500);
 * ```
 */
export function reportContentHeight(height?: number): void {
  const contentHeight = height ?? document.body.scrollHeight;
  window.parent.postMessage(
    { type: RESIZE_MESSAGE_TYPE, height: contentHeight },
    "*",
  );
}

/**
 * Sets up automatic height reporting using ResizeObserver.
 * The iframe height will be updated whenever the document body size changes.
 *
 * @returns A cleanup function to disconnect the observer.
 *
 * @example
 * ```ts
 * import { enableAutoResize } from "@agent-canvas/extension-api/webview";
 *
 * // Enable auto-resize when the page loads
 * const cleanup = enableAutoResize();
 *
 * // Later, if needed:
 * cleanup();
 * ```
 */
export function enableAutoResize(): () => void {
  // Report initial height
  reportContentHeight();

  // Watch for size changes
  const observer = new ResizeObserver(() => {
    reportContentHeight();
  });

  observer.observe(document.body);

  return () => observer.disconnect();
}

/**
 * Applies AgentCanvas theme variables to the document.
 * This listens for theme messages from the host and injects CSS custom properties
 * into `:root`, allowing extensions to use `var(--oh-background)` etc. for theming.
 *
 * Also injects base styles for `html` and `body` so the extension automatically
 * has the correct background color and text color without any additional CSS.
 *
 * Call this early in your extension (before DOM is ready is fine).
 *
 * @returns A cleanup function to remove the listener.
 *
 * @example
 * ```html
 * <script>
 *   // Apply theme from host - this sets up background/text colors automatically
 *   enableHostTheme();
 * </script>
 * <style>
 *   .card {
 *     background: var(--oh-surface);
 *     border: 1px solid var(--oh-border-subtle);
 *     border-radius: var(--oh-radius);
 *   }
 * </style>
 * ```
 */
export function enableHostTheme(): () => void {
  // Inject base theme styles that use the CSS variables
  // This ensures the document has correct background/text colors automatically
  injectBaseThemeStyles();

  const handleMessage = (event: MessageEvent) => {
    // Only accept messages from the parent window (host)
    if (event.source !== window.parent) return;

    // Handle theme messages
    if (
      event.data &&
      typeof event.data === "object" &&
      event.data.type === THEME_MESSAGE_TYPE &&
      typeof event.data.variables === "object"
    ) {
      const variables = event.data.variables as Record<string, string>;
      const root = document.documentElement;

      // Inject each CSS variable into :root
      for (const [name, value] of Object.entries(variables)) {
        root.style.setProperty(name, value);
      }
    }
  };

  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}

/** ID for the injected base theme stylesheet */
const BASE_THEME_STYLE_ID = "agent-canvas-base-theme";

/**
 * Injects a base stylesheet that sets up essential theme styles.
 * This is called automatically by `enableHostTheme()` but can be called
 * separately if you only want the base styles without the dynamic theme listener.
 */
export function injectBaseThemeStyles(): void {
  // Don't inject twice
  if (document.getElementById(BASE_THEME_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = BASE_THEME_STYLE_ID;
  style.textContent = `
    /* Base theme styles injected by Agent Canvas */
    :root {
      color-scheme: dark;
    }
    html, body {
      margin: 0;
      padding: 0;
      background-color: var(--oh-background, #0b0e14);
      color: var(--oh-foreground, #e5e7eb);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    /* Ensure links are visible */
    a {
      color: var(--oh-color-primary, #60a5fa);
    }
    /* Button defaults */
    button {
      font-family: inherit;
      cursor: pointer;
    }
  `;

  // Insert at the beginning of <head> so extension styles can override
  if (document.head) {
    document.head.insertBefore(style, document.head.firstChild);
  } else {
    // If head doesn't exist yet, wait for DOMContentLoaded
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        document.head.insertBefore(style, document.head.firstChild);
      },
      { once: true },
    );
  }
}
