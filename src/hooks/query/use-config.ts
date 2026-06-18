import { useQuery } from "@tanstack/react-query";
import {
  isAgentServerUnavailableError,
  isAgentServerAuthError,
  isAgentServerUnknownVersionError,
  isAgentServerUnsupportedVersionError,
} from "#/api/agent-server-compatibility";
import OptionService from "#/api/option-service/option-service.api";
import { QUERY_KEYS, CONFIG_CACHE_OPTIONS } from "./query-keys";

interface UseConfigOptions {
  enabled?: boolean;
}

export const AGENT_SERVER_BOOTSTRAP_RETRY_COUNT = 4;
export const AGENT_SERVER_BOOTSTRAP_RETRY_BASE_DELAY_MS = 1000;
export const AGENT_SERVER_BOOTSTRAP_RETRY_MAX_DELAY_MS = 5000;

export function shouldRetryConfigQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (
    isAgentServerAuthError(error) ||
    isAgentServerUnsupportedVersionError(error) ||
    isAgentServerUnknownVersionError(error)
  ) {
    return false;
  }

  if (isAgentServerUnavailableError(error)) {
    return (
      !error.noBackendConfigured &&
      failureCount < AGENT_SERVER_BOOTSTRAP_RETRY_COUNT
    );
  }

  return failureCount < 3;
}

export function getConfigRetryDelay(attemptIndex: number): number {
  return Math.min(
    AGENT_SERVER_BOOTSTRAP_RETRY_BASE_DELAY_MS * 2 ** attemptIndex,
    AGENT_SERVER_BOOTSTRAP_RETRY_MAX_DELAY_MS,
  );
}

export const useConfig = (options?: UseConfigOptions) =>
  useQuery({
    queryKey: QUERY_KEYS.WEB_CLIENT_CONFIG,
    queryFn: OptionService.getConfig,
    retry: shouldRetryConfigQuery,
    retryDelay: getConfigRetryDelay,
    meta: { disableToast: true },
    ...CONFIG_CACHE_OPTIONS,
    enabled: options?.enabled,
  });
