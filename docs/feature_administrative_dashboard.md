
# Feature: Administrative Dashboard

## Purpose

To provide a secure, centralized, and feature-rich back-office environment for administrators to manage all aspects of the SmartOnboard platform. This includes school and meeting management, content organization, and system monitoring.

## Actors

- **Administrator:** A user whose profile in Firestore has the `isAuthorized` flag set to `true`. This is the only actor who can access this feature.

## Entry Points

- **Primary Route:** `/admin`. Accessing any route under `/admin/*` initiates the feature's authorization check.
- **Dashboard Widgets:** Administrators interact with individual data widgets (e.g., "Upcoming Meetings", "Pipeline Pie Chart") on the main dashboard page (`/admin`).
- **CRUD Operations:** Administrators interact with tables, forms, and modals to create, read, update, and delete data for schools, meetings, media, surveys, etc., via their respective pages (e.g., `/admin/schools`, `/admin/meetings/new`).
- **Kanban Board:** Administrators drag and drop school cards between columns on the `/admin/pipeline` page.

## Data Model

This feature is a primary consumer of almost all data models in Firestore:
- `schools/{schoolId}`: For all school data.
- `meetings/{meetingId}`: For all meeting data.
- `media/{mediaId}`: For all media assets.
- `surveys/{surveyId}`: For all survey data.
- `onboardingStages/{stageId}`: For defining the Kanban pipeline stages.
- `users/{userId}`: For assigning schools to users and for user management.
- `activities/{activityId}`: For displaying activity timelines.
- `dashboardLayouts/{userId}`: Stores the personalized order of dashboard widgets for each administrator. Contains a single field `componentIds` (array of strings).

## Workflow

1.  An administrator navigates to any URL under `/admin`.
2.  The `AdminLayout` component is rendered. It immediately checks for an authenticated user.
3.  It then fetches the user's profile from `/users/{userId}` in Firestore.
4.  It validates if the `isAuthorized` field is `true`.
    -   If `true`, the `AuthorizationLoader` shows a success message, and the main dashboard content is rendered.
    -   If `false` or the document is missing, the `AuthorizationLoader` shows a failure message, the user is signed out, and redirected to `/login`.
5.  Once authorized, the main dashboard at `/admin` fetches aggregated data via the `getDashboardData` server-side function.
6.  The `DashboardGrid` component renders a set of widgets. It fetches the user's preferred layout from `dashboardLayouts/{userId}`.
7.  Users can drag and drop these widgets to reorder them. On drop, the new order is persisted back to the user's `dashboardLayouts` document.
8.  Navigation to other admin pages (e.g., `/admin/schools`) renders specialized interfaces for managing that data (e.g., a data table of schools).
9.  The `GlobalFilterProvider` and `AssignedUserGlobalFilter` components work together to filter data shown on various pages (Schools, Meetings) based on which user a school is assigned to. The filter state is persisted in `sessionStorage` and synced with the `assignedTo` URL query parameter.

## Business Rules

- **Authorization:** Access to all `/admin` routes is strictly gated by the `isAuthorized: true` flag in a user's Firestore document.
- **Widget Layout:** Each user's dashboard layout is unique and stored separately. The default layout is hard-coded in `DashboardGrid.tsx`.
- **Global Filtering:** The assigned user filter applies across multiple pages and persists for the user's session.
- **Data Integrity:** Forms for creating and editing data (schools, meetings) use `zod` for validation before submitting to Firestore.

## Integrations

- **Authentication Feature:** Relies on the authentication system to identify the user and check their authorization status.
- **Firebase Firestore:** The primary data source and sink for all managed entities.
- **dnd-kit Library:** Used for drag-and-drop functionality on the dashboard grid and the pipeline Kanban board.
- **Recharts Library:** Used to render charts and graphs on the dashboard.
- **Genkit AI Feature:** Invoked for tasks like generating surveys and fetching link metadata.

## State Changes

- **Create/Update/Delete:** The dashboard is the primary interface for mutating `schools`, `meetings`, `media`, `surveys`, and other core Firestore documents.
- **Update `dashboardLayouts`:** A user's widget order is updated in their specific document in this collection.
- **Update `schools.stage`:** Dragging a school card on the pipeline board updates the `stage` field of the corresponding `School` document.

## Files Involved

- `src/app/admin/layout.tsx`: The root layout for the entire admin section. Manages authorization checks and renders the main sidebar navigation.
- `src/app/admin/page.tsx`: The main dashboard homepage, which fetches initial data and renders the widget grid.
- `src/app/admin/components/DashboardGrid.tsx`: Manages the state, rendering, and drag-and-drop functionality of the dashboard widgets.
- `src/app/admin/components/DraggableCard.tsx`: A wrapper component that makes dashboard widgets sortable.
- `src/app/admin/pipeline/components/KanbanBoard.tsx`: Implements the drag-and-drop board for managing school pipeline stages.
- `src/components/dashboard/*`: Individual widget components displayed on the dashboard.
- `src/context/GlobalFilterProvider.tsx`: A React context provider that manages the global filter state for "Assigned To".
- `src/app/admin/components/AssignedUserGlobalFilter.tsx`: The UI component (a dropdown) for changing the global user filter.

## What This Feature Does NOT Do

- It does not define the public-facing UI of the application.
- It does not handle the initial signup or login process itself, only the authorization check *after* login.
- It does not define the data schemas, but rather provides an interface to interact with them.

## Extension Guidelines

- To add a new management page, create a new route under `/admin`, add a link to it in the `navItems` array in `src/app/admin/layout.tsx`, and ensure all data access is guarded by checks for an authorized administrator.
- To add a new dashboard widget, create a new React component, add it to the `componentMap` in `DashboardGrid.tsx`, and add logic to fetch its required data in `src/lib/dashboard.ts`.
