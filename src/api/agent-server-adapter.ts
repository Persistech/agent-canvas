import { DEFAULT_SETTINGS } from "#/services/settings";
import { V1ExecutionStatus } from "#/types/v1/core";
import {
  getAgentServerBaseUrl,
  getAgentServerSessionApiKey,
  getAgentServerWorkingDir,
} from "./agent-server-config";
import {
  GetHooksResponse,
  GetSkillsResponse,
  PluginSpec,
  V1AppConversation,
  V1AppConversationPage,
} from "./conversation-service/v1-conversation-service.types";
import { createHttpClient, createSkillsClient } from "./typescript-client";

export interface DirectConversationInfo {
  id: string;
  title?: string | null;
  created_at: string;
  updated_at: string;
  execution_status?: string | null;
  metrics?: {
    accumulated_cost?: number | null;
    max_budget_per_task?: number | null;
    accumulated_token_usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      cache_read_tokens?: number;
      cache_write_tokens?: number;
      context_window?: number;
      per_turn_token?: number;
    } | null;
  } | null;
  agent?: {
    llm?: {
      model?: string | null;
    } | null;
  } | null;
  workspace?: {
    working_dir?: string | null;
  } | null;
}



export function toConversationUrl(conversationId: string): string {
  return `${getAgentServerBaseUrl()}/api/conversations/${conversationId}`;
}

// TODO(i18n): extract "Conversation" once we add CONVERSATION$DEFAULT_TITLE
// with `{{shortId}}` interpolation. Kept as a literal for now to keep the
// fallback inside this pure adapter rather than fanning out to display sites.
export function getDefaultConversationTitle(conversationId: string): string {
  return `Conversation ${conversationId.slice(0, 5)}`;
}

export function toV1AppConversation(
  info: DirectConversationInfo,
): V1AppConversation {
  return {
    id: info.id,
    created_by_user_id: null,
    selected_repository: null,
    selected_branch: null,
    git_provider: null,
    title: info.title?.trim() ? info.title : getDefaultConversationTitle(info.id),
    trigger: null,
    pr_number: [],
    llm_model: info.agent?.llm?.model ?? DEFAULT_SETTINGS.llm_model,
    metrics: info.metrics
      ? {
          accumulated_cost: info.metrics.accumulated_cost ?? null,
          max_budget_per_task: info.metrics.max_budget_per_task ?? null,
          accumulated_token_usage: info.metrics.accumulated_token_usage
            ? {
                prompt_tokens:
                  info.metrics.accumulated_token_usage.prompt_tokens ?? 0,
                completion_tokens:
                  info.metrics.accumulated_token_usage.completion_tokens ?? 0,
                cache_read_tokens:
                  info.metrics.accumulated_token_usage.cache_read_tokens ?? 0,
                cache_write_tokens:
                  info.metrics.accumulated_token_usage.cache_write_tokens ?? 0,
                context_window:
                  info.metrics.accumulated_token_usage.context_window ?? 0,
                per_turn_token:
                  info.metrics.accumulated_token_usage.per_turn_token ?? 0,
              }
            : null,
        }
      : null,
    created_at: info.created_at,
    updated_at: info.updated_at,
    execution_status:
      (info.execution_status as V1AppConversation["execution_status"]) ??
      V1ExecutionStatus.IDLE,
    conversation_url: toConversationUrl(info.id),
    session_api_key: getAgentServerSessionApiKey(),
    workspace: {
      working_dir: info.workspace?.working_dir ?? getAgentServerWorkingDir(),
    },
    public: false,
    sub_conversation_ids: [],
  };
}

export function toV1ConversationPage(data: {
  items: DirectConversationInfo[];
  next_page_id?: string | null;
}): V1AppConversationPage {
  return {
    items: data.items.map(toV1AppConversation),
    next_page_id: data.next_page_id ?? null,
  };
}

/**
 * Build a minimal start conversation request payload.
 *
 * The agent-server fills in all configuration from persisted settings via
 * server-side merge (_merge_request_with_persisted_settings). We only send:
 * - initial_message: The user's query (if any)
 * - plugins: Any plugins to load (if any)
 * - conversation_id: Optional explicit ID
 *
 * All other settings (agent/LLM config, tools, workspace, confirmation_policy,
 * max_iterations, condenser, MCP config, security_analyzer) come from
 * server-side persisted settings.
 */
export function buildStartConversationRequest(options: {
  query?: string;
  conversationInstructions?: string;
  plugins?: PluginSpec[];
  conversationId?: string;
}) {
  const payload: Record<string, unknown> = {};

  // Add conversation ID if specified
  if (options.conversationId) {
    payload.conversation_id = options.conversationId;
  }

  // Build initial message from query and instructions
  const messageParts = [
    options.query?.trim(),
    options.conversationInstructions?.trim(),
  ].filter(Boolean);

  if (messageParts.length > 0) {
    payload.initial_message = {
      role: "user",
      content: [{ type: "text", text: messageParts.join("\n\n") }],
    };
  }

  // Add plugins if specified
  if (options.plugins?.length) {
    payload.plugins = options.plugins.map((plugin) => ({
      source: plugin.source,
      ...(plugin.ref ? { ref: plugin.ref } : {}),
      ...(plugin.repo_path ? { repo_path: plugin.repo_path } : {}),
    }));
  }

  return payload;
}

export async function downloadTextFile(path: string): Promise<string> {
  const response = await createHttpClient().get<ArrayBuffer>(
    "/api/file/download",
    {
      params: { path },
      responseType: "arrayBuffer",
    },
  );

  return new TextDecoder().decode(response.data);
}

export async function loadSkillsForConversation(
  conversation: V1AppConversation | null | undefined,
): Promise<GetSkillsResponse> {
  const projectDir =
    conversation?.workspace?.working_dir ?? getAgentServerWorkingDir();

  const response = await createSkillsClient().getSkills({
    load_public: true,
    load_user: true,
    load_project: true,
    load_org: false,
    project_dir: projectDir,
  });

  return { skills: response.skills ?? [] };
}

export function emptyHooksResponse(): GetHooksResponse {
  return { hooks: [] };
}
