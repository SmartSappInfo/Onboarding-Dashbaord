'use server';

import { adminDb } from './firebase-admin';
import { logActivity } from './activity-logger';
import { createEntityAction } from './entity-actions';
import { linkEntityToWorkspaceAction } from './workspace-entity-actions';
import type { FocalPerson, InstitutionData, EntityContact } from './types';

/**
 * @fileOverview Server actions for signup flow using unified entity architecture.
 * Implements Requirements 10.1, 10.2, 10.3, 10.4, 10.5 from the SchoolId to EntityId migration.
 * FER-01: Exclusively uses `entityContacts`.
 */

interface SignupInput {
  // Organization details
  organizationId: string;
  workspaceId: string;
  name: string;
  location: string;
  
  // Contacts — canonical format
  entityContacts?: EntityContact[];
  
  // Institution-specific data
  nominalRoll: number;
  billingAddress?: string;
  currency?: string;
  subscriptionPackageId?: string;
  subscriptionPackageName?: string;
  subscriptionRate?: number;
  discountPercentage?: number;
  arrearsBalance?: number;
  creditBalance?: number;
  modules?: Array<{
    id: string;
    name: string;
    abbreviation: string;
    color: string;
  }>;
  implementationDate?: string;
  referee?: string;
  includeDroneFootage?: boolean;
  
  // Pipeline assignment
  pipelineId: string;
  stageId: string;
  
  // User context for activity logging
  userId?: string;
}

/**
 * Handles new contact signup by creating entity and workspace_entity records.
 * Does NOT create legacy school records.
 * 
 * Requirements:
 * - 10.1: Create entity record with entityId
 * - 10.2: Create workspace_entity record linking entity to workspace
 * - 10.3: Do not create legacy school records for new signups
 * - 10.4: Assign unique entityId using format entity_<random_id>
 * - 10.5: Log activity with entityId reference
 */
export async function handleSignupAction(input: SignupInput) {
  try {
    const timestamp = new Date().toISOString();
    
    // Generate unique entityId using format entity_<random_id>
    // Using Firestore's auto-generated ID as the random component (Requirement 10.4)
    const tempRef = adminDb.collection('_temp').doc();
    const randomId = tempRef.id;
    const entityId = `entity_${randomId}`;
    
    // Prepare institution data
    const institutionData: InstitutionData = {
      nominalRoll: input.nominalRoll,
      billingAddress: input.billingAddress,
      currency: input.currency || 'GHS',
      subscriptionPackageId: input.subscriptionPackageId,
      subscriptionRate: input.subscriptionRate,
      modules: input.modules,
      implementationDate: input.implementationDate,
      referee: input.referee,
    };
    
    // Step 1: Create entity record (Requirement 10.1)
    // FER-01: Pass canonical entityContacts
    const contactData = { entityContacts: input.entityContacts || [] };

    const createResult = await createEntityAction(
      {
        name: input.name,
        ...contactData,
        institutionData,
      },
      input.userId || 'system',
      input.workspaceId,
      'institution',
      input.organizationId
    );
    
    if (!createResult.success) {
      return {
        success: false,
        error: `Failed to create entity: ${createResult.error}`,
      };
    }
    
    if (!createResult.id) {
      return {
        success: false,
        error: 'Entity creation succeeded but no ID was returned',
      };
    }
    
    const createdEntityId = createResult.id;
    
    // Step 2: Link entity to workspace (Requirement 10.2)
    const linkResult = await linkEntityToWorkspaceAction({
      entityId: createdEntityId,
      workspaceId: input.workspaceId,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      userId: input.userId || 'system',
    });
    
    if (!linkResult.success) {
      // Rollback: Delete the entity we just created
      await adminDb.collection('entities').doc(createdEntityId).delete();
      
      return {
        success: false,
        error: `Failed to link entity to workspace: ${linkResult.error}`,
      };
    }
    
    // Step 3: Log signup completion activity with entityId (Requirement 10.5)
    await logActivity({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      entityId: createdEntityId,
      entityType: 'institution',
      displayName: input.name,
      userId: input.userId || 'system',
      type: 'signup_completed',
      source: 'signup_form',
      description: `New institution "${input.name}" signed up`,
      metadata: {
        nominalRoll: input.nominalRoll,
        location: input.location,
        implementationDate: input.implementationDate,
        referee: input.referee,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
      },
    });
    
    return {
      success: true,
      entityId: createdEntityId,
      workspaceEntityId: linkResult.workspaceEntityId,
    };
  } catch (e: any) {
    console.error('>>> [SIGNUP:ACTION] Failed:', e.message);
    return {
      success: false,
      error: e.message,
    };
  }
}
