import { useMemo } from "react";
import type { ProfileInfo } from "#/api/profiles-service/profiles-service.api";
import { useActiveBackend } from "#/contexts/active-backend-context";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useLlmProfiles } from "#/hooks/query/use-llm-profiles";
import { useSettings } from "#/hooks/query/use-settings";
import { useModelStore } from "#/stores/model-store";

export interface ChatInputLlmDisplay {
  label: string;
  model: string;
  profileName: string | null;
  title: string;
}

interface ResolveChatInputLlmDisplayOptions {
  llmModel: string | null | undefined;
  profiles: ProfileInfo[];
  activeProfileName: string | null | undefined;
  latestSwitchedProfileName: string | null | undefined;
  hasActiveConversation: boolean;
}

function findProfileByName(
  profiles: ProfileInfo[],
  name: string | null | undefined,
): ProfileInfo | null {
  if (!name) {
    return null;
  }

  return profiles.find((profile) => profile.name === name) ?? null;
}

export function resolveChatInputLlmDisplay({
  llmModel,
  profiles,
  activeProfileName,
  latestSwitchedProfileName,
  hasActiveConversation,
}: ResolveChatInputLlmDisplayOptions): ChatInputLlmDisplay | null {
  if (!llmModel) {
    return null;
  }

  const switchedProfile = findProfileByName(
    profiles,
    latestSwitchedProfileName,
  );
  const activeProfile = findProfileByName(profiles, activeProfileName);
  const matchingProfiles = profiles.filter(
    (profile) => profile.model === llmModel,
  );

  let profileName: string | null = null;

  if (switchedProfile?.model === llmModel) {
    profileName = switchedProfile.name;
  } else if (!hasActiveConversation && activeProfile?.model === llmModel) {
    profileName = activeProfile.name;
  } else if (matchingProfiles.length === 1) {
    profileName = matchingProfiles[0]?.name ?? null;
  }

  return {
    label: profileName ?? llmModel,
    model: llmModel,
    profileName,
    title: profileName ? `${profileName} (${llmModel})` : llmModel,
  };
}

export function useChatInputLlmDisplay(): ChatInputLlmDisplay | null {
  const { backend } = useActiveBackend();
  const { conversationId } = useOptionalConversationId();
  const { data: conversation } = useActiveConversation();
  const { data: settings } = useSettings();
  const { data: profilesData } = useLlmProfiles({
    enabled: backend.kind === "local",
  });
  const latestSwitchedProfileName = useModelStore((state) => {
    if (!conversationId) {
      return null;
    }

    const entries = state.entriesByConversation[conversationId] ?? [];
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const switchedTo = entries[index]?.switchedTo;
      if (switchedTo) {
        return switchedTo;
      }
    }

    return null;
  });

  return useMemo(
    () =>
      resolveChatInputLlmDisplay({
        llmModel: conversation?.llm_model ?? settings?.llm_model,
        profiles: profilesData?.profiles ?? [],
        activeProfileName: profilesData?.active_profile,
        latestSwitchedProfileName,
        hasActiveConversation: Boolean(conversation),
      }),
    [
      conversation,
      latestSwitchedProfileName,
      profilesData?.active_profile,
      profilesData?.profiles,
      settings?.llm_model,
    ],
  );
}
