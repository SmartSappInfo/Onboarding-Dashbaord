# Spec: Meeting Details Page Restructuring & Tabbed Layout

## 1. Goal Description
To restructure the Meeting details sub-system in the admin dashboard into a highly cohesive, tabbed workspace layout. Rather than displaying long, scrolling pages or disjointed sub-routes, all context regarding a meeting (General details, Invitations, Registrations, Facilitators, and Intelligence) will be unified under a shared Next.js Layout.

This workspace will feature a **left sidebar navigation** (vertical tabs) to switch between dynamic sub-route pages, and **sub-tabs** inside pages where internal context switching is required (such as switching between "Invited Guests" lists and "Send Invitations" inside the Invited Guests tab).

---

## 2. Architecture & Directory Mapping
We will leverage Next.js App Router's dynamic nested layout capability to keep the page navigation stateless, bookmarkable, and fast without redundant database queries.

### Directory Structure
```
src/app/admin/meetings/[id]/
├── layout.tsx                     <-- [NEW] Shared sidebar layout, header & MeetingContext
├── page.tsx                       <-- [MODIFY] General Tab (Meeting Info, Stats, End Meeting)
├── edit/
├── invitations/
│   └── page.tsx                   <-- [MODIFY] Invited Guests Tab (List, Composer, Sub-tabs)
├── registrants/
│   ├── page.tsx                   <-- [MODIFY] Registrants Tab wrapper (no header)
│   └── RegistrantsClient.tsx      <-- [MODIFY] Strip header, integrate with MeetingContext
├── facilitators/
│   └── page.tsx                   <-- [NEW] Facilitators Tab (List, actions, resend modal)
└── results/
    ├── page.tsx                   <-- [MODIFY] Intelligence Tab wrapper (no header)
    └── ResultsClient.tsx          <-- [MODIFY] Strip header, integrate with MeetingContext
```

---

## 3. Data Flow & React Context (`MeetingContext`)
To prevent redundant database fetches and layout flashes as users switch tabs, a shared **`MeetingContext`** will be defined in the dynamic layout. This context will fetch and subscribe to the real-time Firebase Firestore database listeners.

### Shared Data Hooks (in `layout.tsx`):
1. **Meeting Document**: `meetings/${meetingId}` (Real-time `useDoc`)
2. **Registrants Subcollection**: `meetings/${meetingId}/registrants` (Real-time `useCollection`)
3. **Attendees Subcollection**: `meetings/${meetingId}/attendees` (Real-time `useCollection`)

### Context Schema:
```typescript
interface MeetingContextType {
  meeting: Meeting;
  registrants: MeetingRegistrant[];
  attendees: Attendee[];
  isLoading: boolean;
  meetingDocRef: any;
}
```
All child pages will consume this context to compute stats and display registers reactively.

---

## 4. UI Layout Specifications

### Shared Workspace Shell (`layout.tsx`)
1. **Top Header**:
   - Contains a back button (`<ChevronLeft />`) to `/admin/meetings`.
   - Displays the Meeting Title (with inline `Edit3` renaming capability).
   - Displays type badge and formatted scheduled date.
   - Action buttons aligned to the right: **View Public Page** and **Edit Architecture** (redirects to edit page).
2. **Main Layout Grid**:
   - Two columns (`grid grid-cols-1 md:grid-cols-12 gap-8 mt-6`):
     - **Left Column (col-span-3)**: Vertical Navigation Sidebar.
       Renders 5 menu items styled as premium sidebar buttons:
       - **Meeting Details**: Icon `Building`, route `/admin/meetings/[id]`
       - **Invited Guests**: Icon `Mail`, route `/admin/meetings/[id]/invitations`
       - **Registrants & Attendance**: Icon `Users`, route `/admin/meetings/[id]/registrants`
       - **Facilitators**: Icon `ShieldCheck`, route `/admin/meetings/[id]/facilitators`
       - **Intelligence**: Icon `BarChart3`, route `/admin/meetings/[id]/results`
     - **Right Column (col-span-9)**: Page content workspace panel (`{children}`).

---

## 5. Tab View Specifications

### Tab 1: Meeting Details / General (`page.tsx`)
This is the default dynamic page. It will render:
1. **Engagement Statistics Card**:
   - Total Invited (`source === 'invite' || source === 'one-click'`)
   - Total Registered (`status === 'registered' || status === 'approved' || status === 'attended'`)
   - Total Attendees/Participants (length of `attendees` subcollection)
   - Total Facilitators (`meeting.facilitators?.length || 0`)
   - **Conversion Rate**: Out of invited, how many registered:
     `invitedRegisteredCount / invitedGuestsCount * 100`%
2. **Meeting Information Card**: Read-only display of time, location, institutional context.
3. **Distribution Access Card**: Short URL, copy actions, dynamic QR Code preview, and custom slug settings.
4. **End Session & Follow-ups Card**: The post-event actions panel for ending the meeting and sending summaries.

### Tab 2: Invited Guests & Invitations (`invitations/page.tsx`)
This page handles outreach and invitations. It will include an internal sub-tab navigation at the top:
- **Guests List (Active by default)**:
  - Displays invitation stats cards (Invited, RSVP Going, RSVP Not Going, Pending).
  - Renders the table of invited guests.
  - If the list is empty, displays an empty state card with a button "Invite New Guests" that toggles to the Invite tab.
- **Send Invitations**:
  - Renders the audience criteria builder, template selectors, channel selectors (Email/SMS), and the send action button.
  - Sits on the same page, allowing facilitators to easily toggle or view the composer below the list.

### Tab 3: Registrants & Attendance (`registrants/page.tsx`)
- Embeds the existing `RegistrantsClient` panel.
- Modifies `RegistrantsClient.tsx` to:
  - Remove duplicate meeting name header and back button.
  - Consume the shared `MeetingContext` for `meeting` and `registrants` data, avoiding redundant Firestore queries.
  - Clean up formatting and page paddings.

### Tab 4: Facilitators (`facilitators/page.tsx`)
- Displays the assigned facilitators list.
- Features the **Invite/Add dropdown selector** to attach workspace members or external custom facilitators.
- Renders facilitator profiles with their dynamic avatar, bio, and name.
- Renders the single meatball action dropdown menu:
  - **Copy Link**: copies the personalized waiting room URL.
  - **Share via WhatsApp**: opens a pre-composed WhatsApp chat text.
  - **Send Link**: dispatches template emails.

### Tab 5: Intelligence (`results/page.tsx`)
- Embeds the existing `ResultsClient` panel.
- Modifies `ResultsClient.tsx` to:
  - Remove duplicate headers and back navigation buttons.
  - Consume shared `MeetingContext` for attendees and meeting data.
  - Fit cleanly in the content pane.

---

## 6. Theme and Contrast Compliance
To guarantee high contrast in light mode:
- Card panels will use: `bg-card border shadow-sm` or `bg-white/70 dark:bg-white/5 border-slate-200/80 dark:border-white/10`.
- Text labels will use: `text-slate-900 dark:text-white` for titles, and `text-slate-600 dark:text-slate-400` for subtitles.
- Primary buttons will use solid background colors (`bg-primary`) to stand out clearly on both light and dark backgrounds.

---

## 7. Verification Plan
1. **Dynamic Navigation Validation**: Navigate between all 5 vertical tabs and verify that URLs switch correctly (`/invitations`, `/registrants`, `/facilitators`, `/results`) and the sidebar navigation retains focus.
2. **Context Persistence Validation**: Confirm that edits in one tab (e.g. adding a facilitator or checking in a registrant) dynamically update the statistics in the General tab instantly without page reload.
3. **Responsive Checks**: Verify the sidebar collapses into a horizontal nav bar or mobile-friendly overlay on narrow screens.
4. **Light Mode Legibility**: Switch themes and inspect all text colors for accessibility.
