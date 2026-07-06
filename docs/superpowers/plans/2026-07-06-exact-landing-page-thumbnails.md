# Exact Landing Page Rendering for Dashboard Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static placeholder templates in the campaign hub with exact, real-time scaled-down rendering of the landing page's custom sections and blocks.

**Architecture:** Update `GoalPreview` to fetch the latest `CampaignPageVersion` in real-time using Firestore `onSnapshot`. Set up a scaled layout container wrapping `PageRenderer` with `pointer-events: none` to let click actions pass through to the overlays.

**Tech Stack:** Next.js, React, Tailwind CSS, Firestore Client SDK, Framer Motion.

---

## Technical Considerations & Risk Mitigation

### 1. What Could Go Wrong & Solutions
* **Pointer Events Blocking Interaction**: The interactive landing page components (forms, links) inside `PageRenderer` could capture hover states and click events, blocking PageCard buttons.
  * *Mitigation*: Apply `pointer-events-none` (or `style={{ pointerEvents: 'none' }}`) to the scaled inner container.
* **Layout Shifts / Slow Loading**: Fetching the page structure on card render could cause a brief blank layout flash.
  * *Mitigation*: Keep the existing high-fidelity static placeholders as immediate loading skeleton fallbacks until the Firestore structure resolves.
* **Memory Leaks from Active Snapshots**: Having multiple page cards subscribing to `onSnapshot` might cause listener leaks if not cleaned up properly.
  * *Mitigation*: Unsubscribe from firestore listeners in the React `useEffect` cleanups.

### 2. Clean & Testable Code Practices
* **No `any` or `any[]` types**: Type all variables strictly. Use empty structures or dummy models for parameters rather than casting.

### 3. Firebase Rules & Indexes
* **Rule configuration**: Read access on `campaign_page_versions` is already allowed under workspace/org matching criteria.
* **Indexes**: Querying versions requires `pageId` equality and `versionNumber` ordering, which already has a compound index for history tracking.

---

### Task 1: Update GoalPreview Props & PageCard Integration

**Files:**
- Modify: `src/app/admin/pages/components/PageCard.tsx`
- Modify: `src/app/admin/pages/components/GoalPreview.tsx`

- [ ] **Step 1: Update PageCard to pass pageId and page settings to GoalPreview**
```typescript
// Inside src/app/admin/pages/components/PageCard.tsx around line 170
        <GoalPreview
          goal={page.pageGoal}
          themeColor={themeColor}
          pageName={page.name}
          pageId={page.id}
          pageSettings={page.settings}
        />
```

- [ ] **Step 2: Modify GoalPreview.tsx to query and render dynamic blocks**
Inject Firestore querying and `PageRenderer` into `GoalPreview.tsx`:
```typescript
// Add imports:
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { CampaignPageVersion } from '@/lib/types';
import { PageRenderer } from '@/components/page-builder/PageRenderer';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';

// Update interface:
interface GoalPreviewProps {
  goal: CampaignPage['pageGoal'];
  themeColor?: string;
  pageName?: string;
  pageId?: string;
  pageSettings?: CampaignPage['settings'];
}
```

Implement the hook inside `GoalPreview`:
```typescript
  const firestore = useFirestore();
  const [version, setVersion] = React.useState<CampaignPageVersion | null>(null);

  React.useEffect(() => {
    if (!firestore || !pageId) return;
    const vQuery = query(
      collection(firestore, 'campaign_page_versions'),
      where('pageId', '==', pageId),
      orderBy('versionNumber', 'desc'),
      limit(1)
    );
    const unsubscribe = onSnapshot(vQuery, (snap) => {
      if (!snap.empty) {
        setVersion(snap.docs[0].data() as CampaignPageVersion);
      }
    }, console.error);
    return unsubscribe;
  }, [firestore, pageId]);
```

Update the scale rendering logic inside `GoalPreview`:
```typescript
  React.useEffect(() => {
    const container = containerRef.current;
    const inner     = innerRef.current;
    if (!container || !inner) return;

    if (typeof ResizeObserver === 'undefined') return;

    const applyScale = (w: number, h: number) => {
      const scale = w / 900;
      inner.style.transform       = `scale(${scale})`;
      inner.style.transformOrigin = 'top left';
      inner.style.width           = '900px';
      inner.style.height          = `${h / scale}px`;
    };

    applyScale(container.offsetWidth, container.offsetHeight);

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      requestAnimationFrame(() => applyScale(width, height));
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [version]); // re-run scale mapping when version resolves
```

Return layout:
```typescript
  if (version) {
    const resolvedTheme = resolveTheme({
      overrides: pageSettings?.themeOverrides,
    });
    const pageObj = {
      id: pageId || '',
      organizationId: '',
      workspaceIds: [],
      settings: {
        showHeader: pageSettings?.showHeader ?? false,
        showFooter: pageSettings?.showFooter ?? false,
      }
    };
    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden pointer-events-none"
      >
        <div ref={innerRef} style={{ position: 'absolute', top: 0, left: 0 }}>
          <PageRenderer
            page={pageObj}
            version={version}
            theme={resolvedTheme}
            interpolate={(t) => t}
            fireTrigger={() => {}}
          />
        </div>
      </div>
    );
  }

  // Fallback layout when structure hasn't resolved yet
  const Layout = GOAL_LAYOUTS[goal] ?? LeadCaptureLayout;
```

---

## Verification Plan

### Automated Tests
- Run typecheck and production build to guarantee compilation success.
