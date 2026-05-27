import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

const useActiveBackendMock = vi.fn();
const useLlmProfilesMock = vi.fn();

vi.mock("#/contexts/active-backend-context", async () => {
  const actual = await vi.importActual<
    typeof import("#/contexts/active-backend-context")
  >("#/contexts/active-backend-context");
  return { ...actual, useActiveBackend: () => useActiveBackendMock() };
});

vi.mock("#/hooks/query/use-llm-profiles", () => ({
  useLlmProfiles: () => useLlmProfilesMock(),
}));

// ACP_PROVIDERS is exercised for real so the test pins the actual
// registry-sourced provider/model list the catalog surfaces.
import { useAgentBundleCatalog } from "#/hooks/use-agent-bundle-catalog";
import { ACP_PROVIDERS } from "#/constants/acp-providers";

describe("useAgentBundleCatalog", () => {
  beforeEach(() => {
    useActiveBackendMock.mockReset();
    useActiveBackendMock.mockReturnValue({ backend: { kind: "local" } });
    useLlmProfilesMock.mockReset();
    useLlmProfilesMock.mockReturnValue({
      data: { profiles: [], active_profile: null },
    });
  });

  it("builds an OpenHands group from the native profiles", () => {
    useLlmProfilesMock.mockReturnValue({
      data: {
        profiles: [
          { name: "gpt-5", model: "openai/gpt-5" },
          { name: "local", model: null },
        ],
        active_profile: "gpt-5",
      },
    });

    const { result } = renderHook(() => useAgentBundleCatalog());
    const group = result.current.find((g) => g.key === "openhands");

    expect(group?.label).toBe("OpenHands");
    expect(group?.bundles).toHaveLength(2);
    expect(group?.bundles[0]).toMatchObject({
      kind: "openhands",
      profileName: "gpt-5",
      model: "openai/gpt-5",
    });
  });

  it("includes one group per ACP provider, default model first, carrying the runtime-switch flag", () => {
    const { result } = renderHook(() => useAgentBundleCatalog());

    for (const provider of ACP_PROVIDERS) {
      if (!provider.available_models?.length) continue;
      const group = result.current.find((g) => g.key === provider.key);
      expect(group, `group for ${provider.key}`).toBeTruthy();
      const first = group!.bundles[0];
      expect(first.kind).toBe("acp");
      if (provider.default_model) {
        expect(first).toMatchObject({ model: provider.default_model });
      }
      if (first.kind === "acp") {
        expect(first.supportsRuntimeSwitch).toBe(
          provider.supports_runtime_model_switch ?? false,
        );
      }
    }
  });

  it("omits the OpenHands group when there are no native profiles", () => {
    const { result } = renderHook(() => useAgentBundleCatalog());
    expect(result.current.find((g) => g.key === "openhands")).toBeUndefined();
  });

  it("returns an empty catalog on cloud (profiles + ACP are local-only)", () => {
    useActiveBackendMock.mockReturnValue({ backend: { kind: "cloud" } });
    useLlmProfilesMock.mockReturnValue({
      data: { profiles: [{ name: "x", model: "m" }], active_profile: "x" },
    });

    const { result } = renderHook(() => useAgentBundleCatalog());
    expect(result.current).toEqual([]);
  });
});
