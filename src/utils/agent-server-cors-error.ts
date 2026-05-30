import type { Backend } from "#/api/backend-registry/types";
import i18n from "#/i18n";
import { I18nKey } from "#/i18n/declaration";

// Browser-generated network error messages used to detect likely CORS
// failures. These are English-only strings (Chrome, Safari, Firefox on
// English locales). Non-English locales or future browser wording changes
// will miss the match and fall back to the generic error path — intentional
// graceful degradation: no false positives because the
// `frontendOrigin !== backendOrigin` guard still applies.
const FETCH_NETWORK_ERROR_FRAGMENTS = [
  "failed to fetch",
  "load failed",
  "networkerror when attempting to fetch resource",
] as const;

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return "";
}

function isFetchNetworkFailure(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return FETCH_NETWORK_ERROR_FRAGMENTS.some((fragment) =>
    message.includes(fragment),
  );
}

function getCurrentBrowserOrigin(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.origin;
}

function getUrlOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildCorsMessage(frontendOrigin: string, backendOrigin: string) {
  return i18n.t(I18nKey.ERROR$AGENT_SERVER_CORS, {
    frontendOrigin,
    backendOrigin,
    interpolation: { escapeValue: false },
  });
}

export function maybeCreateAgentServerCorsError(
  error: unknown,
  backend: Backend,
): Error | null {
  if (backend.kind !== "local" || !isFetchNetworkFailure(error)) return null;

  const frontendOrigin = getCurrentBrowserOrigin();
  const backendOrigin = getUrlOrigin(backend.host);
  if (!frontendOrigin || !backendOrigin || frontendOrigin === backendOrigin) {
    return null;
  }

  return new Error(buildCorsMessage(frontendOrigin, backendOrigin), {
    cause: error,
  });
}
