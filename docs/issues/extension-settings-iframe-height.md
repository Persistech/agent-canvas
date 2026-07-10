# Extension Settings Webview Height Issue

**Status:** ✅ Resolved  
**Component:** `src/routes/extension-settings.tsx`, `src/components/features/extensions/extension-webview.tsx`  
**Severity:** Medium — UI is functional but visually broken  
**Discovered:** 2026-07-10 during Phase 3 integration testing  
**Resolved:** 2026-07-10

---

## Problem

Extension settings pages render in a tiny iframe (~150px tall) even though the content inside requires much more space (e.g., 886px). This causes:
- Content to be severely clipped
- Awkward nested scrolling within the small iframe
- Poor user experience when configuring extensions

## Visual Evidence

The iframe bounding box from Playwright accessibility snapshot:
```yaml
- iframe [ref=f5e301] [box=789,105,798,150]:  # Only 150px tall!
    - generic [ref=f6e1] [box=0,0,798,886]:   # Content needs 886px
```

The iframe is constrained to **150px height** while its content requires **886px**.

---

## Solution Implemented

We implemented **dynamic viewport-based height calculation**: the extension settings container calculates its available height based on its position in the viewport.

### Changes Made

1. **Extension Settings route** (`src/routes/extension-settings.tsx`):
   - Added `useAvailableHeight()` hook that calculates `window.innerHeight - element.getBoundingClientRect().top - padding`
   - Container height is set dynamically via `style={{ height }}`
   - Updates automatically on window resize, scroll, and parent layout changes via ResizeObserver
   - Minimum height of 400px ensures usability on small screens

2. **Settings Layout** (`src/components/features/settings/settings-layout.tsx`):
   - Added `fillHeight` prop for routes that need to extend to viewport bottom
   - When enabled, content wrapper uses `flex flex-1 flex-col` layout

3. **Settings Route** (`src/routes/settings.tsx`):
   - Detects extension settings paths (`/settings/x/*`) 
   - Applies `fillHeight` mode and simplified content wrapper for extension pages

4. **Webview SDK** (`src/extensions/sdk/webview-client.ts`) — *bonus feature*:
   - Added `reportContentHeight(height?)` — sends height to host via postMessage
   - Added `enableAutoResize()` — sets up ResizeObserver for automatic height updates
   - Useful for sidebar panels or other contexts where content-based sizing is preferred

5. **ExtensionWebview component** (`src/components/features/extensions/extension-webview.tsx`) — *bonus feature*:
   - Added `autoResize` prop for content-based height (alternative to viewport-based)
   - Listens for `agentCanvas:resize` messages from iframe content

### How It Works

The `useAvailableHeight()` hook:
```ts
function useAvailableHeight(minHeight = 400) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(minHeight);

  const updateHeight = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const availableHeight = window.innerHeight - rect.top - BOTTOM_PADDING;
    setHeight(Math.max(availableHeight, minHeight));
  }, [minHeight]);

  // Updates on resize, scroll, and parent layout changes
  useEffect(() => { /* event listeners + ResizeObserver */ }, [updateHeight]);

  return { ref, height };
}
```

The container uses this calculated height:
```tsx
const { ref, height } = useAvailableHeight();
return (
  <div ref={ref} style={{ height }} className="overflow-hidden ...">
    <ExtensionWebview ... />
  </div>
);
```

### Result

Extension settings pages now extend from their position to the bottom of the viewport, with 24px padding. The height adjusts automatically when the window is resized.

---

## Original Reproduction Steps (for reference)

### Manual Reproduction

1. Start agent-canvas with extensions enabled:
   ```bash
   cd /path/to/agent-canvas
   VITE_ENABLE_EXTENSIONS=true npm run dev
   ```

2. Navigate to http://localhost:8000/extensions

3. Install an extension with a settings page (e.g., Dad Jokes):
   - Click "Install from URL"
   - Enter: `gh:jpshackelford/oh-examples/agent-canvas-extensions/dad-jokes@feature/dad-jokes-extension`
   - Click "Review permissions" → "Grant & install"

4. Navigate to Settings → Dad Jokes (or `/settings/x/dadjokes.groan`)

5. ✅ **After fix:** The settings content now expands to fit naturally

---

## Technical Analysis

### Root Cause

The extension settings page (`src/routes/extension-settings.tsx`) used:
```tsx
<div className="h-full min-h-[480px] overflow-hidden rounded-md border ...">
  <ExtensionWebview ... />
</div>
```

The problem is that `h-full` (100%) doesn't work as expected in this flex layout:

1. `SettingsLayout` creates a flex container with `flex-1` children
2. The main content area has `overflow-y-auto` (scrollable)
3. The child `<div className="mx-auto w-full min-w-0 max-w-[800px]">` has no explicit height
4. `h-full` on the extension settings div resolves to the content height, not the available space
5. The iframe collapses to fit only its initial/minimum content

### Layout Chain (before fix)

```
SettingsLayout (flex h-full)
  └── main (flex-1, overflow-y-auto) ← scrollable, height = available space
       └── div (max-w-[800px]) ← NO explicit height
            └── ExtensionSettingsScreen
                 └── div (h-full min-h-[480px]) ← h-full = 0, falls back to min-h
                      └── iframe (h-full) ← inherits broken height
```

---

## Files Modified

- `src/routes/extension-settings.tsx` — Added `useAvailableHeight()` hook for dynamic viewport-based sizing
- `src/components/features/settings/settings-layout.tsx` — Added `fillHeight` prop
- `src/routes/settings.tsx` — Detects extension settings and applies `fillHeight` mode
- `src/components/features/extensions/extension-webview.tsx` — Added `autoResize` support (bonus)
- `src/extensions/sdk/webview-client.ts` — Added `reportContentHeight()` and `enableAutoResize()` helpers (bonus)
- `examples/extensions/hello-sidebar/settings.html` — Updated with auto-resize example code

---

## Related

- Extension webview rendering: `src/components/features/extensions/extension-webview.tsx`
- Similar layout in extension panel: `src/components/features/extensions/extension-panel.tsx`
- Settings scroll classes: `src/utils/settings-like-page-layout-classes.ts`
