import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useActivateLlmProfile } from "#/hooks/mutation/use-activate-llm-profile";
import ProfilesService from "#/api/profiles-service/profiles-service.api";
import SettingsService from "#/api/settings-service/settings-service.api";
import {
  LLM_PROFILES_QUERY_KEYS,
  SETTINGS_QUERY_KEYS,
} from "#/hooks/query/query-keys";

const { trackLlmProfileActivatedMock } = vi.hoisted(() => ({
  trackLlmProfileActivatedMock: vi.fn(),
}));

vi.mock("#/hooks/use-tracking", () => ({
  useTracking: () => ({
    trackLlmProfileActivated: trackLlmProfileActivatedMock,
  }),
}));

vi.mock("#/hooks/query/use-llm-profiles", () => ({
  useLlmProfiles: () => ({
    data: {
      profiles: [
        {
          name: "my-profile",
          model: "openai/gpt-4.1",
          base_url: null,
          api_key_set: false,
        },
      ],
    },
  }),
}));

vi.mock("#/api/profiles-service/profiles-service.api", () => ({
  default: {
    activateProfile: vi.fn(),
  },
}));

describe("useActivateLlmProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SettingsService.invalidateCache();
  });

  it("calls activateProfile and invalidates all relevant caches on success", async () => {
    const mockActivateProfile = vi.mocked(ProfilesService.activateProfile);
    mockActivateProfile.mockResolvedValue({
      name: "my-profile",
      message: "Profile activated",
      llm_applied: true,
    });

    const invalidateCacheSpy = vi.spyOn(SettingsService, "invalidateCache");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useActivateLlmProfile(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    // Trigger the mutation
    result.current.mutate("my-profile");

    // Wait for the mutation to complete
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify activateProfile was called with the correct name
    expect(mockActivateProfile).toHaveBeenCalledWith("my-profile");
    expect(trackLlmProfileActivatedMock).toHaveBeenCalledWith({
      llm_model: "openai/gpt-4.1",
      llm_model_provider: "openai",
      llm_model_name: "gpt-4.1",
      llm_auth_type: "unknown",
      llm_subscription_vendor: null,
      llm_api_key_set: false,
      llm_base_url_set: false,
    });

    // Verify all cache invalidations occur on success
    expect(invalidateCacheSpy).toHaveBeenCalled();
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: LLM_PROFILES_QUERY_KEYS.all,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: SETTINGS_QUERY_KEYS.personal(),
    });

    invalidateCacheSpy.mockRestore();
    invalidateQueriesSpy.mockRestore();
  });

  it("does not invalidate cache on activation failure", async () => {
    const mockActivateProfile = vi.mocked(ProfilesService.activateProfile);
    mockActivateProfile.mockRejectedValue(new Error("Profile not found"));

    // Create spy after beforeEach invalidation
    const invalidateCacheSpy = vi.spyOn(SettingsService, "invalidateCache");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useActivateLlmProfile(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    // Trigger the mutation
    result.current.mutate("nonexistent-profile");

    // Wait for the mutation to fail
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // invalidateCache should NOT have been called on failure
    // (onSuccess is not called when mutation fails)
    expect(invalidateCacheSpy).not.toHaveBeenCalled();

    invalidateCacheSpy.mockRestore();
  });
});
