# Feature: Administrative Dashboard

## Summary

The Administrative Dashboard is a secure, feature-rich back-office for managing the entire SmartOnboard platform. It provides administrators with the tools to manage schools, meetings, media assets, surveys, and user access.

## Current Implementation

-   **Layout & Navigation:**
    -   A collapsible sidebar (`src/components/ui/sidebar.tsx`) provides primary navigation.
    -   A central `AdminLayout` (`src/app/admin/layout.tsx`) wraps all admin pages, handling authorization checks and providing a consistent header and structure.
    -   The dashboard homepage (`src/app/admin/page.tsx`) features a customizable grid of widgets using `dnd-kit` for drag-and-drop functionality. Layout preferences are saved per-user in Firestore.
-   **Core Modules:**
    -   **School Management:** Create, Read, Update, and Delete (CRUD) operations for school records. Includes a table view with sorting/filtering and a detailed fly-out modal for viewing school information.
    -   **Meeting Management:** Schedule and manage meetings for each school. The system automatically generates public-facing links.
    -   **Pipeline View:** A Kanban-style board (`src/app/admin/pipeline/`) allows admins to visually track a school's progress through the onboarding stages by dragging and dropping school cards between columns.
    -   **Media Library:** A central repository for uploading and managing images, videos, and documents. Includes a client-side image editor for cropping and optimization before upload.
    -   **Survey Builder:** Create and manage surveys using a multi-step form builder. Includes logic blocks for conditional questions and a preview mode.
    -   **Activity Feed:** A global timeline that logs important user and system actions, providing a comprehensive audit trail.
-   **Authorization:**
    -   Access to `/admin` is protected. The `AdminLayout` component checks if the logged-in user has the `isAuthorized` flag set to `true` in their Firestore user profile. Unauthorized users are redirected to the login page.
-   **Global Filtering:** A `GlobalFilterProvider` allows users to filter data across different dashboard pages (e.g., show only schools assigned to "User X"). The filter state is persisted in `sessionStorage` and synced with URL query parameters.

## Future Enhancements

-   **Role-Based Access Control (RBAC):** Introduce more granular permissions beyond a simple `isAuthorized` flag. For example, roles like "Sales," "Onboarding Specialist," or "Support" could have access to different modules or actions.
-   **Enhanced Reporting:** Build a dedicated "Reports" section with more advanced data visualizations, date-range filtering, and the ability to export reports as PDF or Excel files.
-   **Bulk Actions:** Add the ability to perform bulk actions on the schools and meetings tables, such as assigning multiple schools to a user at once or archiving old meetings.
-   **Notifications Center:** Create an in-app notification center to alert admins of important events, such as a new school signup or a completed survey.
