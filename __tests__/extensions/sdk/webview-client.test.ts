import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  reportContentHeight,
  enableAutoResize,
} from "#/extensions/sdk/webview-client";

describe("webview-client resize helpers", () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;
  let originalParent: typeof window.parent;

  beforeEach(() => {
    // Mock window.parent.postMessage
    originalParent = window.parent;
    postMessageSpy = vi.fn();
    Object.defineProperty(window, "parent", {
      value: { postMessage: postMessageSpy },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "parent", {
      value: originalParent,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe("reportContentHeight", () => {
    it("sends resize message with document.body.scrollHeight when no height provided", () => {
      // Mock scrollHeight
      Object.defineProperty(document.body, "scrollHeight", {
        value: 500,
        configurable: true,
      });

      reportContentHeight();

      expect(postMessageSpy).toHaveBeenCalledWith(
        { type: "agentCanvas:resize", height: 500 },
        "*",
      );
    });

    it("sends resize message with explicit height when provided", () => {
      reportContentHeight(800);

      expect(postMessageSpy).toHaveBeenCalledWith(
        { type: "agentCanvas:resize", height: 800 },
        "*",
      );
    });
  });

  describe("enableAutoResize", () => {
    let observeSpy: ReturnType<typeof vi.fn>;
    let disconnectSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      observeSpy = vi.fn();
      disconnectSpy = vi.fn();

      // Create a proper mock constructor class
      class MockResizeObserver {
        observe = observeSpy;
        disconnect = disconnectSpy;
        unobserve = vi.fn();
        constructor(_callback: ResizeObserverCallback) {
          // Store callback if needed for testing
        }
      }

      vi.stubGlobal("ResizeObserver", MockResizeObserver);

      // Mock scrollHeight for initial report
      Object.defineProperty(document.body, "scrollHeight", {
        value: 300,
        configurable: true,
      });
    });

    it("reports initial height on setup", () => {
      enableAutoResize();

      expect(postMessageSpy).toHaveBeenCalledWith(
        { type: "agentCanvas:resize", height: 300 },
        "*",
      );
    });

    it("observes document.body for resize", () => {
      enableAutoResize();

      expect(observeSpy).toHaveBeenCalledWith(document.body);
    });

    it("returns cleanup function that disconnects observer", () => {
      const cleanup = enableAutoResize();

      expect(disconnectSpy).not.toHaveBeenCalled();

      cleanup();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});
