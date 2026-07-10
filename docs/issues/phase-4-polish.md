# Phase 4: Polish

**Status:** Proposed  
**Component:** `src/extensions/`  
**Related:** GitHub API Resolver, Asset Relay System, Source Resolution Updates  
**Priority:** Low — Core functionality complete; these are UX and security enhancements

---

## Overview

With Phases 1-3 complete, the GitHub extension system is functional:
- ✅ `gh:owner/repo@feature/branch` resolves via GitHub API (slashed branches work)
- ✅ Assets load through the parent-window relay (CSP compliant)
- ✅ Webviews receive blob URLs with proper CSP meta tags
- ✅ Persisted extensions restore correctly

Phase 4 focuses on polish: security hardening, UX improvements, and documentation.

---

## 1. Permission Model for External URLs

### Problem

Currently, webviews can request the parent to fetch any URL via `relayFetch()`. The `WebviewBridge` checks against an `allowedOrigins` list, but:
- There's no UI for users to grant/review permissions
- Extensions don't declare required origins in their manifest
- The default is permissive (GitHub raw content always allowed)

### Proposed Solution

#### 1.1 Manifest Declaration

Extensions declare external origins they need in `extension.json`:

```json
{
  "id": "acme.weather",
  "name": "Weather Widget",
  "permissions": {
    "externalUrls": [
      "https://api.weather.com",
      "https://api.openweathermap.org"
    ]
  }
}
```

#### 1.2 Install-Time Consent

When installing, show the user what external access the extension requests:

```
┌─────────────────────────────────────────────────┐
│ Install "Weather Widget"?                       │
│                                                 │
│ This extension requests access to:              │
│ • api.weather.com                               │
│ • api.openweathermap.org                        │
│                                                 │
│ [Cancel]                    [Install & Allow]  │
└─────────────────────────────────────────────────┘
```

#### 1.3 Runtime Enforcement

The `WebviewBridge` already has `allowedOrigins` support. Wire it to:
1. Read from the installed extension's granted permissions
2. Reject requests to non-declared origins with a clear error
3. Log permission violations for debugging

#### 1.4 Permission Review

Add a section in extension settings to view/revoke granted permissions:

```
Weather Widget v1.0.0
├─ Capabilities: conversation:read, storage
└─ External Access: api.weather.com, api.openweathermap.org
   [Revoke External Access]
```

### Files to Modify

- `src/extensions/manifest.ts` — Add `permissions.externalUrls` to schema
- `src/extensions/installed-store.ts` — Store granted permissions
- `src/extensions/webview-bridge.ts` — Wire `allowedOrigins` from permissions
- `src/components/features/extensions/` — Consent UI during install

---

## 2. GitHub Token Support for Private Repos

### Problem

Private GitHub repositories require authentication. Currently:
- `resolveGitHubRef` accepts a `token` option but it's not wired to UI
- `AssetLoader` accepts `githubToken` but there's no way to set it
- No secure storage for the token

### Proposed Solution

#### 2.1 Settings UI

Add a GitHub token input in extension settings:

```
┌─────────────────────────────────────────────────┐
│ Extension Settings                              │
│                                                 │
│ GitHub Access Token (for private repos)         │
│ ┌─────────────────────────────────────────────┐ │
│ │ ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx    │ │
│ └─────────────────────────────────────────────┘ │
│ Token is stored locally and never sent to our  │
│ servers. Only used for GitHub API requests.    │
│                                                 │
│ [Clear Token]                                   │
└─────────────────────────────────────────────────┘
```

#### 2.2 Secure Storage

Options for token storage:
1. **localStorage** — Simple but visible in DevTools
2. **IndexedDB with encryption** — More secure, more complex
3. **System keychain via Electron** — Best security, requires Electron context

For web-only deployment, localStorage with clear warnings is pragmatic. Document the security tradeoff.

#### 2.3 Token Flow

```
User enters token in settings
       │
       ▼
┌──────────────────┐
│ Store in secure  │
│ storage          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ resolveGitHubRef │────▶│ GitHub API       │
│ (resolution)     │     │ (authenticated)  │
└──────────────────┘     └──────────────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ AssetLoader      │────▶│ raw.github.com   │
│ (asset fetching) │     │ (authenticated)  │
└──────────────────┘     └──────────────────┘
```

#### 2.4 Rate Limit Handling

With a token:
- Rate limit increases from 60/hour to 5000/hour
- Show remaining rate limit in UI when low
- Clear error message when limit exceeded

### Files to Modify

- `src/extensions/sources/resolve.ts` — Wire token from settings
- `src/extensions/asset-loader.ts` — Wire token from settings
- `src/components/features/extensions/` — Token settings UI
- New: `src/extensions/github-token-store.ts` — Secure token storage

---

## 3. Improve Error Messages

### Problem

Current errors are developer-focused, not user-friendly:

```
GitHubApiError: Could not resolve ref "main" for acme/private-repo. 
Checked as: branch, tag. Verify the ref exists, or if the repo is 
private, configure a GitHub token.
```

### Proposed Solution

#### 3.1 User-Friendly Error Display

```
┌─────────────────────────────────────────────────┐
│ ⚠️ Couldn't install extension                   │
│                                                 │
│ The repository "acme/private-repo" wasn't found │
│ or is private.                                  │
│                                                 │
│ If this is a private repository:                │
│ 1. Go to Extension Settings                     │
│ 2. Add your GitHub access token                 │
│ 3. Try installing again                         │
│                                                 │
│ [Extension Settings]              [Dismiss]     │
└─────────────────────────────────────────────────┘
```

#### 3.2 Error Categories

| Error Type | User Message | Action |
|------------|--------------|--------|
| Repo not found | "Repository not found" | Check URL |
| Private repo | "Repository is private" | Add token |
| Rate limited | "GitHub rate limit reached" | Wait or add token |
| Network error | "Couldn't connect to GitHub" | Check connection |
| Invalid manifest | "Extension package is invalid" | Contact author |
| Asset not found | "Extension file missing" | Contact author |

#### 3.3 Actionable Errors

Each error should have:
- Clear description of what went wrong
- Why it might have happened
- What the user can do about it
- A button/link to take that action

### Files to Modify

- `src/extensions/sources/github-api.ts` — Error classification
- `src/components/features/extensions/` — Error display UI
- New: `src/extensions/error-messages.ts` — User-friendly message mapping

---

## 4. Documentation Updates

### Problem

The extension system documentation is scattered and developer-focused.

### Proposed Solution

#### 4.1 User Documentation

Create end-user docs for:
- How to install extensions from GitHub
- How to configure GitHub token for private repos
- How to manage extension permissions
- Troubleshooting common errors

#### 4.2 Extension Author Documentation

Create author docs for:
- Extension manifest format (full reference)
- Declaring permissions and capabilities
- Using the asset relay in webviews
- Testing extensions locally
- Publishing to GitHub

#### 4.3 Architecture Documentation

Update `docs/issues/README.md` to be the canonical architecture doc:
- Move from "issues" framing to "architecture"
- Document the postMessage relay pattern
- Document security model
- Document extension lifecycle

### Files to Create/Modify

- New: `docs/extensions/user-guide.md`
- New: `docs/extensions/author-guide.md`
- Rename/refactor: `docs/issues/` → `docs/extensions/architecture/`

---

## Implementation Order

1. **Error Messages** — Quick win, improves UX immediately
2. **GitHub Token** — Unblocks private repo users
3. **Permission Model** — Security hardening
4. **Documentation** — Can happen in parallel

---

## Success Criteria

- [ ] Extensions can declare required external URLs in manifest
- [ ] Users see permission requests during install
- [ ] Users can configure GitHub token in settings
- [ ] Private repo extensions install successfully with token
- [ ] Error messages are user-friendly with clear actions
- [ ] User documentation exists for common workflows
- [ ] Author documentation exists for extension development

---

## Open Questions

1. **Token Scope**: Should we support fine-grained tokens (repo-specific) or just classic PATs?

2. **Permission Revocation**: If a user revokes external URL access, should the extension be disabled or just lose that capability?

3. **Offline Support**: Should we cache extension assets in IndexedDB for offline use? This could be part of Phase 4 or a future phase.

4. **Marketplace Integration**: Is there a plan for a curated extension marketplace? That would affect how we handle trust/permissions.
