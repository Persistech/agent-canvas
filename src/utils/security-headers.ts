import type { Backend } from "#/api/backend-registry/types";

/**
 * Content Security Policy builder for the agent-canvas frontend.
 *
 * Why this exists: the frontend runs arbitrary JavaScript from a large npm
 * dependency graph. Without a Content-Security-Policy (CSP), any successful
 * XSS (compromised dep, malicious browser extension) gets free rein. CSP is
 * the *real* mitigation for XSS-driven key exfiltration, ahead of where we
 * store API keys.
 *
 * The policy is intentionally permissive in `script-src` (allows `'unsafe-inline'`)
 * because React Router v7 emits inline `<script>` tags for its server-stream
 * replay and the static-server injects additional inline scripts to set
 * `window.__AGENT_CANVAS_*` runtime config. A nonce-based setup would be
 * tighter but breaks Vite's HMR. We tighten everything else (frame-src,
 * img-src, base-uri, form-action, object-src) so a successful XSS still
 * can't exfiltrate credentials or embed hostile iframes.
 *
 * `connect-src` is broadened to include every registered backend's origin
 * (the user can switch backends at runtime) plus known telemetry endpoints
 * (PostHog for product analytics, z.openhands.dev for library telemetry)
 * and `ws:` / `wss:` for the WebSocket event streams.
 *
 * Future tightening: once every entry-point that emits inline scripts is
 * nonce-driven, drop `'unsafe-inline'` from `script-src` and require a
 * per-request nonce. Tracked in SECURITY.md.
 */
const POSTHOG_API_HOST = "https://us.i.posthog.com";
const TELEMETRY_PROXY_HOST = "https://z.openhands.dev";

/**
 * Convert a backend host string into a CSP `connect-src` / `frame-src` token.
 * Accepts full URLs and bare hostnames (with optional ports). Returns
 * `null` if the value cannot be parsed as a URL — the caller must drop the
 * entry rather than emit a malformed token, since a malformed token can
 * silently disable the whole source-expression.
 */
export function backendHostToCspSource(
  host: string | null | undefined,
): string | null {
  if (!host) return null;
  const trimmed = host.trim();
  if (!trimmed) return null;

  // Reject anything that isn't http(s)://… — CSP source expressions do not
  // understand other schemes, and emitting them would either be ignored or
  // (for `data:` / `javascript:`) actively dangerous.
  if (!/^https?:\/\//i.test(trimmed)) return null;

  try {
    const url = new URL(trimmed);
    // CSP source expressions are scheme + host [+ port]; strip the path /
    // query so they match all paths under that origin.
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Build the `connect-src` source list for the policy.
 *
 * Includes:
 * - `'self'` for the page's own origin
 * - every registered backend's origin (any of them may become active)
 * - PostHog for product analytics
 * - the telemetry proxy for library-level events
 * - `ws:` and `wss:` for WebSocket connections (CSP requires explicit
 *   upgrade of `ws:` ↔ `http:` and `wss:` ↔ `https:`)
 */
export function buildConnectSrc(backends: ReadonlyArray<Backend>): string {
  const sources = new Set<string>(["'self'"]);
  for (const backend of backends) {
    const origin = backendHostToCspSource(backend.host);
    if (origin) sources.add(origin);
  }
  sources.add(POSTHOG_API_HOST);
  sources.add(TELEMETRY_PROXY_HOST);
  sources.add("ws:");
  sources.add("wss:");
  return Array.from(sources).join(" ");
}

/**
 * Build the `frame-src` source list. Workspace artifacts are embedded as
 * `<iframe src>` against the conversation's static fileserver, which is the
 * active backend's origin. Restrict to backend origins only — we never
 * want third-party iframes.
 */
export function buildFrameSrc(backends: ReadonlyArray<Backend>): string {
  const sources = new Set<string>(["'self'"]);
  for (const backend of backends) {
    const origin = backendHostToCspSource(backend.host);
    if (origin) sources.add(origin);
  }
  return Array.from(sources).join(" ");
}

/**
 * Build the `img-src` source list. Covers the page origin (favicons, SVG
 * icons in the bundle), `data:` for inline image previews, `blob:` for
 * workspace file content previews, `https:` for arbitrary remote images
 * (avatars, repo icons in extensions UI), and every backend origin for
 * workspace-relative `<img src>` embeds.
 */
export function buildImgSrc(backends: ReadonlyArray<Backend>): string {
  const sources = new Set<string>(["'self'", "data:", "blob:", "https:"]);
  for (const backend of backends) {
    const origin = backendHostToCspSource(backend.host);
    if (origin) sources.add(origin);
  }
  return Array.from(sources).join(" ");
}

export interface BuildContentSecurityPolicyOptions {
  /** All registered backends (any of them may become active). */
  backends: ReadonlyArray<Backend>;
  /**
   * When `true`, omit `frame-ancestors` so this policy can be safely used as
   * a `<meta>` tag (frame-ancestors is ignored in meta tags anyway).
   * Defaults to `false` for HTTP-header use.
   */
  forMetaTag?: boolean;
}

/**
 * Build the full Content-Security-Policy string.
 *
 * The policy is structured for defense-in-depth:
 * - `default-src 'self'` so every fetch type is restricted by default
 * - `script-src` allows `'unsafe-inline'` (see file comment) plus `'self'`,
 *   `'wasm-unsafe-eval'` (xterm.js needs it), and the PostHog/telemetry
 *   origins. We deliberately do NOT allow eval() / Function().
 * - `style-src 'self' 'unsafe-inline'` — Tailwind/HeroUI inject styles,
 *   and Monaco injects editor styles
 * - `connect-src` covers all known backend origins plus telemetry + ws
 * - `frame-src` restricted to backend origins (workspace iframes)
 * - `frame-ancestors 'none'` so the UI cannot be embedded by other sites
 *   (the workspace artifacts can be embedded — that's the iframe *src*
 *   side; this is about who can embed *us*)
 * - `base-uri 'self'` blocks `<base>` tag injection that would redirect
 *   relative URLs to an attacker-controlled origin
 * - `form-action 'self'` blocks exfiltration via injected forms
 * - `object-src 'none'` blocks `<object>` / `<embed>` plugins (Flash, Java)
 * - `upgrade-insecure-requests` upgrades any stray http: requests to https:
 */
export function buildContentSecurityPolicy(
  options: BuildContentSecurityPolicyOptions,
): string {
  const { backends, forMetaTag = false } = options;
  const connectSrc = buildConnectSrc(backends);
  const frameSrc = buildFrameSrc(backends);
  const imgSrc = buildImgSrc(backends);

  const directives: string[] = [
    "default-src 'self'",
    // `'unsafe-inline'` is needed for React Router's inline replay scripts
    // and the static-server's __AGENT_CANVAS_* config injection. Drop once
    // those become nonce-driven.
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${POSTHOG_API_HOST}`,
    // Tailwind/HeroUI and Monaco require inline styles.
    "style-src 'self' 'unsafe-inline'",
    `font-src 'self' data:`,
    `img-src ${imgSrc}`,
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    // Only emit frame-ancestors when this is going out as an HTTP header;
    // the directive is ignored inside <meta> tags, but emitting it costs
    // nothing and keeps the two delivery paths in sync.
    ...(forMetaTag ? [] : ["frame-ancestors 'none'"]),
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

/**
 * Build a `Permissions-Policy` string that disables browser features the
 * app does not need. Each disabled feature reduces the attack surface for
 * XSS payloads and hostile iframe embeds. Keep this list narrow — disabling
 * features the app actually uses will silently break things.
 */
export function buildPermissionsPolicy(): string {
  return [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "serial=()",
    "bluetooth=()",
    "magnetometer=()",
    "gyroscope=()",
    "accelerometer=()",
    "ambient-light-sensor=()",
    "autoplay=()",
    "encrypted-media=()",
    "picture-in-picture=()",
    "publickey-credentials-get=(self)",
    "xr-spatial-tracking=()",
  ].join(", ");
}

/**
 * Convenience: build all security-relevant response headers at once, for
 * the static-server and any future HTTP-header injection points.
 */
export function buildSecurityHeaders(
  backends: ReadonlyArray<Backend>,
): Record<string, string> {
  return {
    "Content-Security-Policy": buildContentSecurityPolicy({ backends }),
    "Permissions-Policy": buildPermissionsPolicy(),
    // Defence-in-depth: refuse to be embedded by any site. The workspace
    // artifacts embed *us* via <iframe src>; this is the opposite direction.
    "X-Frame-Options": "DENY",
    // Tell browsers the body of this page should not be sniffed for content;
    // we always emit proper Content-Type.
    "X-Content-Type-Options": "nosniff",
    // Limit how much the Referer header leaks when the user clicks external
    // links (docs, GitHub repo, etc.). `strict-origin-when-cross-origin`
    // sends the full URL for same-origin requests and only the origin for
    // cross-origin ones — the standard modern default.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // HSTS only meaningful for HTTPS deployments; harmless on plain http
    // because the browser ignores it there. 1 year, include subdomains,
    // allow preload-list submission.
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  };
}
