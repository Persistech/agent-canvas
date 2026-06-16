import { useMutation, useQueryClient } from "@tanstack/react-query";
import MetaProfilesService from "#/api/meta-profiles-service/meta-profiles-service.api";
import { META_PROFILES_QUERY_KEYS } from "#/hooks/query/query-keys";

export function useDeleteMetaProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => MetaProfilesService.deleteMetaProfile(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: META_PROFILES_QUERY_KEYS.all,
      });
    },
    // Consumers handle errors with try-catch and manual toasts; disable global toast
    meta: { disableToast: true },
  });
}
