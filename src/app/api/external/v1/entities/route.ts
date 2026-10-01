import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';
import { EntityInputSchema, createEntityCore } from '@/lib/crm/entity-core';
import { linkEntityToWorkspaceCore } from '@/lib/crm/workspace-entity-core';
import type { EntityType } from '@/lib/types';
// SECURITY (audit F9): report the detail server-side, return an opaque message.
import { toClientErrorMessage } from '@/lib/errors/report-error';

/**
 * @fileOverview External API endpoint for Entity Creation
 * Requires a Bearer API Key generated in the backoffice.
 */

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate using API Key
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid Bearer token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const keyHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find the API Key
    const keyQuery = await adminDb.collection('api_keys')
      .where('keyHash', '==', keyHash)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (keyQuery.empty) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const keyDoc = keyQuery.docs[0];
    const keyData = keyDoc.data();
    
    // Update lastUsedAt in the background (fire and forget)
    keyDoc.ref.update({ lastUsedAt: new Date().toISOString() }).catch(console.error);

    const { workspaceId, organizationId } = keyData;

    // 2. Parse Payload
    const body = await request.json();
    const {
      entityType,
      name,
      contacts,
      institutionData,
      familyData,
      personData,
      pipelineId,
      stageId,
      assignedTo,
      _workspaceTags,
      globalTags,
    } = body;

    if (!entityType || !name) {
      return NextResponse.json({ error: 'entityType and name are required' }, { status: 400 });
    }

    if (!['institution', 'family', 'person'].includes(entityType)) {
      return NextResponse.json({ error: 'entityType must be one of: institution, family, person' }, { status: 400 });
    }

    // 3. Create the entity through the entity core as the 'api' service, pinned to the API key's
    //    workspace (N1). The request body is validated at this boundary.
    const parsedEntity = EntityInputSchema.safeParse({
      name,
      contacts: contacts || [],
      globalTags: globalTags || [],
      institutionData: entityType === 'institution' ? institutionData : undefined,
      familyData: entityType === 'family' ? familyData : undefined,
      personData: entityType === 'person' ? personData : undefined,
      userName: `API (${keyData.name})`,
      userEmail: 'api@smartsapp.com'
    });
    if (!parsedEntity.success) {
      return NextResponse.json({ error: 'Invalid entity details' }, { status: 400 });
    }
    const entityResult = await createEntityCore(
      { kind: 'service', service: 'api', workspaceId },
      { data: parsedEntity.data, workspaceId, entityType: entityType as EntityType, organizationId }
    );

    if (!entityResult.success || !entityResult.id) {
      return NextResponse.json({ error: entityResult.error || 'Failed to create entity' }, { status: 500 });
    }

    const entityId = entityResult.id;

    // 4. Link Entity to Workspace
    const workspaceEntityResult = await linkEntityToWorkspaceCore({ kind: 'service', service: 'api', workspaceId }, {
      entityId,
      workspaceId,
      pipelineId: pipelineId || '',
      stageId: stageId || '',
      assignedTo: assignedTo || { userId: null, name: null, email: null },
      userId: 'system-api',
      userName: `API (${keyData.name})`,
      userEmail: 'api@smartsapp.com'
    });

    if (!workspaceEntityResult.success) {
      return NextResponse.json({ error: workspaceEntityResult.error || 'Failed to create workspace entity' }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        entityId,
        workspaceEntityId: workspaceEntityResult.workspaceEntityId,
        message: 'Entity successfully created'
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('[API:EXTERNAL:ENTITIES] POST Error:', error);
    return NextResponse.json({ error: toClientErrorMessage('api.external.v1.entities', error, undefined, 'Internal Server Error') }, { status: 500 });
  }
}
