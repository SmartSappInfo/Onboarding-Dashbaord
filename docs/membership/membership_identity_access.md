# Phase 3: Identity, Access & Membership Engine — Production Implementation Plan

> **Platform Dependency Chain:**
> **Phase 0 (Architecture & Platform Prep) [COMPLETED]** → **Phase 1 (Experience Portal Core) [COMPLETED]** → **Phase 2 (Content Engine & Block Studio) [COMPLETED]** → **Phase 3 (Identity, Access & Membership Engine) [CURRENT]** → **Phase 4 (Learning Engine / LMS) [NEXT]** → **Phase 5 (Community Engine)** → **Phase 6 (Onboarding & Engagement)**.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute this plan task-by-task. Steps use trackable checkbox (`- [ ]`) syntax.

---

## Executive Summary & Module Foresight

The SmartSapp Experience Platform has successfully completed:
1. **Phase 0 (Domain Architecture & Tenancy)**: Multi-tenant schemas, authorization contracts, event bus, and shared CRM infrastructure mapping.
2. **Phase 1 (Experience Portal Core)**: Branded portal runtime shell, Figtree typography standardization, dynamic CSS variable system (`var(--portal-primary)`), universal persistent header/footer navigation, theme toggle, and search modal.
3. **Phase 2 (Content Engine + Page Builder Integration)**: Universal `ContentItem` aggregate, the full-screen overlay `ContentEditorModal` with drag-and-drop sortable canvas (`@dnd-kit`), categorized block palette, deferred property inspector, AST plain-text search index synchronization, no-code starter templates, and the dual-mode `PortalContentReaderClient`.

### The Core Mandate of Phase 3
With our content engine and block studio fully operational, our portals currently operate as **open, un-gated public publications**. Anyone possessing a direct URL can consume any article, documentation tree, or downloadable resource regardless of intended membership requirements or monetization tiers.

**Phase 3 transforms open portals into secure, multi-tier membership environments.** It establishes:
1. **Centralized Entitlement Enforcement**: Enforcing `EntitlementService` and `AccessPolicy` at the reader, catalog, and API levels so private and tier-restricted content is automatically gated.
2. **High-Converting Paywall & Access Gate UI (`<PortalAccessGate>`)**: Replacing blank access denials with an elegant blurred content preview, tier perks breakdown, and frictionless 1-click registration/upgrade prompts.
3. **Branded Portal Authentication Suite (`/portal/[slug]/auth/*`)**: Dedicated, non-modal sign-in, registration, and password recovery pages matching the portal's custom theme, logo, and Figtree typography, supporting seamless redirect return loops.
4. **Tier & Plan Entitlement Governance (`MembershipPlanManager`)**: Visual multi-tier pricing builder (Free, Monthly, Annual, Lifetime) linking plans directly to unlocked content items, courses, and community spaces.
5. **Cryptographic Invitations & Bulk Onboarding (`PortalInvitationService`)**: Robust single-use and multi-use invite links, seat counters, expiration timestamps, and CSV bulk onboarding.
6. **Member Hub & Personal Dashboard (`/portal/[slug]/dashboard`)**: Student/member command center showing current tier status, active courses, bookmarked toolkits, points/streaks, and profile customization.

This phase creates the essential authorization and identity bedrock required by **Phase 4 (Learning Engine / LMS)** and **Phase 5 (Community Engine)**.

---

## 10 Mandatory Architectural & Production Standards

Every phase and line of code must strictly conform to these 10 principles:

1. **Next.js & Vercel React Best Practices (`next-best-practices`, `vercel-react-best-practices`)**:
   - **Eliminating Waterfalls (`async-parallel`)**: Parallelize independent queries (`Promise.all([fetchPortal, fetchMembership, fetchEntitlement])`).
   - **Dynamic Bundle Optimization (`bundle-dynamic-imports`)**: Use `next/dynamic` for heavy client modals (e.g. `MemberProfileModal`, `InviteMemberModal`, `AssessmentBuilderModal`).
   - **Server Component Gating & RSC Boundaries**: Route handlers and server actions authenticate requests; client shells handle optimistic UI and reactive transitions.
   - **Re-render Optimization (`rerender-memo`)**: Memoize tier cards, entitlement badges, and member row items with `React.memo`.
   - **High-Frequency Input Deferral (`rerender-use-deferred-value`)**: Use `useDeferredValue` for member catalog search and invitation email filters to guarantee 60fps responsiveness.
2. **Emil Kowalski Animation Guidelines (`emilkowal-animations`)**:
   - **Tactile Feedback**: Enforce `active:scale-[0.97]` on all buttons, cards, and tab triggers with transitions under 200ms (`timing-faster-better`).
   - **Spring Physics (`ease-spring-natural`)**: Smooth spring animation on paywall reveals and auth modal transitions.
   - **Accessibility & Reduced Motion**: Respect `prefers-reduced-motion` across all paywall blur transitions and drawer animations.
3. **Frontend Design & Aesthetics (`frontend-design`)**:
   - **Figtree Typography**: Bind all headings and labels to `var(--portal-heading-font)` and body text to `var(--portal-body-font)`.
   - **Semantic Color Tokens**: All components exclusively use portal CSS variables (`var(--portal-primary)`, `var(--portal-bg)`, `var(--portal-surface)`, `var(--portal-text)`, `var(--portal-border)`).
   - **High-Contrast Dark/Light Verification**: Ensure text contrast ratio >= 4.5:1 against background colors across both modes.
   - **Mobile Touch Ergonomics**: All interactive elements, buttons, and form inputs strictly enforce `min-h-[44px]` touch targets.
4. **Backend Architecture & Security (`backend-design`, `cc-skill-backend-patterns`)**:
   - **Fetch-Enrich-Restore Protocol**: Atomic transactions for invitation seat increments, plan tier assignments, and membership status changes.
   - **Multi-Tenant Isolation**: Every Firestore query strictly scoped by `organizationId`, `portalId`, and `workspaceIds`.
   - **Zero Leaks**: Never send full content blocks over the wire to unauthenticated/unentitled clients. The server returns a sanitized teaser projection when access is withheld.
5. **Strict Typing Standard**: Strictly ZERO `any`, `any[]`, or unhandled `unknown`. All props, Firebase snapshots, server action responses, and state hooks strictly typed. Use inferred module types.
6. **Actionable Toast Navigation Protocol**: Every toast prompting navigation or billing actions must pass `actionConfig` containing a relative path starting with `/` (e.g. `actionConfig: { path: '/portal/acme/dashboard', label: 'View Dashboard' }`). Direct external URLs or `javascript:` protocols strictly prohibited.
7. **Single Source of Truth for Tags**: Member tagging and segmenting must exclusively use the standardized `<TagSelector>` component in client/draft mode.
8. **Clean Everyday UI English**: Zero developer jargon in customer-facing UI. Use "Members", "Join Now", "Upgrade Plan", "Locked Lesson", "Sign In", "Invite People", "Free Trial".
9. **Resilient Offline / Draft State**: Auto-recover interrupted registration or onboarding steps via session storage.
10. **Inline Architectural Documentation**: Every modified file must include file header docstrings explaining change rationale, security boundaries, and testability pointers.

---

## Detailed UI Changes Required

### A. Experience Portal (Member-Facing UI Changes)

```
┌────────────────────────────────────────────────────────────────────────┐
│ EXPERIENCE PORTAL — CONTENT READER WITH ACCESS GATE                    │
├────────────────────────────────────────────────────────────────────────┤
│ ← Catalog   [Portal Logo] ACME Academy              (Search) (Theme)   │
├────────────────────────────────────────────────────────────────────────┤
│  Article  •  Product Strategy                                          │
│                                                                        │
│  The 2026 Executive Playbook for Scaling B2B Revenue                   │
│  By Sarah Jenkins  •  Published Sep 24, 2026                           │
│  ────────────────────────────────────────────────────────────────────  │
│                                                                        │
│  [Visible Teaser Content Paragraph / First Block]                      │
│  Scaling revenue requires aligning marketing automation with direct    │
│  consultative sales pipelines...                                       │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 🔒 MEMBER-EXCLUSIVE CONTENT                                      │  │
│  │                                                                  │  │
│  │ This in-depth strategy guide and downloadable financial model is │  │
│  │ exclusively available to active Academy Members.                 │  │
│  │                                                                  │  │
│  │  ✓ Access 40+ strategic frameworks and downloadable templates    │  │
│  │  ✓ Weekly live coaching and peer roundtable discussions         │  │
│  │  ✓ Direct messaging with certified advisors                     │  │
│  │                                                                  │  │
│  │   [ Sign In to Access ]      [ Join Academy — Free / Pro ]       │  │
│  │                                                                  │  │
│  │ Already invited? Enter your invitation code                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ░░░░░░░░░░░░░░░ Blurred Content Background Below ░░░░░░░░░░░░░░░░░░  │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Dynamic Content Access Gate (`PortalAccessGate.tsx`)**:
   - Replaces the raw content canvas when `hasAccess === false`.
   - Displays a polished teaser, lock badge (`🔒`), custom upgrade perks list, and dual CTAs: **Sign In** (opening `PortalAuthModal` or navigating to `/auth/signin`) and **Join / Upgrade** (linking to plan selection).
   - High-fidelity frosted glass backdrop (`backdrop-blur-md bg-card/80 border border-border/80 rounded-3xl p-8 sm:p-12`).
2. **Content Catalog Access Badges (`PortalContentCatalogClient.tsx`)**:
   - Each card in the catalog grid displays an access badge:
     - `🔓 Public` (emerald badge)
     - `🔒 Member Only` (sky badge with lock icon)
     - `⭐ [Plan Name] Exclusive` (amber badge with star icon)
   - Filter bar adds an "Access" toggle: **All | Free Access | Member Only | Tier Exclusive**.
3. **Branded Portal Authentication Suite (`/portal/[slug]/auth/*`)**:
   - `/portal/[slug]/auth/signin`: Branded sign-in page with email/password and magic link.
   - `/portal/[slug]/auth/register`: Self-registration with automatic membership provisioning.
   - `/portal/[slug]/auth/forgot-password`: Branded password recovery.
   - Preserves destination via `?redirect=/portal/[slug]/content/[type]/[itemSlug]` query parameter.
4. **Member Hub & Personal Dashboard (`/portal/[slug]/dashboard`)**:
   - **Membership Card Widget**: Displays member avatar, display name, role badge, plan name, status indicator (Active, Expired, Suspended), joined date, and points/streak pill.
   - **Action Bar**: "Upgrade Tier", "Edit Profile", "Log Out".
   - **Enrolled Courses Grid**: Visual cards with progress bar (`X% Completed`), current lesson button ("Resume Lesson").
   - **Saved Toolkits & Bookmarks**: Fast access to bookmarked resources.
5. **Invitation Onboarding Flow (`/portal/[slug]/join`)**:
   - Validates cryptographic token in URL (`?token=xyz`).
   - If user is already authenticated: 1-Click "Claim Access & Proceed" prompt without re-entering password.
   - If new visitor: Pre-populates invited email, collects name and password, assigns role/plan, and routes to `/dashboard`.

---

### B. Experience Studio (Backoffice Administrator UI Changes)

```
┌────────────────────────────────────────────────────────────────────────┐
│ EXPERIENCE STUDIO — CONTENT ACCESS & VISIBILITY GOVERNANCE             │
├────────────────────────────────────────────────────────────────────────┤
│ Content Editor Modal > Details & SEO Tab                               │
│                                                                        │
│ Visibility & Entitlement Rules                                         │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Who can read this item?                                            │ │
│ │                                                                    │ │
│ │  ( ) Public — Open to all internet visitors                        │ │
│ │  (•) Members Only — Requires active portal membership              │ │
│ │  ( ) Tier Protected — Requires specific paid or premium plan        │ │
│ │  ( ) Role Restricted — Only instructors, moderators, or admins     │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ Select Required Plans:                                                 │
│ [ ✓ Growth Plan ]   [ ✓ VIP Executive Tier ]   [ + Add Plan ]         │
│                                                                        │
│ Teaser Preview Length:                                                 │
│ [ First Block (Recommended) ▼ ]                                       │
│                                                                        │
│ Paywall Customization (No-Code):                                       │
│ Title:       [ Unlock Member Strategy Guide                        ]   │
│ Description: [ Get access to frameworks and worksheets            ]   │
│ Perks (CSV): [ 40+ Frameworks, Weekly Coaching, Direct Messaging   ]   │
│                                                                        │
│ Member Tags (Standardized TagSelector):                                │
│ [ Strategy ✕ ]  [ Executive ✕ ]  [ + Select Tags ]                     │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Content Editor Modal Access Control Panel (`ContentEditorModal.tsx`)**:
   - Located in the "Details & SEO" tab of `ContentEditorModal`.
   - Radio selector: **Public** | **Members Only** | **Tier Protected** | **Role Restricted**.
   - Plan Multi-Select: Dynamically loads the portal's active `MembershipPlan` tiers.
   - Teaser Boundary Selector: "Summary Only" | "First Block" | "First 2 Blocks" | "None (Full Lock)".
   - **No-Code Paywall Copywriting**: Custom paywall headline, subheadline, and benefit bullet points configured per-item without touching code.
2. **Backoffice Member Manager Upgrades (`PortalMemberManager.tsx`)**:
   - **Plan Selector Dropdown**: 1-click tier switching for any member in the table.
   - **Bulk Invite Modal (`InviteMemberModal.tsx`)**: Upgraded with CSV drag-and-drop, email preview chips, role selector, and course assignment.
   - **Tag Integration**: Seamlessly integrates `<TagSelector>` for tagging members with workspace contact tags.
3. **Membership Plan Tier Builder (`MembershipPlanManager.tsx`)**:
   - Tier Card Editor: Name, price, interval (one-time, monthly, annual), trial days, features checklist.
   - Unlocked Resources Selector: Select specific articles, courses, or spaces unlocked by this tier.

---

## What Could Go Wrong & Production Mitigations (Risk Matrix)

| Risk / Failure Mode | Likelihood & Impact | Architectural Mitigation Strategy |
|:---|:---|:---|
| **1. Client-Side Paywall Bypass (DOM Inspection / Disabled JS)** | **High / Critical** | If content blocks are sent in the initial HTML or JSON payload and only hidden via CSS, technically savvy visitors can inspect DOM or view source to steal premium content. <br/>**Mitigation**: Implement server-side payload truncation (`ContentService.sanitizeForVisitor`). If the visitor lacks entitlement, the server action/resolver truncates `blocks` to only the configured teaser blocks (e.g. block 0) before serializing to the client. Unentitled visitors never receive full blocks in memory. |
| **2. Stale Entitlement Caching on Plan Upgrade** | **High / High** | Member upgrades their plan or is granted access by an admin, but client caches report `hasAccess: false` due to stale Firestore snapshots. <br/>**Mitigation**: Use Firebase real-time listeners for active member sessions, and provide an explicit `revalidateEntitlements()` trigger on payment or plan change. |
| **3. Open Redirect Vulnerability via Auth Return URLs** | **Medium / Critical** | An attacker crafts a link like `/portal/acme/auth/signin?redirect=https://evil.com` to phish members. <br/>**Mitigation**: Enforce the Workspace Actionable Error & Toast Navigation rule: validate `redirect` query parameter strictly. It MUST start with a single `/` and MUST NOT start with `//`, `http:`, `https:`, or `javascript:`. If invalid, default to `/portal/${slug}/dashboard`. |
| **4. Race Condition in Multi-Use Invitation Seat Counts** | **Medium / High** | A 100-seat multi-use invite link opened simultaneously by multiple users could exceed `maxUses`. <br/>**Mitigation**: Increment `usedCount` strictly inside a Firestore transaction (`runTransaction`) in `PortalInvitationService.acceptInvitation`, checking `if (invite.usedCount >= invite.maxUses) throw new Error('Invitation limit reached');`. |
| **5. Flash of Gated Content / Flash of Paywall (Hydration Mismatch)** | **Medium / Medium** | Server renders locked state because user is unauthenticated on server, then client hydrates with logged-in user, causing visual flicker and layout shift. <br/>**Mitigation**: Render a deterministic skeleton while auth state (`isUserLoading`) resolves, preventing layout shift or flickering. |
| **6. Suspended or Deleted Member Access Retention** | **Low / Critical** | Member is suspended by admin in Studio, but their active browser tab continues to fetch and view protected content. <br/>**Mitigation**: `EntitlementService.evaluateEntitlement` strictly checks `membership.status === 'active'`. Real-time membership listener in portal shell immediately redirects suspended users to a suspension notice. |
| **7. Duplicate Memberships for Same User in One Portal** | **Medium / Medium** | User clicks join twice or registers concurrently, creating duplicate membership records. <br/>**Mitigation**: `PortalMembershipService.createMembership` performs a query guard and uses deterministic document IDs or Firestore transactions. |
| **8. Unhandled Currency / Plan Interval Rendering Errors** | **Low / Medium** | Plans created with different currencies or custom billing intervals break formatting on member checkout or tier cards. <br/>**Mitigation**: Centralized currency formatter utility (`formatCurrency(amount, currency)`) with fallback to USD/GHS and strict typing for `PlanBillingInterval`. |
| **9. Mobile Keyboard Obscuring Auth Buttons** | **Medium / Low** | On mobile devices, the virtual keyboard pushes the "Sign In" or "Register" submit button off-screen. <br/>**Mitigation**: Apply `frontend-design` mobile guidelines: `min-h-[44px]` touch targets, responsive scrollable container (`overflow-y-auto max-h-[90vh]`), and proper form scroll behavior. |
| **10. Broken Backwards Compatibility for Public Portals** | **Low / Critical** | Portals configured as "Public" or "Blog" accidentally enforce login on previously public articles. <br/>**Mitigation**: `PortalAccessService` and `EntitlementService` evaluate `portal.visibility` and `item.visibility`. If `item.visibility === 'public'` or unset, access is automatically granted (`reason: 'public_access'`). |

---

## Firebase Security Rules, Indexes & Protocols

### 1. Firebase Security Rules (`firestore.rules`)
Audited against the `firebase-security-rules-auditor` Red-Team criteria (Update Bypass, Authority Source, Storage Abuse, and Type Safety):

```javascript
// --- Experience Platform — Memberships & Directory ---
match /portal_memberships/{membershipId} {
  // Members can read their own membership; operators can read portal memberships
  allow get: if isSignedIn() && (
    resource.data.userId == request.auth.uid || isAuthorized()
  );
  allow list: if isSignedIn() && (
    request.query.limit <= 100 && (
      resource.data.userId == request.auth.uid || isAuthorized()
    )
  );
  // Writes strictly guarded by Server Actions running under Admin SDK or authorized staff
  allow create, update, delete: if isAuthorized();
}

// --- Experience Platform — Cryptographic Invitations ---
match /portal_invitations/{invitationId} {
  // Unauthenticated visitors can query pending invites by token to claim access
  allow get: if isAuthorized() || resource.data.status == 'pending';
  allow list: if isAuthorized();
  allow create, update, delete: if isAuthorized();
}

// --- Experience Platform — Membership Plans & Tiers ---
match /membership_plans/{planId} {
  // Plans are publicly readable so visitors can view pricing and unlock tiers
  allow get, list: if true;
  allow create, update, delete: if isAuthorized();
}

// --- Experience Platform — Access Grants ---
match /access_grants/{grantId} {
  allow get: if isSignedIn() && (
    resource.data.userId == request.auth.uid || isAuthorized()
  );
  allow list: if isSignedIn() && (
    resource.data.userId == request.auth.uid || isAuthorized()
  );
  allow create, update, delete: if isAuthorized();
}
```

### 2. Composite Indexes (`firestore.indexes.json`)
Verified to exist and support high-scale querying:
- `portal_memberships`: `portalId (ASC) + joinedAt (DESC)`
- `portal_memberships`: `portalId (ASC) + role (ASC) + status (ASC) + joinedAt (DESC)`
- `portal_memberships`: `portalId (ASC) + userId (ASC)`
- `portal_memberships`: `portalId (ASC) + planId (ASC) + status (ASC)`
- `portal_invitations`: `portalId (ASC) + token (ASC) + status (ASC)`
- `portal_invitations`: `portalId (ASC) + createdAt (DESC)`
- `membership_plans`: `portalId (ASC) + order (ASC)`
- `membership_plans`: `portalId (ASC) + status (ASC) + price (ASC)`
- `access_grants`: `portalId (ASC) + userId (ASC) + resourceType (ASC) + resourceId (ASC)`

### 3. Fetch-Enrich-Restore Protocol
To eliminate data drift between CRM contacts and portal memberships:
1. **Fetch**: On login or invitation claim, fetch user profile and check for matching CRM contact by email.
2. **Enrich**: Attach `portalId`, `planId`, and `contactId` to the `PortalMembership` document, and emit `member.joined` domain event.
3. **Restore / Persist**: Atomically commit changes to Firestore; trigger non-blocking CRM contact tag update (`portal_member`, plan name tag).

### 4. Seeding Protocol
Run automated seeding to populate Academy plans and test memberships:
```bash
npx tsx src/app/seeds/seed-portal-memberships.ts smartsapp-hq
```

---

## Cross-Subsystem Impact Analysis

| Subsystem | Potential Impact | Required Integration & Enhancement |
|:---|:---|:---|
| **Portal Content Reader** (`PortalContentReaderClient.tsx`) | Content reader must not display full body to unauthorized visitors. | Integrate `<PortalAccessGate>`: evaluate `EntitlementService`, show teaser + paywall when unentitled. |
| **Portal Content Catalog** (`PortalContentCatalogClient.tsx`) | Visitors cannot tell which content requires membership before clicking. | Add lock badges (`🔒 Member Only`, `⭐ Pro`) and access filter chips. |
| **Content Studio Modal** (`ContentEditorModal.tsx`) | Authors must configure access rules when authoring items. | Add "Visibility & Entitlements" panel in "Details & SEO" tab with plan selector, teaser mode, and `<TagSelector>`. |
| **Invitation Route** (`PortalJoinClient.tsx`) | Must handle single-use and multi-use tokens, auto-assign roles and plan tiers. | Connect `acceptInvitationAction` to atomic transaction and redirect to `/dashboard`. |
| **Member Dashboard** (`PortalMemberDashboardClient.tsx`) | Hub must reflect member tier, enrolled courses, bookmarks, and points. | Add `MembershipStatusCard`, bookmarks tab, and profile modal. |
| **Learning Engine Player** (`PortalCoursePlayerClient.tsx`) | Lesson player will enforce enrollment and plan entitlements. | Pre-wire entitlement checks so lessons verify enrollment before playing. |
| **CRM Contact Reconciliation** | Portal members should link to CRM contacts for messaging and automations. | `PortalMembershipService` creates/links contact in CRM with `portal_member` tag. |

---

## File Structure & Responsibilities

| File Path | Action | Architectural Responsibility |
|:---|:---|:---|
| `src/lib/types/membership.ts` | Refine | Strict typing for plan intervals, access evaluation reasons, and teaser options. Zero `any`. |
| `src/lib/types/content.ts` | Refine | Add `teaserMode?: 'summary' \| 'first_block' \| 'two_blocks' \| 'none'`, `customPaywall?: { title?: string; description?: string; perks?: string[] }`. |
| `src/lib/services/entitlement-service.ts` | Refine | Server-side teaser truncation (`sanitizeContentItemForVisitor`), plan perk checks, and role evaluation. |
| `src/lib/services/__tests__/entitlement-service.test.ts` | Create/Refine | Comprehensive unit tests for public access, member-only access, tier gating, and admin bypass. |
| `src/app/actions/membership-actions.ts` | Refine | Server actions for entitlement evaluation, plan subscription, and invitation acceptance. |
| `src/components/portal/PortalAccessGate.tsx` | Create | High-contrast, frosted glass paywall card with teaser, perk bullet points, and sign-in/upgrade CTAs. |
| `src/app/portal/[slug]/content/[type]/[itemSlug]/PortalContentReaderClient.tsx` | Modify | Enforce entitlement evaluation; render `<PortalAccessGate>` with teaser when access is denied. |
| `src/app/portal/[slug]/content/PortalContentCatalogClient.tsx` | Modify | Render lock indicators, access filter tabs, and tier requirement tooltips on content cards. |
| `src/app/portal/[slug]/auth/layout.tsx` | Create | Dedicated branded auth layout wrapping portal auth pages with theme variables and logo. |
| `src/app/portal/[slug]/auth/signin/page.tsx` | Create | Branded full-page sign-in with safe redirect validation and magic link fallback. |
| `src/app/portal/[slug]/auth/register/page.tsx` | Create | Branded full-page registration with automated membership provisioning. |
| `src/app/portal/[slug]/auth/forgot-password/page.tsx` | Create | Branded password recovery page with clear success toasts. |
| `src/app/portal/[slug]/dashboard/PortalMemberDashboardClient.tsx` | Modify | Upgraded member command center with tier status widget, bookmarks, and profile management. |
| `src/app/admin/portals/components/ContentEditorModal.tsx` | Modify | Add "Visibility & Entitlements" panel in "Details & SEO" tab with plan selector, teaser mode, and `<TagSelector>`. |
| `src/app/admin/portals/components/PortalMemberManager.tsx` | Modify | Add quick tier-switching dropdown, member tag editing via `<TagSelector>`, and export to CSV. |

---

## Trackable Sub-Phase Implementation Plan

### Sub-Phase 3.1: Entitlement Engine Refinements & Content Truncation Guard
- [ ] **Step 1: Write unit tests in `src/lib/services/__tests__/entitlement-service.test.ts`**
  - Test public content bypass (`item.visibility === 'public'`).
  - Test member-only access rejection for unauthenticated visitors.
  - Test member-only access approval for active members.
  - Test tier-restricted access evaluation (`matchedPlan` vs `requiredPlanId`).
  - Test server-side teaser block truncation (`sanitizeContentItemForVisitor`).
- [ ] **Step 2: Run test suite to verify failure (`npx vitest run entitlement-service.test.ts`)**
- [ ] **Step 3: Implement `sanitizeContentItemForVisitor` in `src/lib/services/entitlement-service.ts`**
  - Truncates `blocks` array based on `item.teaserMode` when `hasAccess === false`.
- [ ] **Step 4: Update `src/app/actions/membership-actions.ts` with `evaluateContentAccessAction`**
- [ ] **Step 5: Run tests and verify 100% pass rate**
- [ ] **Step 6: Commit changes locally** (`feat(membership): enhance entitlement engine with server-side teaser truncation`)

---

### Sub-Phase 3.2: High-Converting Paywall & Access Gate Component
- [ ] **Step 1: Create `src/components/portal/PortalAccessGate.tsx`**
  - Figtree typography, semantic portal CSS variables (`var(--portal-primary)`, `var(--portal-surface)`).
  - High-contrast blurred backdrop (`backdrop-blur-md`).
  - Lock icon, title, customized benefit bullet points.
  - Dual CTAs: "Sign In to Read" and "Join Academy / View Plans" with `active:scale-[0.97]` tactile press.
  - Accessible `min-h-[44px]` touch targets.
- [ ] **Step 2: Integrate `<PortalAccessGate>` into `PortalContentReaderClient.tsx`**
  - Check `EntitlementService` evaluation for the current visitor.
  - If `hasAccess === false`, render the truncated teaser blocks followed by `<PortalAccessGate>`.
  - If `hasAccess === true`, render the full block tree with `BlockRenderer`.
- [ ] **Step 3: Update `PortalContentCatalogClient.tsx` with Access Badges & Filter Tabs**
  - Display `🔒 Member Only` or `⭐ [Plan Name]` on locked cards.
  - Add access category filter tabs ("All Content", "Public Access", "Members Only", "Tier Exclusive").
- [ ] **Step 4: Commit changes locally** (`feat(portal-reader): integrate PortalAccessGate and catalog lock indicators`)

---

### Sub-Phase 3.3: Branded Dedicated Authentication Suite (`/portal/[slug]/auth/*`)
- [ ] **Step 1: Create `src/app/portal/[slug]/auth/layout.tsx`**
  - Provides scoped `<PortalThemeProvider>` and centering container with branded logo and background.
- [ ] **Step 2: Create `src/app/portal/[slug]/auth/signin/page.tsx`**
  - Email/password and magic link sign-in.
  - Safe relative redirect validation (`validateRelativeRedirectPath`).
- [ ] **Step 3: Create `src/app/portal/[slug]/auth/register/page.tsx`**
  - Name, email, password registration with automatic `PortalMembership` creation.
- [ ] **Step 4: Create `src/app/portal/[slug]/auth/forgot-password/page.tsx`**
  - Email password reset trigger with actionable toast feedback.
- [ ] **Step 5: Commit changes locally** (`feat(portal-auth): implement branded full-page auth suite with redirect security`)

---

### Sub-Phase 3.4: Member Command Center & Personal Dashboard Upgrades
- [ ] **Step 1: Upgrade `PortalMemberDashboardClient.tsx`**
  - Add **Membership Status Card**: Plan tier badge, active/expired status, member since, points/streak pill, "Manage / Upgrade" button.
  - Add **Saved Bookmarks & Downloads** tab: Displays saved toolkits and bookmarked articles.
  - Add **Profile Customization Modal**: Allows updating member display name, avatar, and bio.
- [ ] **Step 2: Upgrade Invitation Join Client (`PortalJoinClient.tsx`)**
  - 1-Click claim for logged-in users with existing session.
  - Atomic multi-use seat increment inside Firestore transaction.
- [ ] **Step 3: Commit changes locally** (`feat(portal-dashboard): upgrade member hub with tier cards and bookmark vault`)

---

### Sub-Phase 3.5: Backoffice Studio Governance & TagSelector Integration
- [ ] **Step 1: Update `ContentEditorModal.tsx`**
  - Add "Visibility & Entitlements" section in the "Details & SEO" tab.
  - Radio options: Public | Members Only | Tier Protected | Role Restricted.
  - Plan multi-select dropdown for tier-restricted content.
  - Teaser boundary selector & paywall copywriting inputs.
  - Standardized `<TagSelector>` for member tagging.
- [ ] **Step 2: Update `PortalMemberManager.tsx`**
  - Add quick plan-switch dropdown on member table rows.
  - Connect `<TagSelector>` for member segmentation.
- [ ] **Step 3: Commit changes locally** (`feat(content-studio): add visibility governance and plan entitlement selectors`)

---

### Sub-Phase 3.6: Strict Verification, Static Analysis & Production Audit
- [ ] **Step 1: Run comprehensive Vitest unit test suite**
  - `npx vitest run src/lib/services/__tests__/entitlement-service.test.ts`
- [ ] **Step 2: Run strict TypeScript static analysis**
  - `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit` (Confirm 0 errors).
- [ ] **Step 3: Run ESLint**
  - `pnpm lint` (Confirm 0 lint errors, 0 warnings).
- [ ] **Step 4: Final verification and commit**
  - Commit all verified changes locally with clear descriptive messages.
  - Zero push to remote branch (`origin/main`).

---

## Future Horizon: Phase 4 (Learning Engine / LMS) Preparation

Once Phase 3 is completed, the foundation is primed for **Phase 4: Learning Engine**:
1. **Full-Screen Curriculum Studio Modal (`CurriculumEditorModal.tsx`)**: Upgrading `CurriculumBuilderDrawer` into a full-screen drag-and-drop hierarchy builder for modules and lessons.
2. **Deep Block Studio Integration for Lessons**: Enabling instructors to author rich lessons using our newly completed Block Studio (video canvas, checklists, interactive accordions, callouts, downloadable toolkits).
3. **Drip Release Engine (`ReleaseRule`)**: Enforcing chronological and milestone locks in `PortalCoursePlayerClient` ("Available 7 days after enrollment" or "Complete Module 1 first").
4. **Interactive LMS Player Enhancements**: Scored quiz evaluations, assignment submissions, instructor grading queues, and automated certificate generation.
