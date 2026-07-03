import { describe, expect, it } from "vitest";
import {
  COOKIE_AUTH_SENTINEL,
  buildAuthHeaders,
  isCookieAuthenticated,
} from "#/api/backend-registry/auth";
import type { Backend } from "#/api/backend-registry/types";

const baseBackend: Backend = {
  id: "test-id",
  name: "test",
  host: "https://app.all-hands.dev",
  apiKey: "",
  kind: "cloud",
};

describe("cookie auth sentinel", () => {
  it("uses a non-empty opaque sentinel", () => {
    // Must not collide with a real bearer token. A real OpenHands API key
    // is a `gAAAAA...`-prefixed Fernet payload, so a leading `__` is safe
    // and the surrounding double underscores make accidental collision
    // vanishingly unlikely.
    expect(COOKIE_AUTH_SENTINEL).toBeTruthy();
    expect(COOKIE_AUTH_SENTINEL.startsWith("__")).toBe(true);
    expect(COOKIE_AUTH_SENTINEL.endsWith("__")).toBe(true);
  });

  it("isCookieAuthenticated recognizes the sentinel on a cloud backend", () => {
    expect(
      isCookieAuthenticated({ ...baseBackend, apiKey: COOKIE_AUTH_SENTINEL }),
    ).toBe(true);
  });

  it("isCookieAuthenticated rejects real API keys", () => {
    expect(
      isCookieAuthenticated({
        ...baseBackend,
        apiKey: "sk-oh-a-real-key-value",
      }),
    ).toBe(false);
  });

  it("isCookieAuthenticated only applies to cloud backends", () => {
    // A local backend must never be treated as cookie-authenticated even
    // if its `apiKey` happens to match the sentinel; the local agent-server
    // path always carries the key in `X-Session-API-Key`.
    expect(
      isCookieAuthenticated({
        ...baseBackend,
        kind: "local",
        apiKey: COOKIE_AUTH_SENTINEL,
      }),
    ).toBe(false);
  });

  it("isCookieAuthenticated rejects an empty apiKey", () => {
    expect(isCookieAuthenticated({ ...baseBackend, apiKey: "" })).toBe(false);
  });
});

describe("buildAuthHeaders with cookie auth", () => {
  it("returns no Authorization header for a cookie-authenticated cloud backend", () => {
    // Sending the sentinel as a Bearer token is wrong on two counts: it
    // would never be a valid credential, and it would expose the
    // sentinel value into request logs and proxies.
    const headers = buildAuthHeaders({
      ...baseBackend,
      apiKey: COOKIE_AUTH_SENTINEL,
    });
    expect(headers).toEqual({});
    expect(headers).not.toHaveProperty("Authorization");
  });

  it("still emits a bearer Authorization header for normal cloud API keys", () => {
    const headers = buildAuthHeaders({
      ...baseBackend,
      apiKey: "sk-oh-real-key",
    });
    expect(headers).toEqual({ Authorization: "Bearer sk-oh-real-key" });
  });

  it("still emits an X-Session-API-Key header for local backends", () => {
    const headers = buildAuthHeaders({
      ...baseBackend,
      kind: "local",
      apiKey: "session-key",
    });
    expect(headers).toEqual({ "X-Session-API-Key": "session-key" });
  });

  it("returns empty headers for an unconfigured cloud backend", () => {
    const headers = buildAuthHeaders({ ...baseBackend, apiKey: "" });
    expect(headers).toEqual({});
  });
});
