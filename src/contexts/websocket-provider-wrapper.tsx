import React from "react";
import { ConversationWebSocketProvider } from "#/contexts/conversation-websocket-context";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useSubConversations } from "#/hooks/query/use-sub-conversations";

interface WebSocketProviderWrapperProps {
  children: React.ReactNode;
  conversationId: string;
}

export function WebSocketProviderWrapper({
  children,
  conversationId,
}: WebSocketProviderWrapperProps) {
  const { data: conversation } = useActiveConversation();
  const { data: subConversations } = useSubConversations(
    conversation?.sub_conversation_ids ?? [],
  );

  const filteredSubConversations = subConversations?.filter(
    (subConversation) => subConversation !== null,
  );

  // Only pass a conversation URL to the WebSocket provider when the backing
  // host is actually reachable. For a cloud conversation that means the sandbox
  // must be RUNNING — PAUSED, STARTING, MISSING and ERROR all leave
  // `conversation_url` pointing at a host that cannot serve the socket (the API
  // keeps the stale URL across these states). Worse, when the agent-server host
  // is unresolved the URL collapses to a relative path, which buildWebSocketUrl
  // silently retargets at the current page origin (the static canvas host) —
  // producing a tight reconnect loop of 502s against canvas that can never
  // succeed. Gating on RUNNING (rather than only excluding PAUSED) keeps
  // wsUrl === null in ConversationWebSocketProvider for every not-ready state.
  //
  // Local conversations carry no sandbox_status (null/undefined) and are always
  // allowed. useActiveConversation polls every ~3s, so the socket opens as soon
  // as the sandbox transitions to RUNNING.
  const sandboxStatus = conversation?.sandbox_status;
  const sandboxReachable =
    sandboxStatus === undefined ||
    sandboxStatus === null ||
    sandboxStatus === "RUNNING";
  const conversationUrl = sandboxReachable
    ? conversation?.conversation_url
    : null;

  return (
    <ConversationWebSocketProvider
      conversationId={conversationId}
      conversationUrl={conversationUrl}
      sessionApiKey={conversation?.session_api_key}
      subConversationIds={conversation?.sub_conversation_ids}
      subConversations={filteredSubConversations}
    >
      {children}
    </ConversationWebSocketProvider>
  );
}
