import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSettings } from "#/hooks/query/use-settings";
import SettingsService from "#/api/settings-service/settings-service.api";
import { SETTINGS_QUERY_KEYS } from "#/hooks/query/query-keys";

/**
 * Enable or disable an installed MCP server without removing it.
 *
 * Disabled servers stay in `agent_settings.mcp_config` (nothing is
 * re-configured); their SDK map key is tracked in the `disabled_mcp_servers`
 * deny-list so the adapter strips them from the config forwarded to a
 * conversation, hiding them from the agent.
 */
export function useToggleMcpServer() {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();

  return useMutation({
    mutationFn: async ({
      sdkKey,
      enabled,
    }: {
      sdkKey: string;
      enabled: boolean;
    }): Promise<void> => {
      const disabled = new Set(settings?.disabled_mcp_servers ?? []);
      if (enabled) {
        disabled.delete(sdkKey);
      } else {
        disabled.add(sdkKey);
      }
      await SettingsService.saveSettings({
        disabled_mcp_servers: Array.from(disabled),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: SETTINGS_QUERY_KEYS.personal(),
      });
    },
  });
}
