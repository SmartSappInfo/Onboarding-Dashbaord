'use server';

/**
 * @fileOverview Server actions for pre-flight signup duplicate conflict detection and entity merge resolution.
 * 
 * DESIGN RATIONALE:
 * Provides pre-flight duplicate checking and intelligent merging for public signup submissions.
 * Prevents creation of duplicate institution entities while giving users full control to resolve
 * conflicts interactively before finalizing registration.
 * 
 * CAUTION AREAS FOR MAINTAINERS:
 * 1. Contact Merging: Uses `enforceContactConstraints` from `entity-contact-helpers.ts` to guarantee
 *    that single-primary and single-signatory constraints remain unbroken after merging.
 * 2. Activity Audit Trail: Log entries use source 'signup_form_merge' to distinguish merged signups
 *    from initial registrations.
 * 3. Strict Typing: Strict TypeScript interfaces used throughout (no 'any' or 'any[]').
 */

import { adminDb } from './firebase-admin';
import { findDuplicateEntities } from './entity-duplicate-detection';
import { updateEntityAction } from './entity-actions';
import { logActivity } from './activity-logger';
import { extractPrimaryContactFields, enforceContactConstraints } from './entity-contact-helpers';
import type { EntityContact } from './types';
import type { SignupInput } from './signup-actions';

/**
 * Detailed duplicate match object passed to the frontend resolution UI.
 */
export interface EnrichedDuplicateMatch {
  entityId: string;
  name: string;
  reason: string;
  primaryEmail: string;
  primaryPhone: string;
  locationString?: string;
  entityContacts: EntityContact[];
  addedAt?: string;
  updatedAt?: string;
  assignedTo?: string | null;
}

/**
 * Result returned by checkSignupDuplicatesAction.
 */
export interface SignupDuplicateCheckResult {
  hasDuplicates: boolean;
  duplicates: EnrichedDuplicateMatch[];
}

/**
 * Performs a pre-flight duplicate check for an incoming signup submission.
 * Checks for matching School Name, Primary Email, or Primary Phone in the target workspace.
 */
export async function checkSignupDuplicatesAction(
  input: SignupInput
): Promise<SignupDuplicateCheckResult> {
  try {
    const { primaryEmail, primaryPhone } = extractPrimaryContactFields({
      entityContacts: input.entityContacts || [],
    });

    // Run duplicate lookup across workspace_entities for institution type
    const rawMatches = await findDuplicateEntities(
      input.workspaceId,
      'institution',
      input.name,
      primaryEmail,
      primaryPhone
    );

    if (rawMatches.length === 0) {
      return { hasDuplicates: false, duplicates: [] };
    }

    // Enrich matched duplicate records with full details from workspace_entities
    const enrichedMatches: EnrichedDuplicateMatch[] = await Promise.all(
      rawMatches.map(async (m) => {
        let primaryEmailVal = '';
        let primaryPhoneVal = '';
        let locationStringVal = '';
        let entityContactsVal: EntityContact[] = [];
        let addedAtVal = '';
        let updatedAtVal = '';
        let assignedToVal: string | null = null;

        try {
          // Look up by doc ID format workspaceId_entityId or by entityId query
          const weDocId = `${input.workspaceId}_${m.entityId}`;
          let docSnap = await adminDb.collection('workspace_entities').doc(weDocId).get();
          
          if (!docSnap.exists) {
            const querySnap = await adminDb
              .collection('workspace_entities')
              .where('workspaceId', '==', input.workspaceId)
              .where('entityId', '==', m.entityId)
              .limit(1)
              .get();
            if (!querySnap.empty) {
              docSnap = querySnap.docs[0];
            }
          }

          if (docSnap.exists) {
            const data = docSnap.data() || {};
            primaryEmailVal = data.primaryEmail || '';
            primaryPhoneVal = data.primaryPhone || '';
            locationStringVal = data.locationString || (data.location?.locationString || '');
            entityContactsVal = Array.isArray(data.entityContacts) ? data.entityContacts : [];
            addedAtVal = data.addedAt || '';
            updatedAtVal = data.updatedAt || '';
            assignedToVal = data.assignedTo || null;
          }
        } catch (fetchErr) {
          console.warn(`[checkSignupDuplicatesAction] Could not fetch enriched record for ${m.entityId}:`, fetchErr);
        }

        return {
          entityId: m.entityId,
          name: m.name,
          reason: m.reason,
          primaryEmail: primaryEmailVal,
          primaryPhone: primaryPhoneVal,
          locationString: locationStringVal,
          entityContacts: entityContactsVal,
          addedAt: addedAtVal,
          updatedAt: updatedAtVal,
          assignedTo: assignedToVal,
        };
      })
    );

    return {
      hasDuplicates: enrichedMatches.length > 0,
      duplicates: enrichedMatches,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('>>> [SIGNUP_CONFLICT:CHECK] Failed:', errorMsg);
    // Safety fallback: if pre-flight check fails, allow flow to proceed without blocking
    return { hasDuplicates: false, duplicates: [] };
  }
}

/**
 * Merges incoming signup form submission details into an existing entity record.
 * Appends/updates contact persons, location, nominal roll, and subscription fields cleanly.
 */
export async function mergeSignupIntoEntityAction(
  targetEntityId: string,
  input: SignupInput
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  try {
    const timestamp = new Date().toISOString();

    // 1. Fetch existing entity contacts from workspace_entities
    const weDocId = `${input.workspaceId}_${targetEntityId}`;
    let existingContacts: EntityContact[] = [];
    let docSnap = await adminDb.collection('workspace_entities').doc(weDocId).get();
    
    if (!docSnap.exists) {
      const querySnap = await adminDb
        .collection('workspace_entities')
        .where('workspaceId', '==', input.workspaceId)
        .where('entityId', '==', targetEntityId)
        .limit(1)
        .get();
      if (!querySnap.empty) {
        docSnap = querySnap.docs[0];
      }
    }

    if (docSnap.exists) {
      const data = docSnap.data() || {};
      existingContacts = Array.isArray(data.entityContacts) ? data.entityContacts : [];
    }

    // 2. Intelligently merge incoming contacts with existing contacts
    const incomingContacts = input.entityContacts || [];
    const mergedContactsMap = new Map<string, EntityContact>();

    // Seed existing contacts by ID or normalized email/phone
    existingContacts.forEach((c) => {
      const key = c.id || c.email?.toLowerCase().trim() || c.phone?.trim() || `ec_${Math.random()}`;
      mergedContactsMap.set(key, { ...c });
    });

    // Merge incoming contacts
    incomingContacts.forEach((inc, idx) => {
      const existingMatchKey = Array.from(mergedContactsMap.keys()).find((k) => {
        const item = mergedContactsMap.get(k);
        if (!item) return false;
        if (inc.email?.trim() && item.email?.trim() && inc.email.trim().toLowerCase() === item.email.trim().toLowerCase()) {
          return true;
        }
        if (inc.phone?.trim() && item.phone?.trim() && inc.phone.trim() === item.phone.trim()) {
          return true;
        }
        return false;
      });

      if (existingMatchKey) {
        const existingItem = mergedContactsMap.get(existingMatchKey)!;
        mergedContactsMap.set(existingMatchKey, {
          ...existingItem,
          name: inc.name?.trim() || existingItem.name,
          email: inc.email?.trim() || existingItem.email,
          phone: inc.phone?.trim() || existingItem.phone,
          typeKey: inc.typeKey || existingItem.typeKey,
          typeLabel: inc.typeLabel || existingItem.typeLabel,
          isPrimary: inc.isPrimary !== undefined ? inc.isPrimary : existingItem.isPrimary,
          isSignatory: inc.isSignatory !== undefined ? inc.isSignatory : existingItem.isSignatory,
        });
      } else {
        const newId = inc.id || `ec_${timestamp.substring(0, 10)}_${idx}`;
        mergedContactsMap.set(newId, {
          ...inc,
          id: newId,
        });
      }
    });

    const mergedContactsList = enforceContactConstraints(Array.from(mergedContactsMap.values()));

    // 3. Build update payload for updateEntityAction
    const updateData: Record<string, unknown> = {
      name: input.name,
      entityContacts: mergedContactsList,
      location: {
        locationString: input.location,
      },
      institutionData: {
        nominalRoll: input.nominalRoll,
        billingAddress: input.billingAddress,
        currency: input.currency || 'GHS',
        subscriptionPackageId: input.subscriptionPackageId,
        subscriptionPackageName: input.subscriptionPackageName,
        subscriptionRate: input.subscriptionRate,
        discountPercentage: input.discountPercentage,
        modules: input.modules,
        implementationDate: input.implementationDate,
        referee: input.referee,
      },
    };

    // 4. Update existing entity record via updateEntityAction
    const updateResult = await updateEntityAction(
      targetEntityId,
      updateData,
      input.userId || 'system-signup-merge',
      input.workspaceId,
      input.organizationId
    );

    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update existing entity' };
    }

    // 5. Log activity record for conflict resolution merge
    await logActivity({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      entityId: targetEntityId,
      entityType: 'institution',
      displayName: input.name,
      userId: input.userId || 'system-signup-merge',
      type: 'contact_updated',
      source: 'signup_form_merge',
      description: `Merged new signup details into existing institution "${input.name}"`,
      metadata: {
        nominalRoll: input.nominalRoll,
        location: input.location,
        implementationDate: input.implementationDate,
        referee: input.referee,
        mergedAt: timestamp,
      },
    });

    return {
      success: true,
      entityId: targetEntityId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('>>> [SIGNUP_CONFLICT:MERGE] Failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
