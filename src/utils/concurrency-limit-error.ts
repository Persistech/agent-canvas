import { AxiosError } from "axios";
import { DEFAULT_CONCURRENT_SANDBOX_LIMIT } from "#/utils/constants";

interface ConcurrencyLimitErrorDetail {
  error: "CONCURRENCY_LIMIT_REACHED";
  message: string;
  limit: number;
  current: number;
}

// FastAPI wraps HTTPException detail in a "detail" field.
interface FastAPIErrorResponse {
  detail: ConcurrencyLimitErrorDetail;
}

/**
 * True when a request failed because the cloud backend rejected it for
 * exceeding the user's concurrent-conversation limit. OpenHands Cloud returns
 * this synchronously from `POST /api/v1/app-conversations` as a 429 whose
 * `detail.error` is `CONCURRENCY_LIMIT_REACHED`.
 */
export function isConcurrencyLimitError(
  error: unknown,
): error is AxiosError<FastAPIErrorResponse> {
  if (!(error instanceof AxiosError)) return false;
  if (error.response?.status !== 429) return false;
  return error.response?.data?.detail?.error === "CONCURRENCY_LIMIT_REACHED";
}

/** The user's concurrent-conversation limit carried by the error. */
export function getConcurrencyLimit(
  error: AxiosError<FastAPIErrorResponse>,
): number {
  return (
    error.response?.data?.detail?.limit ?? DEFAULT_CONCURRENT_SANDBOX_LIMIT
  );
}
