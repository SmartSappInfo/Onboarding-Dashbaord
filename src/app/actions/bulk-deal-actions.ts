'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Deal, Pipeline, WorkspaceEntity, DealFocalContact } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';
import { calculateExpectedCloseDate } from '../admin/pipeline/utils/deal-expected-close';

export interface BulkDealCreationData {
  entityIds: string[];
  workspaceId: string;
  organizationId: string;
  pipelineId: string;
  dealNamePattern: string; // e.g. "{{entityName}} - 2026 Expansion"
  value: number;
  assignmentStrategy: 'direct' | 'unassigned' | 'pipeline';
  /** Optional contact identifier or recipient email to link specific focal contact */
  contactId?: string;
  /** Optional email subject line / title for engagement tracking description */
  messageSubject?: string | null;
  /** Optional email preheader / preview text for engagement tracking description */
  messagePreviewText?: string | null;
}

export async function bulkCreateDealsAction(data: BulkDealCreationData) {
  try {
    const {
      entityIds,
      workspaceId,
      organizationId,
      pipelineId,
      dealNamePattern,
      value,
      assignmentStrategy,
      contactId,
      messageSubject,
      messagePreviewText,
    } = data;

    if (entityIds.length === 0) {
      return { success: true, count: 0 };
    }

    // 1. Fetch Pipeline settings and Stage details once
    const pipelineRef = adminDb.collection('pipelines').doc(pipelineId);
    const stageQuery = adminDb
      .collection('onboardingStages')
      .where('pipelineId', '==', pipelineId)
      .orderBy('order', 'asc')
      .limit(1);

    const [pipelineSnap, stageSnap] = await Promise.all([
      pipelineRef.get(),
      stageQuery.get()
    ]);

    if (!pipelineSnap.exists) throw new Error('Pipeline not found');
    const pipeline = pipelineSnap.data() as Pipeline;

    const calculatedCloseDate = calculateExpectedCloseDate(pipeline);

    const stageId = stageSnap.empty ? 'default_stage' : stageSnap.docs[0].id;
    const stageName = stageSnap.empty ? undefined : (stageSnap.docs[0].data().name as string | undefined);

    const activeStrategy = assignmentStrategy === 'pipeline'
      ? (pipeline.assignmentStrategy || 'direct')
      : assignmentStrategy;

    const activeEligibleUserIds = pipeline.assignmentUserIds || [];

    // Load user profiles and stats once for the entire batch if auto-assignment is active
    const userProfiles: Record<string, { name: string; email: string }> = {};
    const userStats: Record<string, number> = {};

    const isAutoAssign = (activeStrategy === 'round-robin' || activeStrategy === 'value-based') && activeEligibleUserIds.length > 0;

    if (isAutoAssign) {
      // Fetch user profiles
      const userRefs = activeEligibleUserIds.map((uid: string) => adminDb.collection('users').doc(uid));
      const userSnaps = await adminDb.getAll(...userRefs);
      userSnaps.forEach(snap => {
        if (snap.exists) {
          const u = snap.data();
          userProfiles[snap.id] = { name: u?.name || 'Assigned User', email: u?.email || '' };
        } else {
          userProfiles[snap.id] = { name: 'Assigned User', email: '' };
        }
      });

      // Fetch initial user deal stats
      for (const uid of activeEligibleUserIds) {
        const snap = await adminDb.collection('deals')
          .where('assignedTo.userId', '==', uid)
          .where('status', '==', 'open')
          .get();
        if (activeStrategy === 'round-robin') {
          userStats[uid] = snap.size;
        } else {
          let totalVal = 0;
          snap.forEach(d => totalVal += (d.data().value || 0));
          userStats[uid] = totalVal;
        }
      }
    }

    const now = new Date().toISOString();
    const processedResults: string[] = [];
    const chunkLimit = 450; // Safety threshold for Firestore batches (limit is 500)

    // Slicing into parallel chunks
    for (let i = 0; i < entityIds.length; i += chunkLimit) {
      const chunk = entityIds.slice(i, i + chunkLimit);
      const batch = adminDb.batch();

      // Dual-key lookup: attempt `${workspaceId}_${id}` as primary, with `id` fallback
      const entityRefs = chunk.map(id =>
        adminDb.collection('workspace_entities').doc(`${workspaceId}_${id}`)
      );
      
      const entitySnapshots = await adminDb.getAll(...entityRefs);

      for (let idx = 0; idx < chunk.length; idx++) {
        const id = chunk[idx];
        let snap = entitySnapshots[idx];

        // ARCHITECTURAL CAUTION: Dual-key fallback lookup if `${workspaceId}_${id}` doesn't exist
        if (!snap || !snap.exists) {
          const fallbackSnap = await adminDb.collection('workspace_entities').doc(id).get();
          if (fallbackSnap.exists) {
            snap = fallbackSnap;
          } else {
            continue;
          }
        }

        const entity = snap.data() as WorkspaceEntity;

        let assignedTo = null;
        if (isAutoAssign) {
          // Find eligible user with lowest metric
          let minVal = Infinity;
          let selectedUid = activeEligibleUserIds[0];
          for (const uid of activeEligibleUserIds) {
            const val = userStats[uid] ?? 0;
            if (val < minVal) {
              minVal = val;
              selectedUid = uid;
            }
          }
          // Update stats in memory for next loop iteration
          if (activeStrategy === 'round-robin') {
            userStats[selectedUid] = (userStats[selectedUid] ?? 0) + 1;
          } else {
            userStats[selectedUid] = (userStats[selectedUid] ?? 0) + (value || 0);
          }
          assignedTo = {
            userId: selectedUid,
            name: userProfiles[selectedUid]?.name || 'Assigned User',
            email: userProfiles[selectedUid]?.email || '',
          };
        } else if (activeStrategy === 'direct') {
          assignedTo = entity.assignedTo || null;
        } else if (activeStrategy === 'unassigned') {
          assignedTo = null;
        }

        // ARCHITECTURAL NOTE: Dynamic entity name resolution
        const entityName = entity.displayName || (entity as unknown as Record<string, string>).name || (entity as unknown as Record<string, string>).entityName || 'Entity';
        let pattern = dealNamePattern || '{{entityName}}';
        if (pattern === 'Automated Event Deal') {
          pattern = '{{entityName}} - Opened Email';
        }
        const dealName = pattern
          .replace(/\{\{entityName\}\}/g, entityName)
          .replace(/\{\{entity_name\}\}/g, entityName);

        // ARCHITECTURAL NOTE: Contact Linking (focalContacts)
        // If contactId is passed, match specific contact in entity. Fallback to entity's primary contact.
        let resolvedFocalContacts: DealFocalContact[] = [];
        const entityContacts = entity.entityContacts || [];
        const focalContacts = entity.focalContacts || [];

        if (contactId && (entityContacts.length > 0 || focalContacts.length > 0)) {
          const all = [...entityContacts, ...focalContacts];
          const matched = all.find(c =>
            c.id === contactId ||
            (c.email && c.email.toLowerCase() === contactId.toLowerCase()) ||
            (c.phone && c.phone === contactId)
          );
          if (matched) {
            resolvedFocalContacts = [{
              id: matched.id || contactId,
              name: matched.name || 'Contact',
              role: matched.role || undefined,
              email: matched.email || undefined,
              phone: matched.phone || undefined,
            }];
          }
        }

        if (resolvedFocalContacts.length === 0 && entityContacts.length > 0) {
          const primary = entityContacts.find(c => c.isPrimary) || entityContacts[0];
          resolvedFocalContacts = [{
            id: primary.id,
            name: primary.name,
            role: primary.role || undefined,
            email: primary.email || undefined,
            phone: primary.phone || undefined,
          }];
        } else if (resolvedFocalContacts.length === 0 && focalContacts.length > 0) {
          resolvedFocalContacts = [focalContacts[0]];
        }

        // ARCHITECTURAL NOTE: Structured Email Engagement Description
        const descParts: string[] = [];
        if (messageSubject) {
          descParts.push(`Opened Email: "${messageSubject}"`);
        }
        if (messagePreviewText) {
          descParts.push(`Preheader: "${messagePreviewText}"`);
        }
        const description = descParts.length > 0 ? descParts.join('\n') : null;

        // Create deal ref
        const newDealRef = adminDb.collection('deals').doc();
        const dealData: Omit<Deal, 'id'> = {
          organizationId,
          workspaceId,
          entityId: entity.entityId || id,
          pipelineId,
          stageId,
          ...(stageName ? { stageName } : {}),
          name: dealName,
          value: value || 0,
          status: 'open',
          assignedTo,
          focalContacts: resolvedFocalContacts,
          description,
          source: 'automation',
          expectedCloseDate: calculatedCloseDate,
          createdAt: now,
          updatedAt: now,
        };

        batch.set(newDealRef, dealData);
        processedResults.push(newDealRef.id);
      }

      // Commit this chunk's operations
      await batch.commit();
    }

    return {
      success: true,
      count: processedResults.length,
      message: `Successfully initiated ${processedResults.length} deals in the pipeline.`
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bulk deal creation failed';
    console.error('[bulkCreateDealsAction] Error:', error);
    return { success: false, error: message };
  }
}
