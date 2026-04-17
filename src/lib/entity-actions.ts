'use server';

import { adminDb } from './firebase-admin';
import { logActivity } from './activity-logger';
import { revalidatePath } from 'next/cache';
import type { School, OnboardingStage, EntityType, EntityContact } from './types';
import crypto from 'crypto';
import {
  focalPersonToEntityContact,
  enforceContactConstraints,
  extractPrimaryContactFields,
  entityContactToFocalPerson,
  normalizeContactType,
} from './entity-contact-helpers';
import { canUser } from './workspace-permissions';

/**
 * @fileOverview Server actions for entity lifecycle management.
 * Handles polymorphic creation and track transitions.
 */

export async function convertToOnboardingAction(
    entityId: string, 
    targetPipelineId: string, 
    userId: string
) {
    try {
        const timestamp = new Date().toISOString();
        
        // This is a bridge function. Depending on the migration state, it targets entity records.
        // For now, looking up via workspace_entities.
        const weSnap = await adminDb.collection('workspace_entities')
            .where('entityId', '==', entityId)
            .limit(1)
            .get();

        if (weSnap.empty) {
            throw new Error("Workspace entity record not found.");
        }

        const we = weSnap.docs[0];
        const weData = we.data();

        // 1. Resolve target pipeline's initial stage
        const stagesSnap = await adminDb.collection('onboardingStages')
            .where('pipelineId', '==', targetPipelineId)
            .orderBy('order', 'asc')
            .limit(1)
            .get();

        if (stagesSnap.empty) throw new Error("Target pipeline has no defined stages.");
        const firstStage = stagesSnap.docs[0].data();

        // 2. Execute Track Transition
        await we.ref.update({
            pipelineId: targetPipelineId,
            stageId: stagesSnap.docs[0].id,
            currentStageName: firstStage.name,
            updatedAt: timestamp
        });

        // 3. Log Conversion Success
        await logActivity({
            entityId: entityId,
            entityType: weData.entityType as EntityType,
            displayName: weData.displayName,
            organizationId: weData.organizationId || 'default',
            userId,
            workspaceId: weData.workspaceId,
            type: 'pipeline_stage_changed',
            source: 'user_action',
            description: `successfully converted "${weData.displayName}" to a new pipeline.`,
            metadata: { 
                conversionDate: timestamp, 
                targetPipeline: targetPipelineId,
            }
        });

        revalidatePath('/admin/entities');
        revalidatePath('/admin/pipeline');
        revalidatePath(`/admin/entities/${entityId}`);

        return { success: true };
    } catch (e: any) {
        console.error(">>> [ENTITY:CONVERT] Failed:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Creates a new Entity record across 'entities' and 'workspace_entities'.
 * Uses server-side Firebase Admin SDK to bypass client-side security rules.
 */
export async function createEntityAction(
    data: any,
    userId: string,
    workspaceId: string, 
    entityType: EntityType,
    organizationId: string = 'smartsapp-hq'
) {
  try {
    // 0. Permission Check (Requirement: Permissions Expansion Layer 2)
    const permission = await canUser(userId, 'operations', 'campuses', 'create', workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason };
    }

    const timestamp = new Date().toISOString();
    const entityId = `entity_${crypto.randomUUID()}`;
    
    let displayName = data.name || '';
    if (entityType === 'person' && data.personData) {
        displayName = `${data.personData.firstName} ${data.personData.lastName}`.trim();
    }
    
    const slug = displayName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    let initialPipelineId = 'default_pipeline';
    let defaultStage = { 
      id: 'stg_default_0', 
      name: 'Welcome', 
      order: 1, 
    };

    // Try to get the actual pipeline for the workspace
    const pipelinesSnap = await adminDb.collection('pipelines')
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();

    if (!pipelinesSnap.empty) {
      initialPipelineId = pipelinesSnap.docs[0].id;

      // Get the first stage of this pipeline
      const stagesSnap = await adminDb.collection('onboardingStages')
        .where('pipelineId', '==', initialPipelineId)
        .orderBy('order', 'asc')
        .limit(1)
        .get();

      if (!stagesSnap.empty) {
        const stageData = stagesSnap.docs[0].data();
        defaultStage = {
          id: stagesSnap.docs[0].id,
          name: stageData.name,
          order: stageData.order,
        };
      }
    }

    // FER-01: Convert incoming contacts to EntityContact format
    const rawContacts: EntityContact[] = (data.contacts || data.entityContacts || []).map(
      (c: any, i: number) => {
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
          if (c.phone) contact.phone = c.phone;
          if (c.notes !== undefined) contact.notes = c.notes;
          if (c.attachments !== undefined) contact.attachments = c.attachments;
          
          return contact as EntityContact;
        }
        // Legacy FocalPerson shape — convert
        return focalPersonToEntityContact(c, i);
      }
    );

    // Enforce exactly one primary and one signatory
    const entityContacts = enforceContactConstraints(rawContacts);

    // Extract denormalized primary fields
    const { primaryContactName, primaryEmail, primaryPhone } = extractPrimaryContactFields({ entityContacts, contacts: [] });

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
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Append Polymorphic Data
    if (entityType === 'institution' && data.institutionData) {
        entityData.institutionData = data.institutionData;
    } else if (entityType === 'family' && data.familyData) {
        entityData.familyData = data.familyData;
    } else if (entityType === 'person' && data.personData) {
        entityData.personData = data.personData;
    }

    // Save to Universal Identity Collection
    await adminDb.collection('entities').doc(entityId).set(entityData);

    // Prepare Workspace Entity Document
    const workspaceEntityId = `${workspaceId}_${entityId}`;
    const workspaceEntityData = {
        id: workspaceEntityId,
        organizationId,
        workspaceId,
        entityId,
        entityType,
        pipelineId: initialPipelineId,
        stageId: defaultStage.id,
        currentStageName: defaultStage.name,
        assignedTo: data.assignedTo || null,
        status: 'active',
        workspaceTags: data.workspaceTags || [],
        addedAt: timestamp,
        updatedAt: timestamp,
        displayName: displayName,
        // Denormalized contact fields from entityContacts (FER-01)
        primaryContactName,
        primaryEmail,
        primaryPhone,
        entityContacts, // Denormalized for list performance
        interests: data.modules || [],
    };

    // Save to Operational Workspace Collection
    await adminDb.collection('workspace_entities').doc(workspaceEntityId).set(workspaceEntityData);

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
    });

    revalidatePath('/admin/entities');
    revalidatePath('/admin/pipeline');

    return { success: true, id: entityId };
  } catch (e: any) {
    console.error(">>> [ENTITY:CREATE] Failed:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Updates an existing Entity record across 'entities', 'workspace_entities',
 * and the legacy 'schools' collection (Dual Write).
 */
export async function updateEntityAction(
    entityId: string,
    data: any,
    userId: string,
    workspaceId: string,
    organizationId: string
) {
  try {
    // 0. Permission Check (Requirement: Permissions Expansion Layer 2)
    const permission = await canUser(userId, 'operations', 'campuses', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason };
    }

    const timestamp = new Date().toISOString();
    
    // 1. Resolve Entity reference
    const entityRef = adminDb.collection('entities').doc(entityId);
    const entitySnap = await entityRef.get();
    
    let entityType: EntityType = 'institution'; // default
    let displayName = data.name || '';
    
    if (entitySnap.exists) {
        entityType = entitySnap.data()?.entityType || 'institution';
    }

    if (entityType === 'person' && data.personData) {
        displayName = `${data.personData.firstName} ${data.personData.lastName}`.trim();
    }

    // 2. FER-01: Convert incoming contacts to EntityContact format if contacts are provided
    let entityContacts: EntityContact[] | undefined;
    let legacyContacts: any[] | undefined;

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
          return focalPersonToEntityContact(c, i);
        }
      );
      entityContacts = enforceContactConstraints(rawContacts);
    }

    // Prepare Base Entity Update (Identity)
    const entityUpdate: any = {
      name: displayName,
      updatedAt: timestamp,
    };
    
    if (entityContacts) {
      entityUpdate.entityContacts = entityContacts;
    }
    if (data.globalTags) entityUpdate.globalTags = data.globalTags;
    if (data.status) entityUpdate.status = data.status.toLowerCase();

    if (entityType === 'institution' && data.institutionData) {
        entityUpdate.institutionData = data.institutionData;
    } else if (entityType === 'family' && data.familyData) {
        entityUpdate.familyData = data.familyData;
    } else if (entityType === 'person' && data.personData) {
        entityUpdate.personData = data.personData;
    }

    // 3. Update Universal Identity Collection
    if (entitySnap.exists) {
        await entityRef.update(entityUpdate);
    } else {
        console.warn(`Entity ${entityId} not found in entities collection during update.`);
    }

    // 4. Update Workspace Entity (Operational)
    const workspaceEntityId = `${workspaceId}_${entityId}`;
    const weRef = adminDb.collection('workspace_entities').doc(workspaceEntityId);
    const weSnap = await weRef.get();
    
    if (weSnap.exists) {
        const weUpdate: any = {
            displayName: displayName,
            updatedAt: timestamp,
        };
        
        if (data.assignedTo !== undefined) weUpdate.assignedTo = data.assignedTo;
        if (data.status) weUpdate.status = data.status.toLowerCase();
        if (data.workspaceTags) weUpdate.workspaceTags = data.workspaceTags;
        
        // FER-01: Sync entityContacts and denormalized fields
        if (entityContacts) {
            const { primaryContactName, primaryEmail, primaryPhone } = extractPrimaryContactFields({ entityContacts, contacts: [] });
            weUpdate.primaryContactName = primaryContactName;
            weUpdate.primaryEmail = primaryEmail;
            weUpdate.primaryPhone = primaryPhone;
            weUpdate.entityContacts = entityContacts;
        } else {
            if (data.primaryEmail !== undefined) weUpdate.primaryEmail = data.primaryEmail;
            if (data.primaryPhone !== undefined) weUpdate.primaryPhone = data.primaryPhone;
        }

        if (data.modules !== undefined) {
            weUpdate.interests = data.modules;
        }
        
        await weRef.update(weUpdate);
    } else {
        console.warn(`Workspace entity ${workspaceEntityId} not found during update.`);
    }

    // 5. Update lifecycle status if provided in workspace_entities
    if (data.lifecycleStatus && weSnap.exists) {
        await weRef.update({
            lifecycleStatus: data.lifecycleStatus,
            updatedAt: timestamp
        });
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

    return { success: true };
  } catch (e: any) {
    console.error(">>> [ENTITY:UPDATE] Failed:", e.message);
    return { success: false, error: e.message };
  }
}
