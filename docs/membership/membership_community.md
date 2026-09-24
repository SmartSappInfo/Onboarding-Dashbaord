# Phase 5: Community Engine & Social Engagement Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the member portal into an industry-grade, Skool-competitive social learning community with tier-gated channels, rich discussion feeds, pinned announcements, threaded replies, interactive polls, multi-emoji reactions, a member gamification leaderboard, and seamless bidirectional lesson-discussion integration inside the LMS Course Player.

**Architecture:** 
1. **Tier-Gated Spaces & Entitlement Enforcement**: Community channels/spaces support public, members-only, and plan-gated visibility. Access is guarded by Phase 3's `PortalAccessGate`, seamlessly prompting members to upgrade to Pro/VIP tiers when attempting to view or participate in premium mastermind channels.
2. **Bidirectional Course Player <-> Community Integration**: Every lesson in the Phase 4 LMS connects to the community. Posts can declare `lessonId` and `courseId`. In `PortalCoursePlayerClient.tsx`, a 4th tab ("Community Discussion") displays lesson questions and allows in-context Q&A that synchronizes directly with the community feed.
3. **Skool-Style Social Feed & Gamification**: A clean, distraction-free feed featuring category filters, pinned announcements, interactive polls, threaded nested comments, author role badges, and an automated gamification leaderboard ranking top contributors by points and level badges.
4. **Resilient Backoffice Moderation & Governance**: Backoffice administrators manage channels, reorder spaces, configure tier gating, and resolve flagged content via an interactive moderation queue ("Dismiss Report", "Delete Content").

**Tech Stack:** Next.js 15, React 19, TypeScript (strictly 0 `any` / 0 `any[]` / 0 unhandled `unknown`), Tailwind CSS v4, Framer Motion, Firebase Cloud Firestore, Lucide React, Radix UI.

---

## 10 Mandatory Architectural & Production Standards

Every phase and line of code must strictly conform to these 10 principles:
1. **Skill Conformance & Standards Enforcement**:
   - `next-best-practices`: Explicit RSC boundaries in `/portal/[slug]/community/[spaceSlug]/[postSlug]`. Proper metadata generation with OpenGraph cards. Safe relative navigation for all redirect URLs.
   - `vercel-react-best-practices`:
     - `rerender-memo`: Memoize feed cards (`PostCard`, `CommentItem`, `LeaderboardWidget`) with `React.memo` to eliminate cascading re-renders during active scroll.
     - `rerender-functional-setstate`: Use functional updater forms (`setOptimisticReactions(prev => ...)`) for stable callbacks.
     - `rendering-content-visibility`: Apply `content-visibility: auto; contain-intrinsic-size: 1px 160px;` to feed cards to ensure 60fps scrolling on long feeds.
   - `emilkowal-animations`:
     - Standard tactile feedback (`active:scale-[0.97]` on all buttons, reaction chips, and tabs).
     - Smooth height/opacity transitions for inline composers and threaded replies (`duration <= 200ms`).
   - `backend-design`:
     - Multi-tenant data isolation (`organizationId`, `portalId`, `workspaceIds`).
     - Atomic transactions for poll voting to prevent double-voting.
     - Cascading batch deletions for spaces and posts (deleting child comments, polls, and votes).
   - `frontend-design`:
     - Unified Figtree typography across community feed, post details, and member cards.
     - Dynamic portal CSS variables (`var(--portal-primary)`, `var(--portal-surface)`, `var(--portal-text)`, `var(--portal-border)`).
     - Clean, modern Skool-like aesthetic with high readability and zero clutter.
2. **What Could Go Wrong & Systematic Resolutions**: All failure modes, edge cases, and quota bounds mapped in the Risk Matrix below.
3. **Cross-Subsystem Impact & Continuity**: LMS course player, onboarding engagement wizard, universal navigation, and member profiles fully integrated without breaking pre-existing behaviors.
4. **Strict Typing & Everyday UI English**: Strictly 0 `any`, 0 `any[]`, 0 unhandled `unknown`. Clean everyday UI English ("Start a discussion", "Ask a question", "Reply", "Report post", "Upgrade to access"). Zero raw HTML or CSS leakage.
5. **Firebase Indexes & Security Rules**: Composite indexes configured for channel-filtered queries, lesson-linked posts, and leaderboard point aggregates.
6. **Mobile-First & Touch Ergonomics**: `min-h-[44px]` touch targets on all buttons, reaction chips, tab triggers, and dropdown items.
7. **Security & Data Protection**: DOMPurify HTML sanitization, URL protocol validation (`http:`, `https:` only), deterministic doc IDs for reactions and poll votes.
8. **Performance Under Extreme Load**: Support 100+ comments per thread with Level 1/Level 2 nesting; optimistic local updates for instant reaction response.
9. **Gamification & Automation**: Automated point awards (+5 post, +2 comment, +1 reaction) and automatic step completion (`community_post`) via `EngagementService`.
10. **Inline Architectural Documentation**: Explanatory comments detailing change rationales, caution zones, and testability pointers.

---

## What Could Go Wrong & Production Mitigations (Risk Matrix)

| Risk / Failure Mode | Likelihood & Impact | Architectural Mitigation Strategy |
|:---|:---|:---|
| **1. Unauthorized Access to Tier-Gated Spaces** | **High / Critical** | Free or non-member visits a plan-gated space URL (e.g. `#/vip-mastermind`) and views confidential discussions without an active subscription. <br/>**Mitigation**: Server-side check in `SpacePage` and client gate in `PortalCommunityClient`: if `space.visibility === 'plan_gated'`, verify user's active membership against `space.allowedPlanIds`. If unauthorized, render `<PortalAccessGate itemType="channel" reason="plan_upgrade_required" />`. Guard writes in `createPostAction` & `createCommentAction`. |
| **2. Concurrency Race & Negative Reaction Counters** | **Medium / High** | Multiple users rapidly click like/heart simultaneously, or a user rapidly double-clicks, causing counters to desynchronize or go below zero. <br/>**Mitigation**: Deterministic doc ID `react_${targetId}_${userId}` prevents duplicate records. Counter decrements are bounded by `Math.max(0, count - 1)`. Client uses optimistic updates with error-revert. |
| **3. Duplicate Poll Voting / Manipulation** | **Medium / High** | User submits multiple votes on a poll to skew results. <br/>**Mitigation**: Deterministic vote ID `vote_${pollId}_${userId}` in `poll_votes`. `castPollVote` executes inside a strict Firestore transaction: validates `!voteSnap.exists` before incrementing `poll.options[i].voteCount` and `poll.totalVotes`. |
| **4. Orphaned Data on Space/Post Deletion** | **Medium / Medium** | Deleting a space leaves orphaned posts; deleting a post leaves orphaned comments, polls, and votes. <br/>**Mitigation**: `CommunityService.deleteSpace` and `deletePost` execute cascading Firestore batch deletes for all child records and decrement counter aggregates on parent documents. |
| **5. Course Player Tab Layout Bloat on Mobile** | **Medium / Medium** | Adding the "Discussion" tab to `PortalCoursePlayerClient.tsx` wraps tabs into an awkward stacked layout on small screens. <br/>**Mitigation**: Style `TabsList` as a responsive grid (`grid-cols-2 sm:grid-cols-4`) with `min-h-[44px]` touch targets, clean iconography, and compact badge counts. |
| **6. XSS Injection in Community Discussions** | **Medium / Critical** | Malicious user injects `<script>` or `javascript:` links into post bodies or comments. <br/>**Mitigation**: Sanitize all text before rendering using `@/lib/page-builder/sanitize`. Reject media URLs that do not begin with `http://` or `https://`. |
| **7. Spam Flooding & Toxic Content** | **Medium / High** | Bad actors flood the community feed with repetitive spam or abusive messages. <br/>**Mitigation**: User reporting action creates a `moderation_reports` record. Admin `PortalCommunityManager.tsx` provides 1-click "Dismiss Report" or "Delete Content" actions. |
| **8. Leaderboard Query Performance Degradation** | **Low / High** | Querying all members to sort by points on every community visit causes heavy Firestore read costs. <br/>**Mitigation**: Query `portal_memberships` with `orderBy('points', 'desc')` and `limit(10)`, caching with React `useMemoFirebase` and SWR patterns. |

---

## Impact Analysis Across Pre-Existing Features

| Feature Subsystem | Potential Impact | Required Integration & Enhancement |
|:---|:---|:---|
| **LMS Course Player** (`PortalCoursePlayerClient.tsx`) | Lessons currently have 3 tabs: Notes, Quiz, Downloads. No way for students to discuss lesson concepts. | Add 4th tab: "Community Discussion". Query posts where `lessonId === currentLesson.id`. Provide inline question ask composer, synchronized with community space. |
| **Portal Access & Membership** (`PortalAccessGate.tsx`) | Spaces can be marked `plan_gated`, but without the gate, content remains unprotected. | Integrate `<PortalAccessGate>` into `PortalCommunityClient` and `SpacePage`, enforcing `space.allowedPlanIds`. |
| **Onboarding & Engagement** (`EngagementService.ts`) | Onboarding step 4 is "Introduce Yourself in Community" (`community_post`). | Already pre-wired in `CommunityService.createPost`! Verify that posting advances onboarding progress and awards +5 gamification points. |
| **Admin Portal Hub** (`PortalCommunityManager.tsx`) | `CreateSpaceModal` previously lacked a plan picker for `allowedPlanIds`, and the moderation tab had no resolution actions. | Add membership plan checkboxes to `CreateSpaceModal`, and implement "Dismiss" and "Delete" actions in the Moderation Queue. |
| **Universal Navigation** (`PortalUniversalNav.tsx`) | Portal header and mobile drawer have "Community" link. | Ensure active route highlighting and smooth transition between portal spaces and global feed. |
| **Public Member Identity** (`MemberProfileModal.tsx`) | Clicking on an author's avatar in the feed currently does nothing. | Create `<MemberPublicProfileModal>` showing user's bio, school affiliation, role badge, points, and completed courses. |

---

## File Structure & Responsibilities

| File Path | Action | Architectural Responsibility |
|:---|:---|:---|
| `src/lib/types/community.ts` | Modify | Add `lessonId?: string`, `courseId?: string`, `blocks?: PageBlock[]`, and moderation resolution types. Zero `any`. |
| `src/lib/services/community-service.ts` | Modify | Add `listLessonPosts`, `resolveModerationReport`, space access validation, and cascade deletes. |
| `src/lib/services/__tests__/community-service.test.ts` | Modify | Unit tests verifying space CRUD, tier gating, lesson-linked posts, poll voting transactions, reaction toggles, and moderation resolution. |
| `src/app/actions/community-actions.ts` | Modify | Add `listLessonPostsAction` and `resolveModerationReportAction` with server-side error reporting. |
| `src/app/admin/portals/components/CreateSpaceModal.tsx` | Modify | Add membership plan selector for `allowedPlanIds` when visibility is `plan_gated`. |
| `src/app/admin/portals/components/PortalCommunityManager.tsx` | Modify | Show plan badges on spaces, add moderation queue resolution controls ("Dismiss Report", "Delete Content"). |
| `src/app/portal/[slug]/community/PortalCommunityClient.tsx` | Modify | Add tier-gate check with `<PortalAccessGate>`, category filter tabs, pinned announcement styling, and Skool-style Leaderboard sidebar widget. |
| `src/app/portal/[slug]/community/[spaceSlug]/[postSlug]/PortalPostDetailClient.tsx` | Modify | Enhanced threaded comments (Level 1/2), reaction counts, and author profile trigger. |
| `src/app/portal/[slug]/components/MemberPublicProfileModal.tsx` | Create | Reusable public profile modal displaying member bio, school, points, level badge, and completed courses. |
| `src/app/portal/[slug]/learn/[courseSlug]/[lessonSlug]/PortalCoursePlayerClient.tsx` | Modify | Add 4th tab: "Community Discussion ({count})", lesson Q&A feed, quick-ask composer, and gamification hooks. |

---

## Phase-by-Phase Implementation Plan

### Sub-Phase 5.1: Domain Schema & Service Layer Hardening

**Files:**
- Modify: `src/lib/types/community.ts`
- Modify: `src/lib/services/community-service.ts`
- Modify: `src/app/actions/community-actions.ts`
- Test: `src/lib/services/__tests__/community-service.test.ts`

- [ ] **Step 1: Write failing unit tests for lesson-linked posts, space tier gating, and moderation resolution**
  - Test `CommunityService.createPost` with `lessonId` and `courseId`.
  - Test `CommunityService.listLessonPosts(portalId, lessonId)`.
  - Test `CommunityService.resolveModerationReport(reportId, 'dismiss')` and `'delete_target'`.
  - Test `CommunityService.castPollVote` preventing duplicate votes.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/lib/services/__tests__/community-service.test.ts`
  - Expected: Fail with methods not defined.
- [ ] **Step 3: Update `src/lib/types/community.ts`**
  - Add `lessonId?: string` and `courseId?: string` to `CommunityPost`, `CreatePostInput`, and `UpdatePostInput`.
  - Add `allowedPlanIds?: string[]` to `CreateSpaceInput` and `UpdateSpaceInput`.
  - Add `ResolveModerationAction = 'dismiss' | 'delete_target'` and `ResolveModerationInput`.
  - Add `blocks?: PageBlock[]` for rich post content.
  - Strictly 0 `any` / 0 `any[]`.
- [ ] **Step 4: Enhance `src/lib/services/community-service.ts`**
  - Implement `listLessonPosts(portalId: string, lessonId: string)`.
  - Implement `resolveModerationReport(reportId: string, action: 'dismiss' | 'delete_target')`.
  - Ensure cascading deletion in `deleteSpace` and `deletePost`.
  - Ensure `createPost` persists `lessonId` and `courseId`.
- [ ] **Step 5: Add Server Actions in `src/app/actions/community-actions.ts`**
  - Export `listLessonPostsAction(portalId: string, lessonId: string)`.
  - Export `resolveModerationReportAction(reportId: string, action: 'dismiss' | 'delete_target', portalId: string)`.
- [ ] **Step 6: Run tests and verify they pass**
  - Run: `npx vitest run src/lib/services/__tests__/community-service.test.ts`
  - Expected: 100% tests passing.
- [ ] **Step 7: Commit changes locally**
  - `git commit -m "feat(community): extend domain contracts for lesson discussions, tier gating, and moderation resolution"`

---

### Sub-Phase 5.2: Admin Community Studio & Tier Gating Configuration

**Files:**
- Modify: `src/app/admin/portals/components/CreateSpaceModal.tsx`
- Modify: `src/app/admin/portals/components/PortalCommunityManager.tsx`

- [ ] **Step 1: Enhance `CreateSpaceModal.tsx` with Membership Plan Selector**
  - Query `membership_plans` for the current portal.
  - When `visibility === 'plan_gated'`, render an accessible multi-select/checkbox group allowing admins to select which membership tiers have access (`allowedPlanIds`).
  - Everyday plain English labels ("Select Plans with Access").
  - Mobile touch targets $\ge 44$px.
- [ ] **Step 2: Update `PortalCommunityManager.tsx`**
  - On space cards: show badge indicators for allowed plans when `visibility === 'plan_gated'` (e.g. "⭐ Pro Tier Only").
  - In Moderation Queue tab: add action buttons for flagged items:
    - "Dismiss Flag" (calls `resolveModerationReportAction(rep.id, 'dismiss')`).
    - "Delete Content" (calls `resolveModerationReportAction(rep.id, 'delete_target')`).
  - Actionable toast notifications conforming to Workspace Rules.
- [ ] **Step 3: Run static analysis & verify**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
- [ ] **Step 4: Commit changes locally**
  - `git commit -m "feat(community-studio): add plan tier selector to CreateSpaceModal and moderation resolution to PortalCommunityManager"`

---

### Sub-Phase 5.3: Portal Community Feed & Tier-Gated Channel Experience

**Files:**
- Modify: `src/app/portal/[slug]/community/PortalCommunityClient.tsx`
- Modify: `src/app/portal/[slug]/community/[spaceSlug]/page.tsx`

- [ ] **Step 1: Implement Tier-Gated Channel Protection with `<PortalAccessGate>`**
  - Check current member's subscription plan against `currentSpace.allowedPlanIds`.
  - If member lacks required plan, render `<PortalAccessGate>` with `itemType="channel"`, `reason="plan_upgrade_required"`, and redirect to `/portal/[slug]/join`.
- [ ] **Step 2: Add Category / Type Filter Tabs & Pinned Announcement Card**
  - Add filter pills: "All", "Discussions", "Questions", "Announcements", "Wins", "Polls".
  - Distinctive visual treatment for pinned posts (`border-primary/40 bg-primary/[0.03]`, pin icon, instructor badge).
- [ ] **Step 3: Create Skool-Style Community Leaderboard Widget**
  - Query `portal_memberships` with `orderBy('points', 'desc')` and `limit(10)`.
  - Render top 5-10 contributors with ranking badges (🥇, 🥈, 🥉), avatar, points tally, and level badge (Level 1: Novice, Level 2: Contributor, Level 3: Master).
  - Place in right sidebar on desktop, or collapsible accordion on mobile.
- [ ] **Step 4: Optimize Mobile Touch Ergonomics & 60fps Scrolling**
  - Ensure all reaction chips, channel links, and filter pills maintain `min-h-[44px]`.
  - Emil Kowalski tactile scale feedback (`active:scale-[0.97]`).
  - Add `content-visibility: auto; contain-intrinsic-size: 1px 160px;` to feed cards.
- [ ] **Step 5: Commit changes locally**
  - `git commit -m "feat(portal-community): add tier access gating, leaderboard widget, and pinned announcement feed"`

---

### Sub-Phase 5.4: Post Detail, Threaded Discussions & Public Member Profile Card

**Files:**
- Modify: `src/app/portal/[slug]/community/[spaceSlug]/[postSlug]/PortalPostDetailClient.tsx`
- Create: `src/app/portal/[slug]/components/MemberPublicProfileModal.tsx`

- [ ] **Step 1: Create `MemberPublicProfileModal.tsx`**
  - Responsive modal/drawer triggered when clicking any member's avatar or name.
  - Displays: Avatar, Display Name, School Name / Job Title, Bio, Role Badge, Total Gamification Points, Level Badge, and Enrolled/Completed Courses.
  - `min-h-[44px]` touch targets, zero `any`.
- [ ] **Step 2: Update `PortalPostDetailClient.tsx`**
  - Wire author avatars and names to open `<MemberPublicProfileModal>`.
  - Refine Level 1 and Level 2 threaded comment trees with clean indentation lines.
  - Multi-reaction bar with optimistic local count updates and error rollback.
  - Actionable report dialog with reason selection.
- [ ] **Step 3: Commit changes locally**
  - `git commit -m "feat(portal-community): implement MemberPublicProfileModal and refine threaded discussion client"`

---

### Sub-Phase 5.5: LMS Course Player Lesson Discussion Tab Integration

**Files:**
- Modify: `src/app/portal/[slug]/learn/[courseSlug]/[lessonSlug]/PortalCoursePlayerClient.tsx`

- [ ] **Step 1: Add 4th Tab: "Community Discussion" to Course Player**
  - Update `TabsList` in `PortalCoursePlayerClient.tsx`:
    - Tab 1: Notes & Takeaways
    - Tab 2: Knowledge Quiz
    - Tab 3: Toolkits
    - Tab 4: Community Discussion (`<TabsTrigger value="discussion">`)
  - Display discussion count badge on tab trigger.
- [ ] **Step 2: Render Lesson Q&A Feed & Inline Composer**
  - Query posts where `portalId == portal.id` and `lessonId == currentLesson.id`.
  - Render quick question composer: "Ask a question about this lesson...".
  - Save post with `lessonId: currentLesson.id`, `courseId: course.id`, and `spaceId` (course discussion or default space).
  - Award +5 gamification points and trigger onboarding step `community_post`.
  - Provide "View in Community Feed ->" deep link.
- [ ] **Step 3: Run static analysis & verify**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
- [ ] **Step 4: Commit changes locally**
  - `git commit -m "feat(course-player): integrate bidirectional lesson community discussion tab with gamification hooks"`

---

### Sub-Phase 5.6: Verification, Static Analysis & Cross-Phase Audit

**Files:**
- Full workspace verification across modified modules

- [ ] **Step 1: Run complete Vitest suite**
  - Run: `npx vitest run src/lib/services/__tests__/community-service.test.ts src/lib/services/__tests__/content-service.test.ts src/lib/page-builder/__tests__/content-templates.test.ts`
  - Ensure 100% tests pass.
- [ ] **Step 2: Run strict TypeScript static analysis**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
  - Verify 0 errors, strictly 0 `any` / 0 `any[]` / 0 unhandled `unknown`.
- [ ] **Step 3: Run ESLint across modified files**
  - Run: `npx eslint src/lib/services/community-service.ts src/app/portal/[slug]/community/ src/app/admin/portals/components/PortalCommunityManager.tsx`
  - Verify 0 errors, 0 warnings.
- [ ] **Step 4: Final review of git status**
  - Verify working tree is clean on `main`, zero pushes to `origin/main`.
