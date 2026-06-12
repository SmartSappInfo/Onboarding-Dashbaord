'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { NotificationPreferences } from '@/lib/types';

/**
 * Validates a Join Code / Organization Token / Slug against the database.
 * Runs on the server side with Admin credentials, avoiding open read rules on the client.
 */
export async function validateJoinCodeAction(code: string): Promise<{
  success: boolean;
  organizationId?: string;
  organizationName?: string;
  departments?: string[];
  isConfigured?: boolean;
  error?: string;
}> {
  try {
    if (!code || !code.trim()) {
      return { success: false, error: 'Please enter an organization join code.' };
    }

    const cleanCode = code.trim().toLowerCase();

    // 1. Check organizations by slug first or prefix matching
    let matchedDoc: any = null;
    const orgsBySlug = await adminDb.collection('organizations')
      .where('slug', '==', cleanCode)
      .limit(1)
      .get();
      
    if (!orgsBySlug.empty) {
      matchedDoc = orgsBySlug.docs[0];
    } else {
      // Try querying with prefix match (slug starts with baseSlug- and is active)
      const prefixSnap = await adminDb.collection('organizations')
        .orderBy('slug')
        .startAt(cleanCode + '-')
        .endAt(cleanCode + '-\uf8ff')
        .limit(1)
        .get();
      if (!prefixSnap.empty) {
        matchedDoc = prefixSnap.docs[0];
      }
    }

    if (matchedDoc) {
      const data = matchedDoc.data();
      return { 
        success: true, 
        organizationId: matchedDoc.id, 
        organizationName: data.name,
        departments: data.departments && data.departments.length > 0 ? data.departments : ['General'],
        isConfigured: data.isConfigured || false
      };
    }

    // 2. Check organizations by custom joinToken field (case-sensitive lookup for short codes)
    const orgsByToken = await adminDb.collection('organizations')
      .where('joinToken', '==', code.trim())
      .limit(1)
      .get();

    if (!orgsByToken.empty) {
      const doc = orgsByToken.docs[0];
      const data = doc.data();
      // Provisioning-token hardening: single-use + expiry. (Slug/doc-id joins
      // above are unaffected — those are for members of an existing org.)
      if (data.joinTokenUsed === true) {
        return { success: false, error: 'This invitation link has already been used. Please ask your administrator to re-share it.' };
      }
      if (data.joinTokenExpiresAt && new Date(data.joinTokenExpiresAt).getTime() < Date.now()) {
        return { success: false, error: 'This invitation link has expired. Please ask your administrator to re-share it.' };
      }
      return {
        success: true,
        organizationId: doc.id,
        organizationName: data.name,
        departments: data.departments && data.departments.length > 0 ? data.departments : ['General'],
        isConfigured: data.isConfigured || false
      };
    }

    // 3. Fallback: Check organizations by direct document ID (exact match)
    const orgDoc = await adminDb.collection('organizations').doc(code.trim()).get();
    if (orgDoc.exists) {
      const data = orgDoc.data();
      return {
        success: true,
        organizationId: orgDoc.id,
        organizationName: data?.name || 'SmartSapp Organization',
        departments: data?.departments && data.departments.length > 0 ? data.departments : ['General'],
        isConfigured: data?.isConfigured || false
      };
    }

    return { success: false, error: 'No organization matches the provided Join Code/Token.' };
  } catch (error: any) {
    console.error('>>> [ONBOARDING:VALIDATE] Error:', error.message);
    return { success: false, error: error.message || 'Validation failed due to database error.' };
  }
}

/**
 * Resolves the onboarding wizard's initial state server-side (Admin SDK).
 *
 * The wizard previously did these reads from the client SDK, which made this
 * critical path fail on (a) restrictive security rules for pending users and
 * (b) client↔Firestore connectivity issues (WebChannel "offline mode").
 * A server action goes over plain HTTPS to the Next server and is immune to both.
 */
export async function getOnboardingSetupStateAction(userId: string): Promise<{
  success: boolean;
  error?: string;
  state?: 'no-profile' | 'already-configured' | 'ready';
  org?: { id: string; name: string };
}> {
  try {
    if (!userId) return { success: false, error: 'Not authenticated.' };

    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) return { success: true, state: 'no-profile' };

    const userData = userSnap.data() || {};
    if (!userData.organizationId) return { success: true, state: 'no-profile' };

    const orgSnap = await adminDb.collection('organizations').doc(userData.organizationId).get();
    if (!orgSnap.exists) return { success: true, state: 'no-profile' };

    const orgData = orgSnap.data() || {};
    if (orgData.isConfigured === true) {
      return { success: true, state: 'already-configured' };
    }

    return {
      success: true,
      state: 'ready',
      org: { id: orgSnap.id, name: orgData.name || 'Your Organization' },
    };
  } catch (error: any) {
    console.error('>>> [ONBOARDING:SETUP-STATE] Error:', error.message);
    return { success: false, error: error.message || 'Failed to load setup state.' };
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

/**
 * Updates the user's document in Firestore with their onboarding details.
 * Sets profileCompleted to true and approvalStatus to 'pending' to trigger the awaiting state.
 */
export async function submitOnboardingProfileAction(input: OnboardingInput): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!input.userId) {
      return { success: false, error: 'Authentication details are missing.' };
    }
    if (!input.name.trim()) {
      return { success: false, error: 'Full Name is required.' };
    }
    if (!input.organizationId) {
      return { success: false, error: 'You must link your account to an organization.' };
    }

    const userRef = adminDb.collection('users').doc(input.userId);
    const userSnap = await userRef.get();

    const existingData = userSnap.exists ? userSnap.data() || {} : {};

    // Get default workspaces in this organization to pre-assign
    const workspacesSnap = await adminDb.collection('workspaces')
      .where('organizationId', '==', input.organizationId)
      .get();
    
    // Auto-assign to workspaces in this organization if they exist, or default to empty array
    const workspaceIds = workspacesSnap.docs.map(doc => doc.id);

    await userRef.set({
      ...existingData,
      id: input.userId,
      name: input.name,
      phone: input.phone,
      department: input.department,
      organizationId: input.organizationId,
      workspaceIds: workspaceIds,
      notificationPreferences: input.notificationPreferences,
      profileCompleted: true,
      isAuthorized: false,
      approvalStatus: 'pending',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
    console.error('>>> [ONBOARDING:SUBMIT] Error:', error.message);
    return { success: false, error: error.message || 'An error occurred during onboarding profile update.' };
  }
}

// Define super admin permissions list
const SUPER_ADMIN_PERMISSIONS = [
  'schools_view', 'schools_edit', 'prospects_view', 'prospects_edit',
  'finance_view', 'finance_manage', 'contracts_delete',
  'studios_view', 'studios_edit', 'system_admin', 'system_user_switch',
  'meetings_manage', 'tasks_manage', 'activities_view',
];

/**
 * Organization-level administrator permissions: full operational control of
 * their OWN organization, but never `system_admin` / `system_user_switch` —
 * those make the holder a platform super admin (the Firestore rules'
 * `isSystemAdmin()` and the org switcher both key off `system_admin`, which
 * would let an invited org admin see and switch into every organization).
 */
const ORG_ADMIN_PERMISSIONS = SUPER_ADMIN_PERMISSIONS.filter(
  p => p !== 'system_admin' && p !== 'system_user_switch'
);

/**
 * Checks if the user's email is a designated super admin in system_config/super_admins.
 * If yes, updates their user profile in Firestore securely using admin privileges,
 * granting full permissions and bypassing onboarding screens.
 */
export async function enforceSuperAdminProfileAction(uid: string, email: string, name: string): Promise<{
  success: boolean;
  isSuperAdmin: boolean;
  error?: string;
}> {
  try {
    if (!email) return { success: false, isSuperAdmin: false };

    const lowerEmail = email.toLowerCase();

    // Fetch super admins config
    const configDoc = await adminDb.collection('system_config').doc('super_admins').get();
    const emails: string[] = configDoc.exists ? configDoc.data()?.emails || [] : [];

    const isSuperAdmin = emails.includes(lowerEmail);

    if (isSuperAdmin) {
      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      const existingData = userSnap.exists ? userSnap.data() || {} : {};

      await userRef.set({
        ...existingData,
        id: uid,
        name: name || existingData.name || 'Super Admin',
        email: lowerEmail,
        isAuthorized: true,
        profileCompleted: true,
        approvalStatus: 'approved',
        organizationId: 'smartsapp-hq',
        workspaceIds: ['onboarding', 'prospect'],
        roles: ['administrator'],
        permissions: SUPER_ADMIN_PERMISSIONS,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      return { success: true, isSuperAdmin: true };
    }

    return { success: true, isSuperAdmin: false };
  } catch (error: any) {
    console.error('>>> [AUTH:SUPERADMIN] Error:', error.message);
    return { success: false, isSuperAdmin: false, error: error.message };
  }
}

interface CompleteOnboardingInput {
  userId: string;
  organizationId: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
    fontFamily: string;
    settings: {
      defaultLanguage: string;
      timezone: string;
      currency: string;
    };
  };
  workspace: {
    name: string;
    contactScope: 'institution' | 'family' | 'person';
    industry: 'SaaS' | 'SchoolEnrollment' | 'Law' | 'Marketing' | 'RealEstate' | 'Consultancy';
  };
}

/**
 * Transactionally completes the organization's onboarding:
 * 1. Verifies that the organization is not already configured.
 * 2. Saves branding and sets isConfigured to true.
 * 3. Provisions the first workspace.
 * 4. Assigns user roles/permissions as organization Administrator.
 */
export async function completeOrganizationOnboardingAction(
  input: CompleteOnboardingInput
): Promise<{ success: boolean; error?: string; code?: string; workspaceId?: string }> {
  try {
    if (!input.userId) {
      return { success: false, error: 'User ID is required.' };
    }
    if (!input.organizationId) {
      return { success: false, error: 'Organization ID is required.' };
    }
    if (!input.workspace.name.trim()) {
      return { success: false, error: 'Workspace Name is required.' };
    }

    const timestamp = new Date().toISOString();

    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection('users').doc(input.userId);
      const orgRef = adminDb.collection('organizations').doc(input.organizationId);

      const userSnap = await transaction.get(userRef);
      const orgSnap = await transaction.get(orgRef);

      if (!userSnap.exists) {
        throw new Error('User profile not found.');
      }
      if (!orgSnap.exists) {
        throw new Error('Organization not found.');
      }

      const userData = userSnap.data() || {};
      const orgData = orgSnap.data() || {};

      // Security check
      if (userData.organizationId !== input.organizationId) {
        throw new Error('Security restriction: Organization mismatch.');
      }

      // Concurrency check
      if (orgData.isConfigured === true) {
        return { success: false, code: 'ALREADY_CONFIGURED', error: 'Organization has already been configured.' };
      }

      // Update Org settings
      transaction.update(orgRef, {
        'settings.defaultLanguage': input.branding.settings.defaultLanguage || 'en',
        'settings.timezone': input.branding.settings.timezone || 'UTC',
        'settings.currency': input.branding.settings.currency || 'USD',
        'settings.branding.primaryColor': input.branding.primaryColor || '#10b981',
        'settings.branding.secondaryColor': input.branding.secondaryColor || '#3b82f6',
        'settings.branding.logoUrl': input.branding.logoUrl || '',
        'settings.branding.fontFamily': input.branding.fontFamily || 'Inter',
        isConfigured: true,
        // Consume the provisioning join token now that the org is configured.
        // (Consumed here, not at validation, so a dropped session doesn't burn it.)
        joinTokenUsed: true,
        joinTokenUsedAt: timestamp,
        updatedAt: timestamp,
      });

      // Provision new workspace
      const workspaceRef = adminDb.collection('workspaces').doc();
      const workspaceId = workspaceRef.id;

      const workspaceData = {
        id: workspaceId,
        organizationId: input.organizationId,
        name: input.workspace.name.trim(),
        status: 'active',
        statuses: [],
        contactScope: input.workspace.contactScope || 'person',
        industry: input.workspace.industry || 'Consultancy',
        industryScopeLocked: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      transaction.set(workspaceRef, workspaceData);

      // Update User permissions
      const currentWorkspaces = userData.workspaceIds || [];
      const workspaceIds = Array.from(new Set([...currentWorkspaces, workspaceId]));
      const workspaceRoles = {
        ...(userData.workspaceRoles || {}),
        [workspaceId]: ['administrator'],
      };
      const workspacePermissions = {
        ...(userData.workspacePermissions || {}),
        [workspaceId]: ORG_ADMIN_PERMISSIONS,
      };

      transaction.update(userRef, {
        isAuthorized: true,
        approvalStatus: 'approved',
        roles: ['administrator'],
        permissions: ORG_ADMIN_PERMISSIONS,
        workspaceIds,
        workspaceRoles,
        workspacePermissions,
        lastActiveWorkspaceId: workspaceId,
        updatedAt: timestamp,
      });

      return { success: true, workspaceId };
    });

    return transactionResult;
  } catch (err: any) {
    console.error('>>> [ONBOARDING:COMPLETE] Error:', err.message);
    return { success: false, error: err.message || 'Transaction failed.' };
  }
}
