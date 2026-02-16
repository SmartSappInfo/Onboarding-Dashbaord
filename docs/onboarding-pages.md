# Feature: Dynamic Onboarding Pages

## Summary

This feature is the public-facing core of the SmartOnboard application. It provides dynamically generated, school-specific landing pages for various meeting types (Parent Engagement, Kickoff, Training). These pages serve as a central hub for parents and staff to get meeting information, watch informational videos, and download the SmartSapp app.

## Current Implementation

-   **Routing:** The pages are handled via Next.js Dynamic Routes. The URL structure is `/meetings/[meetingType]/[schoolSlug]`.
-   **Data Fetching:** The `school-meeting-loader.tsx` component is the primary client-side data loader.
    1.  It extracts the `schoolSlug` and `meetingType` from the URL.
    2.  It queries Firestore to find a `School` document that matches the `schoolSlug`.
    3.  It then queries for all `Meeting` documents associated with that school's ID.
    4.  Client-side logic filters these meetings to find the one matching the `meetingType` slug. It prioritizes upcoming meetings but will show the most recent past meeting if no future ones are scheduled.
-   **Component Structure:**
    -   `SchoolMeetingLoader`: Orchestrates data loading and displays either a skeleton loader, a "Not Found" message, or the appropriate meeting layout.
    -   **Hero Components** (`MeetingHero`, `KickoffMeetingHero`, `TrainingMeetingHero`): Display school branding, meeting details, and a countdown timer. They contain logic to automatically switch between the "Join Meeting" form, a "Meeting has ended" message, and a "Watch Recording" button based on the current time and the presence of a `recordingUrl`.
    -   **Content Sections**: Reusable components like `WelcomeSection`, `AppDownloadSection`, `RecordingSection`, `HelpSection`, etc., are conditionally rendered based on the meeting data.
-   **Styling:** Pages are hard-coded to use a dark theme for a consistent, premium public-facing experience. Smooth scrolling and scroll-snapping are enabled via global CSS for a polished feel.

## Future Enhancements

-   **Server-Side Rendering (SSR):** Convert the pages to be fully server-rendered for improved SEO and faster initial load times. This would involve moving data fetching logic into a server-side `page.tsx` file.
-   **Customizable Content Blocks:** Allow administrators to add, remove, or reorder content sections (e.g., testimonials, help videos) for each meeting page directly from the admin dashboard.
-   **Personalized Greetings:** If a user's name is captured in the "Join Meeting" form, greet them by name upon joining the meeting platform.
-   **Multi-Language Support:** Add functionality to display page content in multiple languages based on user preference or browser settings.
