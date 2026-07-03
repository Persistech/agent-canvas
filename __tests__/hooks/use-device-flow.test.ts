import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDeviceFlow } from "../../src/hooks/use-device-flow";
import * as deviceFlowClient from "../../src/api/device-flow-client";

vi.mock("../../src/api/device-flow-client", () => ({
  startDeviceFlow: vi.fn(),
  pollForToken: vi.fn(),
  DeviceFlowError: class DeviceFlowError extends Error {
    code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.name = "DeviceFlowError";
      this.code = code;
    }
  },
}));

describe("useDeviceFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with idle state", () => {
    const { result } = renderHook(() => useDeviceFlow());

    expect(result.current.status).toBe("idle");
    expect(result.current.verificationUrl).toBeNull();
    expect(result.current.userCode).toBeNull();
    expect(result.current.userId).toBeNull();
    expect(result.current.error).toBeNull();
    // The API key is intentionally **not** exposed in the cookie-based flow
    // because the cookie endpoint mints it as an HttpOnly cookie rather
    // than returning it to JS — exposing `apiKey` here would re-create the
    // XSS-exfiltration surface the cookie endpoint exists to remove.
    expect(result.current).not.toHaveProperty("apiKey");
  });

  it("transitions through states on successful cookie auth", async () => {
    const mockAuthResponse = {
      device_code: "device123",
      user_code: "USER-1234",
      verification_uri: "https://app.all-hands.dev/device",
      verification_uri_complete:
        "https://app.all-hands.dev/device?user_code=USER-1234",
      expires_in: 600,
      interval: 5,
    };

    const mockCookieResponse = {
      success: true as const,
      user_id: "user-123",
    };

    // Make startDeviceFlow resolve after a tick to allow observing states
    let resolveStart: (value: typeof mockAuthResponse) => void;
    const startPromise = new Promise<typeof mockAuthResponse>((resolve) => {
      resolveStart = resolve;
    });

    let resolvePoll: (value: typeof mockCookieResponse) => void;
    const pollPromise = new Promise<typeof mockCookieResponse>((resolve) => {
      resolvePoll = resolve;
    });

    vi.mocked(deviceFlowClient.startDeviceFlow).mockReturnValue(startPromise);
    vi.mocked(deviceFlowClient.pollForToken).mockReturnValue(pollPromise);

    const { result } = renderHook(() => useDeviceFlow());

    // Start the flow
    act(() => {
      result.current.start("https://app.all-hands.dev");
    });

    // Should be starting
    expect(result.current.status).toBe("starting");

    // Resolve startDeviceFlow
    await act(async () => {
      resolveStart!(mockAuthResponse);
      await Promise.resolve(); // flush microtasks
    });

    // Now should be awaiting_authorization
    expect(result.current.status).toBe("awaiting_authorization");
    expect(result.current.verificationUrl).toBe(
      "https://app.all-hands.dev/device?user_code=USER-1234",
    );
    expect(result.current.userCode).toBe("USER-1234");

    // Resolve pollForToken
    await act(async () => {
      resolvePoll!(mockCookieResponse);
      await Promise.resolve(); // flush microtasks
    });

    // Now should be success with the user id — never the API key.
    expect(result.current.status).toBe("success");
    expect(result.current.userId).toBe("user-123");
  });

  it("handles startDeviceFlow error", async () => {
    vi.mocked(deviceFlowClient.startDeviceFlow).mockRejectedValue(
      new deviceFlowClient.DeviceFlowError("Failed to start"),
    );

    const { result } = renderHook(() => useDeviceFlow());

    act(() => {
      result.current.start("https://app.all-hands.dev");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error).toBe("Failed to start");
  });

  it("handles pollForToken error", async () => {
    const mockAuthResponse = {
      device_code: "device123",
      user_code: "USER-1234",
      verification_uri: "https://app.all-hands.dev/device",
      verification_uri_complete:
        "https://app.all-hands.dev/device?user_code=USER-1234",
      expires_in: 600,
      interval: 5,
    };

    vi.mocked(deviceFlowClient.startDeviceFlow).mockResolvedValue(
      mockAuthResponse,
    );
    vi.mocked(deviceFlowClient.pollForToken).mockRejectedValue(
      new deviceFlowClient.DeviceFlowError("Access denied", "access_denied"),
    );

    const { result } = renderHook(() => useDeviceFlow());

    act(() => {
      result.current.start("https://app.all-hands.dev");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error).toBe("Access denied");
    expect(result.current.errorCode).toBe("access_denied");
  });

  it("cancels flow and resets to idle", async () => {
    const mockAuthResponse = {
      device_code: "device123",
      user_code: "USER-1234",
      verification_uri: "https://app.all-hands.dev/device",
      verification_uri_complete:
        "https://app.all-hands.dev/device?user_code=USER-1234",
      expires_in: 600,
      interval: 5,
    };

    // Make pollForToken hang indefinitely
    vi.mocked(deviceFlowClient.startDeviceFlow).mockResolvedValue(
      mockAuthResponse,
    );
    vi.mocked(deviceFlowClient.pollForToken).mockImplementation(
      () => new Promise(() => {}),
    );

    const { result } = renderHook(() => useDeviceFlow());

    act(() => {
      result.current.start("https://app.all-hands.dev");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("awaiting_authorization");
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.verificationUrl).toBeNull();
  });

  it("resets to idle state", async () => {
    const mockAuthResponse = {
      device_code: "device123",
      user_code: "USER-1234",
      verification_uri: "https://app.all-hands.dev/device",
      verification_uri_complete:
        "https://app.all-hands.dev/device?user_code=USER-1234",
      expires_in: 600,
      interval: 5,
    };

    const mockCookieResponse = {
      success: true as const,
      user_id: "user-123",
    };

    vi.mocked(deviceFlowClient.startDeviceFlow).mockResolvedValue(
      mockAuthResponse,
    );
    vi.mocked(deviceFlowClient.pollForToken).mockResolvedValue(
      mockCookieResponse,
    );

    const { result } = renderHook(() => useDeviceFlow());

    act(() => {
      result.current.start("https://app.all-hands.dev");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.userId).toBeNull();
  });

  it("cancels previous flow when starting a new one", async () => {
    const mockAuthResponse = {
      device_code: "device123",
      user_code: "USER-1234",
      verification_uri: "https://app.all-hands.dev/device",
      verification_uri_complete:
        "https://app.all-hands.dev/device?user_code=USER-1234",
      expires_in: 600,
      interval: 5,
    };

    vi.mocked(deviceFlowClient.startDeviceFlow).mockResolvedValue(
      mockAuthResponse,
    );
    vi.mocked(deviceFlowClient.pollForToken).mockImplementation(
      () => new Promise(() => {}),
    );

    const { result } = renderHook(() => useDeviceFlow());

    // Start first flow
    act(() => {
      result.current.start("https://app.all-hands.dev");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("awaiting_authorization");
    });

    // Start second flow (should cancel first)
    act(() => {
      result.current.start("https://staging.all-hands.dev");
    });

    // Should be starting again (first flow cancelled)
    expect(result.current.status).toBe("starting");
  });

  it("cleans up on unmount without state update warnings", async () => {
    const mockAuthResponse = {
      device_code: "device123",
      user_code: "USER-1234",
      verification_uri: "https://app.all-hands.dev/device",
      verification_uri_complete: "https://app.all-hands.dev/device?user_code=USER-1234",
      expires_in: 600,
      interval: 5,
    };

    vi.mocked(deviceFlowClient.startDeviceFlow).mockResolvedValue(
      mockAuthResponse,
    );
    // Make pollForToken hang forever to simulate in-progress flow
    vi.mocked(deviceFlowClient.pollForToken).mockImplementation(
      () => new Promise(() => {}),
    );

    const { result, unmount } = renderHook(() => useDeviceFlow());

    act(() => {
      result.current.start("https://app.all-hands.dev");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("awaiting_authorization");
    });

    // Unmount should abort without errors or state update warnings
    unmount();

    // If cleanup didn't work, React would warn about state updates on unmounted component
    // No assertion needed - the test passes if unmount completes without warnings
  });
});
