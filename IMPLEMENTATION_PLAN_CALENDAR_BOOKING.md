# Calendar Booking System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal**: Build a unified, high-performance Scheduling Platform inside the SmartSapp Next.js App Router application. This engine supports administrative calendar views, public-facing booking pages with customizable forms, email template link injection, and Microsoft Teams, Zoom, and Google Meet integrations with organization/workspace scopes.

**Architecture**: 
- Keep `meetings` and `tasks` collections intact for backward compatibility. Use a unified dynamic in-memory mapper in the `availability` and `calendar` interfaces.
- Create new collections for `bookings`, `booking_pages`, `calendar_connections`, and `user_availabilities` with public/authorized Firestore rules.
- Leverage dynamic imports, client-only wrappers to prevent hydration mismatches, and queue-based syncing to avoid API rate-limit bottlenecks.

**Tech Stack**: Next.js App Router, Firebase/Firestore, Microsoft Graph API, Google Calendar API, Zoom API, Framer Motion (Emil Kowalski guidelines), date-fns, Tailwind CSS.

---

## Technical Risk Review & Mitigations

### 1. Timezone & Daylight Saving Time (DST) Jumps
- **Problem**: Storing date-times in relative offsets or plain UTC can lead to meetings shifting by an hour during spring-forward or fall-back DST transitions in the host's physical timezone.
- **Mitigation**: Store availability and event objects using geographical IANA timezone identifiers (e.g. `America/New_York`). Perform slot math by computing dates in the target IANA timezone via `date-fns-tz` before converting to UTC for database storage.

### 2. Double-Booking Race Conditions
- **Problem**: Two visitors load availability and click the exact same booking slot simultaneously, causing double booking.
- **Mitigation**: Run the confirmation step in a Firestore transaction (`runTransaction`). Verify the slot remains open in the host's `meetings` and `bookings` collections before writing the confirmed `BookingResponse` and `Meeting`.

### 3. Hydration Mismatches in Calendar UI
- **Problem**: Formatting date strings in Server Components creates a mismatch if the server is in UTC and the client's browser is in local timezone.
- **Mitigation**: Load the interactive Calendar UI grid using client-only lazy loading (`next/dynamic` with `ssr: false`). Use fallback skeletons styled in high-fidelity tailwind classes during initial page load.

### 4. API Rate Limits & Token Revocations
- **Problem**: Google, Microsoft, and Zoom have API rate limits. Generating meeting links inline in the user request will hang the client if third-party APIs are down or slow.
- **Mitigation**: Perform token exchange synchronously, but queue meeting creation/updates in a `calendar_sync_queue` collection. Process this queue using Cloud Functions with exponential backoff. Mark connections as `invalid_credentials` in the DB if refresh tokens are revoked, prompting user reconnects in the Settings panel.

### 5. Type Safety (No `any` or `any[]`)
- **Problem**: Loose types mask runtime property mismatches.
- **Mitigation**: Enable strict TypeScript interfaces. Define exact models for questions, answers, and integration configurations. Use `Record<string, string | string[]>` instead of `any`, and explicitly define schemas using Zod validation.

---

## Affected & Interdependent Features

1. **Scheduled Messages / Reminders**:
   - *Impact*: Standard meetings had reminders scheduled via `scheduleRemindersForMeeting`.
   - *Plan*: When a booking is created, write the resultant object as a standard `Meeting` document, triggering the existing reminder scheduler automatically.
2. **Tasks & Kanban UI**:
   - *Impact*: Tasks are currently rendered on the Kanban board and have start/due dates.
   - *Plan*: The Calendar page queries the `tasks` collection. Dragging and resizing a task on the Calendar will trigger a background Server Action updating the task's dates.
3. **Email Templates Builder**:
   - *Impact*: Needs variables for booking link injection.
   - *Plan*: Introduce `booking_url` variables to the template registry mapping.

---

## Phase 1: Core Scheduling & Database Architecture

### Task 1: TypeScript Definitions & Schemas
- [ ] **Step 1: Update Types file**
  Modify `src/lib/types.ts` to add typed contracts. Never use `any` or `any[]`.
  - Create: `CalendarConnection`, `UserAvailability`, `WorkingDay`, `BookingQuestion`, `BookingPage`, `BookingResponse`.

```typescript
// Add to src/lib/types.ts
export type ConferencingProvider = 'GOOGLE_MEET' | 'ZOOM' | 'MICROSOFT_TEAMS' | 'PHONE' | 'IN_PERSON';

export interface CalendarConnection {
  id: string;
  organizationId: string;
  workspaceId: string;
  userId: string;
  provider: 'google_calendar' | 'microsoft_teams' | 'zoom';
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO DateTime
  calendarId: string; // e.g. "primary"
  syncDirection: 'one_way_to_calendar' | 'one_way_from_calendar' | 'two_way';
  lastSyncAt?: string;
  createdAt: string;
}

export interface WorkingDay {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  slots: Array<{ start: string; end: string }>; // e.g. [{ start: "09:00", end: "12:00" }]
}

export interface UserAvailability {
  id: string; // matches user or workspace
  organizationId: string;
  workspaceId: string;
  userId: string;
  weeklySchedule: WorkingDay[];
  timezone: string; // IANA string e.g. "Africa/Accra"
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  maxBookingsPerDay?: number;
  minimumNoticeHours: number;
  maximumNoticeDays: number;
}

export interface BookingQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'dropdown' | 'checkbox' | 'radio';
  required: boolean;
  options?: string[]; // for multi-choice fields
}

export interface BookingPage {
  id: string;
  organizationId: string;
  workspaceId: string;
  slug: string;
  title: string;
  description?: string;
  durationMinutes: number;
  availabilityId: string;
  questions: BookingQuestion[];
  meetingProvider: ConferencingProvider;
  locationDetails?: string;
  bufferMinutes: number;
  publishStatus: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface BookingResponse {
  id: string;
  bookingPageId: string;
  organizationId: string;
  workspaceId: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  answers: Record<string, string | string[]>;
  scheduledTime: string; // ISO DateTime UTC
  durationMinutes: number;
  meetingId?: string; // links to created Meeting doc
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}
```

- [ ] **Step 2: Update Firestore Security Rules**
  Modify `firestore.rules` to allow secure public access for bookings and restricted admin/workspace access for integrations.

```javascript
    // Add to firestore.rules
    match /booking_pages/{pageId} {
      allow read: if true;
      allow create: if isAuthorized();
      allow update, delete: if isAuthorized() && (isSystemAdmin() || canAccessWorkspace(resource.data.workspaceIds));
    }
    
    match /bookings/{bookingId} {
      allow create: if true;
      allow read: if isAuthorized() && (isSystemAdmin() || canAccessWorkspace(resource.data.workspaceIds));
      allow update: if isAuthorized() && (isSystemAdmin() || canAccessWorkspace(resource.data.workspaceIds));
    }

    match /calendar_connections/{connId} {
      allow read, write: if isAuthorized() && (isSystemAdmin() || canAccessWorkspace(resource.data.workspaceIds));
    }

    match /user_availabilities/{availId} {
      allow read: if true;
      allow write: if isAuthorized() && (isSystemAdmin() || canAccessWorkspace(resource.data.workspaceIds));
    }
```

---

## Phase 2: Hierarchical Integration Engine & API OAuth

We will implement OAuth connectors and API adapters for Google, Zoom, and Microsoft Graph.

### Task 1: Microsoft Teams Graph Integration
- [ ] **Step 1: Create Microsoft Integration Service**
  Create `src/lib/services/integrations/microsoft-teams.ts` to connect to Microsoft Graph.
  - Generates auth URLs.
  - Exchanges codes for access/refresh tokens.
  - Calls `POST /me/onlineMeetings` to generate Teams meetings.

```typescript
// Create src/lib/services/integrations/microsoft-teams.ts
import { adminDb } from '@/lib/firebase-admin';
import type { CalendarConnection } from '@/lib/types';

interface MicrosoftMeetingResponse {
  joinWebUrl: string;
  id: string;
}

export async function getMicrosoftAuthUrl(workspaceId: string, orgId: string, customCreds?: { clientId: string }): Promise<string> {
  const clientId = customCreds?.clientId || process.env.MICROSOFT_CLIENT_ID || '';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft/callback`;
  const scope = encodeURIComponent('offline_access Calendars.ReadWrite OnlineMeetings.ReadWrite');
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scope}&state=${workspaceId}_${orgId}`;
}

export async function createMicrosoftTeamsMeeting(
  connection: CalendarConnection,
  details: { title: string; start: string; end: string }
): Promise<MicrosoftMeetingResponse> {
  // Call Graph API using accessToken, automatic refresh if needed
  const response = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDateTime: details.start,
      endDateTime: details.end,
      subject: details.title,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create Microsoft Teams meeting');
  }

  const data = await response.json() as MicrosoftMeetingResponse;
  return {
    joinWebUrl: data.joinWebUrl,
    id: data.id,
  };
}
```

- [ ] **Step 2: Add API Route Handler for Microsoft Callback**
  Create `src/app/api/integrations/microsoft/callback/route.ts` to receive Microsoft OAuth codes, save them to the `calendar_connections` collection, and redirect users back to the Settings view.

---

## Phase 3: Availability & Conflict Engine

### Task 1: Availability Computations
- [ ] **Step 1: Create availability computation helper**
  Create `src/lib/services/scheduler/availability.ts`.
  - Fetch working schedule (`weeklySchedule`).
  - Query Google Calendar, Outlook Calendar, and domestic smart-sapp database for conflicting event slots.
  - Calculate free intervals. Apply before/after buffer offsets.

```typescript
// Create src/lib/services/scheduler/availability.ts
import { adminDb } from '@/lib/firebase-admin';
import type { UserAvailability, Meeting, Task } from '@/lib/types';
import { addMinutes, parseISO, isWithinInterval, areIntervalsOverlapping } from 'date-fns';

export interface TimeSlot {
  start: string; // ISO
  end: string;   // ISO
}

export async function calculateFreeSlots(
  availability: UserAvailability,
  dateStr: string // YYYY-MM-DD
): Promise<TimeSlot[]> {
  const firestore = adminDb;
  
  // 1. Fetch meetings and tasks overlapping this date
  const meetingsSnap = await firestore.collection('meetings')
    .where('workspaceIds', 'array-contains', availability.workspaceId)
    .get();
  
  const tasksSnap = await firestore.collection('tasks')
    .where('workspaceId', '==', availability.workspaceId)
    .get();

  const busyIntervals: Array<{ start: Date; end: Date }> = [];

  meetingsSnap.docs.forEach(doc => {
    const meeting = doc.data() as Meeting;
    if (meeting.meetingTime) {
      const start = parseISO(meeting.meetingTime);
      const end = addMinutes(start, meeting.durationMinutes || 30);
      busyIntervals.push({
        start: addMinutes(start, -availability.bufferBeforeMinutes),
        end: addMinutes(end, availability.bufferAfterMinutes),
      });
    }
  });

  // Parse tasks and add them to busyIntervals if they occupy time blocks
  // ...

  // Calculate free segments based on availability.weeklySchedule slots
  // ...
  
  return []; // Return computed free slots
}
```

---

## Phase 4: Dashboard Integration Tab & Calendar UI

### Task 1: Admin Calendar Page
- [ ] **Step 1: Build Calendar View Client**
  Create `src/app/admin/calendar/CalendarClient.tsx`.
  - Conforms to **frontend-design**: high contrast dark layout default, outfit/playful typography, clean visual hierarchy.
  - Conforms to **emilkowal-animations**: 
    - Easing custom curves `cubic-bezier(0.23, 1, 0.32, 1)`.
    - Active press transforms (`active:scale-[0.97]`).
    - Staggered entry transitions for event tiles.
  - Dynamic loading using Next.js `dynamic(..., { ssr: false })` to bypass client date parsing hydration errors.

- [ ] **Step 2: Add Calendar Route**
  Create `src/app/admin/calendar/page.tsx` rendering `CalendarClient`.

### Task 2: Credentials Administration Panel
- [ ] **Step 1: Modify Workspace Settings**
  Add Microsoft Teams connection triggers to `src/app/admin/settings/components/WorkspaceIntegrationsTab.tsx`. Display status badge.
- [ ] **Step 2: Modify Organization Settings**
  Add Microsoft App client ID override options inside `src/app/admin/settings/components/OrganizationIntegrationsTab.tsx`.

---

## Phase 5: Public Booking Engine & Link Embeds

### Task 1: Public Slot Selection Landing Page
- [ ] **Step 1: Create `/book/[slug]` landing routes**
  Implement dynamic routes resolving route params asynchronously to conform to **next-best-practices**.
  - Create: `src/app/book/[slug]/page.tsx`
  - Create: `src/app/book/[slug]/confirm/page.tsx`
- [ ] **Step 2: Render Booking Confirmation Flow**
  Use React hook forms with Zod schema validation to collect visitor responses. Save result in `bookings` and generate matching meeting inside a Firestore transaction.

### Task 2: Copy-Paste Embed Links & Iframes
- [ ] **Step 1: Create Booking Builder interface**
  Create `src/app/admin/booking-pages/page.tsx` allowing page configuration (Title, duration, questions).
- [ ] **Step 2: Add Link copy helper & Iframe code widget**
  Render copy-to-clipboard blocks generating:
  - Markdown/HTML links (e.g. `https://app.smartsapp.com/book/consult?email={{contact.email}}`)
  - Full `<iframe src="..." />` codes for marketing pages integration.

---

## Phase 6: Automated Background Tasks & Syncing

### Task 1: Integration Sync Worker
- [ ] **Step 1: Create Cloud Queue Processor**
  Implement automatic queue reader that pulls pending connection tasks and syncs them to Google Calendar and Microsoft Graph.

---

## Verification & Deployment Checklist

### Automated Tests
```bash
# Execute unit testing suite for conflict checks and database adapters
pnpm test src/lib/__tests__/scheduler
```

### Manual Verification
1. **Scopes Check**: Ensure that if Org credentials exist, redirect URL uses the Org's custom Microsoft client ID instead of App default.
2. **Double Booking Transaction**: Trigger two concurrent requests to the same slot and verify the transaction rejects the second.
3. **Accessibility**: Test keyboard navigation on `/book/[slug]` to verify focus outlines and screen-reader accessibility.
4. **Compile validation**: Run `pnpm verify` (lint, typecheck, test) prior to pushing.
