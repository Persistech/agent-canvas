import { useQuery } from "@tanstack/react-query";
import ProfilesService from "#/api/profiles-service/profiles-service.api";
import { LLM_PROFILES_QUERY_KEYS } from "./query-keys";

export { LLM_PROFILES_QUERY_KEYS };

export function useLlmProfiles() {
  return useQuery({
    queryKey: LLM_PROFILES_QUERY_KEYS.all,
    queryFn: ProfilesService.listProfiles,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    meta: { disableToast: true },
  });
}
