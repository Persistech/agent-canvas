import { describe, expect, it, vi } from "vitest";
import { AgentServerUnknownVersionError } from "#/api/agent-server-compatibility";
import type { Backend } from "#/api/backend-registry/types";
import {
  BACKEND_HEALTH_PROBE_MAX_ATTEMPTS,
  CLOUD_BACKEND_API_KEY_OR_NETWORK_ERROR,
  INVALID_BACKEND_API_KEY_ERROR,
  isRetryableBackendHealthError,
  probeBackendWithRetries,
} from "./use-backends-health";

const localBackend: Backend = {
  id: "local",
  kind: "local",
  name: "Local",
  host: "http://localhost:8001",
  apiKey: "",
};

const cloudBackend: Backend = {
  id: "cloud",
  kind: "cloud",
  name: "Cloud",
  host: "https://app.all-hands.dev",
  apiKey: "oh-cloud-key",
};

describe("isRetryableBackendHealthError", () => {
  it("does not retry credential and compatibility failures", () => {
    expect(
      isRetryableBackendHealthError(
        localBackend,
        new Error(INVALID_BACKEND_API_KEY_ERROR),
      ),
    ).toBe(false);
    expect(
      isRetryableBackendHealthError(
        localBackend,
        new AgentServerUnknownVersionError("unknown"),
      ),
    ).toBe(false);
  });

  it("retries transient network failures", () => {
    expect(
      isRetryableBackendHealthError(
        cloudBackend,
        new Error(CLOUD_BACKEND_API_KEY_OR_NETWORK_ERROR),
      ),
    ).toBe(true);
    expect(
      isRetryableBackendHealthError(localBackend, new Error("Failed to fetch")),
    ).toBe(true);
  });
});

describe("probeBackendWithRetries", () => {
  it("retries transient probe failures before succeeding", async () => {
    const probe = vi
      .fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce(true);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      probeBackendWithRetries(localBackend, probe, sleep),
    ).resolves.toBe(true);

    expect(probe).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-transient failures", async () => {
    const probe = vi
      .fn()
      .mockRejectedValue(new Error(INVALID_BACKEND_API_KEY_ERROR));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      probeBackendWithRetries(localBackend, probe, sleep),
    ).rejects.toThrow(INVALID_BACKEND_API_KEY_ERROR);

    expect(probe).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("throws after exhausting transient retry attempts", async () => {
    const probe = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      probeBackendWithRetries(localBackend, probe, sleep),
    ).rejects.toThrow("Failed to fetch");

    expect(probe).toHaveBeenCalledTimes(BACKEND_HEALTH_PROBE_MAX_ATTEMPTS);
  });
});
