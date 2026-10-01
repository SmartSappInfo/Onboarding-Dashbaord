import { NextRequest, NextResponse } from 'next/server';
import { EntityInputSchema, createEntityCore } from '@/lib/crm/entity-core';
import { linkEntityToWorkspaceCore } from '@/lib/crm/workspace-entity-core';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';
import type { EntityType, EntityContact, EntityCustomData, AssignedUser } from '@/lib/types';

/**
 * @fileOverview Contacts API endpoint for entity creation
 * Requirements: 24.5 - Create entity and workspace_entity records for new contacts
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Security: Protected by `authenticateApiRequest` with workspace and tenant scoping.
 * - Traceability: Uses the verified authenticated caller's identity for audit logs.
 * - Zero `any` or `any[]` typing.
 */

interface CreateContactRequestBody {
  organizationId?: string;
  workspaceId?: string;
  entityType?: string;
  name?: string;
  contacts?: EntityContact[];
  institutionData?: Record<string, EntityCustomData>;
  familyData?: Record<string, EntityCustomData>;
  personData?: Record<string, EntityCustomData>;
  pipelineId?: string;
  stageId?: string;
  assignedTo?: AssignedUser;
  workspaceTags?: string[];
  globalTags?: string[];
  userId?: string;
  userName?: string;
  userEmail?: string;
}

/**
 * POST /api/contacts
 * Create a new contact as an entity
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateContactRequestBody;
    const {
      organizationId,
      workspaceId,
      entityType,
      name,
      contacts,
      institutionData,
      familyData,
      personData,
      pipelineId,
      stageId,
      assignedTo,
      workspaceTags,
      globalTags,
    } = body;

    // Validate required fields
    if (!organizationId || !workspaceId || !entityType || !name) {
      return NextResponse.json(
        { error: 'organizationId, workspaceId, entityType, and name are required' },
        { status: 400 }
      );
    }

    if (!['institution', 'family', 'person'].includes(entityType)) {
      return NextResponse.json(
        { error: 'entityType must be one of: institution, family, person' },
        { status: 400 }
      );
    }

    // Authenticate caller and verify workspace access
    const authResult = await authenticateApiRequest(request, {
      requiredWorkspaceId: workspaceId,
      requiredOrgId: organizationId,
    });

    if (!authResult.success) {
      return authResult.errorResponse;
    }

    const { user } = authResult;
    const callerId = user.uid;
    const callerName = user.profile.name || user.email || 'Authorized User';
    const callerEmail = user.email || 'system@smartsapp.com';

    // Step 1: Create entity record (Requirement 24.5)
    // Route handler (token-authenticated caller): the entity core runs as that user (N1).
    const parsedEntity = EntityInputSchema.safeParse({
      name,
      contacts: contacts || [],
      globalTags: globalTags || [],
      institutionData: entityType === 'institution' ? institutionData : undefined,
      familyData: entityType === 'family' ? familyData : undefined,
      personData: entityType === 'person' ? personData : undefined,
      userName: callerName,
      userEmail: callerEmail,
    });
    if (!parsedEntity.success) {
      return NextResponse.json({ error: 'Invalid entity details' }, { status: 400 });
    }
    const entityResult = await createEntityCore(
      { kind: 'user', uid: callerId },
      { data: parsedEntity.data, workspaceId, entityType: entityType as EntityType, organizationId }
    );

    if (!entityResult.success || !entityResult.id) {
      return NextResponse.json(
        { error: entityResult.error || 'Failed to create entity' },
        { status: 500 }
      );
    }

    const entityId = entityResult.id;

    // Step 2: Create workspace_entity record (Requirement 24.5)
    const workspaceEntityResult = await linkEntityToWorkspaceCore({ kind: 'user', uid: callerId }, {
      entityId,
      workspaceId,
      pipelineId: pipelineId || '',
      stageId: stageId || '',
      assignedTo: assignedTo ? {
        userId: assignedTo.userId ?? assignedTo.id ?? null,
        name: assignedTo.name ?? null,
        email: assignedTo.email ?? null,
      } : { userId: null, name: null, email: null },
      userId: callerId,
      userName: callerName,
      userEmail: callerEmail,
    });

    if (!workspaceEntityResult.success) {
      return NextResponse.json(
        { error: workspaceEntityResult.error || 'Failed to create workspace entity' },
        { status: 500 }
      );
    }

    // Return both entity and workspace_entity data (Requirement 24.2)
    return NextResponse.json(
      {
        entity: {
          id: entityId,
          organizationId,
          entityType,
          name,
          contacts: contacts || [],
          globalTags: globalTags || [],
          status: 'active',
          institutionData: entityType === 'institution' ? institutionData : undefined,
          familyData: entityType === 'family' ? familyData : undefined,
          personData: entityType === 'person' ? personData : undefined,
          createdAt: new Date().toISOString(),
        },
        workspaceEntity: {
          id: workspaceEntityResult.workspaceEntityId,
          workspaceId,
          entityId,
          entityType,
          pipelineId: pipelineId || '',
          stageId: stageId || '',
          status: 'active',
          workspaceTags: workspaceTags || [],
          displayName: name,
          assignedTo: assignedTo || null,
          addedAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[API:CONTACTS:POST] Error:', error);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
