import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useSettings } from "#/hooks/query/use-settings";
import SettingsService from "#/api/settings-service/settings-service.api";
import { SETTINGS_QUERY_KEYS } from "#/hooks/query/query-keys";
import type { Settings } from "#/types/settings";

type ToggleVariables = { sdkKey: string; enabled: boolean };
type SettingsSnapshot = [QueryKey, Settings | undefined][];

function nextDisabledList(
  current: readonly string[] | undefined,
  sdkKey: string,
  enabled: boolean,
): string[] {
  const disabled = new Set(current ?? []);
  if (enabled) {
    disabled.delete(sdkKey);
  } else {
    disabled.add(sdkKey);
  }
  return Array.from(disabled);
}

/**
 * Enable or disable an installed MCP server without removing it.
 *
 * Disabled servers stay in `agent_settings.mcp_config` (nothing is
 * re-configured); their SDK map key is tracked in the `disabled_mcp_servers`
 * deny-list so the adapter strips them from the config forwarded to a
 * conversation, hiding them from the agent.
 *
 * The cached settings are updated optimistically so the card's enabled state
 * flips immediately instead of waiting on the PATCH + refetch round-trip; the
 * change is rolled back if the save fails.
 */
export function useToggleMcpServer() {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();

  return useMutation({
    mutationFn: async ({ sdkKey, enabled }: ToggleVariables): Promise<void> => {
      await SettingsService.saveSettings({
        disabled_mcp_servers: nextDisabledList(
          settings?.disabled_mcp_servers,
          sdkKey,
          enabled,
        ),
      });
    },
    onMutate: async ({ sdkKey, enabled }: ToggleVariables) => {
      const filter = { queryKey: SETTINGS_QUERY_KEYS.personal() };
      await queryClient.cancelQueries(filter);
      const snapshot = queryClient.getQueriesData<Settings>(filter);
      queryClient.setQueriesData<Settings>(filter, (prev) =>
        prev
          ? {
              ...prev,
              disabled_mcp_servers: nextDisabledList(
                prev.disabled_mcp_servers,
                sdkKey,
                enabled,
              ),
            }
          : prev,
      );
      return { snapshot } satisfies { snapshot: SettingsSnapshot };
    },
    onError: (_err, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: SETTINGS_QUERY_KEYS.personal(),
      });
    },
  });
}
