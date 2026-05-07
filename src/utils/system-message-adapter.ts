import { OHEvent } from "#/stores/use-event-store";
import { isActionOrObservation, isSystemMessage } from "#/types/core/guards";
import { ChatCompletionToolParam } from "#/types/agent-server/core";
import {
  isSystemPromptEvent,
  isV0Event,
  isAgentServerEvent,
} from "#/types/agent-server/type-guards";

export interface SystemMessageForModal {
  content: string;
  tools: ChatCompletionToolParam[] | Record<string, unknown>[] | null;
  openhands_version: string | null;
  agent_class: string | null;
}

export function adaptSystemMessage(
  events: OHEvent[],
): SystemMessageForModal | null {
  let systemMessage: SystemMessageForModal | null = null;
  const v0SystemMessage = events
    .filter(isV0Event)
    .filter(isActionOrObservation)
    .find(isSystemMessage);

  // V1 System Prompt Event
  const systemPromptEvent = events
    .filter(isAgentServerEvent)
    .find(isSystemPromptEvent);

  if (v0SystemMessage) {
    systemMessage = v0SystemMessage.args;
  } else if (systemPromptEvent) {
    systemMessage = {
      content: systemPromptEvent.system_prompt.text,
      tools: systemPromptEvent.tools ?? null,
      openhands_version: null,
      agent_class: null,
    };
  }

  if (systemMessage) {
    return systemMessage;
  }

  return null;
}
