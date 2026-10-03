# SmartSapp Meetings 2.0 (Phase 3) Implementation Plan: Interactive Calendar Hub, Full-Spectrum Plotted Views & Universal Header Standard

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Calendar Hub (`/admin/meetings/calendar`) into a full-spectrum, interactive command center with month grid view, event source filtering, and slide-over inspection drawer, while enforcing the universal header `<CardInfoTooltip>` standard and strict typing across all remaining Meetings pillars.

**Architecture:**
- Create `<CalendarEventDetailDrawer>` adhering to the Standardized Modal Architecture in `theme.md` (demarcated header, `CardInfoTooltip`, `sr-only` description, tactile buttons, `min-h-[44px]` touch targets) to inspect 1:1 bookings and group webinars without abrupt page redirects.
- Upgrade `CalendarClient.tsx` with a true 7-column month grid view, accurate 1-month date jumps, and an in-memory event source filter (`All` | `1:1 Consultations` | `Group Sessions`).
- Standardize headers across all 4 remaining Meetings pillars (`BookingsClient`, `EventTypesClient`, `CalendarsClient`, `RoutingFormsClient`) by eliminating raw `<p>` descriptions and routing guidance through `<CardInfoTooltip>`.
- Eliminate legacy `any` types in `MeetingsClient.tsx`.

**Tech Stack:** Next.js 15, React 19, TypeScript (Strict, 0 `any`), Tailwind CSS, date-fns, Lucide React, Framer Motion (`emilkowal-animations`), Vitest.

---

## Alignment with `agents_mcp_rules.md` & `.agents/AGENTS.md`

| Rule # | Requirement | Specific Alignment & Implementation Strategy |
| :--- | :--- | :--- |
| **Rule 1** | **Conform to Engineering Skills** | Conforms to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations` (smooth slide-over transitions, tactile micro-interactions), `frontend-design` (minimalist, clean hierarchy). |
| **Rule 2** | **"What Could Go Wrong" & Scalability** | Anticipate high event density in month cells, missing conference URLs, timezone drifts during month navigation, and drawer unmount memory leaks. Full Vitest unit test coverage. |
| **Rule 3** | **Blast Radius & Pillar Consistency** | Extends consistency across `/admin/meetings/calendar`, `/bookings`, `/event-types`, `/calendars`, `/routing`, and `/sessions`. |
| **Rule 4** | **Strict Typing & Trust Boundary** | **Zero `any`, `any[]`, or unchecked casts**. Purge `useCollection<any>` and `(clonedData as any)` from `MeetingsClient.tsx`. Strictly typed props for `CalendarEventDetailDrawer`. |
| **Rule 5** | **Public Access & Security** | Safe URL handling: all join links validated before opening; internal links strictly relative starting with `/`. Safe Firestore reads scoped to active workspace. |
| **Rule 7** | **Mobile & Accessibility First** | Touch targets $\ge 44\text{px}$ (`min-h-[44px]` or responsive `sm:min-h-[32px]/[28px]`). Keyboard accessible drawers, ARIA dialog descriptions, and concise everyday English. |
| **Rule 8** | **Security & Open-Redirect Protection** | Join links use `target="_blank" rel="noopener noreferrer"`. Block `javascript:` or malformed protocols. |
| **Rule 9** | **Load, Concurrency & Performance** | Memoize month grid calculations and event groupings per date cell with `React.useMemo` to eliminate unnecessary re-computations during day navigation. |
| **Rule 10** | **Inline Architectural Guides** | Code changes include explanatory comments detailing the rationale, testability pointers, and caution warnings for future maintainers. |
| **Workspace Rule** | **Zero Raw Descriptions Under Titles** | All titles pair with `<CardInfoTooltip text="..." />` in flex headers. Raw `<p>` tags beneath headers are completely eliminated. |

---

## File Structure & Responsibilities

| File Path | Action | Responsibility |
| :--- | :--- | :--- |
| `src/app/admin/meetings/calendar/components/CalendarEventDetailDrawer.tsx` | Create | Interactive slide-over drawer inspecting any calendar event with full metadata, join CTA, share actions, and management routes. |
| `src/app/admin/meetings/calendar/CalendarClient.tsx` | Modify | Add Month Grid view, source filter toggle (`All` / `1:1` / `Group`), calendar navigation fixes, and wire event clicking to the detail drawer. |
| `src/lib/meetings/calendar-view-service.ts` | Modify | Add month grid day generation with leading/trailing padding days for full 7-column calendar alignment. |
| `src/lib/meetings/__tests__/calendar-view-service.test.ts` | Modify | Unit test suite verifying month view grid calculation, date boundaries, and event distribution. |
| `src/app/admin/meetings/bookings/BookingsClient.tsx` | Modify | Align header to `<CardInfoTooltip>` standard (remove raw `<p>` description). |
| `src/app/admin/meetings/event-types/EventTypesClient.tsx` | Modify | Align header to `<CardInfoTooltip>` standard (remove raw `<p>` description). |
| `src/app/admin/meetings/calendars/CalendarsClient.tsx` | Modify | Align header to `<CardInfoTooltip>` standard (remove raw `<p>` description). |
| `src/app/admin/meetings/routing/RoutingFormsClient.tsx` | Modify | Align header to `<CardInfoTooltip>` standard (remove raw `<p>` description). |
| `src/app/admin/meetings/MeetingsClient.tsx` | Modify | Purge legacy `any` types in `MeetingStats` and cloning logic. |

---

## Bite-Sized Implementation Tasks

### Task 1: Enhance `calendar-view-service.ts` for True 7-Column Month Grids
- **Files**:
  - Modify: `src/lib/meetings/calendar-view-service.ts`
  - Modify: `src/lib/meetings/__tests__/calendar-view-service.test.ts`
- **Details**:
  - Implement `getMonthGridCalendarDays(anchorDate: Date): Date[]` that generates a complete 35- or 42-day calendar matrix starting on Sunday of the first week and ending on Saturday of the last week (with proper leading and trailing padding days from adjacent months).
  - Add unit tests verifying grid dimensions (divisible by 7), correct anchor month days, and boundary stability.
- **Verification**: `pnpm vitest run src/lib/meetings/__tests__/calendar-view-service.test.ts`

### Task 2: Build `CalendarEventDetailDrawer.tsx`
- **Files**:
  - Create: `src/app/admin/meetings/calendar/components/CalendarEventDetailDrawer.tsx`
- **Details**:
  - Slide-over `Sheet` component receiving `event: CalendarGridEvent | null`, `open: boolean`, and `onOpenChange: (open: boolean) => void`.
  - Conforms to `theme.md`:
    - Demarcated header with title and `<CardInfoTooltip text="Detailed event metadata, attendee roster, and direct room access." />`.
    - `<SheetDescription className="sr-only">Event details and session actions</SheetDescription>`.
    - Badges: Source Type (1:1 Consultation vs Live Session/Webinar) and Status (Confirmed, Live, Completed, Cancelled).
    - Formatted Date, Time Range, and Duration with icons.
    - Host and contact/booker info (Name, Email, Notes).
    - Direct "Join Room Now" / "Join Call" button (`min-h-[44px]`, `active:scale-[0.97]`).
    - Copy join link and copy registration link with toast notifications.
    - Direct link to manage event (`/admin/meetings/${event.id}` for webinars, `/admin/meetings/bookings` for bookings).
- **Verification**: `pnpm typecheck`

### Task 3: Upgrade `CalendarClient.tsx` (Month Grid View, Filtering & Drawer Integration)
- **Files**:
  - Modify: `src/app/admin/meetings/calendar/CalendarClient.tsx`
- **Details**:
  - Integrate `CalendarEventDetailDrawer` for both grid slots and agenda list rows. Clicking an event opens the drawer instead of instantly redirecting.
  - Add `<SelectItem value="month">Month View</SelectItem>` to view mode selector.
  - Implement true 7-column month grid rendering:
    - Day cell showing day number (accented for today, muted for adjacent month days).
    - Event chips showing time + title with custom badge colors.
    - `+N more` indicator if >3 events on a day.
    - Clicking an empty slot opens `QuickScheduleModal` with date prefilled.
  - Fix month navigation: `handlePrev` and `handleNext` add/subtract 1 calendar month safely using `date-fns/addMonths` / `subMonths` rather than a fixed 30-day millisecond interval.
  - Add in-memory source filter: `All` | `1:1 Consultations` | `Group Sessions` with segmented control or filter pill.
- **Verification**: `pnpm typecheck` & `pnpm vitest run`

### Task 4: Standardize Headers Across All Meetings Sub-Pillars
- **Files**:
  - Modify: `src/app/admin/meetings/bookings/BookingsClient.tsx`
  - Modify: `src/app/admin/meetings/event-types/EventTypesClient.tsx`
  - Modify: `src/app/admin/meetings/calendars/CalendarsClient.tsx`
  - Modify: `src/app/admin/meetings/routing/RoutingFormsClient.tsx`
- **Details**:
  - In each file, remove raw `<p className="text-xs text-muted-foreground">` descriptions directly below the page title.
  - Pair each `h1` with `<CardInfoTooltip text="..." />` in a flex header row.
  - Ensure all action buttons satisfy `min-h-[44px]` (or responsive `sm:min-h-[36px]/[32px]`) and tactile `active:scale-[0.97]`.
- **Verification**: Visual code inspection & `pnpm typecheck`

### Task 5: Strict Typing & Cleanup in `MeetingsClient.tsx`
- **Files**:
  - Modify: `src/app/admin/meetings/MeetingsClient.tsx`
- **Details**:
  - In `MeetingStats`, define interface `MeetingRegistrant { status?: string; source?: string }` and replace `useCollection<any>` with `useCollection<MeetingRegistrant>`.
  - Fix `(clonedData as any).entitySlug = uniqueSlug;` with strictly typed partial.
  - Ensure zero `any` or `any[]` throughout the file.
- **Verification**: `pnpm typecheck` & `pnpm lint`

### Task 6: Comprehensive Verification & Senior Code Review
- **Verification Commands**:
  - `pnpm vitest run src/lib/meetings/` (verify all 144+ unit tests pass)
  - `pnpm typecheck` (`tsc --noEmit`, verify 0 errors)
  - `pnpm lint` (`eslint`, verify 0 errors)
- **Subagent Review**:
  - Invoke `Senior Principal Code Reviewer` subagent for Phase 3 sign-off.
