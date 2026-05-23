# Self-Signup Profile Onboarding Flow Implementation Plan

**Goal:** Allow self-signup users to successfully authenticate, complete a profile setup wizard (providing name, phone, department, organization code/slug, and notifications), and place them in an "Awaiting Approval" state scoped to that organization, rather than immediately signing them out and blocking them.

**Architecture:** Route-based auth guards in root layout / dashboard client that intercept un-onboarded users. Safe Server Actions for lookup and updates, bypassing strict client-side Firestore write limitations. Real-time Firestore snapshot listeners to automatically transition approved users.

**Tech Stack:** Next.js (App Router), Firebase Client SDK, Firebase Admin SDK (Server Actions), Tailwind CSS, Framer Motion, Radix UI.

---

## User Review Required

> [!WARNING]
> **Firebase Auth Disabling Flow Changes**:
> Currently, the system disables users in Firebase Auth (`auth.updateUser(uid, { disabled: true })`) when access is revoked. In the new flow:
> * Self-signup users **must not** be disabled in Firebase Auth when `isAuthorized` is false; they must be allowed to authenticate so they can view the `/awaiting-approval` screen and `/profile-setup` wizard.
> * Users are only disabled in Firebase Auth if they are explicitly marked as `rejected` or deactivated by a backoffice/org administrator.

> [!IMPORTANT]
> **Strict Organization Validation**:
> We will validate organization codes using a Server Action (`validateJoinCodeAction`) that queries Firestore using the Admin SDK. This prevents raw database read rules from leaking private tenant information to unauthenticated client sessions.

---

## Proposed Changes

### Component 1: Types & Data Layer

#### [MODIFY] [types.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/types.ts)
* Update `UserProfile` type to support onboarding state fields.
```typescript
// Add to UserProfile interface (approx line 614):
profileCompleted: boolean;
department?: string;
approvalStatus?: 'pending' | 'approved' | 'rejected';
```

---

### Component 2: Onboarding Server Actions

#### [NEW] [onboarding-actions.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/actions/onboarding-actions.ts)
* Create `validateJoinCodeAction` to lookup an organization by slug or join token.
* Create `submitOnboardingProfileAction` to update user document in Firestore and set state.
```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { NotificationPreferences } from '@/lib/types';

export async function validateJoinCodeAction(code: string) {
  try {
    const cleanCode = code.trim().toLowerCase();
    
    // Check organizations by slug first
    const orgsBySlug = await adminDb.collection('organizations')
      .where('slug', '==', cleanCode)
      .limit(1)
      .get();
      
    if (!orgsBySlug.empty) {
      const doc = orgsBySlug.docs[0];
      return { 
        success: true, 
        organizationId: doc.id, 
        organizationName: doc.data().name 
      };
    }

    // Check organizations by joinToken custom field
    const orgsByToken = await adminDb.collection('organizations')
      .where('joinToken', '==', code.trim())
      .limit(1)
      .get();

    if (!orgsByToken.empty) {
      const doc = orgsByToken.docs[0];
      return { 
        success: true, 
        organizationId: doc.id, 
        organizationName: doc.data().name 
      };
    }

    // Check organizations by direct document ID (fallback)
    const orgDoc = await adminDb.collection('organizations').doc(code.trim()).get();
    if (orgDoc.exists) {
      return {
        success: true,
        organizationId: orgDoc.id,
        organizationName: orgDoc.data()?.name || 'SmartSapp Organization'
      };
    }

    return { success: false, error: 'Organization not found. Check your token or slug.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Validation failed.' };
  }
}

interface OnboardingInput {
  userId: string;
  name: string;
  phone: string;
  department: string;
  organizationId: string;
  notificationPreferences: NotificationPreferences;
}

export async function submitOnboardingProfileAction(input: OnboardingInput) {
  try {
    const userRef = adminDb.collection('users').doc(input.userId);
    const userSnap = await userRef.get();
    
    const existingData = userSnap.exists ? userSnap.data() : {};
    
    await userRef.set({
      ...existingData,
      id: input.userId,
      name: input.name,
      phone: input.phone,
      department: input.department,
      organizationId: input.organizationId,
      notificationPreferences: input.notificationPreferences,
      profileCompleted: true,
      isAuthorized: false,
      approvalStatus: 'pending',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to submit profile.' };
  }
}
```

---

### Component 3: Route Guard Update

#### [MODIFY] [layout-client.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/layout-client.tsx)
* Update redirection checks to send users to `/profile-setup` or `/awaiting-approval` instead of immediately logging out.
```typescript
// Replace lines 98-106:
if (docSnap.exists()) {
  const data = docSnap.data();
  
  // 1. Check if profile onboarding is complete
  if (data.profileCompleted === false || !data.profileCompleted) {
    setLoaderStatus('success');
    router.push('/profile-setup');
    return;
  }

  // 2. Check authorization
  if (data.isAuthorized === false) {
    if (data.approvalStatus === 'pending') {
      setLoaderStatus('success');
      router.push('/awaiting-approval');
      return;
    } else {
      // Explicitly rejected or blocked
      setLoaderStatus('failed');
      toast({ variant: "destructive", title: 'Access Denied', description: 'Your access request was rejected or revoked.' });
      setTimeout(() => { 
        auth.signOut(); 
        router.push('/login'); 
      }, 1500);
      return;
    }
  }
  
  // Rest of role checks...
} else {
  // New auth user with no profile doc yet - send to profile-setup
  setLoaderStatus('success');
  router.push('/profile-setup');
}
```

---

### Component 4: Auth Forms Flow

#### [MODIFY] [page.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/signup/page.tsx)
* Remove `await auth.signOut()` call immediately after creation.
* Redirect to `/admin` where `layout-client.tsx` will route them to `/profile-setup`.
```typescript
// In onSubmit (around lines 80-88):
// REMOVE: await auth.signOut();
// REPLACE: router.push('/login'); WITH:
router.push('/admin');

// In handleGoogleSignIn (around lines 145-153):
// REMOVE: await auth.signOut();
// REPLACE: router.push('/login'); WITH:
router.push('/admin');
```

#### [MODIFY] [page.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/login/page.tsx)
* Prevent automatic logouts for pending users during standard email/Google sign-in.
```typescript
// Replace lines 168-173:
if (data.profileCompleted === false || !data.profileCompleted) {
  router.push('/admin');
} else if (data.isAuthorized === false && data.approvalStatus === 'pending') {
  router.push('/admin');
} else if (data.isAuthorized === false) {
  await auth.signOut();
  toast({ ... });
}
```

---

### Component 5: Onboarding & Waiting Screen UIs

#### [NEW] [page.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/profile-setup/page.tsx)
* Implements a premium visual multistepper profile onboarding setup.
* Validates codes via `validateJoinCodeAction`.
* Submits via `submitOnboardingProfileAction`.

#### [NEW] [page.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/awaiting-approval/page.tsx)
* Implements the await dashboard UI with real-time `onSnapshot` listener. Once authorized, routes to `/admin`.

---

### Component 6: Admin Backoffice & Approval UI

#### [MODIFY] [OrganizationsClient.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/settings/organizations/OrganizationsClient.tsx)
* Render the organization slug or ID on each card with a quick copy button so admins can easily share it.

#### [MODIFY] [UsersClient.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/users/UsersClient.tsx)
* Render a pending verification icon or "Awaiting Approval" badge for users with `approvalStatus === 'pending'`.
* Show "Approve Access" button inside the User details panel or actions to set `isAuthorized = true` and `approvalStatus = 'approved'`.

---

## Verification Plan

### Automated Tests
* Create unit test `src/app/actions/__tests__/onboarding-actions.test.ts` to mock Firestore `adminDb` and test validation/submission.
* Run tests:
```bash
pnpm test:run src/app/actions/__tests__/onboarding-actions.test.ts
```

### Manual Verification
1. Sign up a new user via `/signup`. Verify they are redirected straight to `/profile-setup` without getting logged out.
2. Enter an invalid join code. Confirm error message states "Organization not found".
3. Enter a valid organization slug. Confirm organization name is resolved and displayed.
4. Submit the profile wizard with name, phone, department, and notification toggles.
5. Verify redirect to `/awaiting-approval` with pulsing radar animation.
6. Open admin dashboard in a separate incognito browser. Go to `/admin/users`. Locate the new user in the members list showing "Awaiting Approval".
7. Click "Approve Access". Check if the self-signup user's screen in the original browser automatically transitions and redirects to `/admin` dashboard.
