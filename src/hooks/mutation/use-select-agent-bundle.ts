import { useCallback } from "react";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useSwitchLlmProfileAndLog } from "#/hooks/mutation/use-switch-llm-profile-and-log";
import { useSwitchAcpModel } from "#/hooks/mutation/use-switch-acp-model";
import { useStartNewWithBundle } from "#/hooks/mutation/use-start-new-with-bundle";
import type {
  AgentModelBundle,
  BundleAction,
} from "#/types/agent-model-bundle";

/**
 * The single write action behind the unified picker. Given the bundle the
 * user clicked and the {@link BundleAction} ``getBundleAction`` computed for
 * it, fan out to the existing per-kind mechanisms — keeping the proven
 * service calls underneath rather than introducing a new endpoint:
 *
 *   - native ``switch-live``   → ``switch_llm`` (per-conversation)
 *   - native ``set-default``   → ``activateProfile`` (home / no session)
 *   - ACP ``switch-live``      → ``switch_acp_model`` (live ``session/set_model``)
 *   - ACP ``set-default``      → ``PATCH /settings { acp_model }``
 *   - ``start-new-only``       → fork a new conversation ({@link useStartNewWithBundle})
 *
 * ``conversationId`` is ``null`` on the home screen, which is exactly what the
 * underlying hooks treat as "write the default", so the action falls out of
 * the same value the live path uses. ``current``/``disabled`` are no-ops.
 */
export function useSelectAgentBundle() {
  const { conversationId } = useOptionalConversationId();
  const { switchAndLog, isPending: isNativePending } =
    useSwitchLlmProfileAndLog();
  const switchAcpModel = useSwitchAcpModel();
  const { start: startNew, isPending: isForkPending } = useStartNewWithBundle();

  const select = useCallback(
    (bundle: AgentModelBundle, action: BundleAction) => {
      if (action === "start-new-only") {
        startNew(bundle);
        return;
      }
      if (action !== "switch-live" && action !== "set-default") {
        // current / disabled — nothing to do.
        return;
      }
      if (bundle.kind === "openhands") {
        switchAndLog(conversationId ?? null, bundle.profileName);
        return;
      }
      switchAcpModel.mutate({
        conversationId: conversationId ?? null,
        model: bundle.model,
      });
    },
    [conversationId, switchAndLog, switchAcpModel, startNew],
  );

  return {
    select,
    isPending: isNativePending || switchAcpModel.isPending || isForkPending,
  };
}
