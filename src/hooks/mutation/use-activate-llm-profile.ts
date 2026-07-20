import { useMutation, useQueryClient } from "@tanstack/react-query";
import ProfilesService from "#/api/profiles-service/profiles-service.api";
import SettingsService from "#/api/settings-service/settings-service.api";
import {
  LLM_PROFILES_QUERY_KEYS,
  SETTINGS_QUERY_KEYS,
} from "#/hooks/query/query-keys";
import { useTracking } from "#/hooks/use-tracking";
import { useLlmProfiles } from "#/hooks/query/use-llm-profiles";
import {
  buildLlmTelemetryProperties,
  LLM_AUTH_TYPE_UNKNOWN,
} from "#/utils/llm-telemetry";

export function useActivateLlmProfile() {
  const queryClient = useQueryClient();
  const { trackLlmProfileActivated } = useTracking();
  const { data: profilesData } = useLlmProfiles();

  return useMutation({
    mutationFn: (name: string) => ProfilesService.activateProfile(name),
    onSuccess: async (_data, name) => {
      const profile = profilesData?.profiles?.find(
        (item) => item.name === name,
      );
      trackLlmProfileActivated(
        profile
          ? buildLlmTelemetryProperties(
              profile as unknown as Record<string, unknown>,
              { defaultAuthType: LLM_AUTH_TYPE_UNKNOWN },
            )
          : {},
      );
      // Invalidate the SettingsService internal cache so getSettingsForConversation
      // fetches fresh settings with the newly activated profile's LLM config
      SettingsService.invalidateCache();
      // Invalidate profiles list to refresh active_profile
      await queryClient.invalidateQueries({
        queryKey: LLM_PROFILES_QUERY_KEYS.all,
      });
      // Use personal() scope for consistency with other settings hooks
      await queryClient.invalidateQueries({
        queryKey: SETTINGS_QUERY_KEYS.personal(),
      });
    },
    // Consumers handle errors with try-catch and manual toasts; disable global toast
    meta: { disableToast: true },
  });
}
