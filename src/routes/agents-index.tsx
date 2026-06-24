import { Navigate } from "react-router";
import {
  useBreakpoint,
  SIDEBAR_RAIL_COLLAPSE_MAX_WIDTH,
} from "#/hooks/use-breakpoint";
import { useAgentsHubNavItems } from "#/hooks/use-agents-hub-nav-items";
import { AgentsMobileHub } from "#/components/features/settings/agents-mobile-hub";
import { getFirstAvailableAgentsPath } from "#/utils/settings-utils";

/**
 * The `/agents` index. On mobile the desktop section sidebar is hidden, so we
 * render a navigable hub landing; on desktop we drop straight into the first
 * available section (Profiles). Mirrors the former settings index.
 *
 * The breakpoint must match the CSS `md` boundary that toggles the sidebar
 * (`hidden md:flex`) and the hub (`md:hidden`): `md` is min-width:768px, so
 * width <= 767 is the drawer-only / mobile range. Using 768 here would render
 * the (CSS-hidden) mobile hub at exactly 768px with no redirect — a blank pane.
 */
export default function AgentsIndex() {
  const isMobile = useBreakpoint(SIDEBAR_RAIL_COLLAPSE_MAX_WIDTH);
  const navigationItems = useAgentsHubNavItems();

  if (isMobile) {
    return <AgentsMobileHub navigationItems={navigationItems} />;
  }

  return <Navigate to={getFirstAvailableAgentsPath()} replace />;
}
