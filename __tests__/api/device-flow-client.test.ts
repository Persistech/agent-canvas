import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  startDeviceFlow,
  pollForToken,
} from "#/api/device-flow-client";

const CLOUD_HOST = "https://app.all-hands.dev";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("device-flow-client direct cloud calls", () => {
  it("startDeviceFlow POSTs /oauth/device/authorize directly to the cloud host", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          device_code: "device123",
          user_code: "USER-1234",
          verification_uri: `${CLOUD_HOST}/device`,
          expires_in: 600,
          interval: 5,
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Act
    const result = await startDeviceFlow(`${CLOUD_HOST}///`);

    // Assert — direct call to the cloud (no /api/cloud-proxy hop),
    // trailing slashes normalized, content-type set for JSON.
    expect(fetchMock).toHaveBeenCalledWith(
      `${CLOUD_HOST}/oauth/device/authorize`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(result.device_code).toBe("device123");
  });

  it("pollForToken POSTs the form-encoded device_code body to the cloud's /oauth/device/token", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "api-key-xyz",
          token_type: "Bearer",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Act
    const result = await pollForToken(CLOUD_HOST, "device123", {
      interval: 5,
    });

    // Assert
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${CLOUD_HOST}/oauth/device/token`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    // Body is form-encoded per RFC 8628.
    expect(String(init.body)).toContain(
      "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code",
    );
    expect(String(init.body)).toContain("device_code=device123");
    expect(result.access_token).toBe("api-key-xyz");
  });
});
