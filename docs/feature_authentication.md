
# Feature: Authentication & User Management

## Purpose

To provide a secure system for administrator registration, login, and access control. This feature ensures that only approved personnel can access the administrative sections of the application.

## Actors

- **Prospective Administrator:** An individual who does not yet have an account.
- **Registered Administrator (Unauthorized):** A user who has created an account but has not yet been granted access by an existing admin.
- **Authorized Administrator:** A user who can access the admin dashboard and manage other users.

## Entry Points

- **Signup:** A user navigates to the `/signup` route.
- **Login:** A user navigates to the `/login` route.
- **User Management:** An authorized administrator navigates to the `/admin/users` route.
- **Authorization Check:** This is triggered automatically whenever any route under `/admin` is accessed.

## Data Model

This feature uses two systems:
1.  **Firebase Authentication:** Stores the core user credential (email/password or Google OAuth token). This is the source of the user's `uid`.
2.  **Firestore Collection:** `/users`
    -   **Document ID:** User's `uid` from Firebase Auth.
    -   **Schema (`UserProfile`):**
        -   `id` (string): The document ID, same as the user's `uid`.
        -   `name` (string): The user's full name.
        -   `email` (string): The user's email address.
        -   `phone` (string, optional): The user's phone number.
        -   `photoURL` (string, optional): A URL to the user's profile picture.
        -   `isAuthorized` (boolean): The critical flag that grants or denies access to the admin dashboard.
        -   `createdAt` (ISO string): The timestamp when the user document was created.

## Workflow

1.  **Signup Workflow (`/signup`):**
    -   A user provides their name, email, and password, or uses the Google Sign-In button.
    -   A new user is created in Firebase Authentication.
    -   Simultaneously, a new document is created in the `/users` collection in Firestore with the user's `uid` as the document ID.
    -   In this new document, the `isAuthorized` field is explicitly set to `false`.
    -   The system then immediately signs the user out.
    -   The user is redirected to the `/login` page with a notification that their account is pending authorization.

2.  **Login Workflow (`/login`):**
    -   A user signs in using their email/password or Google Sign-In.
    -   Firebase Authentication verifies their credentials.
    -   Upon successful authentication, the user is redirected to `/admin`.

3.  **Authorization Workflow (`/admin/layout.tsx`):**
    -   The `AdminLayout` component, which wraps all admin pages, detects the authenticated user.
    -   It uses the user's `uid` to fetch the corresponding document from the `/users` collection.
    -   It checks the value of the `isAuthorized` field.
    -   **If `true`:** Access is granted, and the requested admin page is rendered.
    -   **If `false` (or the document doesn't exist):** The user is immediately signed out from Firebase Auth, a "Permission Denied" notification is shown, and they are redirected back to the `/login` page.

4.  **User Management Workflow (`/admin/users`):**
    -   An authorized administrator views a table of all users fetched from the `/users` collection.
    -   The table displays each user's details and a toggle switch corresponding to their `isAuthorized` status.
    -   When an admin flips the switch for a user, an `updateDoc` call is made to Firestore to change the boolean value of the `isAuthorized` field for that user's document.

## Business Rules

-   A user's existence in Firebase Authentication is not sufficient for access; the `isAuthorized` flag in their Firestore document must be `true`.
-   All new signups default to `isAuthorized: false`.
-   Only an existing, authorized administrator can change the `isAuthorized` status of another user.

## Integrations

-   **Firebase Authentication:** The primary service for credential management and identity verification.
-   **Firebase Firestore:** Used as the authorization database, storing the critical `isAuthorized` flag.
-   **Administrative Dashboard Feature:** The authorization check is the entry gate for the entire admin dashboard.

## State Changes

-   **Create:** A new user record is created in Firebase Authentication. A new document is created in the `/users` collection in Firestore.
-   **Update:** An administrator can update the `isAuthorized` field on any document in the `/users` collection.

## Files Involved

-   `src/app/signup/page.tsx`: The UI and logic for the user registration form.
-   `src/app/login/page.tsx`: The UI and logic for the user login form.
-   `src/app/admin/layout.tsx`: Contains the critical authorization check logic that runs after a user logs in and tries to access an admin page.
-   `src/app/admin/users/page.tsx`: The UI for managing user authorization status.
-   `src/firebase/provider.tsx`: Manages the global user authentication state via `onAuthStateChanged`.
-   `firestore.rules`: Defines security rules, specifying who can read and write user profile documents.

## What This Feature Does NOT Do

-   It does not implement role-based access control (RBAC) beyond a single "authorized" vs. "unauthorized" state.
-   It does not handle password reset functionality.
-   It does not allow users to edit their own profiles (this is a separate feature).

## Extension Guidelines

-   To add more user roles (e.g., "Editor", "Viewer"), the `isAuthorized` boolean should be replaced with a `role` (string) field in the `UserProfile` type and Firestore documents. The authorization check in `AdminLayout` would then need to be updated to check for a list of allowed roles instead of a simple boolean.
-   The `firestore.rules` would need to be updated to allow for more granular permissions based on this new `role` field.
