import { adminDb } from '../../firebase-admin';
import { resolveContact } from '../../contact-adapter';
import { logActivity } from '../../activity-logger';
import { MAX_AUTOMATION_CHAIN_DEPTH, type ExecutionContext } from '../execution-types';
import type { EntityType, Automation, EntityContact, Entity } from '../../types';

/**
 * Resolves the workspace's organizationId.
 * Fast path: reads from ExecutionContext (populated once at run start in executor.ts).
 * Fallback: Firestore read (used when context is rebuilt in resume.ts without orgId).
 */
async function resolveOrgId(context: ExecutionContext): Promise<string> {
  if (context.organizationId) return context.organizationId;
  const snap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
  return (snap.data()?.organizationId as string) || '';
}

const NATIVE_ENTITY_FIELDS_LIST = [
  'initials', 'slogan', 'capacity', 'currency', 'subscriptionPackageId',
  'subscriptionRate', 'discountPercentage', 'billingAddress', 'arrearsBalance',
  'creditBalance', 'currentNeeds', 'currentChallenges', 'interests',
  'locationString', 'website', 'digitalAddress', 'googleMapLocation',
  'facebook', 'whatsapp', 'instagram', 'linkedin', 'x_twitter', 'youtube',
  'tiktok', 'pinterest', 'firstName', 'lastName', 'company', 'jobTitle',
  'leadSource', 'status'
];

function mapNativeFieldsToPayload(sourceMap: Record<string, any>, entityType: string): Record<string, any> {
  const payload: Record<string, any> = {};
  const financeData: Record<string, any> = {};
  const onlinePresence: Record<string, any> = {};
  const industryData: Record<string, any> = {};
  const location: Record<string, any> = {};
  const personData: Record<string, any> = {};

  for (const [key, val] of Object.entries(sourceMap)) {
    if (val === undefined || val === null) continue;

    if (['initials', 'slogan', 'currentNeeds', 'currentChallenges', 'status'].includes(key)) {
      payload[key] = val;
    } else if (key === 'interests') {
      payload.interests = typeof val === 'string' ? val.split(',').map(s => s.trim()) : val;
    } else if (key === 'capacity') {
      industryData.capacity = Number(val) || 0;
    } else if (['currency', 'billingAddress', 'subscriptionPackageId', 'subscriptionRate', 'discountPercentage', 'arrearsBalance', 'creditBalance'].includes(key)) {
      financeData[key] = ['subscriptionRate', 'discountPercentage', 'arrearsBalance', 'creditBalance'].includes(key) ? Number(val) || 0 : val;
    } else if (['website', 'digitalAddress', 'googleMapLocation', 'facebook', 'whatsapp', 'instagram', 'linkedin', 'x_twitter', 'youtube', 'tiktok', 'pinterest'].includes(key)) {
      const opKey = key === 'x_twitter' ? 'x' : key;
      onlinePresence[opKey] = val;
    } else if (key === 'locationString') {
      location.locationString = val;
    } else if (['firstName', 'lastName', 'company', 'jobTitle', 'leadSource'].includes(key)) {
      personData[key] = val;
    }
  }

  if (Object.keys(financeData).length > 0) {
    if (!financeData.currency) financeData.currency = 'GHS';
    payload.financeData = financeData;
  }
  if (Object.keys(onlinePresence).length > 0) payload.onlinePresence = onlinePresence;
  if (Object.keys(industryData).length > 0) payload.industryData = industryData;
  if (Object.keys(location).length > 0) payload.location = location;
  if (Object.keys(personData).length > 0 && entityType === 'person') payload.personData = personData;

  return payload;
}

export async function handleUpdateEntity(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  if (!context.entityId) throw new Error('Cannot update entity: Context missing entityId.');

  const contact = await resolveContact(context.entityId, context.workspaceId);
  if (!contact?.entityId) throw new Error('Cannot update entity: Contact not found.');

  const timestamp = new Date().toISOString();
  const identityFields = ['name', 'slug', 'displayName'];
  const workspaceUpdates: Record<string, unknown> = { updatedAt: timestamp };
  const entityUpdates: Record<string, unknown> = { updatedAt: timestamp };

  const updates = (config.updates || config) as Record<string, unknown>;
  if (config.pipelineId) workspaceUpdates.pipelineId = config.pipelineId;
  if (config.stageId) workspaceUpdates.stageId = config.stageId;
  if (config.assignedTo) workspaceUpdates.assignedTo = config.assignedTo;

  if (updates && typeof updates === 'object') {
    for (const [key, value] of Object.entries(updates)) {
      if (identityFields.includes(key)) {
        entityUpdates[key] = value;
      } else if (['pipelineId', 'stageId', 'assignedTo', 'workspaceTags'].includes(key)) {
        workspaceUpdates[key] = value;
      } else if (NATIVE_ENTITY_FIELDS_LIST.includes(key)) {
        if (['initials', 'slogan', 'currentNeeds', 'currentChallenges', 'status'].includes(key)) {
          entityUpdates[key] = value;
        } else if (key === 'interests') {
          entityUpdates.interests = typeof value === 'string' ? value.split(',').map(s => s.trim()) : value;
        } else if (key === 'capacity') {
          entityUpdates['industryData.capacity'] = Number(value) || 0;
        } else if (['currency', 'billingAddress', 'subscriptionPackageId', 'subscriptionRate', 'discountPercentage', 'arrearsBalance', 'creditBalance'].includes(key)) {
          entityUpdates[`financeData.${key}`] = ['subscriptionRate', 'discountPercentage', 'arrearsBalance', 'creditBalance'].includes(key) ? Number(value) || 0 : value;
        } else if (['website', 'digitalAddress', 'googleMapLocation', 'facebook', 'whatsapp', 'instagram', 'linkedin', 'x_twitter', 'youtube', 'tiktok', 'pinterest'].includes(key)) {
          const opKey = key === 'x_twitter' ? 'x' : key;
          entityUpdates[`onlinePresence.${opKey}`] = value;
        } else if (key === 'locationString') {
          entityUpdates['location.locationString'] = value;
        } else if (['firstName', 'lastName', 'company', 'jobTitle', 'leadSource'].includes(key)) {
          entityUpdates[`personData.${key}`] = value;
        }
      } else if (
        key !== 'updates' &&
        key !== 'pipelineId' &&
        key !== 'stageId' &&
        key !== 'assignedTo'
      ) {
        entityUpdates[`customData.${key}`] = value;
      }
    }
  }

  if (Object.keys(entityUpdates).length > 1) {
    await adminDb.collection('entities').doc(contact.entityId).update(entityUpdates);
  }

  if (contact.workspaceEntityId && Object.keys(workspaceUpdates).length > 1) {
    await adminDb
      .collection('workspace_entities')
      .doc(contact.workspaceEntityId)
      .update(workspaceUpdates);
  }

  // Log to activity feed — exclude the auto-added updatedAt so we only surface real field changes
  const changedFields = Object.keys({
    ...entityUpdates,
    ...workspaceUpdates,
  }).filter((k) => k !== 'updatedAt');

  if (changedFields.length > 0) {
    const organizationId = await resolveOrgId(context);
    await logActivity({
      type: 'entity_updated',
      description: `Automation updated: ${changedFields.join(', ')}`,
      source: 'automation',
      organizationId,
      workspaceId: context.workspaceId,
      entityId: contact.entityId!,
      userId: `automation:${context.automationId}`,
      displayName: 'System Core',
      metadata: {
        // CRITICAL: prevents activity-logger from re-firing an automation trigger loop
        isAutomation: true,
        updatedFields: changedFields,
        automationId: context.automationId,
      },
    });
  }
}

export async function handleAssignEntity(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  if (!context.entityId) throw new Error('Cannot assign entity: Context missing entityId.');
  const contact = await resolveContact(context.entityId, context.workspaceId);
  if (!contact?.workspaceEntityId) {
    throw new Error('Cannot assign entity: Workspace entity not found.');
  }

  const assignedToPayload = context.payload.assignedTo as { userId?: string } | undefined;
  const assignedTo =
    config.assignedTo === 'auto'
      ? assignedToPayload?.userId || (context.payload.actorId as string) || ''
      : (config.assignedTo as string);

  await adminDb.collection('workspace_entities').doc(contact.workspaceEntityId).update({
    assignedTo,
    updatedAt: new Date().toISOString(),
  });
}

export async function handleAddNote(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  if (!context.entityId || !config.content) {
    throw new Error('Add note action requires entityId and content.');
  }

  await adminDb.collection('entity_notes').add({
    entityId: context.entityId,
    workspaceId: context.workspaceId,
    content: config.content,
    createdBy: (config.authorId as string) || 'system',
    createdByName: 'System Core',
    noteType: 'general',
    isPinned: false,
    source: 'automation',
    automationId: context.automationId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Log to activity feed so the note is visible in the contact timeline
  const organizationId = await resolveOrgId(context);
  await logActivity({
    type: 'note_added',
    description: 'Automation added a note',
    source: 'automation',
    organizationId,
    workspaceId: context.workspaceId,
    entityId: context.entityId!,
    userId: `automation:${context.automationId}`,
    displayName: 'System Core',
    metadata: {
      // CRITICAL: prevents activity-logger from re-firing an automation trigger loop
      isAutomation: true,
      noteType: 'general',
      contentPreview: String(config.content).slice(0, 120),
      automationId: context.automationId,
    },
  });
}

export async function handleCreateEntity(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ id: string }> {
  const resolvedName = (config.name as string || '').trim();
  const resolvedPhone = (config.phone as string || '').trim();
  const resolvedEmail = (config.email as string || '').trim();
  const entityType = (config.entityType as 'institution' | 'person' | 'family') || 'institution';

  if (!resolvedName) {
    throw new Error('Create entity failed: Name is required.');
  }
  if (!resolvedPhone && !resolvedEmail) {
    throw new Error('Create entity failed: Either phone number or email address is required.');
  }

  // Retrieve organizationId
  const organizationId = await resolveOrgId(context);

  // Retrieve app fields from workspace to ensure mapping is scoped
  const appFieldsSnap = await adminDb
    .collection('app_fields')
    .where('workspaceId', '==', context.workspaceId)
    .get();

  // Create a map of app field compatibility scopes
  const fieldScopes = new Map<string, string[]>();
  appFieldsSnap.docs.forEach(doc => {
    const data = doc.data();
    const key = (data.id || data.name) as string;
    fieldScopes.set(key, (data.compatibilityScope as string[] | undefined) || ['common']);
  });

  // Extract, filter, and validate custom fields by compatibility scope, allowing native fields to bypass
  const customData: Record<string, unknown> = {};
  const nativeInputs: Record<string, unknown> = {};
  const configCustomData = (config.customData || {}) as Record<string, unknown>;

  for (const [key, val] of Object.entries(configCustomData)) {
    if (NATIVE_ENTITY_FIELDS_LIST.includes(key)) {
      nativeInputs[key] = val;
    } else if (fieldScopes.has(key)) {
      const scopes = fieldScopes.get(key) || ['common'];
      if (scopes.includes('common') || scopes.includes(entityType)) {
        customData[key] = val;
      } else {
        console.warn(`[CREATE_ENTITY] Ignored custom field key "${key}" since it is not compatible with entityType "${entityType}".`);
      }
    } else {
      console.warn(`[CREATE_ENTITY] Ignored custom field key "${key}" since it is not defined in the workspace app_fields.`);
    }
  }

  const nativePayload = mapNativeFieldsToPayload(nativeInputs, entityType);

  const tagIds = Array.isArray(config.tagIds)
    ? (config.tagIds as string[])
    : [];

  const { createEntityAction } = await import('../../entity-actions');
  const createRes = await createEntityAction(
    {
      name: resolvedName,
      contacts: [
        {
          name: resolvedName,
          email: resolvedEmail || undefined,
          phone: resolvedPhone || undefined,
          isPrimary: true,
          typeKey: 'primary'
        }
      ],
      customData,
      globalTags: [],
      workspaceTags: tagIds,
      ...nativePayload
    },
    `system-automation-create:${context.automationId}`,
    context.workspaceId,
    entityType,
    organizationId,
    true // forceCreate: true to bypass interactive duplicate prevention check inside server actions (since it's automated)
  );

  if (!createRes.success || !createRes.id) {
    throw new Error(`Create entity failed: ${createRes.error || 'Unknown error'}`);
  }

  // Update ExecutionContext and run log link
  context.entityId = createRes.id;
  context.entityType = entityType;

  await adminDb.collection('automation_runs').doc(context.runId).update({
    entityId: createRes.id,
    updatedAt: new Date().toISOString()
  });

  // Check and execute sub-automation if configured
  if (config.automationId) {
    const isTestRun = !!(context.payload.metadata as Record<string, unknown> | undefined)?.testStepRun;
    if (isTestRun) {
      console.log(`[CREATE_ENTITY] Skipping subsequent sub-automation "${config.automationId}" trigger because this is a test step dry run.`);
    } else {
      const chainDepth = context.chainDepth ?? 0;
      if (chainDepth >= MAX_AUTOMATION_CHAIN_DEPTH) {
        throw new Error(`Sub-automation trigger failed: recursion depth limit of ${MAX_AUTOMATION_CHAIN_DEPTH} reached.`);
      }

      const autoDoc = await adminDb.collection('automations').doc(config.automationId as string).get();
      if (autoDoc.exists) {
        const automation = { id: autoDoc.id, ...autoDoc.data() } as Automation;
        if (automation.isActive && !automation.isArchived) {
          const subPayload: Record<string, unknown> = {
            entityId: createRes.id,
            workspaceId: context.workspaceId,
            organizationId,
            entityName: resolvedName,
            entityType,
            assignedTo: null,
            _chainDepth: chainDepth + 1,
          };
          const { executeAutomation } = await import('../executor');
          await executeAutomation(automation, subPayload, chainDepth + 1);
        }
      }
    }
  }

  return { id: createRes.id };
}

export async function handleCreateContactForEntity(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  const resolvedEntityName = (config.entityName as string || '').trim();
  const resolvedContactName = (config.contactName as string || '').trim();
  const resolvedContactPhone = (config.contactPhone as string || '').trim();
  const resolvedContactEmail = (config.contactEmail as string || '').trim();
  const resolvedContactRole = (config.contactRole as string || '').trim();
  const resolvedIsPrimary = !!config.isPrimary;
  const resolvedIsSignatory = !!config.isSignatory;

  if (!resolvedEntityName) {
    throw new Error('Add contact failed: Target Entity Name is required for matching.');
  }
  if (!resolvedContactName) {
    throw new Error('Add contact failed: Contact Name is required.');
  }
  if (!resolvedContactPhone && !resolvedContactEmail) {
    throw new Error('Add contact failed: Either contact phone or email is required.');
  }

  // 1. Search for Entity by Match in workspace_entities
  let entityId = '';
  let entityType: EntityType | undefined;

  if (config.caseInsensitive) {
    const weSnap = await adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', context.workspaceId)
      .get();

    const matchedDoc = weSnap.docs.find(doc => {
      const dispName = (doc.data().displayName as string || '').trim();
      return dispName.toLowerCase() === resolvedEntityName.toLowerCase();
    });

    if (!matchedDoc) {
      throw new Error(`Add contact failed: Target entity with name "${resolvedEntityName}" (case-insensitive) not found in this workspace.`);
    }

    const weData = matchedDoc.data();
    entityId = weData.entityId;
    entityType = weData.entityType;
  } else {
    const weSnap = await adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', context.workspaceId)
      .where('displayName', '==', resolvedEntityName)
      .limit(1)
      .get();

    if (weSnap.empty) {
      throw new Error(`Add contact failed: Target entity with exact name "${resolvedEntityName}" not found in this workspace.`);
    }

    const weData = weSnap.docs[0].data();
    entityId = weData.entityId;
    entityType = weData.entityType;
  }

  // 2. Fetch parent entity from entities collection
  const entityRef = adminDb.collection('entities').doc(entityId);
  const entitySnap = await entityRef.get();
  if (!entitySnap.exists) {
    throw new Error(`Add contact failed: Universal entity document ${entityId} not found.`);
  }

  const entityData = entitySnap.data();
  const existingContacts = entityData?.entityContacts || [];

  // 3. Resolve default country code for phone normalization
  const organizationId = await resolveOrgId(context);
  let defaultCountryCode = 'GH';
  try {
    const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
    if (orgSnap.exists) {
      defaultCountryCode = orgSnap.data()?.defaultCountryCode || 'GH';
    }
  } catch (err) {}

  const crypto = await import('crypto');
  const { normalizePhoneNumber } = await import('../../phone-utils');
  const { normalizeContactType } = await import('../../entity-contact-helpers');

  let phone = resolvedContactPhone;
  let countryCode: string | undefined;
  let callingCode: string | undefined;
  if (phone) {
    const parsed = normalizePhoneNumber(phone, defaultCountryCode);
    phone = parsed.e164 || phone;
    countryCode = parsed.countryCode;
    callingCode = parsed.callingCode;
  }

  const newContact: any = {
    id: `ec_${crypto.randomUUID().substring(0, 8)}`,
    name: resolvedContactName,
    typeKey: normalizeContactType(resolvedContactRole || 'other'),
    typeLabel: resolvedContactRole || 'Other',
    isPrimary: resolvedIsPrimary,
    isSignatory: resolvedIsSignatory,
    order: existingContacts.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (resolvedContactEmail) newContact.email = resolvedContactEmail;
  if (phone) {
    newContact.phone = phone;
    if (countryCode) newContact.countryCode = countryCode;
    if (callingCode) newContact.callingCode = callingCode;
  }

  // 4. Update the entity via updateEntityAction
  const { updateEntityAction } = await import('../../entity-actions');
  const updateRes = await updateEntityAction(
    entityId,
    {
      entityContacts: [...existingContacts, newContact],
    },
    `system-automation-contact:${context.automationId}`,
    context.workspaceId,
    organizationId
  );

  if (!updateRes.success) {
    throw new Error(`Add contact failed: ${updateRes.error || 'Unknown error'}`);
  }

  // 5. Update context reference
  context.entityId = entityId;
  context.entityType = entityType;

  await adminDb.collection('automation_runs').doc(context.runId).update({
    entityId,
    updatedAt: new Date().toISOString()
  });
}

export async function handleUpdateContact(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  const filterEntityName = (config.filterEntityName as string || '').trim();
  const filterContactName = (config.filterContactName as string || '').trim();
  const filterContactPhone = (config.filterContactPhone as string || '').trim();
  const filterContactEmail = (config.filterContactEmail as string || '').trim();
  const matchLogic = (config.matchLogic as 'all' | 'any') || 'all';
  const caseInsensitive = !!config.caseInsensitive;

  if (!filterEntityName && !filterContactName && !filterContactPhone && !filterContactEmail) {
    throw new Error('Update contact failed: At least one filter criterion must be provided.');
  }

  // 1. Resolve organization default country code for phone normalization
  const organizationId = await resolveOrgId(context);
  let defaultCountryCode = 'GH';
  try {
    const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
    if (orgSnap.exists) {
      defaultCountryCode = (orgSnap.data()?.defaultCountryCode as string) || 'GH';
    }
  } catch (err) {}

  const { normalizePhoneNumber } = await import('../../phone-utils');
  const { normalizeContactType, enforceContactConstraints } = await import('../../entity-contact-helpers');

  const getNormalizedPhone = (p: string): string => {
    if (!p) return '';
    const parsed = normalizePhoneNumber(p, defaultCountryCode);
    return parsed.e164 || p.trim();
  };

  interface CandidateResult {
    entityId: string;
    contactId?: string;
  }

  const candidateResults: CandidateResult[] = [];

  const queryByEntityName = async (name: string): Promise<CandidateResult[]> => {
    const results: CandidateResult[] = [];
    if (caseInsensitive) {
      const { toSearchKey } = await import('../../entities/entity-cache-domain');
      const snap = await adminDb
        .collection('workspace_entities')
        .where('workspaceId', '==', context.workspaceId)
        .where('displayNameLower', '==', toSearchKey(name))
        .get();
      snap.docs.forEach((doc) => {
        const entityId = doc.data().entityId as string;
        if (entityId) results.push({ entityId });
      });
    } else {
      const snap = await adminDb
        .collection('workspace_entities')
        .where('workspaceId', '==', context.workspaceId)
        .where('displayName', '==', name)
        .get();
      snap.docs.forEach((doc) => {
        const entityId = doc.data().entityId as string;
        if (entityId) results.push({ entityId });
      });
    }
    return results;
  };

  const queryByContactEmail = async (email: string): Promise<CandidateResult[]> => {
    const results: CandidateResult[] = [];
    const snap = await adminDb
      .collection('workspace_contacts')
      .where('workspaceId', '==', context.workspaceId)
      .where('emailLower', '==', email.trim().toLowerCase())
      .get();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.entityId && data.contactId) {
        results.push({ entityId: data.entityId as string, contactId: data.contactId as string });
      }
    });
    return results;
  };

  const queryByContactPhone = async (phone: string): Promise<CandidateResult[]> => {
    const results: CandidateResult[] = [];
    const normPhone = getNormalizedPhone(phone);
    if (!normPhone) return results;
    const snap = await adminDb
      .collection('workspace_contacts')
      .where('workspaceId', '==', context.workspaceId)
      .where('phone', '==', normPhone)
      .get();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.entityId && data.contactId) {
        results.push({ entityId: data.entityId as string, contactId: data.contactId as string });
      }
    });
    return results;
  };

  const queryByContactName = async (name: string): Promise<CandidateResult[]> => {
    const results: CandidateResult[] = [];
    if (caseInsensitive) {
      const snap = await adminDb
        .collection('workspace_contacts')
        .where('workspaceId', '==', context.workspaceId)
        .where('nameLower', '==', name.trim().toLowerCase())
        .get();
      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.entityId && data.contactId) {
          results.push({ entityId: data.entityId as string, contactId: data.contactId as string });
        }
      });
    } else {
      const snap = await adminDb
        .collection('workspace_contacts')
        .where('workspaceId', '==', context.workspaceId)
        .where('name', '==', name.trim())
        .get();
      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.entityId && data.contactId) {
          results.push({ entityId: data.entityId as string, contactId: data.contactId as string });
        }
      });
    }
    return results;
  };

  // 2. Fetch initial candidate set
  if (matchLogic === 'all') {
    // Under AND logic, run the query for the most specific/restrictive field provided.
    let initialCandidates: CandidateResult[] = [];
    if (filterContactEmail) {
      initialCandidates = await queryByContactEmail(filterContactEmail);
    } else if (filterContactPhone) {
      initialCandidates = await queryByContactPhone(filterContactPhone);
    } else if (filterEntityName) {
      initialCandidates = await queryByEntityName(filterEntityName);
    } else if (filterContactName) {
      initialCandidates = await queryByContactName(filterContactName);
    }
    candidateResults.push(...initialCandidates);
  } else {
    // Under OR logic, run queries for all provided fields in parallel and take the union.
    const promises: Promise<CandidateResult[]>[] = [];
    if (filterEntityName) promises.push(queryByEntityName(filterEntityName));
    if (filterContactEmail) promises.push(queryByContactEmail(filterContactEmail));
    if (filterContactPhone) promises.push(queryByContactPhone(filterContactPhone));
    if (filterContactName) promises.push(queryByContactName(filterContactName));

    const resultsList = await Promise.all(promises);
    const seen = new Set<string>();
    for (const list of resultsList) {
      for (const item of list) {
        const key = `${item.entityId}:${item.contactId || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          candidateResults.push(item);
        }
      }
    }
  }

  const uniqueEntityIds = [...new Set(candidateResults.map((r) => r.entityId))];
  if (uniqueEntityIds.length === 0) {
    throw new Error('Update contact failed: No matching contact/entity found.');
  }

  // 3. Load full entities and perform in-memory evaluation
  const entitySnaps = await Promise.all(
    uniqueEntityIds.map((id) => adminDb.collection('entities').doc(id).get())
  );

  const entitiesData: Entity[] = entitySnaps
    .filter((snap) => snap.exists)
    .map((snap) => ({ id: snap.id, ...(snap.data() as Omit<Entity, 'id'>) } as Entity));

  interface MatchedItem {
    entity: Entity;
    entityId: string;
    contact: EntityContact;
  }

  const matches: MatchedItem[] = [];

  const isMatch = (entity: Entity, c: EntityContact): boolean => {
    const eNameMatch = filterEntityName ? (
      caseInsensitive
        ? entity.name.trim().toLowerCase() === filterEntityName.toLowerCase()
        : entity.name.trim() === filterEntityName
    ) : false;

    const cNameMatch = filterContactName ? (
      caseInsensitive
        ? c.name.trim().toLowerCase() === filterContactName.toLowerCase()
        : c.name.trim() === filterContactName
    ) : false;

    const cEmailMatch = filterContactEmail ? (
      c.email ? (
        c.email.trim().toLowerCase() === filterContactEmail.toLowerCase()
      ) : false
    ) : false;

    const cPhoneMatch = filterContactPhone ? (
      c.phone ? (
        getNormalizedPhone(c.phone) === getNormalizedPhone(filterContactPhone)
      ) : false
    ) : false;

    if (matchLogic === 'all') {
      const conds: boolean[] = [];
      if (filterEntityName) conds.push(eNameMatch);
      if (filterContactName) conds.push(cNameMatch);
      if (filterContactEmail) conds.push(cEmailMatch);
      if (filterContactPhone) conds.push(cPhoneMatch);
      return conds.every(Boolean);
    } else {
      if (filterEntityName && eNameMatch) return true;
      if (filterContactName && cNameMatch) return true;
      if (filterContactEmail && cEmailMatch) return true;
      if (filterContactPhone && cPhoneMatch) return true;
      return false;
    }
  };

  for (const entity of entitiesData) {
    const contacts = entity.entityContacts || [];
    for (const c of contacts) {
      if (isMatch(entity, c)) {
        matches.push({ entity, entityId: entity.id, contact: c });
      }
    }
  }

  // 4. Resolve matches and handle tie-breakers
  const matchedEntitiesMap = new Map<string, MatchedItem[]>();
  matches.forEach((item) => {
    const list = matchedEntitiesMap.get(item.entityId) || [];
    list.push(item);
    matchedEntitiesMap.set(item.entityId, list);
  });

  if (matchedEntitiesMap.size === 0) {
    throw new Error('Update contact failed: No matching contact/entity found.');
  }

  if (matchedEntitiesMap.size > 1) {
    const matchedNames = Array.from(matchedEntitiesMap.values()).map((list) => list[0].entity.name);
    throw new Error(`Update contact failed: Multiple matching entities found (${matchedNames.join(', ')}). Please make your filters more specific.`);
  }

  const singleEntityId = Array.from(matchedEntitiesMap.keys())[0];
  const entityMatches = matchedEntitiesMap.get(singleEntityId)!;

  let targetItem = entityMatches.find((item) => item.contact.isPrimary);
  if (!targetItem) {
    targetItem = entityMatches[0];
  }
  const targetContact = targetItem.contact;

  // 5. Apply Updates
  const resolvedName = (config.contactName as string || '').trim();
  const resolvedPhone = (config.contactPhone as string || '').trim();
  const resolvedEmail = (config.contactEmail as string || '').trim();
  const resolvedRole = (config.contactRole as string || '').trim();

  const existingContacts = targetItem.entity.entityContacts || [];
  const updatedContacts = existingContacts.map((c) => {
    if (c.id === targetContact.id) {
      const updated: EntityContact = { ...c };
      if (resolvedName !== '') {
        updated.name = resolvedName;
      }
      if (resolvedEmail !== '') {
        updated.email = resolvedEmail;
      }
      if (resolvedPhone !== '') {
        const parsed = normalizePhoneNumber(resolvedPhone, defaultCountryCode);
        updated.phone = parsed.e164 || resolvedPhone;
        if (parsed.countryCode) updated.countryCode = parsed.countryCode;
        if (parsed.callingCode) updated.callingCode = parsed.callingCode;
      }
      if (resolvedRole !== '') {
        updated.typeKey = normalizeContactType(resolvedRole);
        updated.typeLabel = resolvedRole;
      }
      if (config.isPrimary !== undefined) {
        updated.isPrimary = !!config.isPrimary;
      }
      if (config.isSignatory !== undefined) {
        updated.isSignatory = !!config.isSignatory;
      }
      updated.updatedAt = new Date().toISOString();
      return updated;
    }
    return c;
  });

  const finalContacts = enforceContactConstraints(updatedContacts);

  const { updateEntityAction } = await import('../../entity-actions');
  const updateRes = await updateEntityAction(
    singleEntityId,
    {
      entityContacts: finalContacts,
    },
    `system-automation-contact:${context.automationId}`,
    context.workspaceId,
    organizationId
  );

  if (!updateRes.success) {
    throw new Error(`Update contact failed: ${updateRes.error || 'Unknown error'}`);
  }

  // 6. Update context reference and ledger
  context.entityId = singleEntityId;
  const targetEntityType = targetItem.entity.entityType || 'institution';
  context.entityType = targetEntityType;

  await adminDb.collection('automation_runs').doc(context.runId).update({
    entityId: singleEntityId,
    updatedAt: new Date().toISOString()
  });
}
