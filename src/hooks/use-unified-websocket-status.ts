import {
  useConversationWebSocket,
  WebSocketConnectionState,
} from "#/contexts/conversation-websocket-context";

/**
 * Unified hook that returns the current WebSocket status
 * - For V0 conversations: Returns status from useWsClient
 * - For V1 conversations: Returns status from ConversationWebSocketProvider
 */
export function useUnifiedWebSocketStatus(): WebSocketConnectionState {
  const conversationContext = useConversationWebSocket();
  return conversationContext ? conversationContext.connectionState : "CLOSED";
}
