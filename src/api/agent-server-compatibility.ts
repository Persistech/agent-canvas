import { HttpError } from "@openhands/typescript-client/client/http-client";
import { getEffectiveLocalBackend } from "#/api/backend-registry/active-store";
import {
  createServerClient,
  type ServerInfo as BaseServerInfo,
} from "#/api/typescript-client";

const AGENT_SERVER_INFO_TIMEOUT_MS = 5000;

export interface AgentServerInfo extends BaseServerInfo {
  usable_tools?: string[] | null;
}

let cachedAgentServerInfo: AgentServerInfo | null = null;

const getAdvertisedTools = (serverInfo: AgentServerInfo | null) => {
  if (Array.isArray(serverInfo?.usable_tools)) {
    return serverInfo.usable_tools;
  }
  return null;
};

export class AgentServerUnavailableError extends Error {
  readonly details: string | null;

  constructor(details?: string | null) {
    super(
      "Agent server not found. Could not connect to the configured agent server. Start a compatible agent server and reload the page.",
    );
    this.name = "AgentServerUnavailableError";
    this.details = details ?? null;
  }
}

function createAgentServerAuthenticationError(details?: string | null) {
  const error = new AgentServerUnavailableError(
    details ??
      "Agent server requires a valid X-Session-API-Key before the frontend can connect.",
  );
  error.name = "AgentServerAuthenticationError";
  return error;
}

export const isAgentServerUnavailableError = (
  error: unknown,
): error is AgentServerUnavailableError =>
  error instanceof AgentServerUnavailableError ||
  (typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "AgentServerUnavailableError" ||
      error.name === "AgentServerAuthenticationError"));

function getHttpStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;

  const { status } = error as { status?: unknown };
  if (typeof status === "number") return status;

  const { statusCode } = error as { statusCode?: unknown };
  if (typeof statusCode === "number") return statusCode;

  const { response } = error as { response?: { status?: unknown } };
  const responseStatus = response?.status;
  return typeof responseStatus === "number" ? responseStatus : null;
}

export function clearCachedAgentServerInfo() {
  cachedAgentServerInfo = null;
}

export function isAgentServerToolAvailable(toolName: string) {
  const availableTools = getAdvertisedTools(cachedAgentServerInfo);
  if (!Array.isArray(availableTools)) {
    return true;
  }
  return availableTools.includes(toolName);
}

export async function loadAgentServerInfo() {
  // The probe is a *local* agent-server concern — it verifies the runtime
  // hosting the GUI is reachable. It must NEVER run against the active
  // backend when that backend is cloud, because cloud SaaS hosts don't
  // expose /api/server_info and would fail with a CORS error besides.
  const local = getEffectiveLocalBackend();
  let serverInfo: AgentServerInfo;

  try {
    serverInfo = (await createServerClient({
      host: local.host,
      sessionApiKey: local.apiKey || null,
      timeout: AGENT_SERVER_INFO_TIMEOUT_MS,
    }).getServerInfo()) as AgentServerInfo;
  } catch (error) {
    clearCachedAgentServerInfo();
    const status = getHttpStatus(error);
    if (status === 401 || status === 403) {
      throw createAgentServerAuthenticationError(`HTTP ${status}`);
    }

    if (error instanceof HttpError || status !== null) {
      throw new AgentServerUnavailableError(
        status === null ? null : `HTTP ${status}`,
      );
    }

    const details = error instanceof Error ? error.message : null;
    throw new AgentServerUnavailableError(details);
  }

  cachedAgentServerInfo = serverInfo;
  return serverInfo;
}
