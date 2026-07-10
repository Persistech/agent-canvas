import { RpcEndpoint, type RpcMessage, type RpcTransport } from "../host/rpc";
import { createAgentCanvasApi } from "./api-proxy";
import type { AgentCanvasApi } from "./types";

/** Message type for iframe content height updates — must match host's RESIZE_MESSAGE_TYPE. */
const RESIZE_MESSAGE_TYPE = "agentCanvas:resize";

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
