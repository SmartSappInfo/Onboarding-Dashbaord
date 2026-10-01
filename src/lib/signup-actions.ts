'use server';

import { logActivity } from './activity-logger';
import { EntityInputSchema, createEntityCore } from './crm/entity-core';
import { SIGNUP_WORKSPACE_ID, pinSignupTarget } from './signup-target';
import type { InstitutionData, EntityContact } from './types';
import { requireAuth } from '@/lib/auth/require-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

/**
 * @fileOverview Server actions for signup flow using unified entity architecture.
 * Implements Requirements 10.1, 10.2, 10.3, 10.4, 10.5 from the SchoolId to EntityId migration.
 * FER-01: Exclusively uses `entityContacts`.
 */

export interface SignupInput {
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
  
  // Pipeline assignment (optional for public signups)
  pipelineId?: string;
  stageId?: string;
  
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
export async function handleSignupAction(rawInput: SignupInput) {
  // SECURITY (audit F2 / N1): identity from the session; the target workspace is fixed server-side.
  const { uid } = await requireAuth();
  const input = await pinSignupTarget(rawInput, uid);

  try {
    const _timestamp = new Date().toISOString();
    
    
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

    const createResult = await createEntityCore(
      { kind: 'service', service: 'signup', workspaceId: SIGNUP_WORKSPACE_ID, onBehalfOf: uid },
      {
        data: EntityInputSchema.parse({ name: input.name, ...contactData, institutionData }),
        workspaceId: SIGNUP_WORKSPACE_ID,
        entityType: 'institution',
        organizationId: input.organizationId,
        forceCreate: true, // public new school signup flow
      }
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
    
    // Note: createEntityAction already creates the workspace_entity record,
    // so we do NOT call linkEntityToWorkspaceAction here (that would double-link
    // and fail on contactScope validation for public routes).
    
    // Step 2: Log signup completion activity with entityId (Requirement 10.5)
    await logActivity({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      entityId: createdEntityId,
      entityType: 'institution',
      displayName: input.name,
      userId: input.userId || 'system-signup',
      type: 'signup_completed',
      source: 'signup_form',
      description: `New institution "${input.name}" signed up`,
      metadata: {
        nominalRoll: input.nominalRoll,
        location: input.location,
        implementationDate: input.implementationDate,
        referee: input.referee,
        ...(input.pipelineId ? { pipelineId: input.pipelineId } : {}),
        ...(input.stageId ? { stageId: input.stageId } : {}),
      },
    });
    
    return {
      success: true,
      entityId: createdEntityId,
    };
  } catch (e: unknown) {
    console.error('>>> [SIGNUP:ACTION] Failed:', getErrorMessage(e));
    return {
      success: false,
      error: getErrorMessage(e),
    };
  }
}
