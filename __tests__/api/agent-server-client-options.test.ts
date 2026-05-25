import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAgentServerClientOptions } from "#/api/agent-server-client-options";
import {
  __resetActiveStoreForTests,
  setActiveSelection,
  setRegisteredBackends,
} from "#/api/backend-registry/active-store";
import type { Backend } from "#/api/backend-registry/types";

const ORIGINAL_LOCATION = window.location;

function mockWindowLocation(url: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(url),
  });
}

beforeEach(() => {
  window.localStorage.clear();
  __resetActiveStoreForTests();
});

afterEach(() => {
  window.localStorage.clear();
  __resetActiveStoreForTests();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: ORIGINAL_LOCATION,
  });
});

describe("agent server client options", () => {
  it("routes stored loopback local backends through the browser origin for proxy-capable runtime browsers", () => {
    mockWindowLocation(
      "https://work-1-abc.prod-runtime.all-hands.dev/conversations",
    );
    const backend: Backend = {
      id: "local-1",
      name: "Local",
      host: "http://127.0.0.1:18000",
      apiKey: "session-key",
      kind: "local",
    };
    setRegisteredBackends([backend]);
    setActiveSelection({ backendId: backend.id, orgId: null });

    expect(getAgentServerClientOptions()).toMatchObject({
      host: "https://work-1-abc.prod-runtime.all-hands.dev",
      apiKey: "session-key",
    });
  });

  it("preserves stored loopback local backends for separately hosted frontends", () => {
    mockWindowLocation("https://agent-canvas.example.com/conversations");
    const backend: Backend = {
      id: "local-1",
      name: "Local",
      host: "http://127.0.0.1:18000",
      apiKey: "session-key",
      kind: "local",
    };
    setRegisteredBackends([backend]);
    setActiveSelection({ backendId: backend.id, orgId: null });

    expect(getAgentServerClientOptions()).toMatchObject({
      host: "http://127.0.0.1:18000",
      apiKey: "session-key",
    });
  });

  it("preserves non-loopback local backend hosts", () => {
    mockWindowLocation("https://work-1.example.dev/conversations");
    const backend: Backend = {
      id: "local-1",
      name: "Local",
      host: "https://agent.example.com/",
      apiKey: "session-key",
      kind: "local",
    };
    setRegisteredBackends([backend]);
    setActiveSelection({ backendId: backend.id, orgId: null });

    expect(getAgentServerClientOptions()).toMatchObject({
      host: "https://agent.example.com",
      apiKey: "session-key",
    });
  });
});
