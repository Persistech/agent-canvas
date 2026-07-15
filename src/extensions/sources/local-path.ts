/**
 * Local-directory dev source recognition — the **browser-side, filesystem-blind** half
 * of the local-extension workflow.
 *
 * A developer running Agent Canvas locally can type a path to a directory on their own
 * machine (`~/code/my-ext`, `/abs/path`, or `file:///abs/path`) into the "Add extension"
 * box. This module recognizes such an input and produces the *raw* path string to hand
 * to the dev server's register endpoint. It deliberately does **no** filesystem work and
 * **never** expands `~`: only Node (which knows `$HOME`) may resolve the home directory
 * and confine the resolved path. See `src/extensions/dev/local-extension-registry.ts`
 * for the server half and `vite.config.ts` for the `/__ext-local/` middleware.
 *
 * Accepted input forms (mirrors the SDK `LOCAL` grammar in
 * `software-agent-sdk::parse_extension_source`, minus the dot-relative/bare-relative
 * cases which are ambiguous with npm/github refs in the UI):
 * - `~/rel/to/home`          — home-relative, expanded server-side
 * - `/abs/path`              — POSIX absolute
 * - `C:\abs\path` / `C:/…`   — Windows absolute
 * - `file:///abs/path`       — the `file://` + empty-host + absolute-path form only
 *
 * Rejected (with an actionable error):
 * - `file://~/…`             — tilde-as-host is structurally invalid URL grammar; no
 *                              browser/shell/the SDK accepts it. The user is told to drop
 *                              the `file://` prefix or use `file:///absolute/path`.
 */

/** Fixed dev-middleware route prefix serving registered local extension directories. */
export const LOCAL_EXTENSION_ROUTE_PREFIX = "/__ext-local/";

/** Dev-only endpoint that registers a raw local path and returns a stable id. */
export const LOCAL_EXTENSION_REGISTER_PATH = "/__ext-local/register";

/** Windows drive-absolute path, e.g. `C:\foo` or `C:/foo`. */
const WINDOWS_ABSOLUTE = /^[a-zA-Z]:[\\/]/;

/**
 * True when `input` is a `file://` URL whose host is a literal `~` (e.g. `file://~/x`).
 * This is invalid URL grammar — the segment after `file://` is the host, so `~` is parsed
 * as a hostname, not a home reference. We detect it explicitly to give a helpful error
 * instead of silently mis-registering it.
 */
export function isFileTildeHost(input: string): boolean {
  const trimmed = input.trim();
  // `file://~` but NOT `file:///…` (three slashes = empty host + absolute path).
  return /^file:\/\/~/i.test(trimmed);
}

/**
 * Recognize a local filesystem path input (before any normalization). Returns true for
 * `~/…`, POSIX/Windows absolute paths, and the `file:///…` form. Returns false for
 * `file://~/…` (structurally invalid — {@link toRegisterableLocalPath} rejects it with a
 * message) and for every remote source (`npm:`, `github:`, `https://`, …).
 */
export function isLocalPathInput(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (isFileTildeHost(trimmed)) return true; // recognized, but rejected downstream
  if (/^file:\/\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith("~/") || trimmed === "~") return true;
  if (trimmed.startsWith("/")) return true;
  if (WINDOWS_ABSOLUTE.test(trimmed)) return true;
  return false;
}

/**
 * Convert a recognized local-path input into the raw path string to send to the dev
 * register endpoint. `~` is preserved verbatim (expanded server-side); a `file:///…`
 * URL is decoded to its filesystem path. Throws on the invalid `file://~` form.
 *
 * @throws Error when the input is `file://~/…` (tilde-as-host).
 */
export function toRegisterableLocalPath(input: string): string {
  const trimmed = input.trim();
  if (isFileTildeHost(trimmed)) {
    throw new Error(
      `invalid local extension path "${trimmed}": "file://~" is not a valid URL ` +
        `(the segment after file:// is a host, so "~" cannot be a home reference). ` +
        `Use "~/path" without the file:// prefix, or "file:///absolute/path".`,
    );
  }
  if (/^file:\/\/\//i.test(trimmed)) {
    // Strip the `file://` scheme+empty-host, keeping the leading `/` of the abs path,
    // and percent-decode (e.g. spaces). The browser never touches disk here.
    const withoutScheme = trimmed.slice("file://".length);
    try {
      return decodeURIComponent(withoutScheme);
    } catch {
      return withoutScheme;
    }
  }
  // `~/…` and absolute paths pass through verbatim; the server expands and confines them.
  return trimmed;
}

/**
 * Build the dev base URL for a registered local extension id, rooted at the current
 * frontend origin so the dev middleware (same origin) serves it under a `'self'`
 * `frame-ancestors` CSP.
 */
export function localExtensionBaseUrl(origin: string, id: string): string {
  return `${origin.replace(/\/$/, "")}${LOCAL_EXTENSION_ROUTE_PREFIX}${id}`;
}
