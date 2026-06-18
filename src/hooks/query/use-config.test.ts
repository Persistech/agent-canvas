import { describe, expect, it } from "vitest";
import {
  AgentServerUnknownVersionError,
  AgentServerUnavailableError,
  AgentServerUnsupportedVersionError,
} from "#/api/agent-server-compatibility";
import {
  AGENT_SERVER_BOOTSTRAP_RETRY_COUNT,
  getConfigRetryDelay,
  shouldRetryConfigQuery,
} from "./use-config";

describe("shouldRetryConfigQuery", () => {
  it("retries transient agent-server unavailable errors", () => {
    const error = new AgentServerUnavailableError("timeout");

    expect(shouldRetryConfigQuery(0, error)).toBe(true);
    expect(
      shouldRetryConfigQuery(AGENT_SERVER_BOOTSTRAP_RETRY_COUNT, error),
    ).toBe(false);
  });

  it("does not retry when no backend is configured", () => {
    const error = new AgentServerUnavailableError("No backend configured", {
      noBackendConfigured: true,
    });

    expect(shouldRetryConfigQuery(0, error)).toBe(false);
  });

  it("does not retry compatibility failures", () => {
    expect(
      shouldRetryConfigQuery(
        0,
        new AgentServerUnsupportedVersionError("1.0.0"),
      ),
    ).toBe(false);
    expect(
      shouldRetryConfigQuery(0, new AgentServerUnknownVersionError(null)),
    ).toBe(false);
  });

  it("keeps the existing retry cap for non-bootstrap errors", () => {
    const error = new Error("Unexpected");

    expect(shouldRetryConfigQuery(0, error)).toBe(true);
    expect(shouldRetryConfigQuery(3, error)).toBe(false);
  });

  it("uses capped exponential backoff", () => {
    expect(getConfigRetryDelay(0)).toBe(1000);
    expect(getConfigRetryDelay(1)).toBe(2000);
    expect(getConfigRetryDelay(10)).toBe(5000);
  });
});
