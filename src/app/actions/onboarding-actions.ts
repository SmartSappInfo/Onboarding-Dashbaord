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
  error?: string;
}> {
  try {
    if (!code || !code.trim()) {
      return { success: false, error: 'Please enter an organization join code.' };
    }

    const cleanCode = code.trim().toLowerCase();

    // 1. Check organizations by slug first
    // 1. Check organizations by slug prefix (supporting dynamic suffixes) or exact slug match
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
        departments: data.departments && data.departments.length > 0 ? data.departments : ['General']
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
      return { 
        success: true, 
        organizationId: doc.id, 
        organizationName: data.name,
        departments: data.departments && data.departments.length > 0 ? data.departments : ['General']
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
        departments: data?.departments && data.departments.length > 0 ? data.departments : ['General']
      };
    }

    return { success: false, error: 'No organization matches the provided Join Code/Token.' };
  } catch (error: any) {
    console.error('>>> [ONBOARDING:VALIDATE] Error:', error.message);
    return { success: false, error: error.message || 'Validation failed due to database error.' };
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
