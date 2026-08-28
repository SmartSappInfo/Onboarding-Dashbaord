import { NextRequest, NextResponse } from 'next/server';
import { getActivitiesForContact } from '@/lib/activity-actions';
import { logActivity } from '@/lib/activity-logger';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';
import type { ActivityType, ActivityMetadata, EntityType } from '@/lib/types';

/**
 * @fileOverview Activities API endpoint with entityId support
 * Requirements: 24.1, 24.2, 24.5
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Security: Protected by `authenticateApiRequest` ensuring callers can only query and log
 *   activities within workspaces they are authorized to access.
 * - Traceability: All operational activity writes record the verified caller's ID and timestamps.
 * - Zero `any` or `any[]` typing.
 */

interface PostActivityRequestBody {
  workspaceId?: string;
  type?: ActivityType;
  description?: string;
  entityId?: string;
  entityType?: string;
  metadata?: ActivityMetadata;
  organizationId?: string;
}

/**
 * GET /api/activities
 * Query activities for a contact using entityId
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');
    const entityId = searchParams.get('entityId');
    const type = searchParams.get('type') as ActivityType | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        { error: 'entityId must be provided' },
        { status: 400 }
      );
    }

    // Authenticate caller and verify workspace membership
    const authResult = await authenticateApiRequest(request, {
      requiredWorkspaceId: workspaceId,
    });

    if (!authResult.success) {
      return authResult.errorResponse;
    }

    // Get activities using server action
    const activities = await getActivitiesForContact(entityId, workspaceId, limit);

    // Apply type filter if provided
    let filteredActivities = activities;
    if (type) {
      filteredActivities = filteredActivities.filter(activity => activity.type === type);
    }

    return NextResponse.json({
      activities: filteredActivities,
      total: filteredActivities.length,
      nextCursor: null,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[API:ACTIVITIES:GET] Error:', error);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/activities
 * Log a new activity with entityId support
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PostActivityRequestBody;
    const {
      workspaceId,
      type,
      description,
      entityId,
      entityType,
      metadata,
      organizationId,
    } = body;

    // Validate required fields
    if (!workspaceId || !type || !description) {
      return NextResponse.json(
        { error: 'workspaceId, type, and description are required' },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        { error: 'entityId must be provided' },
        { status: 400 }
      );
    }

    // Authenticate caller and verify workspace membership
    const authResult = await authenticateApiRequest(request, {
      requiredWorkspaceId: workspaceId,
      requiredOrgId: organizationId,
    });

    if (!authResult.success) {
      return authResult.errorResponse;
    }

    const { user } = authResult;
    const callerId = user.uid;
    const callerOrgId = organizationId || user.profile.organizationId || 'default';

    // Log activity
    await logActivity({
      workspaceId,
      type,
      description,
      entityId: entityId || null,
      entityType: (entityType as EntityType) || null,
      userId: callerId,
      metadata: metadata || {},
      organizationId: callerOrgId,
      source: 'api',
    });

    const timestamp = new Date().toISOString();

    return NextResponse.json(
      {
        workspaceId,
        type,
        description,
        entityId: entityId || null,
        entityType: entityType || null,
        userId: callerId,
        timestamp,
        metadata: metadata || {},
        createdAt: timestamp,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[API:ACTIVITIES:POST] Error:', error);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
