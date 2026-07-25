# Dynamic Header CTA Links & Click Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal**: Build a unified and secure dynamic link configuration system for the Page Builder's Header CTA button, allowing internal and external routing, section scroll anchors, and overlay modal actions (forms, surveys, agreements) with click tracking, while reusing existing navigation components.

**Architecture**: 
- Extend `PageHeaderSettings` schemas and TypeScript interfaces with standardized link attributes matching `HeaderNavItem`.
- Update the admin settings configurations form to dynamically render the same link target editors for the CTA button as standard navigation links.
- Implement click tracking that triggers server actions (`recordInteractionAction`) to log clicks to the database for analytics reporting.
- Standardize link clicks in `PageRenderer` so that the desktop header, mobile menu, and card overlays share a single click handling component.

**Tech Stack**: Next.js App Router (RSC/Client), Tailwind CSS, Firestore, TypeScript.

---

## Technical Risk Review & Mitigations

### 1. Hotspotting on Firestore Document Writes
- **Problem**: In high-traffic scenarios (e.g., thousands of visitors click CTA links simultaneously), calling `recordInteractionAction` on the single `campaign_pages/{id}` document will trigger write throttling (Firestore limits writes to 1/second per document).
- **Mitigation**: Use local storage debouncing or keep the write fire-and-forget without blocking the user request. In production, document stats writes can be buffered through a queue/pubsub or handled asynchronously. Swallowing errors ensures the client never freezes. Add inline architectural comments outlining distributed counter strategies for future scaling.

### 2. XSS Vulnerability via Custom URL Redirects
- **Problem**: An administrator (or a compromised account) could insert `javascript:` URIs or malicious links as the CTA URL, causing script execution in the viewer's browser.
- **Mitigation**: Sanitize redirect links prior to execution. Block `javascript:` protocols. Ensure external links open securely with `rel="noopener noreferrer"`.

### 3. Hydration Mismatches in Render Actions
- **Problem**: Different client/server rendering of buttons or modal states during initial page load.
- **Mitigation**: Reuse the hydration gate (`mounted` state check) inside `PageRenderer` and lazy-load modal modules.

### 4. Code Quality & Strict Typing (No `any`)
- **Problem**: Using `any` causes compilation opacity.
- **Mitigation**: Enforce strict types. Declare `HeaderNavItem` structures or reusable helper types for all action handlers.

---

## Affected & Interdependent Features

1. **Builder Preview Canvas (`Canvas.tsx`)**:
   - *Impact*: Needs to display the CTA button correctly based on settings, but disable actual modal or redirect actions when in edit mode so the builder keeps editing capability.
   - *Plan*: Re-render CTA preview styles in canvas, but wrap button trigger in a check for `isEditMode`.

2. **Analytics Dashboard (`AnalyticsClient.tsx`)**:
   - *Impact*: Displays click counts.
   - *Plan*: The link tracking clicks increment `stats.clicks` in Firestore, meaning the analytics dashboard will automatically reflect clicks without changing the queries.

3. **Campaign Templates Seeding (`seed-platform-page-templates-action.ts`)**:
   - *Impact*: Templates might have missing fields.
   - *Plan*: Provide a fallback migration utility during structure parsing (`migrateLegacyStructure`) in the viewer to populate `ctaLinkType` to `'url'` dynamically if it is absent.

---

## Database Rules & Migration Protocol

### 1. Security Rules (`firestore.rules`)
No security rule modifications are required for this feature, as public visitors read campaign pages and record views/clicks via Next.js Server Actions running under the admin/system context, bypassing Firestore client-side write limits and maintaining lock-tight security.

### 2. Migration Protocol
We will implement an inline structural migration helper `migrateLegacyStructure` in `PageRenderer.tsx` and `Canvas.tsx` to automatically normalize legacy header configurations (populating missing `ctaLinkType`, etc.) on the fly. This ensures 100% backward compatibility without needing offline database migration scripts.

---

## Phase-by-Phase Implementation Plan

### Phase 1: Dynamic Types & Schema Validation

#### [MODIFY] [types.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/types.ts)
- [ ] **Step 1: Update PageHeaderSettings interface**
  Add the dynamic CTA button target properties to `PageHeaderSettings` around line 3696:
  ```typescript
  export interface PageHeaderSettings {
    preset: 'native' | 'minimal' | 'full-nav' | 'cta-only' | 'search-nav' | 'card-nav';
    overlap: boolean;
    sticky: boolean;
    floating: boolean;
    showSearch: boolean;
    showCta: boolean;
    ctaText?: string;
    ctaUrl?: string;
    ctaLinkType?: 'url' | 'scroll' | 'action';
    ctaTargetSectionId?: string;
    ctaAction?: 'receipt_request' | 'open_modal_form' | 'open_modal_survey' | 'open_modal_agreement';
    ctaSurveyResultMode?: 'modal' | 'parent';
    showPhone: boolean;
    phoneNumber?: string;
    navItems: HeaderNavItem[];
  }
  ```

#### [MODIFY] [schema.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/page-builder/schema.ts)
- [ ] **Step 2: Update headerSettingsSchema validator**
  Extend `headerSettingsSchema` starting around line 39 to validate the new CTA fields and support the `'card-nav'` preset:
  ```typescript
  export const headerSettingsSchema = z.object({
    preset: z.enum(['native', 'minimal', 'full-nav', 'cta-only', 'search-nav', 'card-nav']).default('native'),
    overlap: z.boolean().default(false),
    sticky: z.boolean().default(false),
    floating: z.boolean().default(false),
    showSearch: z.boolean().default(false),
    showCta: z.boolean().default(false),
    ctaText: z.string().optional(),
    ctaUrl: z.string().optional(),
    ctaLinkType: z.enum(['url', 'scroll', 'action']).default('url'),
    ctaTargetSectionId: z.string().optional(),
    ctaAction: z.enum(['receipt_request', 'open_modal_form', 'open_modal_survey', 'open_modal_agreement']).optional(),
    ctaSurveyResultMode: z.enum(['modal', 'parent']).default('modal'),
    showPhone: z.boolean().default(false),
    phoneNumber: z.string().optional(),
    navItems: z.array(navItemSchema).default([]),
  });
  ```

- [ ] **Step 3: Verify TypeScript Compilation**
  Run: `pnpm typecheck`
  Expected: Success.

- [ ] **Step 4: Commit Phase 1**
  Run:
  ```bash
  git add src/lib/types.ts src/lib/page-builder/schema.ts
  git commit -m "feat(header): extend types and zod validation schemas for dynamic CTA targets"
  ```

---

### Phase 2: Side Panel Configuration UI

#### [MODIFY] [HeaderFooterSettings.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/pages/%5Bid%5D/builder/components/HeaderFooterSettings.tsx)
- [ ] **Step 5: Replace simple CTA inputs with dynamic targets form**
  Refactor the CTA editing block around lines 94-119 in `HeaderSettingsControl`. Add inline comments guiding future edits on target settings, and configure interactive inputs (touch target heights `min-h-[44px]` for accessibility):
  ```tsx
  {/* CTA Button Settings Config Block */}
  {header.showCta && (
    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[8px] font-bold text-slate-500 uppercase">Button Label</Label>
          <input
            type="text"
            value={header.ctaText || ''}
            onChange={(e) => onUpdateHeader({ ctaText: e.target.value })}
            placeholder="Request Quote"
            className="w-full h-8 px-2 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200 outline-none focus:border-emerald-500/50"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[8px] font-bold text-slate-500 uppercase">Target Type</Label>
          <select
            value={header.ctaLinkType || 'url'}
            onChange={(e) => onUpdateHeader({ 
              ctaLinkType: e.target.value as PageHeaderSettings['ctaLinkType'],
              ctaUrl: '',
              ctaTargetSectionId: '',
              ctaAction: undefined
            })}
            className="w-full h-8 px-1 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200 outline-none focus:border-emerald-500/50"
          >
            <option value="url">URL Redirect</option>
            <option value="scroll">Scroll to Section</option>
            <option value="action">Trigger Page Action</option>
          </select>
        </div>
      </div>

      {(header.ctaLinkType === 'url' || !header.ctaLinkType) && (
        <div className="space-y-1">
          <Label className="text-[8px] font-bold text-slate-500 uppercase">Redirect URL Link</Label>
          <input
            type="text"
            value={header.ctaUrl || ''}
            onChange={(e) => onUpdateHeader({ ctaUrl: e.target.value })}
            placeholder="https://example.com"
            className="w-full h-8 px-2 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200 outline-none focus:border-emerald-500/50"
          />
        </div>
      )}

      {header.ctaLinkType === 'scroll' && (
        <div className="space-y-1">
          <Label className="text-[8px] font-bold text-slate-500 uppercase">Target Section</Label>
          <select
            value={header.ctaTargetSectionId || ''}
            onChange={(e) => onUpdateHeader({ ctaTargetSectionId: e.target.value })}
            className="w-full h-8 px-1 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200 outline-none focus:border-emerald-500/50"
          >
            <option value="">Select a Section...</option>
            {(structure.sections || []).map((sec, sIdx) => {
              const heading = (sec.props as { heading?: string })?.heading || `Section ${sIdx + 1}`;
              return <option key={sec.id} value={sec.id}>{heading}</option>;
            })}
          </select>
        </div>
      )}

      {header.ctaLinkType === 'action' && (
        <div className="space-y-1">
          <Label className="text-[8px] font-bold text-slate-500 uppercase">Overlay Action</Label>
          <select
            value={header.ctaAction || ''}
            onChange={(e) => onUpdateHeader({ ctaAction: e.target.value as PageHeaderSettings['ctaAction'] })}
            className="w-full h-8 px-1 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200 outline-none focus:border-emerald-500/50"
          >
            <option value="">Select Action...</option>
            <option value="receipt_request">Open Receipt Request Modal</option>
            <option value="open_modal_form">Open Form Modal</option>
            <option value="open_modal_survey">Open Survey Modal</option>
            <option value="open_modal_agreement">Open Agreement Modal</option>
          </select>
        </div>
      )}

      {header.ctaLinkType === 'action' && header.ctaAction === 'open_modal_survey' && (
        <div className="space-y-1 animate-in fade-in duration-200">
          <Label className="text-[8px] font-bold text-slate-500 uppercase">Survey Result Display</Label>
          <select
            value={header.ctaSurveyResultMode || 'modal'}
            onChange={(e) => onUpdateHeader({ ctaSurveyResultMode: e.target.value as PageHeaderSettings['ctaSurveyResultMode'] })}
            className="w-full h-8 px-1 text-[10px] bg-slate-950 border border-slate-700 rounded-md text-slate-200 outline-none focus:border-emerald-500/50"
          >
            <option value="modal">Show inside Modal</option>
            <option value="parent">Redirect parent page</option>
          </select>
        </div>
      )}
    </div>
  )}
  ```

- [ ] **Step 6: Verify Linter & Types**
  Run:
  ```bash
  pnpm lint
  pnpm typecheck
  ```
  Expected: Success with 0 errors.

- [ ] **Step 7: Commit Phase 2**
  Run:
  ```bash
  git commit -a -m "feat(editor): render target links configuration selectors for header CTA button"
  ```

---

### Phase 3: Renderer Integrations & Click Tracking

#### [MODIFY] [PageRenderer.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/components/page-builder/PageRenderer.tsx)
- [ ] **Step 8: Define tracking callbacks and update CTA rendering**
  - Import `recordInteractionAction` from `@/lib/analytics-actions`.
  - Add helper function `trackLinkClick` inside `PageRenderer` component:
    ```typescript
    const trackLinkClick = useCallback((linkId: string) => {
      // Swallowed: analytics updates must never impact user execution flows
      recordInteractionAction(page.id, linkId).catch(() => {});
    }, [page.id]);
    ```
  - Implement reusable `handleCtaClick` action dispatcher:
    ```typescript
    const handleCtaClick = useCallback(() => {
      // CAUTION: Distributed writes to campaign_pages stat counters may trigger write throttle.
      // In large scale loads, optimize via queue sync aggregates.
      trackLinkClick('header-cta');
      
      const linkType = headerSettings.ctaLinkType || 'url';
      if (linkType === 'url' && headerSettings.ctaUrl) {
        // Security check: Sanitize custom URLs to prevent javascript execution
        const targetUrl = headerSettings.ctaUrl.trim();
        if (targetUrl.toLowerCase().startsWith('javascript:')) {
          console.warn('[Security] blocked javascript URI in header redirect');
          return;
        }
        window.open(targetUrl, targetUrl.startsWith('http') ? '_blank' : '_self');
      } else if (linkType === 'scroll' && headerSettings.ctaTargetSectionId) {
        const element = document.getElementById(headerSettings.ctaTargetSectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else if (linkType === 'action' && headerSettings.ctaAction) {
        if (headerSettings.ctaAction === 'receipt_request') {
          fireTrigger('block_click', 'cta-1');
        } else {
          let type = 'form';
          let targetId = '';
          if (headerSettings.ctaAction === 'open_modal_form') {
            type = 'form';
            targetId = resources.forms?.[0]?.id || '';
          } else if (headerSettings.ctaAction === 'open_modal_survey') {
            type = 'survey';
            targetId = resources.surveys?.[0]?.id || '';
          } else if (headerSettings.ctaAction === 'open_modal_agreement') {
            type = 'agreement';
            targetId = resources.agreements?.[0]?.id || '';
          }
          fireTrigger('open_modal_resource', JSON.stringify({ type, targetId, resultMode: headerSettings.ctaSurveyResultMode }));
        }
      }
    }, [headerSettings, fireTrigger, resources, trackLinkClick]);
    ```
  - Refactor `handleNavItemClick` to execute link tracking on selection:
    ```typescript
    const handleNavItemClick = useCallback((item: HeaderNavItem) => {
      trackLinkClick(item.id);
      if (item.linkType === 'url' && item.url) {
        const targetUrl = item.url.trim();
        if (targetUrl.toLowerCase().startsWith('javascript:')) return;
        window.open(targetUrl, targetUrl.startsWith('http') ? '_blank' : '_self');
      } else if (item.linkType === 'scroll' && item.targetSectionId) {
        const element = document.getElementById(item.targetSectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else if (item.linkType === 'action' && item.action) {
        if (item.action === 'receipt_request') {
          fireTrigger('block_click', 'cta-1');
        } else {
          let type = 'form';
          let targetId = '';
          if (item.action === 'open_modal_form') {
            type = 'form';
            targetId = resources.forms?.[0]?.id || '';
          } else if (item.action === 'open_modal_survey') {
            type = 'survey';
            targetId = resources.surveys?.[0]?.id || '';
          } else if (item.action === 'open_modal_agreement') {
            type = 'agreement';
            targetId = resources.agreements?.[0]?.id || '';
          }
          fireTrigger('open_modal_resource', JSON.stringify({ type, targetId, resultMode: item.surveyResultMode }));
        }
      }
    }, [fireTrigger, resources, trackLinkClick]);
    ```
  - Bind all rendering occurrences of header CTA buttons inside `PageRenderer.tsx` (preset `'cta-only'`, standard layouts, and `CardNavMenu`) to call `handleCtaClick`.
  - Bind `CardNavMenu` navigation clicks to trigger `handleNavItemClick(item)`.

- [ ] **Step 9: Run TypeScript & Eslint checks**
  Verify clean integration:
  ```bash
  pnpm lint
  pnpm typecheck
  ```
  Expected: 0 errors.

- [ ] **Step 10: Commit Phase 3**
  Run:
  ```bash
  git commit -a -m "feat(renderer): bind link click tracking and support dynamic CTA button redirection targets"
  ```
