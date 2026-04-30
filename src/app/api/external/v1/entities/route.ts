import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';
import { createEntityAction } from '@/lib/entity-actions';
import { linkEntityToWorkspaceAction } from '@/lib/workspace-entity-actions';
import type { EntityType } from '@/lib/types';
import { unstable_after as after } from 'next/server';

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
    
    // Update lastUsedAt in the background using after()
    after(() => {
      keyDoc.ref.update({ lastUsedAt: new Date().toISOString() }).catch(console.error);
    });

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
      workspaceTags,
      globalTags,
    } = body;

    if (!entityType || !name) {
      return NextResponse.json({ error: 'entityType and name are required' }, { status: 400 });
    }

    if (!['institution', 'family', 'person'].includes(entityType)) {
      return NextResponse.json({ error: 'entityType must be one of: institution, family, person' }, { status: 400 });
    }

    // 3. Create Entity using createEntityAction
    // Note: createEntityAction uses 'system-' prefix for permission bypass
    const entityResult = await createEntityAction(
      {
        name,
        contacts: contacts || [],
        globalTags: globalTags || [],
        institutionData: entityType === 'institution' ? institutionData : undefined,
        familyData: entityType === 'family' ? familyData : undefined,
        personData: entityType === 'person' ? personData : undefined,
        userName: `API (${keyData.name})`,
        userEmail: 'api@smartsapp.com'
      },
      'system-api',
      workspaceId,
      entityType as EntityType,
      organizationId
    );

    if (!entityResult.success || !entityResult.id) {
      return NextResponse.json({ error: entityResult.error || 'Failed to create entity' }, { status: 500 });
    }

    const entityId = entityResult.id;

    // 4. Link Entity to Workspace
    const workspaceEntityResult = await linkEntityToWorkspaceAction({
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
  } catch (error: any) {
    console.error('[API:EXTERNAL:ENTITIES] POST Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
