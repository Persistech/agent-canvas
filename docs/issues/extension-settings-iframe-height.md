# Extension Settings Webview Height Issue

**Status:** Open  
**Component:** `src/routes/extension-settings.tsx`, `src/components/features/settings/settings-layout.tsx`  
**Severity:** Medium — UI is functional but visually broken  
**Discovered:** 2026-07-10 during Phase 3 integration testing

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

## Reproduction Steps

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

5. Observe: The settings content is cramped into a small area with internal scrolling

### Playwright Reproduction Script

```typescript
import { test, expect } from '@playwright/test';

test('extension settings iframe has proper height', async ({ page }) => {
  // Navigate to an extension's settings page
  // (assumes Dad Jokes extension is already installed)
  await page.goto('http://localhost:8000/settings/x/dadjokes.groan');
  
  // Wait for the iframe to load
  const iframe = page.locator('iframe[data-testid="extension-webview-dadjokes.groan"]');
  await iframe.waitFor({ state: 'visible' });
  
  // Get iframe dimensions
  const iframeBounds = await iframe.boundingBox();
  
  // The iframe should have reasonable height (at least 400px for a settings page)
  // Currently it's only ~150px
  expect(iframeBounds?.height).toBeGreaterThan(400);
  
  // Alternative: check that iframe height matches or exceeds content height
  const iframeHandle = await iframe.elementHandle();
  const contentHeight = await iframeHandle?.evaluate((el: HTMLIFrameElement) => {
    return el.contentDocument?.body?.scrollHeight ?? 0;
  });
  
  // Iframe should be tall enough to show content without excessive scrolling
  // Allow some tolerance for padding/margins
  if (contentHeight && iframeBounds?.height) {
    const heightRatio = iframeBounds.height / contentHeight;
    // Should show at least 50% of content without scrolling
    expect(heightRatio).toBeGreaterThan(0.5);
  }
});

test('extension settings page layout fills available space', async ({ page }) => {
  await page.goto('http://localhost:8000/settings/x/dadjokes.groan');
  
  // The settings container should fill the main content area
  const settingsContainer = page.locator('[data-testid="extension-settings"]');
  await settingsContainer.waitFor({ state: 'visible' });
  
  const containerBounds = await settingsContainer.boundingBox();
  const viewportSize = page.viewportSize();
  
  // Container should use significant vertical space (at least 60% of viewport)
  if (containerBounds && viewportSize) {
    const heightRatio = containerBounds.height / viewportSize.height;
    expect(heightRatio).toBeGreaterThan(0.6);
  }
});
```

---

## Technical Analysis

### Root Cause

The extension settings page (`src/routes/extension-settings.tsx`) uses:
```tsx
<div className="h-full min-h-[480px] overflow-hidden rounded-md border ...">
  <ExtensionWebview ... />
</div>
```

And the iframe in `ExtensionWebview` uses:
```tsx
<iframe className="h-full w-full border-0" ... />
```

The problem is that `h-full` (100%) doesn't work as expected in this flex layout:

1. `SettingsLayout` creates a flex container with `flex-1` children
2. The main content area has `overflow-y-auto` (scrollable)
3. The child `<div className="mx-auto w-full min-w-0 max-w-[800px]">` has no explicit height
4. `h-full` on the extension settings div resolves to the content height, not the available space
5. The iframe collapses to fit only its initial/minimum content

### Layout Chain

```
SettingsLayout (flex h-full)
  └── main (flex-1, overflow-y-auto) ← scrollable, height = available space
       └── div (max-w-[800px]) ← NO explicit height
            └── ExtensionSettingsScreen
                 └── div (h-full min-h-[480px]) ← h-full = 0, falls back to min-h
                      └── iframe (h-full) ← inherits broken height
```

---

## Suggested Fix

### Option A: Use flex-grow instead of h-full

```tsx
// extension-settings.tsx
<div
  data-testid="extension-settings"
  className="flex-1 min-h-[480px] overflow-hidden rounded-md border border-(--oh-border-input)"
>
  <ExtensionWebview ... />
</div>
```

And ensure the parent chain supports flex:
```tsx
// settings-layout.tsx - the max-w wrapper needs to be a flex column
<main className={settingsLayoutMainScrollClassName}>
  <div className="mx-auto w-full min-w-0 max-w-[800px] flex flex-col flex-1">
    {children}
  </div>
</main>
```

### Option B: Use viewport-relative height

```tsx
// extension-settings.tsx
<div
  data-testid="extension-settings"
  className="h-[calc(100vh-200px)] min-h-[480px] overflow-hidden rounded-md ..."
>
```

### Option C: Auto-resize iframe based on content

Use `ResizeObserver` on the iframe content to dynamically set the container height:
```tsx
const [contentHeight, setContentHeight] = useState(480);

useEffect(() => {
  const iframe = frameRef.current;
  if (!iframe) return;
  
  const observer = new ResizeObserver((entries) => {
    const height = entries[0]?.contentRect.height;
    if (height) setContentHeight(Math.max(height, 480));
  });
  
  // Observe iframe body after load
  iframe.addEventListener('load', () => {
    const body = iframe.contentDocument?.body;
    if (body) observer.observe(body);
  });
  
  return () => observer.disconnect();
}, []);

return <div style={{ height: contentHeight }}><iframe ... /></div>;
```

---

## Files to Modify

- `src/routes/extension-settings.tsx` — Fix container height
- `src/components/features/settings/settings-layout.tsx` — Possibly adjust flex chain
- `src/utils/settings-like-page-layout-classes.ts` — May need new class variant

---

## Related

- Extension webview rendering: `src/components/features/extensions/extension-webview.tsx`
- Similar layout in extension panel: `src/components/features/extensions/extension-panel.tsx`
- Settings scroll classes: `src/utils/settings-like-page-layout-classes.ts`
