import { useConfig } from "#/hooks/query/use-config";
import {
  AGENTS_HUB_NAV_ITEMS,
  type SettingsNavRenderedItem,
} from "#/constants/settings-nav";
import { isSettingsPageHidden } from "#/utils/settings-utils";
import { I18nKey } from "#/i18n/declaration";
import { useActiveBackend } from "#/contexts/active-backend-context";

/**
 * Nav for the Agents hub (#1456): a single flat list — the profile library
 * plus the catalogs it composes (LLM / MCP / Skills / Plugins / Secrets).
 */
export function useAgentsHubNavItems(): SettingsNavRenderedItem[] {
  const { data: config } = useConfig();
  const { backend } = useActiveBackend();
  const featureFlags = config?.feature_flags;

  return AGENTS_HUB_NAV_ITEMS.filter(
    (item) => !isSettingsPageHidden(item.to, featureFlags),
  ).map((item) => {
    // Local backends present "LLM Profiles"; cloud keeps the canonical "LLM".
    const renamedItem =
      item.to === "/agents/llm" && backend.kind === "local"
        ? {
            ...item,
            text: I18nKey.SETTINGS$LLM_PROFILES,
            subtitle: I18nKey.SETTINGS$PAGE_LLM_PROFILES_SUBLINE,
          }
        : item;

    return { type: "item", item: renamedItem };
  });
}
