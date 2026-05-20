import { AxiosError, isAxiosError } from "axios";
import { retrieveAxiosErrorMessage } from "./retrieve-axios-error-message";

/**
 * Discriminated union describing the kinds of resume-conversation failures
 * the UI cares about distinguishing. Anything that doesn't match a specific
 * case falls back to `kind: "unknown"` so the caller can render a generic
 * toast.
 *
 * - "lease_held": the agent-server returned 409 because another process
 *   still owns the conversation's `owner_lease.json`. The UI should show
 *   the take-ownership modal (advising the user to wait for the lease to
 *   expire or to restart the agent-server). The lease holder cannot be
 *   surfaced today — the agent-server's 409 detail only contains a hint
 *   message, not a structured payload — so the modal is informational.
 * - "session_load_failed": the ACP subprocess's `session/load` failed
 *   when respawning a paused conversation (e.g. the upstream CLI's
 *   session JSONL was wiped). Detected via a substring match on the
 *   error message; the SDK does not yet expose a structured error code
 *   for this. Tracked upstream in software-agent-sdk (see PR body).
 *   The UI should fall through to a banner and let the user keep typing.
 * - "unknown": everything else.
 */
export type ResumeErrorKind = "lease_held" | "session_load_failed" | "unknown";

export interface ResumeErrorInfo {
  kind: ResumeErrorKind;
  message: string;
}

const SESSION_LOAD_FAILURE_SUBSTRINGS = [
  "acp_session_load_failed",
  "session/load",
  "session_load_failed",
];

const looksLikeSessionLoadFailure = (message: string): boolean => {
  const haystack = message.toLowerCase();
  return SESSION_LOAD_FAILURE_SUBSTRINGS.some((needle) =>
    haystack.includes(needle.toLowerCase()),
  );
};

const looksLikeLeaseConflict = (message: string): boolean => {
  const haystack = message.toLowerCase();
  // The agent-server emits "Conversation already running. Wait for
  // completion or pause first." for the only 409 the /run endpoint
  // produces today, but the underlying ConversationLeaseHeldError uses
  // the phrase "conversation lease is held by". Match both so we cover
  // future SDK changes that might surface the lease error more directly.
  return (
    haystack.includes("already running") ||
    haystack.includes("lease is held") ||
    haystack.includes("owner_lease")
  );
};

/**
 * Categorise an error from `resumeConversation` so the caller can pick the
 * right UI surface (take-ownership modal vs. session-load banner vs.
 * generic toast).
 */
export const categorizeResumeError = (error: unknown): ResumeErrorInfo => {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const message = retrieveAxiosErrorMessage(axiosError) ?? "";
    if (
      axiosError.response?.status === 409 ||
      looksLikeLeaseConflict(message)
    ) {
      return { kind: "lease_held", message };
    }
    if (looksLikeSessionLoadFailure(message)) {
      return { kind: "session_load_failed", message };
    }
    return { kind: "unknown", message };
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  if (looksLikeSessionLoadFailure(message)) {
    return { kind: "session_load_failed", message };
  }
  if (looksLikeLeaseConflict(message)) {
    return { kind: "lease_held", message };
  }
  return { kind: "unknown", message };
};
