import type { Backend } from "./types";

/**
 * Sentinel stored in `Backend.apiKey` to indicate that the user
 * authenticated against a cloud backend via the device-flow cookie
 * endpoint (`POST /oauth/device/cookie`) rather than by pasting a
 * long-lived bearer token. The actual API key lives in the HttpOnly
 * `api_key` cookie set by that endpoint; JavaScript cannot read it
 * (which is the XSS-exfiltration mitigation), and subsequent same-site
 * cloud requests pick it up automatically when
 * `callCloudProxy` flips on `withCredentials: true`.
 *
 * Persisted in `localStorage` so the UI can tell the backend is logged
 * in across reloads, but the real credential is never accessible to
 * other scripts on the page even if they escape sandbox restrictions.
 */
export const COOKIE_AUTH_SENTINEL = "__cookie_authenticated__";

/**
 * True when the backend is authenticated via the device-flow cookie.
 */
export function isCookieAuthenticated(backend: Backend): boolean {
  return backend.kind === "cloud" && backend.apiKey === COOKIE_AUTH_SENTINEL;
}

/**
 * Build the auth headers to send to a backend.
 *
 * Local agent-server uses `X-Session-API-Key`. Cloud expects a bearer
 * token in the `Authorization` header, except for cookie-authenticated
 * backends, which carry the credential in an HttpOnly cookie picked up
 * via `credentials: "include"` instead of a request header (see
 * `src/api/cloud/proxy.ts`). JavaScript cannot read the cookie value,
 * so `buildAuthHeaders` deliberately returns an empty header set for
 * those backends — sending the sentinel as a bearer token would be
 * useless and pollute logs.
 */
export function buildAuthHeaders(backend: Backend): Record<string, string> {
  if (isCookieAuthenticated(backend)) return {};

  if (!backend.apiKey) return {};

  if (backend.kind === "cloud") {
    return { Authorization: `Bearer ${backend.apiKey}` };
  }

  return { "X-Session-API-Key": backend.apiKey };
}
