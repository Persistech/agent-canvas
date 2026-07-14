import toast from "react-hot-toast";
import ConversationService from "#/api/conversation-service/conversation-service.api";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import { getActiveBackend } from "#/api/backend-registry/active-store";
import { callCloudProxy } from "#/api/cloud/proxy";
import EventService from "#/api/event-service/event-service.api";
import { TOAST_OPTIONS } from "#/utils/custom-toast-handlers";
import { contributionRegistry } from "../contribution-registry";
import type {
  ConversationSummary,
  CreateConversationOptions,
  EventStats,
} from "../sdk/types";
import type {
  BackendFetchMethod,
  BackendFetchResponse,
  HostApiDeps,
  SandboxInfo,
} from "./host-api";

/** Global navigate function set by the app's navigation provider. */
let globalNavigate: ((path: string) => void) | null = null;

/** Set the global navigate function (called from NavigationProvider). */
export function setExtensionNavigate(fn: (path: string) => void): void {
  globalNavigate = fn;
}

const STORAGE_PREFIX = "agent-canvas:ext";

/** Retry configuration for rate-limited requests */
const RETRY_CONFIG = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/** Check if an error is a 429 rate limit error */
function isRateLimitError(error: unknown): boolean {
  const axiosError = error as { response?: { status?: number } };
  return axiosError?.response?.status === 429;
}

/** Sleep for a specified number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Execute a function with retry and exponential backoff for 429 errors */
async function withRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
  let lastError: unknown;
  let delay = RETRY_CONFIG.initialDelayMs;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRateLimitError(error) || attempt === RETRY_CONFIG.maxRetries) {
        throw error;
      }

      console.log(
        `[extensions] ${context}: Rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`,
      );
      await sleep(delay);
      delay = Math.min(
        delay * RETRY_CONFIG.backoffMultiplier,
        RETRY_CONFIG.maxDelayMs,
      );
    }
  }

  throw lastError;
}

function storageKey(extensionId: string, key: string): string {
  return `${STORAGE_PREFIX}:${extensionId}:${key}`;
}

/**
 * Upper bound on events scanned when computing stats, so a very long trajectory
 * can't spin the UI forever. At 100/page this is 50 requests; beyond it the
 * returned stats are flagged `truncated`.
 */
const EVENT_STATS_MAX_EVENTS = 5000;
const EVENT_STATS_PAGE_SIZE = 100;

/** Coerce an event's timestamp to epoch ms, or null if unparseable. */
function eventTimeMs(timestamp: unknown): number | null {
  if (typeof timestamp !== "string") return null;
  const ms = Date.parse(timestamp);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Page through a conversation's event stream via {@link EventService} (which
 * transparently targets the cloud App API or the local agent-server) and fold
 * the events into aggregate counts + a first/last duration. The extension host
 * exposes this so a sandboxed webview — which has no network of its own — can
 * show trajectory stats on both backends without ever seeing the runtime key.
 */
async function computeEventStats(
  conversationId: string,
  conversationUrl: string | null,
  sessionApiKey: string | null,
): Promise<EventStats> {
  const byKind: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let total = 0;
  let minMs: number | null = null;
  let maxMs: number | null = null;
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;
  let truncated = false;

  let pageId: string | undefined;
  // Ascending scan keeps memory flat; we only track running aggregates.
  while (total < EVENT_STATS_MAX_EVENTS) {
    const page = await withRetry(
      () =>
        EventService.searchEvents(
          conversationId,
          conversationUrl,
          sessionApiKey,
          {
            limit: EVENT_STATS_PAGE_SIZE,
            sortOrder: "TIMESTAMP",
            ...(pageId ? { pageId } : {}),
          },
        ),
      `getEventStats ${conversationId}`,
    );

    const items = Array.isArray(page.items) ? page.items : [];
    for (const event of items) {
      const record = event as {
        kind?: unknown;
        source?: unknown;
        timestamp?: unknown;
      };
      total += 1;

      const kind = typeof record.kind === "string" ? record.kind : "Unknown";
      byKind[kind] = (byKind[kind] ?? 0) + 1;

      const source =
        typeof record.source === "string" ? record.source : "unknown";
      bySource[source] = (bySource[source] ?? 0) + 1;

      const ms = eventTimeMs(record.timestamp);
      if (ms !== null) {
        if (minMs === null || ms < minMs) {
          minMs = ms;
          firstTimestamp = record.timestamp as string;
        }
        if (maxMs === null || ms > maxMs) {
          maxMs = ms;
          lastTimestamp = record.timestamp as string;
        }
      }
    }

    const nextPageId = page.next_page_id ?? null;
    if (!nextPageId || items.length === 0) break;
    pageId = nextPageId;

    if (total >= EVENT_STATS_MAX_EVENTS) {
      truncated = true;
      break;
    }
  }

  return {
    total,
    byKind,
    bySource,
    firstTimestamp,
    lastTimestamp,
    durationMs: minMs !== null && maxMs !== null ? maxMs - minMs : null,
    truncated,
  };
}

/**
 * Build the real {@link HostApiDeps} wiring the extension host to live app services:
 * the active conversation, toast notifications, contributed-command dispatch, and
 * namespaced `localStorage`. This is the production seam between the (app-agnostic)
 * extension subsystem and Agent-Canvas.
 */
export function createAppHostDeps(): HostApiDeps {
  return {
    getActiveConversation: (): ConversationSummary | null => {
      const conversation = ConversationService.getCurrentConversation();
      if (!conversation) return null;
      const backendKind = getActiveBackend().backend.kind;
      return {
        id: conversation.id,
        title: conversation.title,
        status: conversation.execution_status ?? null,
        model: conversation.llm_model ?? null,
        agentKind: conversation.agent_kind ?? null,
        createdAt: conversation.created_at ?? null,
        updatedAt: conversation.updated_at ?? null,
        selectedRepository: conversation.selected_repository ?? null,
        workingDir: conversation.workspace?.working_dir ?? null,
        backend: backendKind === "cloud" ? "cloud" : "local",
        sandboxId: conversation.sandbox_id ?? null,
        sandboxStatus: conversation.sandbox_status ?? null,
      };
    },

    getEventStats: async (conversationId?: string): Promise<EventStats> => {
      const conversation = ConversationService.getCurrentConversation();
      const targetId = conversationId ?? conversation?.id;
      if (!targetId) {
        throw new Error("No conversation available for event stats");
      }
      return computeEventStats(
        targetId,
        conversation?.conversation_url ?? null,
        conversation?.session_api_key ?? null,
      );
    },

    showInformationMessage: (message: string) => {
      toast(message, TOAST_OPTIONS);
    },

    executeCommand: (command: string) => {
      const match = contributionRegistry
        .getCommands()
        .find((c) => c.command === command);
      if (!match) {
        console.warn(`[extensions] unknown command: ${command}`);
        return undefined;
      }
      return match.run();
    },

    storageGet: (extensionId: string, key: string) => {
      try {
        const raw = localStorage.getItem(storageKey(extensionId, key));
        return raw === null ? null : JSON.parse(raw);
      } catch {
        return null;
      }
    },

    storageSet: (extensionId: string, key: string, value: unknown) => {
      try {
        localStorage.setItem(
          storageKey(extensionId, key),
          JSON.stringify(value),
        );
      } catch {
        // Ignore quota / serialization errors — extension storage is best-effort.
      }
    },

    backendCloudFetch: async (
      path: string,
      method: BackendFetchMethod,
      body?: unknown,
    ): Promise<BackendFetchResponse | null> => {
      const { backend } = getActiveBackend();

      // Only available for cloud backends
      if (backend.kind !== "cloud") {
        return null;
      }

      try {
        const data = await withRetry(
          () =>
            callCloudProxy({
              backend,
              method,
              path,
              body,
            }),
          `cloudFetch ${method} ${path}`,
        );

        return {
          ok: true,
          status: 200,
          data,
        };
      } catch (error) {
        // Extract status from axios error if available
        const axiosError = error as { response?: { status?: number } };
        const status = axiosError.response?.status ?? 500;

        return {
          ok: false,
          status,
          data: null,
        };
      }
    },

    navigate: (path: string) => {
      if (globalNavigate) {
        globalNavigate(path);
      }
    },

    createConversation: async (
      options?: CreateConversationOptions,
    ): Promise<string> => {
      const task = await withRetry(
        () =>
          AgentServerConversationService.createConversation(
            options?.initialMessage ?? undefined, // initialUserMsg
            options?.title ?? undefined, // conversationInstructions
            undefined, // metadata
            undefined, // plugins
            undefined, // workingDirOverride
            undefined, // workspaceMode
            undefined, // parentConversationId
            undefined, // agentType
            options?.sandboxId, // sandboxId
          ),
        "createConversation",
      );

      // Cloud backend returns a task with status WORKING and app_conversation_id
      // is null until the task completes. Navigate to /conversations/task-{id}
      // so useTaskPolling polls until READY, then redirects to the real
      // conversation. If app_conversation_id is already set (task completed
      // synchronously or local backend), navigate directly to it.
      const navigationId = task.app_conversation_id
        ? task.app_conversation_id
        : `task-${task.id}`;

      // Navigate to the conversation (or task polling route)
      if (globalNavigate) {
        globalNavigate(`/conversations/${navigationId}`);
      }

      // Return the actual conversation ID if available, otherwise the task ID
      return task.app_conversation_id ?? task.id;
    },

    createSandbox: async (sandboxSpecId?: string): Promise<SandboxInfo> => {
      const { backend } = getActiveBackend();

      // Only available for cloud backends
      if (backend.kind !== "cloud") {
        throw new Error("Sandbox creation requires a cloud backend");
      }

      const path = sandboxSpecId
        ? `/api/v1/sandboxes?sandbox_spec_id=${encodeURIComponent(sandboxSpecId)}`
        : "/api/v1/sandboxes";

      const data = await withRetry(
        () =>
          callCloudProxy({
            backend,
            method: "POST",
            path,
          }),
        "createSandbox",
      );

      return data as SandboxInfo;
    },
  };
}
