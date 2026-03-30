import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { updateEntityAction } from '@/lib/entity-actions';
import { updateWorkspaceEntityAction } from '@/lib/workspace-entity-actions';
import type { Entity, WorkspaceEntity } from '@/lib/types';

/**
 * @fileOverview Contact detail API endpoint
 * Requirements: 24.1, 24.2
 */

/**
 * GET /api/contacts/[entityId]
 * Get contact details including both identity and workspace-specific data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityId: string }> }
) {
  try {
    const { entityId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Fetch entity data
    const entityDoc = await adminDb.collection('entities').doc(entityId).get();
    
    if (!entityDoc.exists) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    const entity = { id: entityDoc.id, ...entityDoc.data() } as Entity;

    // Fetch workspace-specific data
    const workspaceEntityId = `${workspaceId}_${entityId}`;
    const workspaceEntityDoc = await adminDb
      .collection('workspace_entities')
      .doc(workspaceEntityId)
      .get();

    let workspaceData = null;
    if (workspaceEntityDoc.exists) {
      const workspaceEntity = workspaceEntityDoc.data() as WorkspaceEntity;
      workspaceData = {
        workspaceId: workspaceEntity.workspaceId,
        pipelineId: workspaceEntity.pipelineId,
        stageId: workspaceEntity.stageId,
        currentStageName: workspaceEntity.currentStageName,
        assignedTo: workspaceEntity.assignedTo,
        workspaceTags: workspaceEntity.workspaceTags,
        lastContactedAt: workspaceEntity.lastContactedAt,
        status: workspaceEntity.status
      };
    }

    // Return combined data (Requirement 24.2)
    return NextResponse.json({
      id: entity.id,
      organizationId: entity.organizationId,
      entityType: entity.entityType,
      name: entity.name,
      slug: entity.slug,
      contacts: entity.contacts,
      globalTags: entity.globalTags,
      status: entity.status,
      institutionData: entity.institutionData,
      familyData: entity.familyData,
      personData: entity.personData,
      workspaceData,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  } catch (error: any) {
    console.error('[API:CONTACTS:GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/contacts/[entityId]
 * Update contact information (routes to appropriate collections)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entityId: string }> }
) {
  try {
    const { entityId } = await params;
    const body = await request.json();
    const {
      workspaceId,
      // Identity fields (go to entities collection)
      name,
      contacts,
      globalTags,
      institutionData,
      familyData,
      personData,
      // Operational fields (go to workspace_entities collection)
      pipelineId,
      stageId,
      assignedTo,
      workspaceTags,
      status
    } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Update entity if identity fields provided (Requirement 11.4)
    const hasIdentityUpdates = name || contacts || globalTags || institutionData || familyData || personData;
    if (hasIdentityUpdates) {
      const entityResult = await updateEntityAction({
        entityId,
        workspaceId,
        userId: 'api-user', // TODO: Get from auth token
        name,
        contacts,
        institutionData,
        familyData,
        personData
      });

      if (!entityResult.success) {
        return NextResponse.json(
          { error: entityResult.error || 'Failed to update entity' },
          { status: 500 }
        );
      }
    }

    // Update workspace_entity if operational fields provided (Requirement 11.5)
    const hasOperationalUpdates = pipelineId || stageId || assignedTo || workspaceTags || status;
    if (hasOperationalUpdates) {
      const workspaceEntityResult = await updateWorkspaceEntityAction({
        workspaceEntityId: `${workspaceId}_${entityId}`,
        userId: 'api-user', // TODO: Get from auth token
        pipelineId,
        stageId,
        assignedTo,
        workspaceTags,
        status
      });

      if (!workspaceEntityResult.success) {
        return NextResponse.json(
          { error: workspaceEntityResult.error || 'Failed to update workspace entity' },
          { status: 500 }
        );
      }
    }

    // Fetch updated data
    const entityDoc = await adminDb.collection('entities').doc(entityId).get();
    const entity = { id: entityDoc.id, ...entityDoc.data() } as Entity;

    const workspaceEntityDoc = await adminDb
      .collection('workspace_entities')
      .doc(`${workspaceId}_${entityId}`)
      .get();

    let workspaceData = null;
    if (workspaceEntityDoc.exists) {
      const workspaceEntity = workspaceEntityDoc.data() as WorkspaceEntity;
      workspaceData = {
        workspaceId: workspaceEntity.workspaceId,
        pipelineId: workspaceEntity.pipelineId,
        stageId: workspaceEntity.stageId,
        assignedTo: workspaceEntity.assignedTo,
        workspaceTags: workspaceEntity.workspaceTags,
        status: workspaceEntity.status
      };
    }

    // Return updated data (Requirement 24.2)
    return NextResponse.json({
      id: entity.id,
      name: entity.name,
      globalTags: entity.globalTags,
      workspaceData,
      updatedAt: entity.updatedAt
    });
  } catch (error: any) {
    console.error('[API:CONTACTS:PATCH] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
