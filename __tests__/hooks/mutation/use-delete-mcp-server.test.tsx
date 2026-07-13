import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteMcpServer } from "#/hooks/mutation/use-delete-mcp-server";
import type { MCPServerConfig } from "#/types/mcp-server";
import type { MCPConfig } from "#/types/settings";

const {
  parseMcpConfigMock,
  saveSettingsMock,
  toSdkMcpConfigMock,
  useSettingsMock,
} = vi.hoisted(() => ({
  parseMcpConfigMock: vi.fn(),
  saveSettingsMock: vi.fn(),
  toSdkMcpConfigMock: vi.fn(),
  useSettingsMock: vi.fn(),
}));

vi.mock("#/hooks/query/use-settings", () => ({
  useSettings: () => useSettingsMock(),
}));

vi.mock("#/api/settings-service/settings-service.api", () => ({
  default: {
    saveSettings: (...args: unknown[]) => saveSettingsMock(...args),
  },
}));

vi.mock("#/utils/mcp-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#/utils/mcp-config")>();
  return {
    ...actual,
    parseMcpConfig: (value: unknown) => parseMcpConfigMock(value),
    toSdkMcpConfig: (config: MCPConfig) => {
      const override = toSdkMcpConfigMock(config);
      return override === undefined ? actual.toSdkMcpConfig(config) : override;
    },
  };
});

const rawConfig = { source: "sdk-settings" };

function emptyConfig(): MCPConfig {
  return { sse_servers: [], stdio_servers: [], shttp_servers: [] };
}

function setup(
  options: {
    config?: MCPConfig;
    settingsData?: unknown;
  } = {},
) {
  const config = options.config ?? emptyConfig();
  const settingsData = Object.hasOwn(options, "settingsData")
    ? options.settingsData
    : { agent_settings: { mcp_config: rawConfig } };
  useSettingsMock.mockReturnValue({ data: settingsData });
  parseMcpConfigMock.mockReturnValue(config);

  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const invalidateQueries = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useDeleteMcpServer(), { wrapper });

  return { ...hook, invalidateQueries, queryClient };
}

async function remove(
  result: ReturnType<typeof setup>["result"],
  target: MCPServerConfig,
) {
  await act(async () => {
    await result.current.mutateAsync(target);
  });
}

function savedConfig(): MCPConfig {
  return toSdkMcpConfigMock.mock.calls.at(-1)?.[0] as MCPConfig;
}

function expectPersonalSettingsInvalidated(
  invalidateQueries: ReturnType<typeof vi.fn>,
) {
  expect(invalidateQueries).toHaveBeenCalledOnce();
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["settings", "personal"],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  saveSettingsMock.mockResolvedValue(undefined);
});

describe("useDeleteMcpServer", () => {
  it("deletes an SSE string at index zero and preserves cloned sibling transports", async () => {
    const config: MCPConfig = {
      sse_servers: [
        "https://remove.example/sse",
        { name: "kept-sse", url: "https://keep.example/sse" },
      ],
      shttp_servers: [{ name: "kept-http", url: "https://keep.example/http" }],
      stdio_servers: [{ name: "kept-stdio", command: "node" }],
    };
    const { invalidateQueries, result } = setup({ config });

    await remove(result, {
      id: "ignored-id",
      type: "sse",
      url: "https://remove.example/sse",
    });

    expect(parseMcpConfigMock).toHaveBeenCalledWith(rawConfig);
    expect(savedConfig()).toEqual({
      sse_servers: [{ name: "kept-sse", url: "https://keep.example/sse" }],
      shttp_servers: [{ name: "kept-http", url: "https://keep.example/http" }],
      stdio_servers: [{ name: "kept-stdio", command: "node" }],
    });
    expect(savedConfig().sse_servers).not.toBe(config.sse_servers);
    expect(savedConfig().shttp_servers).not.toBe(config.shttp_servers);
    expect(savedConfig().stdio_servers).not.toBe(config.stdio_servers);
    expect(config.sse_servers).toHaveLength(2);
    expect(saveSettingsMock).toHaveBeenCalledWith({
      agent_settings_diff: {
        mcp_config: {
          "kept-sse": {
            url: "https://keep.example/sse",
            transport: "sse",
          },
          "kept-http": {
            url: "https://keep.example/http",
            transport: "http",
          },
          "kept-stdio": { command: "node" },
        },
      },
    });
    expectPersonalSettingsInvalidated(invalidateQueries);
  });

  it("extracts an SSE URL only from a string-valued object property", async () => {
    toSdkMcpConfigMock.mockReturnValue(null);
    const malformedEntries = [
      null,
      17,
      {},
      { url: 42 },
      { name: "remove", url: "https://remove.example/sse" },
    ] as unknown as MCPConfig["sse_servers"];
    const { result } = setup({
      config: {
        ...emptyConfig(),
        sse_servers: malformedEntries,
      },
    });

    await remove(result, {
      id: "sse-object",
      type: "sse",
      url: "https://remove.example/sse",
    });

    expect(savedConfig().sse_servers).toEqual([null, 17, {}, { url: 42 }]);
  });

  it("does not match a malformed non-string URL against a malformed target", async () => {
    toSdkMcpConfigMock.mockReturnValue(null);
    const malformedEntry = { url: 42 };
    const config = {
      ...emptyConfig(),
      sse_servers: [malformedEntry],
    } as unknown as MCPConfig;
    const { result } = setup({ config });

    await remove(result, {
      id: "malformed-sse",
      type: "sse",
      url: 42,
    } as unknown as MCPServerConfig);

    expect(savedConfig().sse_servers).toEqual([malformedEntry]);
  });

  it("saves an unchanged SSE config when the URL is absent", async () => {
    const config: MCPConfig = {
      ...emptyConfig(),
      sse_servers: [{ url: "https://keep.example/sse" }],
    };
    const { result } = setup({ config });

    await remove(result, {
      id: "missing-sse",
      type: "sse",
      url: "https://absent.example/sse",
    });

    expect(savedConfig()).toEqual(config);
    expect(saveSettingsMock).toHaveBeenCalledOnce();
  });

  it("skips persistence for an SSE target without a URL", async () => {
    const { invalidateQueries, result } = setup();

    await remove(result, { id: "invalid-sse", type: "sse", url: "" });

    expect(toSdkMcpConfigMock).not.toHaveBeenCalled();
    expect(saveSettingsMock).not.toHaveBeenCalled();
    expectPersonalSettingsInvalidated(invalidateQueries);
  });

  it("deletes an SHTTP object at index zero", async () => {
    const config: MCPConfig = {
      ...emptyConfig(),
      shttp_servers: [
        { name: "remove", url: "https://remove.example/http" },
        { name: "keep", url: "https://keep.example/http" },
      ],
    };
    const { result } = setup({ config });

    await remove(result, {
      id: "shttp-object",
      type: "shttp",
      url: "https://remove.example/http",
    });

    expect(savedConfig().shttp_servers).toEqual([
      { name: "keep", url: "https://keep.example/http" },
    ]);
  });

  it("saves an unchanged SHTTP config when the URL is absent", async () => {
    const config: MCPConfig = {
      ...emptyConfig(),
      shttp_servers: ["https://keep.example/http"],
    };
    const { result } = setup({ config });

    await remove(result, {
      id: "missing-shttp",
      type: "shttp",
      url: "https://absent.example/http",
    });

    expect(savedConfig()).toEqual(config);
  });

  it("skips persistence for an SHTTP target without a URL", async () => {
    const { invalidateQueries, result } = setup();

    await remove(result, { id: "invalid-shttp", type: "shttp" });

    expect(saveSettingsMock).not.toHaveBeenCalled();
    expectPersonalSettingsInvalidated(invalidateQueries);
  });

  it.each([
    {
      storedArgs: undefined,
      targetArgs: [] as string[] | undefined,
      label: "stored args are omitted",
    },
    {
      storedArgs: [] as string[] | undefined,
      targetArgs: undefined,
      label: "target args are omitted",
    },
  ])(
    "deletes index-zero stdio matches when $label",
    async ({ storedArgs, targetArgs }) => {
      const config: MCPConfig = {
        ...emptyConfig(),
        stdio_servers: [
          { name: "remove", command: "node", args: storedArgs },
          { name: "keep", command: "python" },
        ],
      };
      const { result } = setup({ config });

      await remove(result, {
        id: "stdio-zero",
        type: "stdio",
        name: "remove",
        command: "node",
        args: targetArgs,
      });

      expect(savedConfig().stdio_servers).toEqual([
        { name: "keep", command: "python" },
      ]);
    },
  );

  it("requires stdio name, command, and ordered args to all match", async () => {
    const config: MCPConfig = {
      ...emptyConfig(),
      stdio_servers: [
        { name: "other", command: "node", args: ["--a", "--b"] },
        { name: "remove", command: "bun", args: ["--a", "--b"] },
        { name: "remove", command: "node", args: ["--b", "--a"] },
        { name: "remove", command: "node", args: ["--a", "--b"] },
      ],
    };
    const { result } = setup({ config });

    await remove(result, {
      id: "stdio-exact",
      type: "stdio",
      name: "remove",
      command: "node",
      args: ["--a", "--b"],
    });

    expect(savedConfig().stdio_servers).toEqual(
      config.stdio_servers.slice(0, 3),
    );
  });

  it("saves an unchanged stdio config when the exact target is absent", async () => {
    const config: MCPConfig = {
      ...emptyConfig(),
      stdio_servers: [{ name: "keep", command: "node", args: ["--safe"] }],
    };
    const { result } = setup({ config });

    await remove(result, {
      id: "missing-stdio",
      type: "stdio",
      name: "keep",
      command: "node",
      args: ["--different"],
    });

    expect(savedConfig()).toEqual(config);
  });

  it.each([
    { name: undefined, command: "node", label: "name" },
    { name: "server", command: undefined, label: "command" },
  ])(
    "skips persistence when a stdio target lacks its $label",
    async (target) => {
      const { invalidateQueries, result } = setup();

      await remove(result, {
        id: `missing-${target.label}`,
        type: "stdio",
        name: target.name,
        command: target.command,
      });

      expect(saveSettingsMock).not.toHaveBeenCalled();
      expectPersonalSettingsInvalidated(invalidateQueries);
    },
  );

  it("returns safely for an unsupported runtime type", async () => {
    const { invalidateQueries, result } = setup({
      config: {
        ...emptyConfig(),
        stdio_servers: [{ name: "must-stay", command: "node" }],
      },
    });

    await remove(result, {
      id: "unsupported",
      type: "websocket",
      name: "must-stay",
      command: "node",
    } as unknown as MCPServerConfig);

    expect(saveSettingsMock).not.toHaveBeenCalled();
    expectPersonalSettingsInvalidated(invalidateQueries);
  });

  it.each([
    { settingsData: undefined, expectedRaw: undefined, label: "settings" },
    { settingsData: {}, expectedRaw: undefined, label: "agent settings" },
  ])("handles missing $label", async ({ settingsData, expectedRaw }) => {
    const { result } = setup({ settingsData });

    await remove(result, {
      id: "unsupported",
      type: "websocket",
    } as unknown as MCPServerConfig);

    expect(parseMcpConfigMock).toHaveBeenCalledWith(expectedRaw);
  });

  it("uses settings from the latest hook render", async () => {
    const firstRaw = { revision: 1 };
    const latestRaw = { revision: 2 };
    const latestConfig: MCPConfig = {
      ...emptyConfig(),
      sse_servers: ["https://latest.example/sse"],
    };
    useSettingsMock.mockReturnValue({
      data: { agent_settings: { mcp_config: firstRaw } },
    });
    parseMcpConfigMock.mockReturnValue(emptyConfig());
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { rerender, result } = renderHook(() => useDeleteMcpServer(), {
      wrapper,
    });

    useSettingsMock.mockReturnValue({
      data: { agent_settings: { mcp_config: latestRaw } },
    });
    parseMcpConfigMock.mockReturnValue(latestConfig);
    rerender();
    await remove(result, {
      id: "stale-synthetic-id",
      type: "sse",
      url: "https://latest.example/sse",
    });

    expect(parseMcpConfigMock).toHaveBeenLastCalledWith(latestRaw);
    expect(savedConfig()).toEqual(emptyConfig());
  });

  it("awaits persistence before invalidating personal settings", async () => {
    let resolveSave!: () => void;
    const savePending = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    saveSettingsMock.mockReturnValue(savePending);
    const { invalidateQueries, result } = setup({
      config: {
        ...emptyConfig(),
        sse_servers: ["https://remove.example/sse"],
      },
    });
    let settled = false;

    await act(async () => {
      const mutation = result.current
        .mutateAsync({
          id: "await-save",
          type: "sse",
          url: "https://remove.example/sse",
        })
        .then(() => {
          settled = true;
        });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(settled).toBe(false);
      expect(invalidateQueries).not.toHaveBeenCalled();
      resolveSave();
      await mutation;
    });

    expect(settled).toBe(true);
    expectPersonalSettingsInvalidated(invalidateQueries);
  });
});
