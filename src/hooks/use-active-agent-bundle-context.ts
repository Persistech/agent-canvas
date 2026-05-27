import { useActiveBackend } from "#/contexts/active-backend-context";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useSettings } from "#/hooks/query/use-settings";
import { useLlmProfiles } from "#/hooks/query/use-llm-profiles";
import { useAcpModelContext } from "#/hooks/use-acp-model-context";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useModelStore } from "#/stores/model-store";
import { useEventStore } from "#/stores/use-event-store";
import {
  getAcpProvider,
  labelForAcpModel,
  resolveEffectiveAcpModel,
} from "#/constants/acp-providers";
import {
  bundleId,
  type ActiveAgentBundleContext,
} from "#/types/agent-model-bundle";

/**
 * Everything the picker needs about the *current* selection: the
 * capability-matrix inputs ({@link ActiveAgentBundleContext}) plus the human
 * label shown on the inline button. Kept separate so ``getBundleAction``'s
 * input stays minimal and table-testable.
 */
export interface ActiveAgentBundleState extends ActiveAgentBundleContext {
  /**
   * Display label for the running selection — the native profile name, the
   * ACP model's human label, or the raw model string as a fallback (cloud /
   * custom model / no matching profile). ``null`` when there is nothing to
   * show, in which case the picker renders nothing.
   */
  currentLabel: string | null;
}

/**
 * Derive the {@link ActiveAgentBundleContext} that ``getBundleAction``
 * consumes — the running conversation's agent kind / ACP provider, the
 * backend kind, the currently-selected bundle id (so exactly one picker row
 * reads "current"), and whether the ACP session is initialized.
 *
 * The ACP discriminators come from {@link useAcpModelContext} so the
 * home-page-ACP rule lives in one place. ``sessionInitialized`` is inferred
 * from the event store (a conversation with ≥1 exchanged event has a live
 * session — ``switch_acp_model`` 409s before then); Phase 3 replaces this
 * with an authoritative agent-server flag.
 */
export function useActiveAgentBundleContext(): ActiveAgentBundleState {
  const { backend } = useActiveBackend();
  const { data: conversation } = useActiveConversation();
  const { data: settings } = useSettings();
  const { data: profilesData } = useLlmProfiles();
  const { isActiveAcpConversation, isAcpContext } = useAcpModelContext();
  const { conversationId } = useOptionalConversationId();
  const eventCount = useEventStore((s) => s.events.length);
  // Optimistic active profile written on a successful native switch — gives
  // instant "current" feedback before the conversation refetch lands.
  const optimisticActiveProfile = useModelStore((s) =>
    conversationId ? s.activeProfileByConversation[conversationId] : undefined,
  );

  const backendKind = backend.kind === "cloud" ? "cloud" : "local";
  const hasConversation = Boolean(conversation);
  const conversationAgentKind: "openhands" | "acp" | null = conversation
    ? (conversation.agent_kind ?? "openhands")
    : null;
  const conversationAcpProvider =
    typeof conversation?.acp_server === "string"
      ? conversation.acp_server
      : null;
  const sessionInitialized = eventCount > 0;

  let currentBundleId: string | null = null;
  let currentLabel: string | null = null;
  if (isAcpContext) {
    const acpServerKey = isActiveAcpConversation
      ? conversationAcpProvider
      : typeof settings?.agent_settings?.acp_server === "string"
        ? settings.agent_settings.acp_server
        : null;
    const provider = getAcpProvider(acpServerKey);
    const model = isActiveAcpConversation
      ? (conversation?.llm_model ?? null)
      : resolveEffectiveAcpModel({
          configured:
            typeof settings?.agent_settings?.acp_model === "string"
              ? settings.agent_settings.acp_model
              : null,
          providerDefault: provider?.default_model,
        });
    if (model) {
      // Human label (e.g. "Claude Opus 4.7"), falling back to the raw id
      // for a custom acp_model — mirrors the old ChatInputModel display.
      currentLabel = labelForAcpModel(acpServerKey, model) ?? model;
    }
    if (acpServerKey && model) {
      currentBundleId = bundleId.acp(acpServerKey, model);
    }
  } else {
    // Native: mirror SwitchProfileButton's active-profile resolution —
    // optimistic → profile matching the running model → user default.
    const profiles = profilesData?.profiles ?? [];
    const conversationModel = conversation?.llm_model ?? null;
    const activeProfileName =
      optimisticActiveProfile ??
      (conversationModel
        ? (profiles.find((p) => p.model === conversationModel)?.name ?? null)
        : (profilesData?.active_profile ?? null));
    // Prefer the profile name (local picker), falling back to the model
    // string for cloud (no profiles) or an unmatched model.
    currentLabel =
      activeProfileName ?? conversationModel ?? settings?.llm_model ?? null;
    if (activeProfileName) {
      currentBundleId = bundleId.openhands(activeProfileName);
    }
  }

  return {
    backendKind,
    hasConversation,
    conversationAgentKind,
    conversationAcpProvider,
    currentBundleId,
    sessionInitialized,
    currentLabel,
  };
}
