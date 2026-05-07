import { useConfig } from "#/hooks/query/use-config";
import { useActiveBackend } from "#/contexts/active-backend-context";
import { OSS_NAV_ITEMS, SettingsNavItem } from "#/constants/settings-nav";
import { isSettingsPageHidden } from "#/utils/settings-utils";
import { I18nKey } from "#/i18n/declaration";

export type SettingsNavRenderedItem =
  | { type: "item"; item: SettingsNavItem }
  | { type: "header"; text: I18nKey }
  | { type: "divider" };

// Sub-pages that only make sense against a local agent-server. Hidden when
// the active backend is a cloud SaaS environment.
const LOCAL_ONLY_PATHS = new Set<string>([
  "/settings/agent-server",
  "/settings/condenser",
  "/settings/verification",
  "/settings/mcp",
  "/settings/skills",
]);

export function useSettingsNavItems(): SettingsNavRenderedItem[] {
  const { data: config } = useConfig();
  const featureFlags = config?.feature_flags;
  const active = useActiveBackend();
  const isCloud = active.backend.kind === "cloud";

  return OSS_NAV_ITEMS.filter(
    (item) =>
      !isSettingsPageHidden(item.to, featureFlags) &&
      !(isCloud && LOCAL_ONLY_PATHS.has(item.to)),
  ).map((item) => ({ type: "item", item }));
}
