import { useMutation, useQueryClient } from "@tanstack/react-query";
import ProfilesService from "#/api/profiles-service/profiles-service.api";
import SettingsService from "#/api/settings-service/settings-service.api";
import {
  LLM_PROFILES_QUERY_KEYS,
  SETTINGS_QUERY_KEYS,
} from "#/hooks/query/query-keys";
import { useTracking } from "#/hooks/use-tracking";

export function useDeleteLlmProfile() {
  const queryClient = useQueryClient();
  const { trackLlmProfileDeleted } = useTracking();

  return useMutation({
    mutationFn: (name: string) => ProfilesService.deleteProfile(name),
    onSuccess: async () => {
      trackLlmProfileDeleted();
      // Invalidate the SettingsService internal cache so getSettingsForConversation
      // fetches fresh settings after the profile is deleted (backend may have
      // deactivated it or reset agent_settings.llm)
      SettingsService.invalidateCache();
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
