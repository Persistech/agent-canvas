import { buildHttpBaseUrl } from "#/utils/websocket-url";
import {
  getAgentServerSessionApiKey,
  getAgentServerWorkingDir,
} from "./agent-server-config";
import { getEffectiveLocalBackend } from "./backend-registry/active-store";
import { DEFAULT_LOCAL_BACKEND_ID } from "./backend-registry/default-backend";
import type { Backend } from "./backend-registry/types";

export interface AgentServerClientOverrides {
  host?: string;
  apiKey?: string | null;
  sessionApiKey?: string | null;
  workingDir?: string;
  conversationUrl?: string | null;
  timeout?: number;
}

export interface AgentServerClientOptions {
  host: string;
  apiKey?: string;
  workingDir: string;
  timeout?: number;
}

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, "");
}

function resolveHost(
  overrides: AgentServerClientOverrides,
  backend: Backend,
): string {
  if (overrides.host) return normalizeHost(overrides.host);
  if (overrides.conversationUrl)
    return normalizeHost(buildHttpBaseUrl(overrides.conversationUrl));
  return normalizeHost(backend.host);
}

// [DEBUG] Track the last key source to avoid logging on every API call.
let _lastApiKeySource: string | null = null;

export function getAgentServerClientOptions(
  overrides: AgentServerClientOverrides = {},
): AgentServerClientOptions {
  const backend = getEffectiveLocalBackend();
  const configuredSessionApiKey = getAgentServerSessionApiKey();
  const defaultLocalApiKeyOverride =
    backend.id === DEFAULT_LOCAL_BACKEND_ID ? configuredSessionApiKey : null;

  // [DEBUG] Determine which key source wins so we can trace auth failures.
  let apiKeySource: string;
  let apiKey: string | undefined;
  if (overrides.sessionApiKey != null) {
    apiKey = overrides.sessionApiKey;
    apiKeySource = "override.sessionApiKey";
  } else if (overrides.apiKey != null) {
    apiKey = overrides.apiKey;
    apiKeySource = "override.apiKey";
  } else if (defaultLocalApiKeyOverride != null) {
    apiKey = defaultLocalApiKeyOverride;
    apiKeySource = "defaultLocalApiKeyOverride (openhands-agent-server-config / VITE_SESSION_API_KEY)";
  } else if (backend.apiKey) {
    apiKey = backend.apiKey;
    apiKeySource = `backend.apiKey (backend: "${backend.id}")`;
  } else {
    apiKey = undefined;
    apiKeySource = "none — request will be unauthenticated";
  }

  // Log only when the effective source changes to avoid console noise on each call.
  if (_lastApiKeySource !== apiKeySource) {
    _lastApiKeySource = apiKeySource;
    console.debug(
      `[agent-canvas] getAgentServerClientOptions: key source changed → ${apiKeySource}` +
        (apiKey ? ` (key length: ${apiKey.length})` : ""),
    );
  }

  return {
    host: resolveHost(overrides, backend),
    ...(apiKey ? { apiKey } : {}),
    workingDir: overrides.workingDir ?? getAgentServerWorkingDir(),
    ...(overrides.timeout !== undefined ? { timeout: overrides.timeout } : {}),
  };
}

export function getAgentServerHttpClientOptions(
  overrides?: AgentServerClientOverrides,
) {
  const { host, apiKey, timeout } = getAgentServerClientOptions(overrides);
  return {
    baseUrl: host,
    ...(apiKey ? { apiKey } : {}),
    timeout: timeout ?? 60000,
  };
}
