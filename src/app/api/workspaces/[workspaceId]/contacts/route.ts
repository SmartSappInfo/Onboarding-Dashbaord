import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';
import type { WorkspaceEntity, EntityType } from '@/lib/types';
// SECURITY (audit F9): report the detail server-side, return an opaque message.
import { toClientErrorMessage } from '@/lib/errors/report-error';

/**
 * @fileOverview Workspace contacts list API endpoint
 * Requirements: 24.1, 24.2
 *
 * SECURITY: this route reads `workspace_entities` through `adminDb`, which bypasses
 * Firestore rules. The caller MUST be authenticated and MUST be a member of the
 * workspace named in the path — `workspaceId` is attacker-controlled URL input, and
 * workspace IDs appear in client-side URLs, so they are not secret. See audit F3.
 */

/**
 * GET /api/workspaces/[workspaceId]/contacts
 * List all contacts in a workspace with optional filters
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;

    const auth = await authenticateApiRequest(request, { requiredWorkspaceId: workspaceId });
    if (!auth.success) return auth.errorResponse;
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType') as EntityType | null;
    const pipelineId = searchParams.get('pipelineId');
    const stageId = searchParams.get('stageId');
    const status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    let query = adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', workspaceId);

    if (entityType) {
      query = query.where('entityType', '==', entityType);
    }

    if (pipelineId) {
      query = query.where('pipelineId', '==', pipelineId);
    }

    if (stageId) {
      query = query.where('stageId', '==', stageId);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.limit(limit);

    // Execute query
    const snapshot = await query.get();

    const contacts = snapshot.docs.map(doc => {
      const data = doc.data() as WorkspaceEntity;
      return {
        entityId: data.entityId,
        entityType: data.entityType,
        displayName: data.displayName,
        primaryEmail: data.primaryEmail,
        primaryPhone: data.primaryPhone,
        status: data.status,
        workspaceTags: data.workspaceTags,
        assignedTo: data.assignedTo,
        lastContactedAt: data.lastContactedAt
      };
    });

    return NextResponse.json({
      contacts,
      total: contacts.length,
      nextCursor: null // Pagination not implemented yet
    });
  } catch (error: unknown) {
    console.error('[API:WORKSPACES:CONTACTS:GET] Error:', error);
    return NextResponse.json(
      { error: toClientErrorMessage('api.workspaces.[workspaceId].contacts', error, undefined, 'Internal server error') },
      { status: 500 }
    );
  }
}
