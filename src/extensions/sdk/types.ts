/**
 * Public SDK types shared between the host and the in-worker extension runtime.
 *
 * This is the Agent-Canvas analog of the `vscode` module's type surface. Extensions
 * are handed an {@link ExtensionContext} (containing the {@link AgentCanvasApi}) at
 * activation and interact with the app exclusively through it — never via the DOM.
 */

/** Minimal, serialisable view of a conversation exposed to extensions. */
export interface ConversationSummary {
  id: string;
  title: string | null;
  /** Execution status: 'idle', 'running', 'finished', 'error', etc. */
  status: string | null;
  /** The LLM model ID used for this conversation. */
  model: string | null;
  /** The agent kind: 'openhands' or 'acp'. */
  agentKind: string | null;
  /** When the conversation was created (ISO timestamp). */
  createdAt: string | null;
  /** When the conversation was last updated (ISO timestamp). */
  updatedAt: string | null;
  /** Selected repository (if any). */
  selectedRepository: string | null;
  /** Working directory path (if available). */
  workingDir: string | null;
  /**
   * The active backend kind this conversation lives on: `"cloud"` | `"local"`.
   * Lets extensions gate cloud-only affordances (e.g. runtime/sandbox controls)
   * without a separate capability — it mirrors the host UI-context `backend` fact.
   */
  backend: "cloud" | "local" | null;
  /**
   * Cloud sandbox (runtime) id backing this conversation, or null. Only populated
   * for cloud conversations; always null on local backends. Non-secret identifier
   * suitable for querying `/api/v1/sandboxes/{id}` via `backend.cloudFetch`.
   */
  sandboxId: string | null;
  /**
   * Cloud sandbox lifecycle status (e.g. `RUNNING`, `PAUSED`, `STARTING`), or null.
   * Only meaningful for cloud conversations.
   */
  sandboxStatus: string | null;
}

/** Aggregate statistics computed from a conversation's event stream. */
export interface EventStats {
  /** Total number of events in the conversation. */
  total: number;
  /** Count of events grouped by their `kind` (e.g. ActionEvent, MessageEvent). */
  byKind: Record<string, number>;
  /** Count of events grouped by their `source` (agent, user, environment). */
  bySource: Record<string, number>;
  /** ISO timestamp of the earliest event, or null when there are no events. */
  firstTimestamp: string | null;
  /** ISO timestamp of the latest event, or null when there are no events. */
  lastTimestamp: string | null;
  /**
   * Wall-clock duration in milliseconds from the first to the last event, or null
   * when fewer than two events exist.
   */
  durationMs: number | null;
  /**
   * True when the stats were computed from a truncated scan (the event stream was
   * larger than the scan budget), so counts/duration are lower bounds.
   */
  truncated: boolean;
}

/** Returned by registrations/subscriptions so callers can clean up. */
export interface Disposable {
  dispose(): void;
}

/** Options for creating a new conversation. */
export interface CreateConversationOptions {
  /** Optional initial message to send. */
  initialMessage?: string;
  /** Optional sandbox ID to reuse an existing sandbox. */
  sandboxId?: string;
  /** Optional title for the conversation. */
  title?: string;
}

/** Information about a cloud sandbox. */
export interface SandboxInfo {
  id: string;
  created_by_user_id: string | null;
  sandbox_spec_id: string;
  status: string;
  session_api_key: string | null;
  exposed_urls?: Array<{ url: string; name: string }> | null;
  created_at?: string;
}

export interface AgentCanvasApi {
  commands: {
    /** Register a handler for a command declared in the manifest. */
    register(command: string, handler: () => void | Promise<void>): Disposable;
    /** Execute any command (built-in or contributed) by id. */
    execute(command: string, ...args: unknown[]): Promise<unknown>;
  };
  window: {
    /** Show a transient informational message in the host UI. */
    showInformationMessage(message: string): Promise<void>;
  };
  conversation: {
    /** The currently active conversation, or null. Requires `conversation:read`. */
    getActive(): Promise<ConversationSummary | null>;
    /** Create a new conversation and navigate to it. Returns the task/conversation ID. */
    create(options?: CreateConversationOptions): Promise<string>;
    /**
     * Compute aggregate statistics (event counts by kind/source and duration)
     * for a conversation's event stream. Works on both cloud and local backends —
     * the host resolves the conversation's runtime host/key internally, so the
     * extension never handles credentials. Requires `conversation:read`.
     *
     * @param conversationId - Conversation to analyze. Defaults to the active one.
     */
    getEventStats(conversationId?: string): Promise<EventStats>;
  };
  sandbox: {
    /** Create a new cloud sandbox (without a conversation). Returns sandbox info. Requires `backend:cloud:write`. */
    create(sandboxSpecId?: string): Promise<SandboxInfo>;
  };
  storage: {
    /** Per-extension namespaced storage. Requires the `storage` capability. */
    get<T = unknown>(key: string): Promise<T | null>;
    set<T = unknown>(key: string, value: T): Promise<void>;
  };
  navigation: {
    /** Navigate to a path within the app (e.g. "/conversations/abc123"). */
    navigate(path: string): Promise<void>;
  };
}

/** Handed to an extension's `activate(context)` entry point. */
export interface ExtensionContext {
  /** The extension's own id. */
  extensionId: string;
  /** The API surface. */
  agentCanvas: AgentCanvasApi;
  /** Push disposables here; all are disposed on deactivation. */
  subscriptions: Disposable[];
}

/** The module shape an extension's `main` entry is expected to export. */
export interface ExtensionModule {
  activate?(context: ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
