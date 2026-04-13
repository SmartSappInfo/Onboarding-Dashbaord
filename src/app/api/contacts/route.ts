import { NextRequest, NextResponse } from 'next/server';
import { createEntityAction } from '@/lib/entity-actions';
import { linkEntityToWorkspaceAction } from '@/lib/workspace-entity-actions';
import type { EntityType } from '@/lib/types';

/**
 * @fileOverview Contacts API endpoint for entity creation
 * Requirements: 24.5 - Create entity and workspace_entity records for new contacts
 */

/**
 * POST /api/contacts
 * Create a new contact as an entity (no legacy school records)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
      userId,
      userName,
      userEmail
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

    // Step 1: Create entity record (Requirement 24.5)
    const entityResult = await createEntityAction(
      {
        name,
        contacts: contacts || [],
        globalTags: globalTags || [],
        institutionData: entityType === 'institution' ? institutionData : undefined,
        familyData: entityType === 'family' ? familyData : undefined,
        personData: entityType === 'person' ? personData : undefined,
        userName,
        userEmail
      },
      userId || 'system',
      workspaceId,
      entityType as EntityType,
      organizationId
    );

    if (!entityResult.success || !entityResult.id) {
      return NextResponse.json(
        { error: entityResult.error || 'Failed to create entity' },
        { status: 500 }
      );
    }

    const entityId = entityResult.id;

    // Step 2: Create workspace_entity record (Requirement 24.5)
    const workspaceEntityResult = await linkEntityToWorkspaceAction({
      entityId,
      workspaceId,
      pipelineId: pipelineId || '',
      stageId: stageId || '',
      assignedTo: assignedTo || { userId: null, name: null, email: null },
      userId: 'system', // TODO: Get from auth context
      userName: 'System',
      userEmail: 'system@smartsapp.com'
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
          createdAt: new Date().toISOString()
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
          addedAt: new Date().toISOString()
        }
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API:CONTACTS:POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
