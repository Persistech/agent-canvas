import { useMemo } from "react";
import { ExtensionWebview } from "#/components/features/extensions/extension-webview";
import { useExtensionContext } from "#/components/providers/extension-manager-provider";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useCachedConversation } from "#/hooks/query/use-cached-conversation";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import type { ConversationPanelTabItem } from "#/extensions/types";

interface ExtensionPanelTabContentProps {
  tabInfo: ConversationPanelTabItem;
}

/**
 * Renders an extension-contributed conversation panel tab as a sandboxed webview.
 * This component receives the tab info from the contribution registry and
 * connects it to the host's capability-gated API.
 *
 * The component provides conversation context to the webview in three tiers:
 * 1. Immediately: the conversation ID from the route (always available)
 * 2. From cache: metadata from the sidebar's conversation list (usually instant)
 * 3. Progressively: full data as it loads from the websocket/API
 *
 * This approach ensures the webview renders immediately with whatever data
 * is available, without blocking on network requests.
 */
export default function ExtensionPanelTabContent({
  tabInfo,
}: ExtensionPanelTabContentProps) {
  const context = useExtensionContext();
  // Get the conversation ID immediately from the route (no fetch required)
  const { conversationId } = useOptionalConversationId();
  // Try to get conversation from React Query cache (sidebar list data)
  const cachedConversation = useCachedConversation(conversationId);
  // Watch the active conversation for progressive enhancement (websocket data)
  const { data: activeConversation } = useActiveConversation();

  // Build conversation data with the best available source:
  // 1. Active conversation (most complete, from websocket)
  // 2. Cached conversation (from sidebar list, usually has title/model/status)
  // 3. Minimal object with just ID (always available from route)
  const conversationData = useMemo(() => {
    // Prefer full active conversation data when available
    if (activeConversation) return activeConversation;
    // Fall back to cached list data (title, model, status, timestamps)
    if (cachedConversation) return cachedConversation;
    // Last resort: just the ID so the webview can render a shell
    if (conversationId) return { id: conversationId };
    return null;
  }, [conversationId, cachedConversation, activeConversation]);

  // If no extension context is available, we can't render the webview
  if (!context) {
    return (
      // eslint-disable-next-line i18next/no-literal-string
      <div className="flex h-full items-center justify-center text-[var(--oh-text-secondary)]">
        Extension system not initialized
      </div>
    );
  }

  if (!tabInfo.pageUrl) {
    return (
      // eslint-disable-next-line i18next/no-literal-string
      <div className="flex h-full items-center justify-center text-[var(--oh-text-secondary)]">
        Extension tab has no content page configured
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <ExtensionWebview
        extensionId={tabInfo.extensionId}
        capabilities={tabInfo.capabilities ?? []}
        deps={context.deps}
        src={tabInfo.pageUrl}
        title={tabInfo.title}
        extensionSource={tabInfo.extensionSource}
        conversation={conversationData}
      />
    </div>
  );
}
