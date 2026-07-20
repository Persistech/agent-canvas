import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSaveLlmProfile } from "#/hooks/mutation/use-save-llm-profile";
import ProfilesService from "#/api/profiles-service/profiles-service.api";
import SettingsService from "#/api/settings-service/settings-service.api";
import {
  LLM_PROFILES_QUERY_KEYS,
  SETTINGS_QUERY_KEYS,
} from "#/hooks/query/query-keys";

const {
  trackLlmProfileCreatedMock,
  trackLlmProfileUpdatedMock,
  trackLlmProfileDuplicatedMock,
} = vi.hoisted(() => ({
  trackLlmProfileCreatedMock: vi.fn(),
  trackLlmProfileUpdatedMock: vi.fn(),
  trackLlmProfileDuplicatedMock: vi.fn(),
}));

vi.mock("#/hooks/use-tracking", () => ({
  useTracking: () => ({
    trackLlmProfileCreated: trackLlmProfileCreatedMock,
    trackLlmProfileUpdated: trackLlmProfileUpdatedMock,
    trackLlmProfileDuplicated: trackLlmProfileDuplicatedMock,
  }),
}));

vi.mock("#/api/profiles-service/profiles-service.api");
vi.mock("#/api/settings-service/settings-service.api");

describe("useSaveLlmProfile", () => {
  let queryClient: QueryClient;
  let wrapper: ({
    children,
  }: {
    children: React.ReactNode;
  }) => React.ReactElement;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      );
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    trackLlmProfileCreatedMock.mockClear();
    trackLlmProfileUpdatedMock.mockClear();
    trackLlmProfileDuplicatedMock.mockClear();
  });

  it("calls ProfilesService.saveProfile with name and request", async () => {
    vi.mocked(ProfilesService.saveProfile).mockResolvedValue({
      name: "my-profile",
      message: "Profile saved",
    });

    const { result } = renderHook(() => useSaveLlmProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: "my-profile",
        request: {
          llm: {
            model: "openai/gpt-4",
            api_key: "sk-xxx",
          },
        },
      });
    });

    expect(ProfilesService.saveProfile).toHaveBeenCalledWith("my-profile", {
      llm: {
        model: "openai/gpt-4",
        api_key: "sk-xxx",
      },
    });
  });

  it("saves profile with include_secrets flag", async () => {
    vi.mocked(ProfilesService.saveProfile).mockResolvedValue({
      name: "snapshot-profile",
      message: "Profile saved",
    });

    const { result } = renderHook(() => useSaveLlmProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: "snapshot-profile",
        request: {
          llm: { model: "openai/gpt-4" },
          include_secrets: true,
        },
      });
    });

    expect(ProfilesService.saveProfile).toHaveBeenCalledWith(
      "snapshot-profile",
      {
        llm: { model: "openai/gpt-4" },
        include_secrets: true,
      },
    );
  });

  it("tracks created profiles with non-sensitive LLM metadata", async () => {
    vi.mocked(ProfilesService.saveProfile).mockResolvedValue({
      name: "subscription-profile",
      message: "Profile saved",
    });

    const { result } = renderHook(() => useSaveLlmProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: "subscription-profile",
        request: {
          llm: {
            model: "openai/gpt-4.1",
            auth_type: "subscription",
            subscription_vendor: "openai",
          },
        },
        operation: "created",
        source: "settings",
      });
    });

    expect(trackLlmProfileCreatedMock).toHaveBeenCalledWith({
      llm_model: "openai/gpt-4.1",
      llm_model_provider: "openai",
      llm_model_name: "gpt-4.1",
      llm_auth_type: "subscription",
      llm_subscription_vendor: "openai",
      llm_api_key_set: false,
      llm_base_url_set: false,
      source: "settings",
    });
    expect(trackLlmProfileUpdatedMock).not.toHaveBeenCalled();
  });

  it("invalidates all relevant caches on success", async () => {
    vi.mocked(ProfilesService.saveProfile).mockResolvedValue({
      name: "test-profile",
      message: "Profile saved",
    });

    // Pre-populate the profiles cache
    queryClient.setQueryData(LLM_PROFILES_QUERY_KEYS.all, { profiles: [] });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const invalidateCacheSpy = vi.spyOn(SettingsService, "invalidateCache");

    const { result } = renderHook(() => useSaveLlmProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: "test-profile",
        request: { llm: { model: "openai/gpt-4" } },
      });
    });

    // Verifies all three cache invalidations occur on success
    expect(invalidateCacheSpy).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: LLM_PROFILES_QUERY_KEYS.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: SETTINGS_QUERY_KEYS.personal(),
    });
  });

  it("handles save errors", async () => {
    const error = new Error("Profile name already exists");
    vi.mocked(ProfilesService.saveProfile).mockRejectedValue(error);

    const { result } = renderHook(() => useSaveLlmProfile(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          name: "duplicate-name",
          request: { llm: { model: "openai/gpt-4" } },
        });
      }),
    ).rejects.toThrow("Profile name already exists");

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
