import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { WorkspaceEntity, EntityType } from '@/lib/types';

/**
 * @fileOverview Workspace contacts list API endpoint
 * Requirements: 24.1, 24.2
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
        pipelineId: data.pipelineId,
        stageId: data.stageId,
        currentStageName: data.currentStageName,
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
  } catch (error: any) {
    console.error('[API:WORKSPACES:CONTACTS:GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
