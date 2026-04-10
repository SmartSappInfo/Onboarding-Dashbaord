import { NextRequest, NextResponse } from 'next/server';
import { getActivitiesForContact } from '@/lib/activity-actions';
import { logActivity } from '@/lib/activity-logger';

/**
 * @fileOverview Activities API endpoint with entityId support
 * Requirements: 24.1, 24.2, 24.5
 */

/**
 * GET /api/activities
 * Query activities for a contact using either entityId or entityId
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');
    const entityId = searchParams.get('entityId');
    const entityId = searchParams.get('entityId');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const startAfter = searchParams.get('startAfter');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    if (!entityId && !entityId) {
      return NextResponse.json(
        { error: 'Either entityId or entityId must be provided' },
        { status: 400 }
      );
    }

    // Prefer entityId when both provided (Requirement 24.1)
    const identifier = entityId ? { entityId } : { entityId: entityId! };

    // Get activities using server action
    const activities = await getActivitiesForContact(identifier, workspaceId, limit);

    // Apply type filter if provided
    let filteredActivities = activities;
    if (type) {
      filteredActivities = filteredActivities.filter(activity => activity.type === type);
    }

    // Add deprecation warning if entityId was used (Requirement 24.3)
    const headers: Record<string, string> = {};
    if (entityId && !entityId) {
      headers['Warning'] = '299 - "entityId parameter is deprecated and will be removed in Q4 2026. Use entityId instead."';
    }

    // Return both identifiers in response (Requirement 24.2)
    return NextResponse.json(
      {
        activities: filteredActivities,
        total: filteredActivities.length,
        nextCursor: null // Pagination not implemented yet
      },
      { headers }
    );
  } catch (error: any) {
    console.error('[API:ACTIVITIES:GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
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
    const body = await request.json();
    const {
      workspaceId,
      type,
      description,
      entityId,
      entityType,
      entityId,
      userId,
      metadata,
      organizationId
    } = body;

    // Validate required fields
    if (!workspaceId || !type || !description) {
      return NextResponse.json(
        { error: 'workspaceId, type, and description are required' },
        { status: 400 }
      );
    }

    if (!entityId && !entityId) {
      return NextResponse.json(
        { error: 'Either entityId or entityId must be provided' },
        { status: 400 }
      );
    }

    // Log activity with dual-write support (Requirement 24.2)
    await logActivity({
      workspaceId,
      type,
      description,
      // Prefer entityId when both provided (Requirement 24.1)
      entityId: entityId || null,
      entityType: entityType || null,
      entityId: entityId || null,
      userId: userId || null,
      metadata: metadata || {},
      organizationId: organizationId || 'default',
      source: 'api'
    });

    // Add deprecation warning if entityId was used (Requirement 24.3)
    const headers: Record<string, string> = {};
    if (entityId && !entityId) {
      headers['Warning'] = '299 - "entityId parameter is deprecated and will be removed in Q4 2026. Use entityId instead."';
    }

    const timestamp = new Date().toISOString();

    // Return activity with both identifiers (Requirement 24.2)
    return NextResponse.json(
      {
        workspaceId,
        type,
        description,
        entityId: entityId || null,
        entityType: entityType || null,
        entityId: entityId || null,
        userId,
        timestamp,
        metadata,
        createdAt: timestamp
      },
      { status: 201, headers }
    );
  } catch (error: any) {
    console.error('[API:ACTIVITIES:POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
