import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Prospect, LeadIntelligenceSettings } from '@/lib/lead-intelligence/types';
import type { Entity, WorkspaceEntity } from '@/lib/types';
import { adjustLeadScoreAction } from '@/lib/scoring-performance-engine';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or malformed Authorization header' },
        { status: 401, headers: corsHeaders }
      );
    }
    const token = authHeader.substring(7);

    // 1. Resolve workspace
    const settingsSnap = await adminDb.collection('system_settings')
      .where('chromeExtensionToken', '==', token)
      .limit(1)
      .get();

    if (settingsSnap.empty) {
      return NextResponse.json(
        { error: 'Invalid API token' },
        { status: 401, headers: corsHeaders }
      );
    }

    const settingsDoc = settingsSnap.docs[0];
    const settings = settingsDoc.data() as LeadIntelligenceSettings & { workspaceId: string; organizationId: string };
    const workspaceId = settings.workspaceId;
    const organizationId = settings.organizationId;

    const body = await request.json();
    const prospect = body.prospect as Prospect;
    if (!prospect || !prospect.id) {
      return NextResponse.json(
        { error: 'prospect object is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Generate UUIDs for the new SmartSapp CRM entity
    const entityId = `entity_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const wsEntityId = `${workspaceId}_${entityId}`;
    const now = new Date().toISOString();

    // Map prospect contacts to SmartSapp EntityContact structure
    const mappedContacts = prospect.contacts.map((c, i) => ({
      id: `contact_${Date.now()}_${i}`,
      firstName: c.name.split(' ')[0] || 'Focal',
      lastName: c.name.split(' ').slice(1).join(' ') || 'Person',
      email: c.email,
      phone: c.phone || '',
      role: c.role || 'Contact',
      isPrimary: i === 0
    }));

    // Create the global Entity doc
    const newEntity: Entity = {
      id: entityId,
      organizationId,
      entityType: 'institution',
      name: prospect.name,
      slug: prospect.domain.split('.')[0] || '',
      location: prospect.address ? { locationString: prospect.address } : undefined,
      entityContacts: mappedContacts,
      globalTags: [],
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    // Create the workspace-scoped WorkspaceEntity doc
    const newWorkspaceEntity: WorkspaceEntity = {
      id: wsEntityId,
      organizationId,
      workspaceId,
      entityId,
      entityType: 'institution',
      status: 'active',
      workspaceTags: ['synced-lead'],
      displayName: prospect.name,
      displayNameLower: prospect.name.toLowerCase(),
      primaryContactName: mappedContacts[0]?.firstName ? `${mappedContacts[0].firstName} ${mappedContacts[0].lastName}` : undefined,
      primaryEmail: mappedContacts[0]?.email,
      primaryPhone: mappedContacts[0]?.phone,
      entityContacts: mappedContacts,
      addedAt: now,
      updatedAt: now
    };

    // Use a Firestore Batch to execute atomically
    const batch = adminDb.batch();
    
    // Set global CRM Entity
    const entityRef = adminDb.collection('entities').doc(entityId);
    batch.set(entityRef, newEntity);

    // Set Workspace Entity
    const wsEntityRef = adminDb.collection('workspace_entities').doc(wsEntityId);
    batch.set(wsEntityRef, newWorkspaceEntity);

    // Update prospect syncStatus
    const prospectRef = adminDb.collection('prospects').doc(prospect.id);
    batch.update(prospectRef, {
      syncStatus: 'synced',
      syncedEntityId: entityId,
      updatedAt: now
    });

    // Write a synced activity
    const activityId = `act_${Date.now()}`;
    const activityRef = adminDb.collection('prospects').doc(prospect.id).collection('activities').doc(activityId);
    batch.set(activityRef, {
      id: activityId,
      prospectId: prospect.id,
      workspaceId,
      type: 'create_deal',
      userId: 'chrome_extension',
      userName: 'Chrome Extension',
      content: `Lead synced to SmartSapp CRM. Created Campus/Entity ${prospect.name}.`,
      createdAt: now
    });

    await batch.commit();

    // Trigger score history logger via server action (non-blocking)
    try {
      await adjustLeadScoreAction({
        contactId: mappedContacts[0]?.id || 'unknown',
        workspaceId,
        scoreAdjustment: prospect.scoring.overallScore,
        reason: 'Initial Lead Intelligence score lookup from Chrome Extension',
        updatedBy: 'system_api'
      });
    } catch (scoreErr) {
      console.error('[API:LEAD_INTEL:SYNC] Failed to adjust lead score:', scoreErr);
    }

    return NextResponse.json(
      { success: true, entityId, workspaceEntityId: wsEntityId },
      { status: 200, headers: corsHeaders }
    );

  } catch (err: unknown) {
    console.error('[API:LEAD_INTEL:SYNC] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
