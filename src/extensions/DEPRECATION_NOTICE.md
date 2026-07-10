# ⚠️ DEPRECATION NOTICE

**The `src/extensions/README.md` file contains outdated and inaccurate information.**

## Use the New Documentation Instead

For current, accurate documentation, see **[docs/extensions/](../../docs/extensions/README.md)**:

- **[Architecture Reference](../../docs/extensions/ARCHITECTURE.md)** — Accurate technical implementation details
- **[User Guide](../../docs/extensions/USER_GUIDE.md)** — For installing and using extensions  
- **[Author Guide](../../docs/extensions/AUTHOR_GUIDE.md)** — For creating extensions
- **[Security Model](../../docs/extensions/SECURITY.md)** — Security architecture

## Known Inaccuracies in src/extensions/README.md

1. **Lines 252-257:** Incorrectly states that `gh:` sources use jsDelivr for version resolution
   - **Reality:** `gh:` sources use GitHub REST API for resolution, then load assets via parent-window asset relay
   
2. **Line 54 (File map):** Omits the entire asset relay system:
   - Missing: `asset-loader.ts`, `webview-bridge.ts`, `sources/relay-bundle-source.ts`, `sources/github-api.ts`, `sdk/asset-relay.ts`
   
3. **No mention of asset relay architecture:** The README never explains how GitHub extensions load assets through the parent window postMessage relay

## What Changed

- **July 1, 2026:** GitHub API resolver replaced jsDelivr for `gh:` sources (commit `ce31e5d`)
- **July 9, 2026:** Asset relay system implemented for webview loading (commit `2f24e908`)  
- **README was not updated** to reflect these changes

The old README describes the initial design, not the current implementation.

---

**For contributors:** Please refer to **[docs/extensions/ARCHITECTURE.md](../../docs/extensions/ARCHITECTURE.md)** for accurate technical details.
