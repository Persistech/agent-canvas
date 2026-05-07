import React from "react";
import { isOpenHandsAction, isActionOrObservation } from "#/types/core/guards";
import { useEventStore } from "#/stores/use-event-store";
import {
  shouldRenderEvent,
  hasUserEvent,
} from "#/components/features/chat/event-content-helpers/should-render-event";
import {
  shouldRenderEvent as shouldRenderAgentServerEvent,
  hasUserEvent as hasAgentServerUserEvent,
} from "#/components/conversation-events/chat";
import {
  isV0Event,
  isAgentServerEvent,
  isSystemPromptEvent,
  isConversationStateUpdateEvent,
} from "#/types/agent-server/type-guards";

/**
 * Hook that provides memoized filtered event arrays for ChatInterface.
 *
 * Why: Event filtering (V0, V1 UI, V1 full) was previously computed on every
 * render without useMemo. This caused unnecessary recomputation whenever
 * ChatInterface re-rendered for any reason (e.g., agent state change, scroll,
 * typing). By memoizing with proper dependencies, the filtered arrays maintain
 * referential stability when the underlying store data hasn't changed, which
 * prevents unnecessary downstream re-renders of Messages components.
 */
export function useFilteredEvents() {
  const storeEvents = useEventStore((state) => state.events);
  const uiEvents = useEventStore((state) => state.uiEvents);

  // Filter V0 events
  const v0Events = React.useMemo(
    () =>
      storeEvents
        .filter(isV0Event)
        .filter(isActionOrObservation)
        .filter(shouldRenderEvent),
    [storeEvents],
  );

  // Filter V1 events - use uiEvents for rendering (actions replaced by observations)
  const renderableEvents = React.useMemo(
    () => uiEvents.filter(isAgentServerEvent).filter(shouldRenderAgentServerEvent),
    [uiEvents],
  );

  // Keep full v1 events for lookups (includes both actions and observations)
  const allConversationEvents = React.useMemo(
    () => storeEvents.filter(isAgentServerEvent),
    [storeEvents],
  );

  // Combined events count for tracking
  const totalEvents = React.useMemo(
    () => v0Events.length || renderableEvents.length,
    [v0Events, renderableEvents],
  );

  // Check if there are any substantive agent actions (not just system messages)
  // Reuses memoized v0Events and allConversationEvents to avoid redundant filtering
  const hasSubstantiveAgentActions = React.useMemo(
    () =>
      v0Events.some(
        (event) =>
          isOpenHandsAction(event) &&
          event.source === "agent" &&
          event.action !== "system",
      ) ||
      allConversationEvents.some(
        (event) =>
          event.source === "agent" &&
          !isSystemPromptEvent(event) &&
          !isConversationStateUpdateEvent(event),
      ),
    [v0Events, allConversationEvents],
  );

  const v0UserEventsExist = hasUserEvent(v0Events);
  const conversationUserEventsExist = hasAgentServerUserEvent(allConversationEvents);
  const userEventsExist = v0UserEventsExist || conversationUserEventsExist;

  return {
    storeEvents,
    uiEvents,
    v0Events,
    renderableEvents,
    allConversationEvents,
    totalEvents,
    hasSubstantiveAgentActions,
    v0UserEventsExist,
    conversationUserEventsExist,
    userEventsExist,
  };
}
