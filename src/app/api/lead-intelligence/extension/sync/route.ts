import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Prospect, LeadIntelligenceSettings } from '@/lib/lead-intelligence/types';
import type { Entity, WorkspaceEntity, EntityContact } from '@/lib/types';
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
    const mappedContacts: EntityContact[] = prospect.contacts.map((c, i) => ({
      id: `contact_${Date.now()}_${i}`,
      name: c.name || 'Focal Person',
      email: c.email || '',
      phone: c.phone || '',
      typeKey: c.role ? c.role.toLowerCase().replace(/\s+/g, '_') : 'contact',
      typeLabel: c.role || 'Contact',
      isPrimary: i === 0,
      isSignatory: false,
      order: i
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
      primaryContactName: mappedContacts[0]?.name || undefined,
      primaryEmail: mappedContacts[0]?.email,
      primaryPhone: mappedContacts[0]?.phone,
      entityContacts: mappedContacts,
      addedAt: now,
      updatedAt: now
    };

    // Execute atomically inside a Firestore Transaction
    const result = await adminDb.runTransaction(async (transaction) => {
      // 1. Read prospect status
      const prospectRef = adminDb.collection('prospects').doc(prospect.id);
      const prospectSnap = await transaction.get(prospectRef);
      if (prospectSnap.exists) {
        const pData = prospectSnap.data() as Prospect;
        if (pData.syncStatus === 'synced') {
          throw new Error('This lead has already been synced to the CRM.');
        }
      }

      // 2. Read query check for existing workspace entity duplicates
      const duplicateQuery = adminDb.collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .where('displayNameLower', '==', prospect.name.toLowerCase())
        .limit(1);

      const duplicateSnap = await transaction.get(duplicateQuery);
      if (!duplicateSnap.empty) {
        throw new Error('An entity with a matching name already exists in this workspace.');
      }

      // 3. Perform Writes
      const entityRef = adminDb.collection('entities').doc(entityId);
      transaction.set(entityRef, newEntity);

      const wsEntityRef = adminDb.collection('workspace_entities').doc(wsEntityId);
      transaction.set(wsEntityRef, newWorkspaceEntity);

      transaction.update(prospectRef, {
        syncStatus: 'synced',
        syncedEntityId: entityId,
        updatedAt: now
      });

      const activityId = `act_${Date.now()}`;
      const activityRef = prospectRef.collection('activities').doc(activityId);
      transaction.set(activityRef, {
        id: activityId,
        prospectId: prospect.id,
        workspaceId,
        type: 'create_deal',
        userId: 'chrome_extension',
        userName: 'Chrome Extension',
        content: `Lead synced to SmartSapp CRM. Created Campus/Entity ${prospect.name}.`,
        createdAt: now
      });

      return { entityId };
    });

    // Trigger score history logger via server action (non-blocking)
    try {
      await adjustLeadScoreAction({
        organizationId,
        workspaceId,
        entityId,
        contactEmailOrId: mappedContacts[0]?.email || mappedContacts[0]?.id || 'unknown',
        value: Math.max(0, Number(prospect.scoring.overallScore) || 0),
        operation: 'set',
        reason: 'Initial Lead Intelligence score lookup from Chrome Extension',
        source: 'system',
        actorId: 'chrome-extension-sync',
        actorType: 'API'
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
