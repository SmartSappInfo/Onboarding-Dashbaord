/**
 * @fileOverview Entity domain core (agents_mcp PR-1 / N1, same pattern as the deal and task cores).
 *
 * WHY THIS FILE IS NOT `'use server'`: these functions trust their `actor`. They used to be the
 * exported Server Actions `createEntityAction` / `updateEntityAction`, which took the user id from
 * the caller and skipped every permission check for any id starting with `system-`. Only server
 * code that has already established who is calling may import this module (the session wrappers
 * in `entity-actions.ts`, automations, call centre, forms, surveys, imports, the API routes).
 * Never re-export these functions from a `'use server'` module.
 *
 * Permission model: a user actor needs operations/campuses create/edit in the workspace; a service
 * actor must be pinned to that workspace. Updates also require the entity to be linked to it.
 */

import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { logActivity } from '@/lib/activity-logger';
import { revalidatePath } from 'next/cache';
import type { EntityType, EntityContact, Tag, WorkspaceEntity } from '@/lib/types';
import crypto from 'crypto';
import {
  enforceContactConstraints,
  extractPrimaryContactFields,
  normalizeContactType,
} from '@/lib/entity-contact-helpers';
import { type DuplicateMatch, findDuplicateEntities } from '@/lib/entity-duplicate-detection';
import { getWorkspaceIndustry, invalidateWorkspaceCache } from '@/lib/industry-cache';
import { validateIndustryData } from '@/lib/industry-schemas';
import { normalizePhoneNumber } from '@/lib/phone-utils';
import { resolveOrganizationCountryCode } from '@/lib/organization-country';
import { after } from 'next/server';
import { BulkVerificationService } from '@/lib/bulk-verifier';
import { BulkPhoneVerificationService } from '@/lib/bulk-phone-verifier';
import { applyIndustryDataDefaults } from '@/lib/entity-utils';
import { withEntitySearchFields } from '@/lib/entities/entity-cache-domain';
import { syncContactProjectionForWE } from '@/lib/contacts/contact-projection-writer';
import { zoneOrUnassigned } from '@/lib/zone-constants';
import { getErrorMessage } from '@/lib/errors/report-error';
import { canUser } from '@/lib/workspace-permissions';
import { type CrmActor, workspaceOrganizationId } from './deal-core';

/**
 * Boundary schema for entity create/update payloads (Rule 4: replaces `data: any`).
 * Known fields are typed; unknown fields pass through untouched, so no caller loses data.
 */
const objectish = z.record(z.string(), z.unknown());
/** A contact in the canonical EntityContact shape (validated as a plain object; fields pass through). */
const entityContactSchema = z.custom<EntityContact>(
  (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  { message: 'Each contact must be an object.' }
);
const placeRef = z.object({ id: z.string().optional() }).passthrough().nullish();
/** Location as written by the entity forms. A malformed zone falls back to Unassigned. */
const locationSchema = z.object({
  locationString: z.string().optional(),
  country: placeRef,
  region: placeRef,
  district: placeRef,
  zone: z.object({ id: z.string(), name: z.string().catch('') }).passthrough().nullish().catch(null),
}).passthrough();
export const EntityInputSchema = z.object({
  name: z.string().optional(),
  slogan: z.string().optional(),
  logoUrl: z.string().nullish(),
  initials: z.string().optional(),
  status: z.string().optional(),
  primaryEmail: z.string().optional(),
  primaryPhone: z.string().optional(),
  interestsText: z.string().optional(),
  location: locationSchema.optional(),
  personData: objectish.optional(),
  familyData: objectish.optional(),
  onlinePresence: objectish.optional(),
  industryData: objectish.optional(),
  financeData: objectish.optional(),
  customData: objectish.optional(),
  contacts: z.array(objectish).optional(),
  entityContacts: z.array(entityContactSchema).optional(),
  interests: z.array(z.string()).optional(),
  modules: z.array(z.unknown()).optional(),
  workspaceTags: z.array(z.string()).optional(),
  globalTags: z.array(z.string()).optional(),
}).passthrough();
export type EntityInput = z.infer<typeof EntityInputSchema>;

export interface CreateEntityParams {
  data: EntityInput;
  workspaceId: string;
  entityType: EntityType;
  /** Used only by a trusted service writing to a legacy workspace id without a document. */
  organizationId?: string;
  forceCreate?: boolean;
}

/** Result of an entity create: the new id, or why not (including possible duplicates). */
export interface CreateEntityResult {
  success: boolean;
  id?: string;
  error?: string;
  isDuplicate?: boolean;
  duplicates?: DuplicateMatch[];
}

export interface UpdateEntityParams {
  entityId: string;
  data: EntityInput;
  workspaceId: string;
  /** Used only when the workspace document has no organization (legacy). */
  organizationId?: string;
}

/** The id written to activity logs: the user, or the user a service works for, or the service. */
export function entityActorLabel(actor: CrmActor): string {
  return actor.kind === 'user' ? actor.uid : actor.onBehalfOf ?? `system-${actor.service}`;
}

export async function checkEntityPermission(
  actor: CrmActor,
  workspaceId: string,
  action: 'create' | 'edit' | 'delete'
): Promise<{ granted: true } | { granted: false; reason: string }> {
  if (!workspaceId) return { granted: false, reason: 'Workspace not found.' };
  if (actor.kind === 'service') {
    return actor.workspaceId === workspaceId ? { granted: true } : { granted: false, reason: 'Workspace not found.' };
  }
  const permission = await canUser(actor.uid, 'operations', 'campuses', action, workspaceId);
  return permission.granted ? { granted: true } : { granted: false, reason: permission.reason ?? 'Permission denied.' };
}

/** Is the entity linked to the workspace (composite key, or a workspace-scoped link record)? */
export async function isEntityInWorkspace(entityId: string, workspaceId: string): Promise<boolean> {
  if (!entityId || !workspaceId) return false;
  const cleanId = entityId.startsWith(`${workspaceId}_`) ? entityId.slice(workspaceId.length + 1) : entityId;
  const composite = await adminDb.collection('workspace_entities').doc(`${workspaceId}_${cleanId}`).get();
  if (composite.exists && composite.data()?.workspaceId === workspaceId) return true;
  const linked = await adminDb.collection('workspace_entities')
    .where('workspaceId', '==', workspaceId)
    .where('entityId', '==', cleanId)
    .limit(1)
    .get();
  return !linked.empty;
}

/**
 * Marks the workspace's industry scope as locked (after its first entity). No session check:
 * callers have already been authorized for `workspaceId`.
 */
export async function lockWorkspaceScopeCore(workspaceId: string, organizationId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();

  await adminDb.collection('workspaces').doc(workspaceId).update({
    industryScopeLocked: true,
    industryScopeLockedAt: now,
    updatedAt: now,
  });

  // Invalidate cache so subsequent reads reflect the locked state
  invalidateWorkspaceCache(workspaceId);

  // Log the scope-lock event (Requirement 2.6)
  await logActivity({
    organizationId,
    workspaceId,
    userId,
    type: 'workspace_scope_locked',
    source: 'system',
    description: `Industry scope locked for workspace "${workspaceId}"`,
    metadata: { lockedAt: now },
  });
}

/**
 * Runs background contact verification for a primary contact.
 *
 * Email and phone are verified SEQUENTIALLY (never in parallel): both writers
 * rewrite the shared entityContacts[]/leadScore on the same entity, so running
 * them concurrently would race and lose data. Each leg is independently
 * try/caught so one failure never blocks the other.
 */
async function runContactVerification(opts: {
  email?: string;
  phone?: string;
  defaultCountry?: string;
  context: string;
}): Promise<void> {
  const { email, phone, defaultCountry, context } = opts;

  if (email) {
    try {
      console.log(`[autoVerify] Initiating background email verification (${context}): ${email}`);
      await new BulkVerificationService().processBulk([email]);
    } catch (err: unknown) {
      console.error('[autoVerify] Background email verification failed:', getErrorMessage(err));
    }
  }

  if (phone) {
    try {
      console.log(`[autoVerify] Initiating background phone verification (${context}): ${phone}`);
      await new BulkPhoneVerificationService().processBulk([{ phone, defaultCountry }]);
    } catch (err: unknown) {
      console.error('[autoVerify] Background phone verification failed:', getErrorMessage(err));
    }
  }
}

/**
 * Creates a new Entity record across 'entities' and 'workspace_entities'.
 * Uses server-side Firebase Admin SDK to bypass client-side security rules.
 */
export async function createEntityCore(actor: CrmActor, params: CreateEntityParams): Promise<CreateEntityResult> {
  const { data, workspaceId, entityType, forceCreate = false } = params;
  const userId = entityActorLabel(actor);
  try {
    // 0. Permission check (N1): users need operations/campuses:create in the workspace; services
    // must be pinned to it. There is no 'system-' bypass any more.
    const permission = await checkEntityPermission(actor, workspaceId, 'create');
    if (!permission.granted) return { success: false, error: permission.reason };

    // SECURITY (N1): the organization is the workspace's own, never the caller's value.
    const fromWorkspace = await workspaceOrganizationId(workspaceId);
    if (fromWorkspace === null && actor.kind === 'user') return { success: false, error: 'Workspace not found.' };
    const organizationId = fromWorkspace || params.organizationId || '';

    // 1. Resolve workspace industry and scope-lock status (Requirements 2.1, 1.4)
    const { industry: workspaceIndustry, industryScopeLocked } =
      await getWorkspaceIndustry(workspaceId);

    // Backward Compatibility: Clean industry data before validation
    if (data.industryData) {
       if ('nominalRoll' in data.industryData && !('capacity' in data.industryData)) data.industryData.capacity = data.industryData.nominalRoll;
       if ('companySize' in data.industryData && !('capacity' in data.industryData)) data.industryData.capacity = data.industryData.companySize;
       if (data.nominalRoll !== undefined && !('capacity' in data.industryData)) data.industryData.capacity = data.nominalRoll;
       
       delete data.industryData.nominalRoll;
       delete data.industryData.companySize;
       delete data.industryData.entityType;

       if (!data.industryData.industry) {
         data.industryData.industry = workspaceIndustry;
       }

       data.industryData = applyIndustryDataDefaults(data.industryData, workspaceIndustry, entityType);
    }

    // 2. Validate industryData against workspace industry if provided (Requirement 3.9)
    if (data.industryData) {
      // Throws if industry mismatch or schema failure
      validateIndustryData(data.industryData, workspaceIndustry);
    }

    let defaultCountryCode: string | undefined = undefined;
    try {
      defaultCountryCode = await resolveOrganizationCountryCode(organizationId);
    } catch (_err) {}

    const timestamp = new Date().toISOString();
    const entityId = `entity_${crypto.randomUUID()}`;
    
    let displayName = data.name || '';
    if (entityType === 'person' && data.personData) {
        displayName = `${data.personData.firstName} ${data.personData.lastName}`.trim();
    }
    
    const slug = displayName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');


    // FER-01: Convert incoming contacts to EntityContact format
    const rawContacts: EntityContact[] = (data.contacts || data.entityContacts || []).map(
      (c: any, i: number) => {
        let phone = c.phone;
        let countryCode = c.countryCode;
        let callingCode = c.callingCode;

        if (phone) {
           const parsed = normalizePhoneNumber(phone, defaultCountryCode);
           phone = parsed.e164 || phone;
           if (!countryCode) countryCode = parsed.countryCode;
           if (!callingCode) callingCode = parsed.callingCode;
        }

        // If already EntityContact-shaped (has typeKey), use directly
        if (c.typeKey) {
          const contact: any = {
            id: c.id || `ec_${crypto.randomUUID().substring(0, 8)}`,
            name: c.name || '',
            typeKey: c.typeKey,
            typeLabel: c.typeLabel || c.typeKey,
            isPrimary: c.isPrimary ?? (i === 0),
            isSignatory: c.isSignatory ?? (i === 0),
            order: c.order ?? i,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          if (c.email) contact.email = c.email;
          if (phone) {
             contact.phone = phone;
             if (countryCode) contact.countryCode = countryCode;
             if (callingCode) contact.callingCode = callingCode;
          }
          if (c.notes !== undefined) contact.notes = c.notes;
          if (c.attachments !== undefined) contact.attachments = c.attachments;
          
          return contact as EntityContact;
        }
        // Non-EntityContact shape — treat as raw and build
        const legacyContact: EntityContact = {
          id: c.id || `ec_${crypto.randomUUID().substring(0, 8)}`,
          name: c.name || '',
          typeKey: normalizeContactType(c.type || 'other'),
          typeLabel: c.type || 'Other',
          isPrimary: c.isPrimary ?? (i === 0),
          isSignatory: c.isSignatory ?? false,
          order: i,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        if (c.email) legacyContact.email = c.email;
        if (phone) {
            legacyContact.phone = phone;
            legacyContact.countryCode = countryCode;
            legacyContact.callingCode = callingCode;
        }
        return legacyContact;
      }
    );

    // Enforce exactly one primary and one signatory
    const entityContacts = enforceContactConstraints(rawContacts);

    // Extract denormalized primary fields
    const { primaryContactName, primaryEmail, primaryPhone } = extractPrimaryContactFields({ entityContacts });

    // 2.5 Duplicate Detection (Requirement: Strict Duplicate Prevention unless forced)
    if (!forceCreate) {
      const duplicates = await findDuplicateEntities(
        workspaceId,
        entityType,
        displayName,
        primaryEmail,
        primaryPhone
      );
      if (duplicates.length > 0) {
        return { 
          success: false, 
          error: 'Duplicate entity found.', 
          isDuplicate: true, 
          duplicates 
        };
      }
    }

    // Geographic zone: never store null/blank — default to "Unassigned" so the
    // entity always has a zone for filtering, reporting and messaging.
    const normalizedLocation = {
      ...(data.location || {}),
      zone: zoneOrUnassigned(data.location?.zone),
    };

    // Prepare Base Entity Document
    const entityData: any = {
      id: entityId,
      organizationId,
      entityType,
      name: displayName,
      slug: slug,
      entityContacts, // Canonical (FER-01)
      globalTags: data.globalTags || [],
      status: 'active',
      industry: workspaceIndustry,
      
      // Root fields from data (formerly institutionData)
      initials: data.initials || undefined,
      logoUrl: data.logoUrl || undefined,
      referee: data.referee || undefined,
      location: normalizedLocation,
      interests: data.interests || (data.modules ? data.modules.map((m: any) => m.id || m.name || m) : []),

      createdAt: timestamp,
      updatedAt: timestamp,
    };
    
    // Build financeData
    const financeData: any = {
      ...(data.financeData || {})
    };
    const financeFields = [
      'planType', 'subscriptionIds', 'currency', 'billingAddress', 
      'subscriptionRate', 'customerTier', 'signupDate', 'renewalDate', 
      'paymentMethod', 'lastPaymentDate', 'nextPaymentDue', 'invoiceIds', 'paymentIds',
      'subscriptionPackageId', 'subscriptionPackageName', 'discountPercentage', 'arrearsBalance', 'creditBalance'
    ];
    for (const f of financeFields) {
      if (data[f] !== undefined) financeData[f] = data[f];
    }
    if (Object.keys(financeData).length > 0) {
      if (!financeData.currency) financeData.currency = 'GHS'; // default
      entityData.financeData = financeData;
    }

    // Append Polymorphic Data
    if (entityType === 'family' && data.familyData) {
        entityData.familyData = data.familyData;
    } else if (entityType === 'person' && data.personData) {
        entityData.personData = data.personData;
    }

    // Append validated industry-specific data if provided (Requirement 3.1–3.9)
    if (data.industryData) {
      entityData.industryData = data.industryData;
    }

    // Append custom fields data
    if (data.customData) {
      entityData.customData = data.customData;
    }

    // Online Presence
    if (data.onlinePresence) {
      entityData.onlinePresence = data.onlinePresence;
    }

    // Narrative Fields (currentNeeds, currentChallenges, interests text)
    if (data.currentNeeds) entityData.currentNeeds = data.currentNeeds;
    if (data.currentChallenges) entityData.currentChallenges = data.currentChallenges;
    if (data.interests && typeof data.interests === 'string') entityData.interestsText = data.interests;

    // Clean undefined values before saving to Firestore
    const cleanUndefined = (obj: any) => {
      Object.keys(obj).forEach(key => {
        if (obj[key] === undefined) {
          delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          cleanUndefined(obj[key]);
        }
      });
      return obj;
    };

    cleanUndefined(entityData);

    // Prepare Workspace Entity Document
    const workspaceEntityId = `${workspaceId}_${entityId}`;
    const workspaceEntityData = withEntitySearchFields({
        id: workspaceEntityId,
        organizationId,
        workspaceId,
        entityId,
        entityType,
        assignedTo: data.assignedTo || null,
        status: 'active',
        workspaceTags: data.workspaceTags || [],
        addedAt: timestamp,
        updatedAt: timestamp,
        displayName: displayName,
        // displayNameLower stamped by withEntitySearchFields (Phase 5.2)
        // Denormalized contact fields from entityContacts (FER-01)
        primaryContactName,
        primaryEmail,
        primaryPhone,
        entityContacts, // Denormalized for list performance
        interests: data.modules || [],
        // Location fields for filtering and display
        location: normalizedLocation,
        locationString: data.location?.locationString || '',
        locationCountryId: data.location?.country?.id || null,
        locationRegionId: data.location?.region?.id || null,
        locationDistrictId: data.location?.district?.id || null,
        zone: normalizedLocation.zone,
        ...(entityData.currentNeeds && { currentNeeds: entityData.currentNeeds }),
        ...(entityData.currentChallenges && { currentChallenges: entityData.currentChallenges }),
        ...(entityData.interestsText && { interestsText: entityData.interestsText }),
    });

    cleanUndefined(workspaceEntityData);

    // Save to Universal Identity Collection and Operational Workspace Collection
    if (typeof adminDb.batch === 'function') {
      const createBatch = adminDb.batch();
      createBatch.set(adminDb.collection('entities').doc(entityId), entityData);
      createBatch.set(adminDb.collection('workspace_entities').doc(workspaceEntityId), workspaceEntityData);
      await createBatch.commit();
    } else {
      await adminDb.collection('entities').doc(entityId).set(entityData);
      await adminDb.collection('workspace_entities').doc(workspaceEntityId).set(workspaceEntityData);
    }

    // Project contacts into workspace_contacts (Phase 6.1) — read-model, never blocks.
    await syncContactProjectionForWE(workspaceEntityData as unknown as WorkspaceEntity);

    // Log Activity
    await logActivity({
      entityId,
      entityType,
      displayName,
      entitySlug: slug,
      organizationId,
      userId,
      workspaceId,
      type: 'entity_created',
      source: 'user_action',
      description: `registered new ${entityType}: "${displayName}" in workspace`,
      // Include industry context (Requirements 2.1, 2.4)
      metadata: { industry: workspaceIndustry },
    });

    // Lock workspace industry scope after first entity link (Requirements 2.2, 2.6, 1.4)
    if (!industryScopeLocked) {
      await lockWorkspaceScopeCore(workspaceId, organizationId, userId);
    }

    revalidatePath('/admin/entities');
    revalidatePath('/admin/pipeline');

    // Auto-verify email + phone asynchronously in the background (zero impact on performance)
    if (primaryEmail || primaryPhone) {
      try {
        after(() => runContactVerification({
          email: primaryEmail,
          phone: primaryPhone,
          defaultCountry: defaultCountryCode,
          context: 'create',
        }));
      } catch (_err) {
        console.warn('[autoVerify] next/server after() was called outside Next.js request context (likely in test). Skipping.');
      }
    }

    return { success: true, id: entityId };
  } catch (e: unknown) {
    console.error(">>> [ENTITY:CREATE] Failed:", getErrorMessage(e));
    return { success: false, error: getErrorMessage(e) };
  }
}

/**
 * Updates an existing Entity record across 'entities', 'workspace_entities',
 * and the legacy 'schools' collection (Dual Write).
 */
export async function updateEntityCore(actor: CrmActor, params: UpdateEntityParams) {
  const { entityId, data, workspaceId } = params;
  const userId = entityActorLabel(actor);
  try {
    // 0. Permission check (N1): no 'system-' bypass; services are pinned to the workspace.
    const permission = await checkEntityPermission(actor, workspaceId, 'edit');
    if (!permission.granted) return { success: false, error: permission.reason };

    // SECURITY (N1): the entity must already be linked to this workspace. Updates also write the
    // shared `entities/{id}` document, so an unlinked id would reach another tenant's record.
    if (!(await isEntityInWorkspace(entityId, workspaceId))) return { success: false, error: 'Entity not found.' };

    const fromWorkspace = await workspaceOrganizationId(workspaceId);
    const organizationId = fromWorkspace || params.organizationId || '';

    const timestamp = new Date().toISOString();
    let updatedPrimaryEmail: string | undefined;
    let updatedPrimaryPhone: string | undefined;

    let addedGlobalTags: string[] = [];
    let removedGlobalTags: string[] = [];
    let addedWorkspaceTags: string[] = [];
    let removedWorkspaceTags: string[] = [];
    
    // 1. Resolve Entity reference
    const entityRef = adminDb.collection('entities').doc(entityId);
    const entitySnap = await entityRef.get();
    
    let entityType: EntityType = 'institution'; // default
    let displayName = data.name; // Can be undefined
    
    if (entitySnap.exists) {
        entityType = entitySnap.data()?.entityType || 'institution';
    }

    if (entityType === 'person' && data.personData) {
        displayName = `${data.personData.firstName} ${data.personData.lastName}`.trim();
    }

    // 2. FER-01: Convert incoming contacts to EntityContact format if contacts are provided
    let entityContacts: EntityContact[] | undefined;
    let _legacyContacts: any[] | undefined;

    if (data.contacts || data.entityContacts) {
      const rawContacts: EntityContact[] = (data.entityContacts || data.contacts || []).map(
        (c: any, i: number) => {
          if (c.typeKey) {
            const contact: any = {
              id: c.id || `ec_${crypto.randomUUID().substring(0, 8)}`,
              name: c.name || '',
              typeKey: c.typeKey,
              typeLabel: c.typeLabel || c.typeKey,
              isPrimary: c.isPrimary ?? (i === 0),
              isSignatory: c.isSignatory ?? (i === 0),
              order: c.order ?? i,
              updatedAt: timestamp,
            };
            if (c.email) contact.email = c.email;
            if (c.phone) contact.phone = c.phone;
            if (c.notes !== undefined) contact.notes = c.notes;
            if (c.attachments !== undefined) contact.attachments = c.attachments;
            
            return contact as EntityContact;
          }
          // Non-EntityContact shape — build directly
          const contact: EntityContact = {
            id: c.id || `ec_${crypto.randomUUID().substring(0, 8)}`,
            name: c.name || '',
            typeKey: normalizeContactType(c.type || 'other'),
            typeLabel: c.type || 'Other',
            isPrimary: c.isPrimary ?? (i === 0),
            isSignatory: c.isSignatory ?? false,
            order: i,
            updatedAt: timestamp,
          };
          if (c.email) contact.email = c.email;
          if (c.phone) contact.phone = c.phone;
          return contact;
        }
      );
      entityContacts = enforceContactConstraints(rawContacts);
    }

    // Prepare Base Entity Update (Identity)
    const entityUpdate: Record<string, unknown> = {
      updatedAt: timestamp,
    };
    if (displayName !== undefined) {
      entityUpdate.name = displayName;
    }
    
    if (entityContacts) {
      entityUpdate.entityContacts = entityContacts;
    }
    if (data.globalTags) {
      const oldGlobalTags = ((entitySnap.exists ? entitySnap.data()?.globalTags : null) as string[]) || [];
      const newGlobalTags = data.globalTags as string[];
      addedGlobalTags = newGlobalTags.filter(t => !oldGlobalTags.includes(t));
      removedGlobalTags = oldGlobalTags.filter(t => !newGlobalTags.includes(t));
      entityUpdate.globalTags = data.globalTags;
    }
    if (data.status) entityUpdate.status = data.status.toLowerCase();

    // Root fields update
    if (data.initials !== undefined) entityUpdate.initials = data.initials;
    if (data.slogan !== undefined) entityUpdate.slogan = data.slogan;
    if (data.logoUrl !== undefined) entityUpdate.logoUrl = data.logoUrl;
    if (data.referee !== undefined) entityUpdate.referee = data.referee;
    if (data.location !== undefined) entityUpdate.location = { ...data.location, zone: zoneOrUnassigned(data.location?.zone) };
    if (data.interests !== undefined) entityUpdate.interests = data.interests;
    else if (data.modules !== undefined) entityUpdate.interests = data.modules.map((m: any) => m.id || m.name || m);
    if (data.currentNeeds !== undefined) entityUpdate.currentNeeds = data.currentNeeds;
    if (data.currentChallenges !== undefined) entityUpdate.currentChallenges = data.currentChallenges;
    if (data.interestsText !== undefined) entityUpdate.interestsText = data.interestsText;

    // Build financeData update
    const financeData: any = {
      ...(data.financeData || {})
    };
    const financeFields = [
      'planType', 'subscriptionIds', 'currency', 'billingAddress', 
      'subscriptionRate', 'customerTier', 'signupDate', 'renewalDate', 
      'paymentMethod', 'lastPaymentDate', 'nextPaymentDue', 'invoiceIds', 'paymentIds',
      'subscriptionPackageId', 'subscriptionPackageName', 'discountPercentage', 'arrearsBalance', 'creditBalance'
    ];
    for (const f of financeFields) {
      if (data[f] !== undefined) financeData[f] = data[f];
    }
    
    if (Object.keys(financeData).length > 0) {
      // In a full replacement, we'd overwrite. Here we merge via dot notation if entity Snap doesn't have it?
      // Since it's a new schema, let's just create/merge it.
      if (!entitySnap.data()?.financeData) {
         if (!financeData.currency) financeData.currency = 'GHS';
         entityUpdate.financeData = financeData;
      } else {
         for (const key of Object.keys(financeData)) {
            entityUpdate[`financeData.${key}`] = financeData[key];
         }
      }
    }

    // Append Polymorphic Data
    if (entityType === 'family' && data.familyData) {
        entityUpdate.familyData = data.familyData;
    } else if (entityType === 'person' && data.personData) {
        entityUpdate.personData = data.personData;
    }

    // Industry data
    if (data.industryData) {
      const indData = { ...data.industryData };
      if ('nominalRoll' in indData && !('capacity' in indData)) indData.capacity = indData.nominalRoll;
      if ('companySize' in indData && !('capacity' in indData)) indData.capacity = indData.companySize;
      if (data.nominalRoll !== undefined && !('capacity' in indData)) indData.capacity = data.nominalRoll;
      
      delete indData.nominalRoll;
      delete indData.companySize;
      delete indData.entityType;
      
      const { industry: workspaceIndustry } = await getWorkspaceIndustry(workspaceId);
      if (!indData.industry) {
        indData.industry = workspaceIndustry;
      }
      const defaultedIndData = applyIndustryDataDefaults(indData, workspaceIndustry, entityType);
      validateIndustryData(defaultedIndData, workspaceIndustry);
      
      entityUpdate.industryData = defaultedIndData;
    }

    // Custom data
    if (data.customData) {
      if (!entitySnap.data()?.customData) {
         entityUpdate.customData = data.customData;
      } else {
         for (const key of Object.keys(data.customData)) {
           entityUpdate[`customData.${key}`] = data.customData[key];
         }
      }
    }

    // Online Presence
    if (data.onlinePresence) {
      entityUpdate.onlinePresence = data.onlinePresence;
    }

    // 3. Update Universal Identity Collection and Workspace Entities (Operational)
    const hasBatch = typeof adminDb.batch === 'function';
    const updateBatch = hasBatch ? adminDb.batch() : null;

    if (entitySnap.exists) {
      if (updateBatch) {
        updateBatch.update(entityRef, entityUpdate);
      } else {
        await entityRef.update(entityUpdate);
      }
    } else {
      console.warn(`Entity ${entityId} not found in entities collection during update.`);
    }

    const updatedWEPayloads: WorkspaceEntity[] = [];

    // 4. Update Workspace Entity (Operational)
    const weQuery = await adminDb.collection('workspace_entities')
      .where('entityId', '==', entityId)
      .get();
      
    if (!weQuery.empty) {
      for (const doc of weQuery.docs) {
        const weData = doc.data() as WorkspaceEntity;
        const isCurrentWorkspace = weData.workspaceId === workspaceId;
        
        const weUpdate: Record<string, unknown> = withEntitySearchFields({
          displayName: displayName,
          // displayNameLower stamped by withEntitySearchFields (Phase 5.2)
          updatedAt: timestamp,
        });
        
        // Entity-level fields (always sync to all workspaces)
        if (entityContacts) {
          const { primaryContactName, primaryEmail, primaryPhone } = extractPrimaryContactFields({ entityContacts });
          updatedPrimaryEmail = primaryEmail;
          updatedPrimaryPhone = primaryPhone;
          weUpdate.primaryContactName = primaryContactName;
          weUpdate.primaryEmail = primaryEmail;
          weUpdate.primaryPhone = primaryPhone;
          weUpdate.entityContacts = entityContacts;
        } else {
          if (data.primaryEmail !== undefined) {
            weUpdate.primaryEmail = data.primaryEmail;
            updatedPrimaryEmail = data.primaryEmail;
          }
          if (data.primaryPhone !== undefined) {
            weUpdate.primaryPhone = data.primaryPhone;
            updatedPrimaryPhone = data.primaryPhone;
          }
        }
        
        if (data.modules !== undefined) {
          weUpdate.interests = data.modules;
        }
        if (data.currentNeeds !== undefined) weUpdate.currentNeeds = data.currentNeeds;
        if (data.currentChallenges !== undefined) weUpdate.currentChallenges = data.currentChallenges;
        if (data.interestsText !== undefined) weUpdate.interestsText = data.interestsText;
        
        if (data.location !== undefined) {
          const weNormalizedLocation = { ...data.location, zone: zoneOrUnassigned(data.location?.zone) };
          weUpdate.location = weNormalizedLocation;
          weUpdate.locationString = data.location?.locationString || '';
          weUpdate.locationCountryId = data.location?.country?.id || null;
          weUpdate.locationRegionId = data.location?.region?.id || null;
          weUpdate.locationDistrictId = data.location?.district?.id || null;
          weUpdate.zone = weNormalizedLocation.zone;
        }
        
        // Workspace-level fields (only update if matches current workspaceId)
        if (isCurrentWorkspace) {
          if (data.assignedTo !== undefined) weUpdate.assignedTo = data.assignedTo;
          if (data.status) weUpdate.status = data.status.toLowerCase();
          if (data.workspaceTags) {
            const oldWorkspaceTags = (weData.workspaceTags as string[]) || [];
            const newWorkspaceTags = data.workspaceTags as string[];
            addedWorkspaceTags = newWorkspaceTags.filter(t => !oldWorkspaceTags.includes(t));
            removedWorkspaceTags = oldWorkspaceTags.filter(t => !newWorkspaceTags.includes(t));
            weUpdate.workspaceTags = data.workspaceTags;
          }
        }
        
        if (updateBatch) {
          updateBatch.update(doc.ref, weUpdate);
        } else {
          await doc.ref.update(weUpdate);
        }
        updatedWEPayloads.push({ ...weData, ...weUpdate, id: doc.id } as WorkspaceEntity);
      }
    } else {
      console.warn(`No workspace entities found for entity ${entityId} during update.`);
    }

    // Commit entity and all workspace_entities atomically if using batch
    if (updateBatch) {
      await updateBatch.commit();
    }

    // Re-project contacts for this WE (Phase 6.1) — picks up contact, tag,
    // zone, assignee and status changes. Merge current + delta for full state.
    for (const weDoc of updatedWEPayloads) {
      await syncContactProjectionForWE(weDoc);
    }

    // 6. Log Activity
    await logActivity({
      entityId,
      entityType,
      displayName,
      organizationId,
      userId,
      workspaceId,
      type: 'entity_updated',
      source: 'user_action',
      description: `updated profile for "${displayName}"`,
    });

    revalidatePath('/admin/entities');
    revalidatePath(`/admin/entities/${entityId}`);

    // Auto-verify updated email + phone asynchronously in the background (zero impact on performance)
    if (updatedPrimaryEmail || updatedPrimaryPhone) {
      try {
        after(async () => {
          // Resolve the org default country only when a phone needs parsing
          // (the update path stores phones as-entered; the verifier's pre-pass
          // normalizes local formats given the default country).
          let defaultCountry: string | undefined;
          if (updatedPrimaryPhone) {
            try {
              defaultCountry = await resolveOrganizationCountryCode(organizationId);
            } catch {
              // No default country — E.164-stored numbers still verify fine
            }
          }
          await runContactVerification({
            email: updatedPrimaryEmail,
            phone: updatedPrimaryPhone,
            defaultCountry,
            context: 'update',
          });
        });
      } catch (_err) {
        console.warn('[autoVerify] next/server after() was called outside Next.js request context (likely in test). Skipping.');
      }
    }

    // Evaluate field changed triggers in background
    const oldEntityData = entitySnap.exists ? entitySnap.data() : {};
    try {
      after(async () => {
        try {
          await checkEntityFieldChangedTrigger(entityId, oldEntityData, data, workspaceId, organizationId);
        } catch (err: unknown) {
          console.error('[fieldChangedTrigger] Background evaluation failed:', getErrorMessage(err));
        }
      });
    } catch (_err) {
      // fallback if after() is called outside request context
      await checkEntityFieldChangedTrigger(entityId, oldEntityData, data, workspaceId, organizationId).catch(() => {});
    }

    // Fire tag triggers for any added or removed tags

    const allTagIdsToFetch = Array.from(new Set([
      ...addedGlobalTags,
      ...removedGlobalTags,
      ...addedWorkspaceTags,
      ...removedWorkspaceTags
    ]));

    if (allTagIdsToFetch.length > 0) {
      try {
        const tagsSnap = await Promise.all(
          allTagIdsToFetch.map(tagId => adminDb.collection('tags').doc(tagId).get())
        );
        const tagsMap = new Map<string, Tag>();
        tagsSnap.forEach(snap => {
          if (snap.exists) tagsMap.set(snap.id, snap.data() as Tag);
        });

        const logTagChange = async (tagIds: string[], type: 'tag_added' | 'tag_removed') => {
          for (const tagId of tagIds) {
            const tag = tagsMap.get(tagId);
            await logActivity({
              organizationId,
              workspaceId,
              entityId,
              entityType,
              displayName,
              type,
              source: 'user_action',
              userId,
              description: `Tag "${tag?.name || tagId}" ${type === 'tag_added' ? 'applied' : 'removed'} via profile update.`,
              metadata: {
                tagId,
                tagName: tag?.name,
                contactType: 'entity',
                appliedBy: userId,
                isAutomation: actor.kind === 'service',
              }
            });
          }
        };

        await logTagChange(addedGlobalTags, 'tag_added');
        await logTagChange(removedGlobalTags, 'tag_removed');
        await logTagChange(addedWorkspaceTags, 'tag_added');
        await logTagChange(removedWorkspaceTags, 'tag_removed');
      } catch (tagTriggerErr) {
        console.error('[ENTITY:UPDATE] Failed to trigger tag automations:', tagTriggerErr);
      }
    }

    return { success: true };
  } catch (e: unknown) {
    console.error(">>> [ENTITY:UPDATE] Failed:", getErrorMessage(e));
    return { success: false, error: getErrorMessage(e) };
  }
}

async function checkEntityFieldChangedTrigger(
  entityId: string,
  oldData: any,
  newData: any,
  workspaceId: string,
  organizationId: string
) {
  try {
    const automationsRef = adminDb.collection('automations');
    const snap = await automationsRef
      .where('trigger', '==', 'ENTITY_FIELD_CHANGED')
      .where('status', '==', 'active')
      .get();
    
    if (snap.empty) return;

    // Helper to get nested object values
    const getNestedValue = (obj: any, path: string) => {
      if (!obj) return undefined;
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    const { triggerAutomationProtocols } = await import('@/lib/automation-processor');
    const { buildAutomationPayload } = await import('@/lib/automation-payload');

    for (const doc of snap.docs) {
      const automation = doc.data();
      const fieldPath = automation.config?.fieldPath;
      if (!fieldPath) continue;

      const oldValue = getNestedValue(oldData, fieldPath);
      const newValue = getNestedValue(newData, fieldPath);

      if (newValue !== undefined && oldValue !== newValue) {
        const payload = buildAutomationPayload({
          organizationId,
          workspaceId,
          entityId,
          action: 'entity_field_changed',
          metadata: {
            fieldPath,
            oldValue,
            newValue,
          },
        });
        await triggerAutomationProtocols('ENTITY_FIELD_CHANGED', payload);
      }
    }
  } catch (err) {
    console.error('Error evaluating field changed trigger:', err);
  }
}
