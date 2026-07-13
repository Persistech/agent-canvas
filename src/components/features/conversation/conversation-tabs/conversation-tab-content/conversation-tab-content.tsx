import { lazy, Suspense, useMemo } from "react";
import { TabWrapper } from "./tab-wrapper";
import { TabContainer } from "./tab-container";
import { TabContentArea } from "./tab-content-area";
import { ConversationTabContentCrossfade } from "./conversation-tab-content-crossfade";
import {
  useConversationStore,
  parseExtensionTabId,
} from "#/stores/conversation-store";
import { useConversationId } from "#/hooks/use-conversation-id";
import { EXTENSIONS_ENABLED } from "#/extensions/feature-flag";
import { contributionRegistry } from "#/extensions/contribution-registry";
import { LoadingSpinner } from "#/components/shared/loading-spinner";

// Lazy load all tab components, including the terminal — xterm + addon-fit +
// xterm.css are large enough that we don't want them in the conversation
// route's eager graph just because the terminal tab might be selected later.
const FilesTab = lazy(() => import("#/routes/files-tab"));
const BrowserTab = lazy(() => import("#/routes/browser-tab"));
const PlannerTab = lazy(() => import("#/routes/planner-tab"));
const TaskListTab = lazy(() => import("#/routes/task-list-tab"));
const Terminal = lazy(() => import("#/components/features/terminal/terminal"));

// Lazy load the extension tab wrapper to avoid loading extension infrastructure
// when no extension tabs are active.
const ExtensionPanelTabContent = lazy(
  () => import("./extension-panel-tab-content"),
);

const TAB_CONFIG = {
  tasklist: { component: TaskListTab },
  files: { component: FilesTab },
  browser: { component: BrowserTab },
  terminal: { component: Terminal },
  planner: { component: PlannerTab },
};

export function ConversationTabContent() {
  const { selectedTab, shouldShownAgentLoading } = useConversationStore();
  const { conversationId } = useConversationId();

  // Check if the selected tab is an extension tab
  const extensionTabInfo = useMemo(() => {
    if (!EXTENSIONS_ENABLED || !selectedTab) return null;
    const parsed = parseExtensionTabId(selectedTab);
    if (!parsed) return null;

    // Look up the tab in the contribution registry
    const tab = contributionRegistry.getConversationPanelTab(
      parsed.extensionId,
      parsed.tabId,
    );
    return tab ?? null;
  }, [selectedTab]);

  const isExtensionTab = extensionTabInfo !== null;

  const activeTab = useMemo(
    () =>
      TAB_CONFIG[selectedTab as keyof typeof TAB_CONFIG] ?? TAB_CONFIG.files,
    [selectedTab],
  );

  const tabWrapperKey =
    selectedTab === "terminal"
      ? `${selectedTab}-${conversationId}`
      : (selectedTab ?? "files");

  // Render either the extension tab content or a built-in tab
  const renderContent = () => {
    if (isExtensionTab && extensionTabInfo) {
      return (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <LoadingSpinner size="large" />
            </div>
          }
        >
          <ExtensionPanelTabContent tabInfo={extensionTabInfo} />
        </Suspense>
      );
    }
    const ActiveComponent = activeTab.component;
    return <ActiveComponent />;
  };

  // Don't block extension tabs with the loading overlay — they can render
  // immediately using cached conversation data from the sidebar list.
  // Only built-in tabs (files, browser, terminal, etc.) need to wait for
  // the full conversation to load because they depend on sandbox state.
  const showLoadingOverlay = isExtensionTab ? false : shouldShownAgentLoading;

  return (
    <TabContainer>
      <TabContentArea>
        <ConversationTabContentCrossfade
          showAgentLoading={showLoadingOverlay}
          tabKey={tabWrapperKey}
        >
          <TabWrapper key={tabWrapperKey}>{renderContent()}</TabWrapper>
        </ConversationTabContentCrossfade>
      </TabContentArea>
    </TabContainer>
  );
}
