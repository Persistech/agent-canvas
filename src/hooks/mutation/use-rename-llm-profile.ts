import { useMutation, useQueryClient } from "@tanstack/react-query";
import ProfilesService from "#/api/profiles-service/profiles-service.api";
import SettingsService from "#/api/settings-service/settings-service.api";
import {
  LLM_PROFILES_QUERY_KEY,
  SETTINGS_QUERY_KEYS,
} from "#/hooks/query/query-keys";

interface RenameLlmProfileVariables {
  name: string;
  newName: string;
}

export function useRenameLlmProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, newName }: RenameLlmProfileVariables) => {
      await ProfilesService.renameProfile(name, newName);
    },
    onSuccess: () => {
      // Invalidate SettingsService internal cache to ensure fresh settings
      // (backend references in agent_settings may change when renaming active profile)
      SettingsService.invalidateCache();
      queryClient.invalidateQueries({ queryKey: [LLM_PROFILES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all });
    },
  });
}
