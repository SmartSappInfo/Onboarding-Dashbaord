# Design Specification: Facilitator Joining & Profile Waiting Room Flow

This document outlines the architecture, layout (Option 1: Side-by-Side Cards), and technical implementation details for the facilitator waiting room experience.

## 1. Goal
When a facilitator accesses the waiting room using their unique join link (containing their facilitator token):
1. Resolve them as a facilitator instead of a registrant.
2. Present a dual-column workspace:
   - **Left Column**: Welcome message and profile card displaying their photo, name, and bio, allowing them to edit these details. Edits are saved to the current meeting document only.
   - **Right Column**: Meeting details and an active "Join Meeting Now" button.
3. The facilitator can join immediately (even if the scheduled meeting time is in the future) and is **not** automatically redirected on a timeout.

---

## 2. Proposed Changes

### A. Core Database Updates (Server Action)
We will implement a new server action inside `src/app/actions/meeting-facilitator-actions.ts` to update the specific facilitator's profile inside the parent meeting document in Firestore:

```typescript
export async function updateMeetingFacilitatorAction(
  meetingId: string,
  facilitatorId: string,
  updates: { name: string; bio: string; image?: string }
) {
  // 1. Fetch meeting
  // 2. Find facilitator in the meeting.facilitators array
  // 3. Update fields (name, bio, image)
  // 4. Save facilitators back to the meeting doc
}
```

### B. Waiting Room Validation (`JoiningPageClient`)
We will update the resolution effect in `src/components/joining-page-client.tsx`:
1. Check if the URL token parameter matches any facilitator's `joinLink` inside the resolved `meeting.facilitators` array.
2. If matched:
   - Set state `isFacilitator = true`.
   - Set state `facilitator` with the matching facilitator object.
   - Set page state to `'waiting'`.
   - Skip the registrant validation check entirely.

### C. Layout Design (Option 1: Two-Column Grid)
When `isFacilitator` is true, the `'waiting'` view renders:
1. **Left Column (Profile Setup)**:
   - Displays a large square avatar with a camera overlay. Clicking it triggers an hidden `<input type="file" accept="image/*">`.
   - Uploads selected files directly to Firebase Storage under `facilitator-pictures/${meeting.id}-${facilitator.id}` and retrieves the public download URL.
   - Inputs for Name and Textarea for Bio.
   - A `"Save Profile Changes"` button triggering `updateMeetingFacilitatorAction` with loading indicators.
2. **Right Column (Session Info & Join Card)**:
   - Shows meeting title, date/time, and a pulsing `"Meeting Active"` badge.
   - Displays the `"Join Meeting Now"` button which logs attendance and routes to `meeting.meetingLink` immediately (always enabled, no automatic redirection countdown).

---

## 3. UI/UX Aesthetics
* Follow glassmorphic styles with `backdrop-blur-md` and `bg-white/5` border panels.
* Smooth loading state for photo uploads and database updates using `Loader2` spinners.
* Clear toast notifications on successful profile updates.

---

## 4. Verification Plan

### Manual Verification Checklist
1. Navigate to the waiting room using a facilitator's token.
2. Confirm the page displays a two-column layout on desktop (Option 1).
3. Update the name and bio, click `"Save Profile Changes"`, and confirm that the details are updated in the database for that meeting only.
4. Upload a new photo, verify the progress spinner shows on the avatar, and confirm the image updates.
5. Click `"Join Meeting Now"` before the scheduled meeting time starts and verify it redirects immediately to the meeting link.
6. Verify that no automatic 5-second redirection triggers for the facilitator.
