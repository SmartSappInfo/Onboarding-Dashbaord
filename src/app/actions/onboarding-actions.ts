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
  error?: string;
}> {
  try {
    if (!code || !code.trim()) {
      return { success: false, error: 'Please enter an organization join code.' };
    }

    const cleanCode = code.trim().toLowerCase();

    // 1. Check organizations by slug first
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

    // 2. Check organizations by custom joinToken field (case-sensitive lookup for short codes)
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

    // 3. Fallback: Check organizations by direct document ID (exact match)
    const orgDoc = await adminDb.collection('organizations').doc(code.trim()).get();
    if (orgDoc.exists) {
      return {
        success: true,
        organizationId: orgDoc.id,
        organizationName: orgDoc.data()?.name || 'SmartSapp Organization'
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
