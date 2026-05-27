import { useCallback } from "react";
import { useCreateConversation } from "#/hooks/mutation/use-create-conversation";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useNavigation } from "#/context/navigation-context";
import {
  buildAcpAgentSettingsDiff,
  getAcpProvider,
} from "#/constants/acp-providers";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import type { SettingsValue } from "#/types/settings";
import type { AgentModelBundle } from "#/types/agent-model-bundle";

/**
 * Fork: start a *new* conversation running the chosen bundle's agent/model.
 *
 * Used for incompatible ("start-new-only") picker choices, which can't switch
 * in place — a different ACP provider needs a fresh subprocess, so context
 * can't be preserved. Only safe launch context (workspace / repo / branch) is
 * carried over; the transcript and runtime memory are **not**.
 *
 * The new conversation's agent is set per-launch via ``agentSettingsOverride``
 * so the user's saved default is left untouched (the home launcher and
 * Settings → Agent still own the persisted default). ACP targets only: forking
 * to a native LLM profile would need the profile's encrypted LLM config in the
 * start payload and is deferred — those rows stay non-actionable.
 */
export function useStartNewWithBundle() {
  const { mutate: createConversation, isPending } = useCreateConversation();
  const { navigate } = useNavigation();
  const { data: conversation } = useActiveConversation();

  const start = useCallback(
    (bundle: AgentModelBundle) => {
      if (bundle.kind !== "acp") return;

      const provider = getAcpProvider(bundle.provider);
      // Non-secret ACP agent settings (kind/server/command/model) — the same
      // shape Settings → Agent and onboarding persist, here used per-launch.
      const override = buildAcpAgentSettingsDiff(bundle.provider, {
        command: provider?.default_command,
        model: bundle.model,
      });
      if (!override) return;

      // Carry only safe launch context from the current conversation.
      const repository =
        conversation?.selected_repository && conversation.git_provider
          ? {
              name: conversation.selected_repository,
              gitProvider: conversation.git_provider,
              branch: conversation.selected_branch ?? undefined,
            }
          : undefined;

      createConversation(
        {
          agentSettingsOverride: override as Record<string, SettingsValue>,
          workingDir: conversation?.selected_workspace ?? undefined,
          repository,
        },
        {
          onSuccess: (data) =>
            navigate(`/conversations/${data.conversation_id}`),
          onError: (error) =>
            displayErrorToast(error instanceof Error ? error.message : null),
        },
      );
    },
    [conversation, createConversation, navigate],
  );

  return { start, isPending };
}
