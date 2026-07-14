import { ServerClient } from "@openhands/typescript-client/clients";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetActiveStoreForTests,
  setActiveSelection,
  setRegisteredBackends,
} from "#/api/backend-registry/active-store";
import type { Backend } from "#/api/backend-registry/types";
import {
  AGENT_LAUNCH_ADDITIONS_MINIMUM_VERSION,
  AgentServerUnavailableError,
  AgentServerUnknownVersionError,
  AgentServerUnsupportedVersionError,
  clearCachedAgentServerInfo,
  isCachedAgentServerVersionAtLeast,
  loadAgentServerInfo,
  MINIMUM_COMPATIBLE_AGENT_SERVER_VERSION,
} from "#/api/agent-server-compatibility";

const { getServerInfoMock } = vi.hoisted(() => ({
  getServerInfoMock: vi.fn(),
}));

vi.mock("@openhands/typescript-client/clients", () => ({
  ServerClient: vi.fn(function ServerClientMock() {
    return {
      getServerInfo: getServerInfoMock,
    };
  }),
  SettingsClient: vi.fn(function SettingsClientMock() {
    return {
      getSettings: vi.fn(),
    };
  }),
}));

const cloudBackend: Backend = {
  id: "prod",
  name: "Production",
  host: "https://app.all-hands.dev",
  apiKey: "bearer-token",
  kind: "cloud",
};

const localBackend: Backend = {
  id: "local",
  name: "Local",
  host: "http://localhost:9000",
  apiKey: "local-key",
  kind: "local",
};

beforeEach(() => {
  window.localStorage.clear();
  __resetActiveStoreForTests();
  clearCachedAgentServerInfo();
  getServerInfoMock.mockReset();
  vi.mocked(ServerClient).mockClear();
  getServerInfoMock.mockResolvedValue({
    version: MINIMUM_COMPATIBLE_AGENT_SERVER_VERSION,
  });
});

afterEach(() => {
  window.localStorage.clear();
  __resetActiveStoreForTests();
});

describe("loadAgentServerInfo", () => {
  it("checks feature version floors against the cached server version", async () => {
    expect(isCachedAgentServerVersionAtLeast("1.34.0")).toBe(false);

    setRegisteredBackends([localBackend]);
    setActiveSelection({ backendId: localBackend.id });
    getServerInfoMock.mockResolvedValue({ version: "1.33.0" });
    await loadAgentServerInfo();

    expect(isCachedAgentServerVersionAtLeast("1.34.0")).toBe(false);

    getServerInfoMock.mockResolvedValue({ version: "1.34.0" });
    await loadAgentServerInfo();

    expect(isCachedAgentServerVersionAtLeast("1.34.0")).toBe(true);
  });

  it("keeps unreleased profile launch features disabled on agent-server 1.35.0", async () => {
    setRegisteredBackends([localBackend]);
    setActiveSelection({ backendId: localBackend.id });
    getServerInfoMock.mockResolvedValue({ version: "1.35.0" });
    await loadAgentServerInfo();

    expect(
      isCachedAgentServerVersionAtLeast(AGENT_LAUNCH_ADDITIONS_MINIMUM_VERSION),
    ).toBe(false);

    getServerInfoMock.mockResolvedValue({ version: "1.36.0" });
    await loadAgentServerInfo();

    expect(
      isCachedAgentServerVersionAtLeast(AGENT_LAUNCH_ADDITIONS_MINIMUM_VERSION),
    ).toBe(true);
  });

  it("returns server info when the local backend reports the minimum compatible version", async () => {
    setRegisteredBackends([localBackend]);
    setActiveSelection({ backendId: localBackend.id });

    const result = await loadAgentServerInfo();

    expect(result).toMatchObject({
      version: MINIMUM_COMPATIBLE_AGENT_SERVER_VERSION,
    });
    expect(ServerClient).toHaveBeenCalled();
  });

  it("throws AgentServerUnsupportedVersionError when the local backend is too old", async () => {
    setRegisteredBackends([localBackend]);
    setActiveSelection({ backendId: localBackend.id });
    getServerInfoMock.mockResolvedValue({ version: "1.27.1" });

    await expect(loadAgentServerInfo()).rejects.toMatchObject({
      name: AgentServerUnsupportedVersionError.name,
      actualVersion: "1.27.1",
      requiredVersion: MINIMUM_COMPATIBLE_AGENT_SERVER_VERSION,
    });
  });

  it("throws AgentServerUnknownVersionError when the local backend omits its version", async () => {
    setRegisteredBackends([localBackend]);
    setActiveSelection({ backendId: localBackend.id });
    getServerInfoMock.mockResolvedValue({});

    await expect(loadAgentServerInfo()).rejects.toMatchObject({
      name: AgentServerUnknownVersionError.name,
      actualVersion: null,
      requiredVersion: MINIMUM_COMPATIBLE_AGENT_SERVER_VERSION,
    });
  });

  it("does not borrow a registered local backend when the active backend is cloud", async () => {
    setRegisteredBackends([localBackend, cloudBackend]);
    setActiveSelection({ backendId: cloudBackend.id });

    const result = await loadAgentServerInfo();

    expect(result).toBeNull();
    expect(ServerClient).not.toHaveBeenCalled();
  });

  it("throws AgentServerUnavailableError when the registry is empty", async () => {
    // Empty registry — no backends at all (frontend-only with no config).
    setRegisteredBackends([]);

    await expect(loadAgentServerInfo()).rejects.toThrow(
      AgentServerUnavailableError,
    );
    expect(ServerClient).not.toHaveBeenCalled();
  });
});
