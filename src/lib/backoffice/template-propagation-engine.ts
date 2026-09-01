/**
 * @fileoverview Platform Template Propagation Engine
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Fan-out engine that propagates Backoffice platform templates to tenant workspaces.
 * - Adheres strictly to Firestore batch limitations (max 400 writes per batch, chunked in arrays of 30 workspaces).
 * - Incorporates inter-batch delays (50ms) to prevent resource exhaustion and batch collision.
 * - Employs zero `any` or `any[]` typing.
 *
 * @testability Exported pure helper `chunkArray` and batch transaction processors are independently testable.
 * @trustBoundary Security is gated via `authorizeBackoffice(idToken, 'templates', 'execute')`.
 */

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { authorizeBackoffice } from './backoffice-auth';
import { getErrorMessage } from './backoffice-errors';
import type { PlatformTemplate, PlatformTemplateType } from './backoffice-types';

/**
 * Utility helper to chunk arrays for bounded batch processing.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface PropagationTargetFilter {
  organizationIds?: string[];
  workspaceIds?: string[];
  industryVerticals?: string[];
}

export interface PropagationResult {
  success: boolean;
  totalTargetWorkspaces: number;
  totalUpdatedWorkspaces: number;
  totalSkippedWorkspaces: number;
  errors: string[];
}

/**
 * Propagate a published platform template to matching workspaces.
 */
export async function propagateTemplateToWorkspaces(
  templateId: string,
  filter: PropagationTargetFilter,
  idToken: string
): Promise<PropagationResult> {
  try {
    const actor = await authorizeBackoffice(idToken, 'templates', 'execute');

    // 1. Fetch the master template
    const templateDoc = await adminDb.collection('platform_templates').doc(templateId).get();
    if (!templateDoc.exists) {
      return {
        success: false,
        totalTargetWorkspaces: 0,
        totalUpdatedWorkspaces: 0,
        totalSkippedWorkspaces: 0,
        errors: [`Template with ID "${templateId}" not found.`],
      };
    }

    const masterTemplate = { id: templateDoc.id, ...templateDoc.data() } as PlatformTemplate;

    if (masterTemplate.status !== 'published') {
      return {
        success: false,
        totalTargetWorkspaces: 0,
        totalUpdatedWorkspaces: 0,
        totalSkippedWorkspaces: 0,
        errors: [`Cannot propagate template "${masterTemplate.name}" because status is "${masterTemplate.status}" (must be published).`],
      };
    }

    // 2. Resolve target workspaces
    let workspacesQuery: FirebaseFirestore.Query = adminDb.collection('workspaces');

    if (filter.organizationIds && filter.organizationIds.length > 0) {
      workspacesQuery = workspacesQuery.where('organizationId', 'in', filter.organizationIds.slice(0, 10));
    }

    const workspacesSnap = await workspacesQuery.get();
    let targetWorkspaces = workspacesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as { id: string; organizationId: string; industry?: string; name: string }));

    // Apply industry filtering in memory if specified
    if (filter.industryVerticals && filter.industryVerticals.length > 0) {
      const allowedIndustries = new Set(filter.industryVerticals);
      targetWorkspaces = targetWorkspaces.filter((ws) => ws.industry && allowedIndustries.has(ws.industry));
    }

    // Apply explicit workspace filter if provided
    if (filter.workspaceIds && filter.workspaceIds.length > 0) {
      const allowedWsIds = new Set(filter.workspaceIds);
      targetWorkspaces = targetWorkspaces.filter((ws) => allowedWsIds.has(ws.id));
    }

    const totalTarget = targetWorkspaces.length;
    if (totalTarget === 0) {
      return {
        success: true,
        totalTargetWorkspaces: 0,
        totalUpdatedWorkspaces: 0,
        totalSkippedWorkspaces: 0,
        errors: [],
      };
    }

    // 3. Chunk workspaces into batches of 30 for safe Firestore writes
    const workspaceChunks = chunkArray(targetWorkspaces, 30);
    let totalUpdated = 0;
    let totalSkipped = 0;
    const errors: string[] = [];
    const timestamp = new Date().toISOString();

    for (const chunk of workspaceChunks) {
      const batch = adminDb.batch();

      for (const ws of chunk) {
        try {
          // Determine the target subcollection based on template type
          const targetSubcollection = getWorkspaceSubcollectionForType(masterTemplate.type);
          if (!targetSubcollection) {
            totalSkipped++;
            continue;
          }

          // Template instance reference inside workspace
          const templateRef = adminDb
            .collection('workspaces')
            .doc(ws.id)
            .collection(targetSubcollection)
            .doc(`tpl_${masterTemplate.id}`);

          batch.set(
            templateRef,
            {
              platformTemplateId: masterTemplate.id,
              type: masterTemplate.type,
              name: masterTemplate.name,
              description: masterTemplate.description,
              category: masterTemplate.category,
              content: masterTemplate.content,
              version: masterTemplate.version,
              isPlatformManaged: true,
              lastSyncedAt: timestamp,
              syncedBy: actor.email,
              workspaceId: ws.id,
              organizationId: ws.organizationId,
              updatedAt: timestamp,
            },
            { merge: true }
          );

          totalUpdated++;
        } catch (itemErr: unknown) {
          totalSkipped++;
          errors.push(`Workspace ${ws.id}: ${getErrorMessage(itemErr)}`);
        }
      }

      await batch.commit();
      // Throttling interval to avoid batch write exhaustion
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // 4. Update master template usage count
    await templateDoc.ref.update({
      usageCount: (masterTemplate.usageCount || 0) + totalUpdated,
      updatedAt: timestamp,
    });

    // 5. Audit log the propagation action
    await logBackofficeAction(actor, 'template.propagate', 'template', masterTemplate.id, {
      metadata: {
        templateName: masterTemplate.name,
        templateType: masterTemplate.type,
        totalUpdatedWorkspaces: totalUpdated,
        totalSkippedWorkspaces: totalSkipped,
        filter,
      },
    });

    return {
      success: errors.length === 0,
      totalTargetWorkspaces: totalTarget,
      totalUpdatedWorkspaces: totalUpdated,
      totalSkippedWorkspaces: totalSkipped,
      errors,
    };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_PROPAGATION] propagateTemplateToWorkspaces failed:', error);
    return {
      success: false,
      totalTargetWorkspaces: 0,
      totalUpdatedWorkspaces: 0,
      totalSkippedWorkspaces: 0,
      errors: [getErrorMessage(error)],
    };
  }
}

/**
 * Maps a PlatformTemplateType to its corresponding workspace subcollection.
 */
function getWorkspaceSubcollectionForType(type: PlatformTemplateType): string | null {
  switch (type) {
    case 'messaging':
      return 'message_templates';
    case 'meeting':
      return 'meeting_templates';
    case 'survey':
      return 'survey_templates';
    case 'form':
      return 'form_templates';
    case 'automation':
      return 'automation_templates';
    case 'pipeline':
      return 'pipeline_templates';
    case 'page':
    case 'section':
    case 'block':
      return 'page_templates';
    case 'pdf':
      return 'document_templates';
    case 'dunning':
      return 'dunning_templates';
    case 'qr_template':
    case 'qr_credential':
      return 'qr_templates';
    case 'brand_voice':
      return 'brand_profiles';
    case 'prompt':
      return 'ai_prompts';
    default:
      return 'platform_synced_templates';
  }
}
