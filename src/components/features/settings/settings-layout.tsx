import { SettingsDesktopSidebar } from "./settings-desktop-sidebar";
import { SettingsNavRenderedItem } from "#/hooks/use-settings-nav-items";
import { settingsLayoutMainScrollClassName } from "#/utils/settings-like-page-layout-classes";

interface SettingsLayoutProps {
  children: React.ReactNode;
  navigationItems: SettingsNavRenderedItem[];
  /**
   * When true, the content wrapper becomes a flex column that fills available
   * space. Use for extension settings pages that should extend to the bottom
   * of the viewport rather than wrapping content.
   */
  fillHeight?: boolean;
}

/**
 * Mirrors the extensions layout (Skills / MCP): aside and main are siblings,
 * and only the main column scrolls so the left nav stays pinned like
 * ExtensionsNavigation.
 */
export function SettingsLayout({
  children,
  navigationItems,
  fillHeight = false,
}: SettingsLayoutProps) {
  const contentWrapperClassName = fillHeight
    ? "mx-auto flex w-full min-w-0 max-w-[800px] flex-1 flex-col"
    : "mx-auto w-full min-w-0 max-w-[800px]";

  return (
    <div className="flex h-full flex-col md:pt-8">
      <div className="flex min-h-0 flex-1 gap-10 md:items-start">
        <SettingsDesktopSidebar navigationItems={navigationItems} />
        <main className={settingsLayoutMainScrollClassName}>
          <div className={contentWrapperClassName}>{children}</div>
        </main>
      </div>
    </div>
  );
}
