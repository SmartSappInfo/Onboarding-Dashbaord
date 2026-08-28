import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { updateEntityAction } from '@/lib/entity-actions';
import { updateWorkspaceEntityAction } from '@/lib/workspace-entity-actions';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';
import type { Entity, WorkspaceEntity, EntityContact, EntityCustomData, AssignedUser } from '@/lib/types';

/**
 * @fileOverview Contact detail API endpoint
 * Requirements: 24.1, 24.2
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Security: Protected by `authenticateApiRequest` ensuring callers can only read/update
 *   contacts in workspaces they are authorized to access.
 * - Traceability: All operational updates record the actual authenticated user UID.
 * - Zero `any` or `any[]` typing.
 */

interface PatchContactRequestBody {
  workspaceId?: string;
  name?: string;
  contacts?: EntityContact[];
  globalTags?: string[];
  financeData?: Record<string, EntityCustomData>;
  industryData?: Record<string, EntityCustomData>;
  logoUrl?: string;
  location?: string;
  interests?: string[];
  familyData?: Record<string, EntityCustomData>;
  personData?: Record<string, EntityCustomData>;
  assignedTo?: AssignedUser;
  workspaceTags?: string[];
  status?: 'active' | 'archived' | 'inactive';
}

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

    // Authenticate caller and verify workspace access
    const authResult = await authenticateApiRequest(request, {
      requiredWorkspaceId: workspaceId,
    });

    if (!authResult.success) {
      return authResult.errorResponse;
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

    // Verify organization matching (system admin bypasses)
    if (!authResult.user.isSystemAdmin && entity.organizationId !== authResult.user.profile.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: Access to entity in different organization is denied.' },
        { status: 403 }
      );
    }

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
        assignedTo: workspaceEntity.assignedTo,
        workspaceTags: workspaceEntity.workspaceTags,
        lastContactedAt: workspaceEntity.lastContactedAt,
        status: workspaceEntity.status,
      };
    }

    // Return combined data (Requirement 24.2)
    return NextResponse.json({
      id: entity.id,
      organizationId: entity.organizationId,
      entityType: entity.entityType,
      name: entity.name,
      slug: entity.slug,
      initials: entity.initials,
      logoUrl: entity.logoUrl,
      location: entity.location,
      interests: entity.interests,
      financeData: entity.financeData,
      industryData: entity.industryData,
      contacts: entity.contacts,
      entityContacts: entity.entityContacts,
      globalTags: entity.globalTags,
      status: entity.status,
      familyData: entity.familyData,
      personData: entity.personData,
      workspaceData,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[API:CONTACTS:GET] Error:', error);
    return NextResponse.json(
      { error: errMsg },
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
    const body = (await request.json()) as PatchContactRequestBody;
    const {
      workspaceId,
      // Identity fields (go to entities collection)
      name,
      contacts,
      globalTags,
      financeData,
      industryData,
      logoUrl,
      location,
      interests,
      familyData,
      personData,
      // Operational fields (go to workspace_entities collection)
      assignedTo,
      workspaceTags,
      status,
    } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Authenticate caller and verify workspace access
    const authResult = await authenticateApiRequest(request, {
      requiredWorkspaceId: workspaceId,
    });

    if (!authResult.success) {
      return authResult.errorResponse;
    }

    const { user } = authResult;
    const callerId = user.uid;
    const callerOrgId = user.profile.organizationId || 'default';

    // Update entity if identity fields provided (Requirement 11.4)
    const hasIdentityUpdates =
      name ||
      contacts ||
      globalTags ||
      financeData ||
      industryData ||
      logoUrl ||
      location ||
      interests ||
      familyData ||
      personData;

    if (hasIdentityUpdates) {
      const entityResult = await updateEntityAction(
        entityId,
        { name, contacts, financeData, industryData, logoUrl, location, interests, familyData, personData },
        callerId,
        workspaceId,
        callerOrgId
      );

      if (!entityResult.success) {
        return NextResponse.json(
          { error: entityResult.error || 'Failed to update entity' },
          { status: 500 }
        );
      }
    }

    // Update workspace_entity if operational fields provided (Requirement 11.5)
    const hasOperationalUpdates = assignedTo || workspaceTags || status;
    if (hasOperationalUpdates) {
      const workspaceEntityResult = await updateWorkspaceEntityAction({
        workspaceEntityId: `${workspaceId}_${entityId}`,
        userId: callerId,
        assignedTo: assignedTo ? {
          userId: assignedTo.userId ?? assignedTo.id ?? null,
          name: assignedTo.name ?? null,
          email: assignedTo.email ?? null,
        } : undefined,
        workspaceTags,
        status: status === 'archived' ? 'archived' : status === 'active' ? 'active' : undefined,
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
        assignedTo: workspaceEntity.assignedTo,
        workspaceTags: workspaceEntity.workspaceTags,
        status: workspaceEntity.status,
      };
    }

    // Return updated data (Requirement 24.2)
    return NextResponse.json({
      id: entity.id,
      name: entity.name,
      globalTags: entity.globalTags,
      workspaceData,
      updatedAt: entity.updatedAt,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[API:CONTACTS:PATCH] Error:', error);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
