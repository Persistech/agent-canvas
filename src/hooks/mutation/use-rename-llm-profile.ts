import { useMutation, useQueryClient } from "@tanstack/react-query";
import ProfilesService from "#/api/profiles-service/profiles-service.api";
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
      queryClient.invalidateQueries({ queryKey: [LLM_PROFILES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all });
    },
  });
}
