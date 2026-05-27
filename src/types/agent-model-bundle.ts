import type { ACPProviderIcon } from "#/constants/acp-providers";

/**
 * One selectable entry in the unified model picker.
 *
 * Discriminated by ``kind``, which mirrors ``AppConversation.agent_kind``
 * so a bundle maps 1:1 onto the conversation it would produce. This is a
 * frontend *view-model* only: it is read-adapted from the two existing
 * storage shapes (native LLM profiles and the ACP provider registry +
 * agent settings) and never persisted in this form. Writes fan back out to
 * the existing endpoints via ``useSelectAgentBundle``.
 *
 * Bundle ids are stable strings (see {@link bundleId}) so the picker can
 * mark the running selection "current" by id comparison alone.
 */
export type AgentModelBundle =
  | {
      kind: "openhands";
      /** Stable picker id, unique across the catalog. */
      id: string;
      /** Profile name — the native "model" label shown in the picker. */
      label: string;
      /** LLM profile this bundle activates / switches to. */
      profileName: string;
      /** The profile's model string (for display; may be null if unset). */
      model: string | null;
    }
  | {
      kind: "acp";
      /** Stable picker id, unique across the catalog. */
      id: string;
      /** Human model label (e.g. ``"Claude Opus 4.7"``). */
      label: string;
      /** ACP provider registry key (e.g. ``"claude-code"``). */
      provider: string;
      /** Provider display name (e.g. ``"Claude Code"``) — used for group headers. */
      providerLabel: string;
      /** Exact ``acp_model`` id this bundle selects. */
      model: string;
      /** Brand icon discriminator for the row. */
      icon?: ACPProviderIcon;
      /**
       * Static capability: does the provider support live runtime model
       * switching at all (SDK ``supports_runtime_model_switch``). Combined
       * with the dynamic session-initialized signal to decide whether a
       * same-provider row switches live or requires a new conversation.
       */
      supportsRuntimeSwitch: boolean;
    };

/** Stable bundle id builders — the single source of the id scheme. */
export const bundleId = {
  openhands: (profileName: string) => `openhands:${profileName}`,
  acp: (provider: string, model: string) => `acp:${provider}:${model}`,
};

/** What selecting a bundle does, given the current conversation context. */
export type BundleAction =
  /** Already the running / selected bundle — no-op. */
  | "current"
  /** Swap in place; context preserved (native ``switch_llm`` / ACP ``switch_acp_model``). */
  | "switch-live"
  /** Home / no session — persist as the default the next conversation inherits. */
  | "set-default"
  /** Incompatible with this conversation — only reachable by starting a new one. */
  | "start-new-only"
  /** Not actionable right now (cloud backend, or ACP session not yet initialized). */
  | "disabled";

/** Why a bundle is ``start-new-only`` or ``disabled`` — drives the row's reason text. */
export type BundleActionReason =
  /** Switching is unsupported on cloud backends (local-only, like native profiles). */
  | "cloud"
  /** ACP session not started yet; ``switch_acp_model`` 409s until the first message. */
  | "uninitialized"
  /** Target is a different agent kind / ACP provider — needs a fresh subprocess. */
  | "different-agent"
  /** Provider can't switch models live at all (``supports_runtime_model_switch=false``). */
  | "unsupported";

export interface BundleActionResult {
  action: BundleAction;
  reason?: BundleActionReason;
}

/**
 * The running-conversation facts {@link getBundleAction} needs, produced by
 * ``useActiveAgentBundleContext`` from the active conversation, settings,
 * backend kind, and event store.
 */
export interface ActiveAgentBundleContext {
  /** Backend kind — cloud has no profile/ACP switching. */
  backendKind: "local" | "cloud";
  /** Inside an active conversation (vs. on the home / launcher screen). */
  hasConversation: boolean;
  /** The active conversation's agent kind (``null`` on home / unknown). */
  conversationAgentKind: "openhands" | "acp" | null;
  /** For an ACP conversation, the running provider registry key. */
  conversationAcpProvider: string | null;
  /**
   * Id of the currently-selected bundle ({@link bundleId}), used to mark a
   * row "current" — at home (the saved default) and in a conversation (the
   * running model).
   */
  currentBundleId: string | null;
  /**
   * Whether the ACP session has been initialized (≥1 exchanged event). Live
   * same-provider model switch 409s before this is true. Inferred
   * client-side in Phase 1; replaced by an authoritative backend flag in
   * Phase 3.
   */
  sessionInitialized: boolean;
}
