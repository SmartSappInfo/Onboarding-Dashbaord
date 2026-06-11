import { adminDb } from '../../firebase-admin';
import { resolveContact } from '../../contact-adapter';
import { logActivity } from '../../activity-logger';
import type { ExecutionContext } from '../execution-types';

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

export async function handleUpdateEntity(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  if (!context.entityId) throw new Error('Cannot update entity: Context missing entityId.');

  const contact = await resolveContact(context.entityId, context.workspaceId);
  if (!contact?.entityId) throw new Error('Cannot update entity: Contact not found.');

  const timestamp = new Date().toISOString();
  const identityFields = ['name', 'slug', 'displayName'];
  const identityUpdates: Record<string, unknown> = { updatedAt: timestamp };
  const workspaceUpdates: Record<string, unknown> = { updatedAt: timestamp };
  const customDataUpdates: Record<string, unknown> = {};

  const updates = (config.updates || config) as Record<string, unknown>;
  if (config.pipelineId) workspaceUpdates.pipelineId = config.pipelineId;
  if (config.stageId) workspaceUpdates.stageId = config.stageId;
  if (config.assignedTo) workspaceUpdates.assignedTo = config.assignedTo;


  if (updates && typeof updates === 'object') {
    for (const [key, value] of Object.entries(updates)) {
      if (identityFields.includes(key)) {
        identityUpdates[key] = value;
      } else if (['pipelineId', 'stageId', 'assignedTo', 'workspaceTags'].includes(key)) {
        workspaceUpdates[key] = value;
      } else if (
        key !== 'updates' &&
        key !== 'pipelineId' &&
        key !== 'stageId' &&
        key !== 'assignedTo'
      ) {
        customDataUpdates[key] = value;
      }
    }
  }

  if (Object.keys(identityUpdates).length > 1 || Object.keys(customDataUpdates).length > 0) {
    const payload: Record<string, any> = { ...identityUpdates };
    if (Object.keys(customDataUpdates).length > 0) {
      for (const [k, v] of Object.entries(customDataUpdates)) {
        payload[`customData.${k}`] = v;
      }
    }
    await adminDb.collection('entities').doc(contact.entityId).update(payload);
  }

  if (contact.workspaceEntityId && Object.keys(workspaceUpdates).length > 1) {
    await adminDb
      .collection('workspace_entities')
      .doc(contact.workspaceEntityId)
      .update(workspaceUpdates);
  }

  // Log to activity feed — exclude the auto-added updatedAt so we only surface real field changes
  const changedFields = Object.keys({
    ...identityUpdates,
    ...workspaceUpdates,
    ...customDataUpdates,
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
): Promise<void> {
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

  const validFieldKeys = new Set(appFieldsSnap.docs.map(doc => doc.data().id || doc.data().name));

  // Extract and filter custom fields
  const customData: Record<string, unknown> = {};
  const configCustomData = (config.customData || {}) as Record<string, unknown>;
  for (const [key, val] of Object.entries(configCustomData)) {
    if (validFieldKeys.has(key)) {
      customData[key] = val;
    } else {
      console.warn(`[CREATE_ENTITY] Ignored custom field key "${key}" since it is not defined in the workspace app_fields.`);
    }
  }

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
      workspaceTags: []
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

  // 1. Search for Entity by Exact Match in workspace_entities
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
  const entityId = weData.entityId;
  const entityType = weData.entityType;

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
