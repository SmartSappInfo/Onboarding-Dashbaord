# Design Specification: Dynamic Waiting Room Behavior for Unique Joining Link

This document details the design specifications for updating the waiting room page (`src/components/joining-page-client.tsx`) when a participant uses their unique joining link.

## 1. Problem Statement
The current waiting room interface does not clearly differentiate its layout and typography when a meeting starts versus when a meeting is still far in the future:
* Even when `isJoinReady` is true (meeting is in progress or within the 5-minute early entry window), the title remains `"Thank you, {firstName}! 🎉"` and the description indicates `"The meeting room will open automatically when it's time."`
* The standard date-based `CountdownTimer` is still shown in the card, which is irrelevant once the meeting has already started or is ready.
* The automatic redirect behavior is not visually highlighted enough for the user to understand they are transitioning.

## 2. Proposed Changes
We will conditionally update the text and structure in `joining-page-client.tsx` based on the value of `isJoinReady`.

### State A: Meeting Not Yet Started (`isJoinReady === false`)
* Keep the existing RSVP / Confirmation layout:
  * **Badge**: `{meeting.type?.name}`
  * **Title**: `Thank you, {firstName}! 🎉`
  * **Subtitle**: `Your registration for {meetingName} has been confirmed. The meeting room will open automatically when it's time.`
  * **Card**: Displays the dynamic `CountdownTimer` counting down to the scheduled start time.

### State B: Meeting Ready / Started (`isJoinReady === true`)
* Transition the layout to focus entirely on launching:
  * **Badge**: `Meeting Active` (or a pulsing indicator tag)
  * **Title**: `Your meeting has started.`
  * **Subtitle**: `Redirecting you to the meeting room automatically. If the redirect does not occur, click the button below.`
  * **Card**: 
    * Hide the standard `CountdownTimer`.
    * Show a high-fidelity visual indicator of the redirection: a stylized circular loading indicator or a pulsing visual countdown.
    * Display the `autoRedirectCountdown` (from 5 to 1) dynamically.
    * Keep the manual `"Join Meeting Now"` button so the user can click it immediately to bypass the countdown.

## 3. UI/UX Refinement
* Follow the `frontend-design` guidelines to keep the waiting room visually premium with Glassmorphic styling, smooth hover state triggers, and clean text transitions.
* Hide the static timer values when `isJoinReady` is active.

## 4. Verification Plan
* Validate that when `isJoinReady` is true:
  1. The title changes dynamically to `"Your meeting has started."`.
  2. The 5-second countdown to automatic redirection begins immediately.
  3. The page calls `handleJoinMeeting()` at 0 and redirects the browser window location.
* Verify that the client is not blocked from clicking the join button manually if they want to join immediately.
