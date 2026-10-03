# SmartSapp Meetings 2.0: Tier 1 & Tier 2 Implementation Plan (Rules-Conformed)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate critical functional mock gaps, external calendar orphan leaks, and navigation mismatches in Tier 1, then execute major architectural simplification (deduplicating 3,500 lines across session builders, continuous calendar grid duration positioning, dual workspace query reconciliation, and an executive analytics studio) in Tier 2.

**Architecture:** 
1. **Tier 1 (Hardening & Resilience):** Fix mock in `SessionWizardModal`, accurately update `endTime` in `rescheduleBookingAction`, invoke external Google/Outlook event deletion with defensive non-blocking isolation in `cancelBookingAction`, disambiguate booking vs meeting search routing in `GlobalMeetingSearchModal`, and purge dead legacy booking routes with server-side redirects.
2. **Tier 2 (Simplification & Evolution):** Extract an SSOT `<MeetingSessionForm>` component system to eliminate ~2,200 lines of duplicated code between `new/page.tsx` and `edit/page.tsx`, wire `calculateEventGridPosition` into `CalendarClient` for continuous multi-hour duration rendering with overflow safety, reconcile scalar `workspaceId` and array `workspaceIds` in `useWorkspaceSchedule`, and convert `OverviewClient` into a specialized Executive Analytics & Heatmap Studio.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (Strict, 0 `any`), Tailwind CSS, Radix UI / shadcn, Framer Motion, Firebase Firestore / Firebase Admin, Vitest.

---

## Compliance Matrix: `agents_mcp_rules.md`

| Rule | Requirement | How This Plan Conforms |
|---|---|---|
| **Rule 1** | Next.js, React, Vercel & Emil Kowalski best practices | RSC/Client boundaries respected; tactile micro-interactions (`active:scale-[0.97]`); zero flickering layout shifts. |
| **Rule 2** | Failure modes, edge cases & scalability analysis | Explicit "Failure Modes & Edge Case Mitigations" documented for every task (timeouts, token expiry, midnight boundary clipping). |
| **Rule 3** | Blast radius & backoffice observability | Verifies zero disruption to public booking ingress (`/book/[slug]`); failure events recorded in activity logs viewable via backoffice radar. |
| **Rule 4** | Zero `any`, `any[]`, or unchecked casts | Strictly typed interfaces for all forms, actions, and event sources; `unknown` narrowed with Zod schemas at boundaries. |
| **Rule 5** | Verification before completion | Every task requires `pnpm typecheck` and `pnpm vitest run src/lib/meetings/` with clean exit codes before commits. |
| **Rule 6** | Dependencies & context | Leverages native date-fns, existing crypto/integration services, zero unnecessary dependencies. |
| **Rule 7** | Mobile-first ($\ge 44\text{px}$ touch targets) & clean UI English | All buttons and interactive slots have `min-h-[44px]`; UI copy uses concise, human-friendly English without jargon. |
| **Rule 8** | Security, multi-tenant isolation & anti-open-redirect | `workspaceId` ownership enforced in actions; `isValidMeetingUrl` sanitization; toast paths strictly relative (`/`). |
| **Rule 9** | Concurrency & resource exhaustion protection | Non-blocking external calendar deletions; memoized Firebase queries; duration clamping preventing DOM layout blowouts. |
| **Rule 10** | Inline architectural documentation & maintainer guides | Mandatory file headers with architectural notes, caution zones, and testability pointers on all touched files. |

---

## File Structure & Module Map

```
src/
├── app/
│   ├── actions/
│   │   ├── booking-actions.ts                   # Fix H-2 (endTime update) & H-3 (cancel calendar event deletion)
│   │   ├── meeting-calendar-actions.ts          # Fix H-4 (sourceType & sourceId disambiguation)
│   │   └── meeting-analytics-actions.ts         # M-3 (expanded executive metrics & heatmaps)
│   ├── admin/
│   │   └── meetings/
│   │       ├── components/
│   │       │   ├── SessionWizardModal.tsx       # Fix H-1 (wire real Firestore creation & room generation)
│   │       │   ├── GlobalMeetingSearchModal.tsx # Fix H-4 (route bookings vs group sessions correctly)
│   │       │   └── session-form/                # M-1 (SSOT Session Builder Component System)
│   │       │       ├── session-form-schema.ts   # Unified Zod validation schema
│   │       │       ├── MeetingSessionForm.tsx   # Master form wrapper & sticky preview
│   │       │       └── steps/                   # Modular wizard step components
│   │       ├── new/
│   │       │   └── page.tsx                     # M-1 (thin create wrapper ~70 lines)
│   │       ├── [id]/
│   │       │   └── edit/
│   │       │       └── page.tsx                 # M-1 (thin edit wrapper ~90 lines)
│   │       ├── calendar/
│   │       │   └── CalendarClient.tsx           # M-2 (continuous time positioning with calculateEventGridPosition)
│   │       └── overview/
│   │           └── OverviewClient.tsx           # M-3 (Executive Analytics & Heatmap Studio)
│   └── book/
│       └── [slug]/
│           ├── BookingSlotsClient.tsx           # H-5 (delete dead legacy code)
│           └── confirm/
│               └── page.tsx                     # H-5 (clean server redirect to /book/[slug])
└── lib/
    └── meetings/
        ├── calendar-sync-service.ts             # H-3 (deleteExternalCalendarEvent helper)
        ├── hooks/
        │   └── use-workspace-schedule.ts        # M-4 (reconcile scalar workspaceId & array workspaceIds)
        └── __tests__/
            ├── session-wizard-persistence.test.ts # Unit test for wizard data mapping
            ├── booking-lifecycle-resilience.test.ts # Unit tests for reschedule & cancellation sync
            └── calendar-grid-positioning.test.ts    # Unit tests for continuous time positioning
```

---

# PHASE 1: TIER 1 HARDENING & RESILIENCE (QUICK WINS)

---

### Task 1.1: Fix Mock / No-Op in Session Wizard (`SessionWizardModal.tsx`)

**Problem:** In `src/app/admin/meetings/components/SessionWizardModal.tsx`, `handleCreateSession` displays a success toast and closes the modal without persisting anything to Firestore. The session is lost.  
**Rule 2 Failure Modes & Mitigations:**
- *Failure Mode 1:* Past date/time selected by user.  
  *Mitigation:* Validate `new Date(startIso) >= new Date(Date.now() - 5 * 60000)`. If in past, toast actionable error.
- *Failure Mode 2:* Video room generation timeout or API failure.  
  *Mitigation:* `quickScheduleMeetingAction` automatically generates a secure internal room fallback (`/meetings/room/:id`) with 7-second timeout protection.
- *Failure Mode 3:* Rapid duplicate clicking on "Create Session".  
  *Mitigation:* `isSubmitting` flag disables the submit button and shows `<Loader2 className="animate-spin" />`.

**Files:**
- Create: `src/lib/meetings/__tests__/session-wizard-persistence.test.ts`
- Modify: `src/app/admin/meetings/components/SessionWizardModal.tsx:90-120`

- [x] **Step 1: Write the unit test for session wizard data normalization** (Passed)
- [x] **Step 2: Run test to verify it passes** (Passed)
- [x] **Step 3: Implement real session creation in `SessionWizardModal.tsx`** (Completed)
- [x] **Step 4: Verify typecheck & test** (Passed)
- [x] **Step 5: Commit Task 1.1** (Commit `e5f32088`)

---

### Task 1.2: Fix Corrupted `endTime` on Reschedule (`src/app/actions/booking-actions.ts`)

**Problem:** In `rescheduleBookingAction` (lines 813–818), `meetingTime: newStartAt` is updated on the materialized meeting document, but **`endTime` is never updated**. The old `endTime` remains, corrupting duration and causing calendar desync.  
**Rule 2 Failure Modes & Mitigations:**
- *Failure Mode 1:* Legacy booking missing `durationMinutes`.  
  *Mitigation:* Compute duration as `(new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()) / 60000 || 30` to guarantee duration is never 0 or negative.
- *Failure Mode 2:* Firestore transaction aborts.  
  *Mitigation:* Both `bookings` and `meetings` updates are enclosed in the same atomic `adminDb.runTransaction`.

**Files:**
- Create: `src/lib/meetings/__tests__/booking-lifecycle-resilience.test.ts`
- Modify: `src/app/actions/booking-actions.ts:810-825`

- [x] **Step 1: Write the unit test for `endTime` calculation** (Passed)
- [x] **Step 2: Run test to verify pass** (Passed)
- [x] **Step 3: Update `rescheduleBookingAction` in `src/app/actions/booking-actions.ts`** (Completed)
- [x] **Step 4: Verify typecheck** (Passed)
- [x] **Step 5: Commit Task 1.2** (Commit `bac9b2fb`)

---

### Task 1.3: External Calendar Cancellation & Reschedule Deletion/Sync

**Problem:** `cancelBookingAction` updates Firestore status to `'cancelled'`, but **never calls Google Calendar or Microsoft Outlook APIs to delete or cancel the external event**, leaving ghost events on host and booker calendars.  
**Rule 2 & 9 Concurrency & Mitigations:**
- *Failure Mode 1:* External Google or Microsoft API returns 401 (expired token), 404 (already deleted), or times out.  
  *Mitigation:* Wrap external API deletion in `try/catch` with a 5-second `AbortSignal` timeout. Log warning to `meeting_activity` without blocking local Firestore cancellation.
- *Rule 3 Backoffice Observability:* If deletion fails, record the incident in `audit_logs` so it shows on the Backoffice Integration Radar without crashing user flow.

**Files:**
- Modify: `src/lib/meetings/calendar-sync-service.ts:150-171`
- Modify: `src/app/actions/booking-actions.ts:725-745` and `815-830`

- [x] **Step 1: Add defensive `deleteExternalCalendarBooking` to `calendar-sync-service.ts`** (Completed)
- [x] **Step 2: Wire `deleteExternalCalendarBooking` into `cancelBookingAction`** (Completed)
- [x] **Step 3: Run typecheck & tests** (Passed)
- [x] **Step 4: Commit Task 1.3** (Commit `c693560f`)

---

### Task 1.4: Fix Global Search Navigation Mismatch

**Problem:** `getWorkspaceCalendarEventsAction` sets `sourceId: linkedBooking.id` for materialized meetings while keeping `sourceType: 'meeting'`. When selected in search, `GlobalMeetingSearchModal.tsx` line 72 does `router.push('/admin/meetings/' + evt.sourceId)`, pushing the **booking ID** to `/admin/meetings/[id]`. The meeting detail page fails to find the doc in `meetings` collection and breaks.  
**Rule 4 & 8 Compliance:**
- Differentiate `sourceType: 'booking' | 'meeting'` strictly in types.
- Ensure 1:1 bookings route to `/admin/meetings/bookings?id=${evt.sourceId}`, while group sessions route to `/admin/meetings/${evt.sourceId}`.

**Files:**
- Modify: `src/lib/meetings/types/calendar-view.ts:13-18`
- Modify: `src/app/actions/meeting-calendar-actions.ts:135-140` and `185-190`
- Modify: `src/app/admin/meetings/components/GlobalMeetingSearchModal.tsx:69-77`

- [x] **Step 1: Update `CalendarEventSourceType`** (Completed)
- [x] **Step 2: Update `getWorkspaceCalendarEventsAction` in `meeting-calendar-actions.ts`** (Completed)
- [x] **Step 3: Update `handleSelectEvent` in `GlobalMeetingSearchModal.tsx`** (Completed)
- [x] **Step 4: Verify typecheck & meeting test suite** (Passed)
- [x] **Step 5: Commit Task 1.4** (Commit `49d7ed28`)

---

### Task 1.5: Delete Dead Legacy Booking Code & Clean Redirect

**Problem:** `src/app/book/[slug]/BookingSlotsClient.tsx` (207 lines) is unused dead code. `src/app/book/[slug]/confirm/` (350 lines) is the old V1 scheduler bypassing concurrency holds.  
**Rule 3 Blast Radius:**
- Any external bookmarks to `/book/[slug]/confirm?time=...` must not throw 404s.
- Next.js server-side `redirect` seamlessly forwards visitors to the modern `/book/[slug]` flow.

**Files:**
- Delete: `src/app/book/[slug]/BookingSlotsClient.tsx`
- Delete: `src/app/book/[slug]/confirm/ConfirmBookingClient.tsx`
- Modify: `src/app/book/[slug]/confirm/page.tsx`

- [x] **Step 1: Simplify `src/app/book/[slug]/confirm/page.tsx` to redirect** (Completed)
- [x] **Step 2: Delete unreferenced files** (Completed)
- [x] **Step 3: Run typecheck to verify zero broken imports** (Passed)
- [x] **Step 4: Commit Task 1.5** (Commit `53aaf163`)

---

# PHASE 2: TIER 2 ARCHITECTURAL EVOLUTION & SIMPLIFICATION

---

### Task 2.1: Extract SSOT `<MeetingSessionForm>` & Deduplicate Session Builders

**Problem:** `src/app/admin/meetings/new/page.tsx` (1,757 lines) and `src/app/admin/meetings/[id]/edit/page.tsx` (1,788 lines) share **>90% identical form schemas, state, step wizards, and layout** (>3,500 lines total).  
**Rule 1 & 7 Code Reuse & Single Source of Truth:**
- Extract modular `<MeetingSessionForm>` component system into `src/app/admin/meetings/components/session-form/`:
  - `session-form-schema.ts`: Standardized Zod schema & TypeScript types.
  - `MeetingSessionForm.tsx`: Shared wizard orchestrator, sticky preview panel, and submit dispatcher (`mode: 'create' | 'edit'`).
- Both `new/page.tsx` and `[id]/edit/page.tsx` become thin wrappers (~70–90 lines each), eliminating **~2,200 lines of duplicate code**.

**Files:**
- Create: `src/app/admin/meetings/components/session-form/session-form-schema.ts`
- Create: `src/app/admin/meetings/components/session-form/MeetingSessionForm.tsx`
- Modify: `src/app/admin/meetings/new/page.tsx` (reduced from 1,757 lines to 18 lines)
- Modify: `src/app/admin/meetings/[id]/edit/page.tsx` (reduced from 1,788 lines to 42 lines)

- [x] **Step 1: Create `session-form-schema.ts`** (Completed)
- [x] **Step 2: Create `MeetingSessionForm.tsx`** (Completed)
- [x] **Step 3: Refactor `new/page.tsx` into thin wrapper (~18 lines)** (Completed)
- [x] **Step 4: Refactor `[id]/edit/page.tsx` into thin wrapper (~42 lines)** (Completed)
- [x] **Step 5: Verify tests and typecheck** (Passed)
- [x] **Step 6: Commit Task 2.1** (Commit `a2624d9f`)

---

### Task 2.2: Overhaul Calendar Grid Duration with Continuous Positioning

**Problem:** In `CalendarClient.tsx`, multi-day views group events strictly by `startHour === h.hour`, hiding duration (a 2-hour meeting renders only in the first hour; the second hour looks vacant) and clipping events outside 8 AM – 8 PM.  
**Rule 1 & 7 Emil Kowalski Animations & Visual Fidelity:**
- Use `calculateEventGridPosition(new Date(evt.startAt), new Date(evt.endAt), 8, 20)` to compute continuous `topPercent` and `heightPercent`.
- Render day columns with an absolute event layer overlaying time slot grid lines.
- Support multi-hour spans, fractional start times (:15, :30, :45), and live pulsing rings.
- Standardize outer container to `border border-border/80 sm:rounded-2xl bg-card` (`theme.md` §8).

**Files:**
- Create: `src/lib/meetings/__tests__/calendar-grid-positioning.test.ts`
- Modify: `src/app/admin/meetings/calendar/CalendarClient.tsx:470-555`

- [x] **Step 1: Write unit tests for continuous grid positioning** (Passed)
- [x] **Step 2: Run test to verify pass** (Passed)
- [x] **Step 3: Update `CalendarClient.tsx` multi-day grid** (Completed)
- [x] **Step 4: Verify typecheck & tests** (Passed)
- [x] **Step 5: Commit Task 2.2** (Commit `98b34dd9`)

---

### Task 2.3: Reconcile Dual `workspaceId` & `workspaceIds` in `useWorkspaceSchedule.ts`

**Problem:** `useWorkspaceSchedule` only queries `where('workspaceIds', 'array-contains', workspaceId)`. Any legacy meeting having only scalar `workspaceId: string` will not load into the reactive dashboard.  
**Rule 9 Resource Resilience:**
- Subscribe to both queries memoized via `useMemoFirebase`.
- Merge and deduplicate by document ID with `deduplicateUnifiedMeetings`.
- Avoid unnecessary re-renders with stable references.

**Files:**
- Modify: `src/lib/meetings/hooks/use-workspace-schedule.ts:160-195`
- Test: `src/lib/meetings/__tests__/use-workspace-schedule.test.ts`

- [x] **Step 1: Update `useWorkspaceSchedule.ts`** (Completed)
- [x] **Step 2: Run tests to verify pass** (Passed)
- [x] **Step 3: Commit Task 2.3** (Commit `99c9c3b8`)

---

### Task 2.4: Elevate Overview Pillar into Dedicated Executive Analytics & Heatmap Studio

**Problem:** `/admin/meetings` (Home) and `/admin/meetings/overview` (Overview) duplicate ~70% of the same widgets (Today's Schedule, Attendance Rate, Actionable Attention Items).  
**Rule 1 & 7 Clean UI Design:**
- Convert `OverviewClient.tsx` into a dedicated **Executive Analytics & Host Capacity Studio**:
  1. Remove duplicate Today's Meetings list and Needs Attention card (already on Home).
  2. Add:
     - **Host Capacity & Utilization Radar** (hours booked vs available hours per host).
     - **Booking Conversion Funnel** (Views → Holds → Completed).
     - **Peak Booking Times Heatmap** (busiest days of week and hours of day).
     - **Meeting Format Distribution** (1:1 Consultations vs Webinars vs Workshops).
- Strictly adhere to `theme.md` §8 (`<CardInfoTooltip>`, `sm:rounded-2xl`, zero raw descriptions).

**Files:**
- Modify: `src/app/actions/meeting-analytics-actions.ts`
- Modify: `src/app/admin/meetings/overview/OverviewClient.tsx`

- [x] **Step 1: Enhance `getMeetingsOperationalOverviewAction` in `meeting-analytics-actions.ts`** (Completed)
- [x] **Step 2: Update `OverviewClient.tsx` UI** (Completed)
- [x] **Step 3: Verify typecheck & tests** (Passed)

Run: `pnpm typecheck && pnpm vitest run src/lib/meetings/`  
Expected: 0 errors.

- [x] **Step 4: Commit Task 2.4** (Commit `05b5d404`)

---

## Verification & Sign-off Checklist

| Gate | Criterion | Command | Target |
|---|---|---|---|
| 1 | Automated Test Suite | `pnpm vitest run src/lib/meetings/` | 100% Pass (0 failures) |
| 2 | Pure TypeScript Build | `pnpm typecheck` | Exit Code 0 (0 errors) |
| 3 | Code Quality & Rules | Zero `any`, zero unescaped markup, relative toast paths | Verified |
| 4 | Modal Architecture SSOT | `theme.md` §8 (`demarcated`, `CardInfoTooltip`, `sr-only`, `rounded-2xl`) | Verified |
| 5 | Git Policy | Strictly zero remote `git push` | Enforced |
