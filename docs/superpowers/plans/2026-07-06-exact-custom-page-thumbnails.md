# Exact Hardcoded/Custom Page Rendering for Public Launchpad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static mockup templates of Core Custom Pages in the Public Launchpad with exact scaled renderings of their active database content blocks.

**Architecture:** Update `PortalCard` and `PortalPreview` to receive `pageId` and `pageSettings` props. Subscribe to dynamic page versions in `PortalPreview` and render using `<PageRenderer>` with standard mock layout fallbacks.

**Tech Stack:** Next.js, React, Firestore Client SDK, PageRenderer.

---

## Proposed Changes

### Task 1: Update PortalsClient & PortalCard Integrations

**Files:**
- Modify: `src/app/admin/portals/PortalsClient.tsx`
- Modify: `src/app/admin/portals/components/PortalCard.tsx`
- Modify: `src/app/admin/portals/components/PortalPreview.tsx`

- [ ] **Step 1: Pass pageId and settings from PortalsClient.tsx**
Update `PortalsClient.tsx` in the custom pages map:
```typescript
                      <PortalCard
                        key={p.slug}
                        kind="custom"
                        title={p.title}
                        path={p.path}
                        pageKey={p.path}
                        themeColor={p.themeColor}
                        onCopy={handleCopy}
                        onEditSeo={handleEditSeo}
                        workspaceIds={workspaceIds}
                        onAssignWorkspaces={handleAssignWorkspaces}
                        pageId={dbPage?.id}
                        pageSettings={dbPage?.settings}
                      />
```

- [ ] **Step 2: Add props to PortalCard.tsx and pass to PortalPreview**
Update `PortalCardProps` interface and destructured variables:
```typescript
export interface PortalCardProps {
  ...
  pageId?: string;
  pageSettings?: CampaignPage['settings'];
}

// In PortalCard render:
        <PortalPreview
          kind={kind}
          title={title}
          description={description}
          entityName={entityName}
          logoUrl={logoUrl}
          pageKey={pageKey}
          backgroundColor={backgroundColor}
          meetingTime={meetingTime}
          questionCount={questionCount}
          fieldCount={fieldCount}
          themeColor={themeColor}
          pageId={pageId}
          pageSettings={pageSettings}
        />
```

- [ ] **Step 3: Modify PortalPreview.tsx to support dynamic Firestore versions**
Update `PortalPreviewProps` interface and add imports:
```typescript
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { CampaignPageVersion } from '@/lib/types';
import { PageRenderer } from '@/components/page-builder/PageRenderer';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';

export interface PortalPreviewProps {
  ...
  pageId?: string;
  pageSettings?: CampaignPage['settings'];
}
```

Implement the hook and dynamic rendering check:
```typescript
  const firestore = useFirestore();
  const [version, setVersion] = React.useState<CampaignPageVersion | null>(null);

  React.useEffect(() => {
    if (!firestore || !props.pageId) return;
    const vQuery = query(
      collection(firestore, 'campaign_page_versions'),
      where('pageId', '==', props.pageId),
      orderBy('versionNumber', 'desc'),
      limit(1)
    );
    const unsubscribe = onSnapshot(vQuery, (snap) => {
      if (!snap.empty) {
        setVersion(snap.docs[0].data() as CampaignPageVersion);
      }
    }, console.error);
    return unsubscribe;
  }, [firestore, props.pageId]);

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
  }, [version]);
```

Update return block:
```typescript
  if (version) {
    const resolvedTheme = resolveTheme({
      overrides: props.pageSettings?.themeOverrides,
    });
    const pageObj = {
      id: props.pageId || '',
      organizationId: '',
      workspaceIds: [],
      settings: {
        showHeader: props.pageSettings?.showHeader ?? false,
        showFooter: props.pageSettings?.showFooter ?? false,
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

  // Fallback to static mockups
  let Layout: LayoutComponent;
  ...
```

---

## Verification Plan

### Automated Tests
- Run typecheck and production build to verify compilation success.
