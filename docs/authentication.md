# Feature: Authentication & User Management

## Summary

The authentication system provides a secure way for administrators to sign up and log in to the SmartOnboard dashboard. It uses Firebase Authentication and includes a crucial authorization step to ensure only approved personnel can access sensitive data.

## Current Implementation

-   **Technology:** Firebase Authentication (Email/Password and Google Sign-In providers).
-   **Signup Flow (`/signup`):**
    1.  A new user registers with their name, email, and password or via Google Sign-In.
    2.  Upon successful registration with Firebase Auth, a corresponding user profile document is created in the `/users/{userId}` collection in Firestore.
    3.  Crucially, the `isAuthorized` field in this new document is set to `false` by default.
    4.  The user is then automatically signed out and redirected to the login page with a message informing them that their account is pending authorization.
-   **Login Flow (`/login`):**
    1.  A user signs in with their credentials.
    2.  After successful authentication with Firebase, the application's `AdminLayout` component performs an authorization check.
    3.  It fetches the user's document from Firestore (`/users/{userId}`).
    4.  It checks if the `isAuthorized` field is `true`.
        -   **If true:** The user is granted access to the admin dashboard.
        -   **If false (or if the document doesn't exist):** The user is immediately signed out, shown an "Authorization Required" message, and redirected back to the login page.
-   **User Management (`/admin/users`):**
    -   Existing authorized administrators can view a list of all users.
    -   From this page, they can toggle the `isAuthorized` switch for any user, effectively granting or revoking their access to the admin dashboard.
-   **Password Visibility:** Password fields on both login and signup forms have an "eye" icon that allows users to toggle the visibility of their password, improving usability.

## Future Enhancements

-   **Password Reset:** Implement a "Forgot Password" flow that uses Firebase Auth's built-in email-based password reset functionality.
-   **Magic Link Login:** Offer a passwordless login option where users can sign in by clicking a unique link sent to their email.
-   **Two-Factor Authentication (2FA):** For enhanced security, add an option for users to enable 2FA using an authenticator app or SMS.
-   **Invitation-Only System:** Change the signup flow so that new admin accounts can only be created via an invitation sent by an existing administrator, rather than allowing open public registration.
