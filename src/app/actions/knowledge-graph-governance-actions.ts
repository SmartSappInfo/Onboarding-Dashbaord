'use server';

/**
 * @fileoverview Backoffice Knowledge Graph Governance & FER Migration Server Actions (Phase 5).
 *
 * ARCHITECTURAL POINTER:
 * Provides backoffice control plane capabilities for platform administrators:
 * 1. Inspect and customize the 23 enabled semantic relation types.
 * 2. Tune AI Linking Agent hyperparameters (minimum confidence, candidate pool size).
 * 3. Monitor live graph health, density, hub nodes, and orphaned knowledge objects.
 * 4. Execute the Fetch, Enrich, Restore (FER) CRM migration protocol to backfill historical relationships.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero 'any' or 'any[]'.
 * - Write operations to knowledge_graph_governance are blocked from client SDKs in firestore.rules.
 * - All server action errors include actionable relative navigation paths.
 *
 * TESTABILITY POINTER:
 * Tested via pure deterministic engine functions in quick-notes-domain.ts and integration tests.
 */

import { adminDb } from '@/lib/firebase-admin';
import { canUser } from '@/lib/workspace-permissions';
import { logActivity } from '@/lib/activity-logger';
import {
  KnowledgeRelationRepository,
} from '@/lib/knowledge-relation-repository';
import {
  QuickNoteRepository,
} from '@/lib/quick-notes-repository';
import { getAggregatedNotes } from '@/lib/quick-notes-aggregator';
import {
  buildAdjacencyGraph,
  quickNoteToUnified,
} from '@/lib/quick-notes-domain';
import {
  DEFAULT_KNOWLEDGE_GRAPH_GOVERNANCE,
  type KnowledgeGraphGovernanceConfig,
  type GraphMetrics,
  type UnifiedNote,
} from '@/lib/quick-notes-types';
import { backfillCrmRelationsAction } from '@/lib/quick-notes-graph-actions';
import { requireWorkspace } from '@/lib/auth/require-auth';

const GOVERNANCE_COLLECTION = 'knowledge_graph_governance';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: 'unauthenticated' | 'validation_error'; actionConfig?: { path: string; label: string } };

async function getNotesForWorkspace(workspaceId: string): Promise<UnifiedNote[]> {
  try {
    return await getAggregatedNotes(workspaceId);
  } catch {
    const fallback = await QuickNoteRepository.listActive(workspaceId);
    return fallback.map(quickNoteToUnified);
  }
}

/**
 * Retrieves the Knowledge Graph Governance configuration for a workspace.
 * Automatically provisions default configuration if none exists.
 */
export async function getKnowledgeGraphGovernanceAction(
  workspaceId: string,
  actorId: string
): Promise<ActionResult<KnowledgeGraphGovernanceConfig>> {
  // SECURITY (audit F2): the identity below feeds a permission check. The caller used
  // to supply it, so an authenticated low-privilege user could pass an administrator's
  // uid and pass the check as them. The caller-supplied value is discarded here and
  // replaced with the verified session identity before any check runs.
  const __verified = await requireWorkspace(workspaceId);
  actorId = __verified.uid;

  try {
    if (!actorId) {
      return {
        success: false,
        error: 'Authentication required to access Knowledge Graph Governance.',
        code: 'unauthenticated',
        actionConfig: { path: '/login', label: 'Sign In' },
      };
    }
    if (!workspaceId) {
      return {
        success: false,
        error: 'No active workspace selected.',
        actionConfig: { path: '/backoffice/workspaces', label: 'Select Workspace' },
      };
    }

    const perm = await canUser(actorId, 'operations', 'quickNotes', 'view', workspaceId);
    if (!perm.granted) {
      return {
        success: false,
        error: perm.reason || 'Insufficient permissions to view Knowledge Graph Governance.',
        code: 'unauthenticated',
        actionConfig: { path: '/admin/quick-notes', label: 'Return to Notes' },
      };
    }

    const docRef = adminDb.collection(GOVERNANCE_COLLECTION).doc(workspaceId);
    const snap = await docRef.get();

    if (snap.exists) {
      const data = snap.data() as KnowledgeGraphGovernanceConfig;
      return { success: true, data: { ...data, workspaceId } };
    }

    // Auto-provision default governance configuration
    const now = new Date().toISOString();
    const initialConfig: KnowledgeGraphGovernanceConfig = {
      workspaceId,
      ...DEFAULT_KNOWLEDGE_GRAPH_GOVERNANCE,
      updatedAt: now,
      updatedBy: actorId,
    };

    await docRef.set(initialConfig);
    return { success: true, data: initialConfig };
  } catch (err) {
    console.error('[getKnowledgeGraphGovernanceAction] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve governance configuration.',
      actionConfig: { path: '/backoffice', label: 'Backoffice Home' },
    };
  }
}

/**
 * Updates the Knowledge Graph Governance configuration for a workspace.
 */
export async function updateKnowledgeGraphGovernanceAction(params: {
  workspaceId: string;
  actorId: string;
  actorName: string;
  config: Partial<KnowledgeGraphGovernanceConfig>;
}): Promise<ActionResult<KnowledgeGraphGovernanceConfig>> {
  // SECURITY (audit F2): the identity below feeds a permission check. The caller used
  // to supply it, so an authenticated low-privilege user could pass an administrator's
  // uid and pass the check as them. The caller-supplied value is discarded here and
  // replaced with the verified session identity before any check runs.
  const __verified = await requireWorkspace(params.workspaceId);
  params.actorId = __verified.uid;

  try {
    const { workspaceId, actorId, actorName, config } = params;

    if (!actorId) {
      return {
        success: false,
        error: 'Authentication required to update governance configuration.',
        code: 'unauthenticated',
        actionConfig: { path: '/login', label: 'Sign In' },
      };
    }
    if (!workspaceId) {
      return {
        success: false,
        error: 'No active workspace specified.',
        actionConfig: { path: '/backoffice/workspaces', label: 'Select Workspace' },
      };
    }

    const perm = await canUser(actorId, 'operations', 'quickNotes', 'edit', workspaceId);
    if (!perm.granted) {
      return {
        success: false,
        error: perm.reason || 'Insufficient permissions to modify Knowledge Graph Governance.',
        code: 'unauthenticated',
        actionConfig: { path: '/admin/quick-notes', label: 'Return to Notes' },
      };
    }

    // Validate boundaries
    if (config.minAiConfidence !== undefined && (config.minAiConfidence < 0.1 || config.minAiConfidence > 1.0)) {
      return {
        success: false,
        error: 'AI confidence threshold must be between 0.10 and 1.00.',
        code: 'validation_error',
      };
    }

    if (config.maxCandidatePool !== undefined && (config.maxCandidatePool < 5 || config.maxCandidatePool > 50)) {
      return {
        success: false,
        error: 'Candidate pool size must be between 5 and 50 items.',
        code: 'validation_error',
      };
    }

    const docRef = adminDb.collection(GOVERNANCE_COLLECTION).doc(workspaceId);
    const existingSnap = await docRef.get();
    const existingData: Partial<KnowledgeGraphGovernanceConfig> = existingSnap.exists
      ? (existingSnap.data() as KnowledgeGraphGovernanceConfig)
      : DEFAULT_KNOWLEDGE_GRAPH_GOVERNANCE;

    const now = new Date().toISOString();
    const updatedConfig: KnowledgeGraphGovernanceConfig = {
      ...existingData,
      ...config,
      workspaceId,
      updatedAt: now,
      updatedBy: actorId,
    } as KnowledgeGraphGovernanceConfig;

    await docRef.set(updatedConfig, { merge: true });

    // Audit log
    await logActivity({
      organizationId: 'org_default',
      workspaceId,
      userId: actorId,
      displayName: actorName,
      type: 'knowledge_governance_updated',
      source: 'backoffice_governance',
      description: `Updated Knowledge Graph governance: minConfidence=${updatedConfig.minAiConfidence}, enabledTypes=${updatedConfig.enabledRelationTypes.length}`,
      metadata: {
        updatedConfig,
        actorName,
      },
    }).catch((e) => console.warn('[updateKnowledgeGraphGovernanceAction] Activity log failed:', e));

    return { success: true, data: updatedConfig };
  } catch (err) {
    console.error('[updateKnowledgeGraphGovernanceAction] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update governance configuration.',
      actionConfig: { path: '/backoffice/knowledge-graph', label: 'Retry Governance' },
    };
  }
}

/**
 * Retrieves real-time graph health metrics (density, hub nodes, isolation count).
 */
export async function getKnowledgeGraphMetricsAction(
  workspaceId: string,
  actorId: string
): Promise<ActionResult<{ metrics: GraphMetrics; totalRelations: number }>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    if (!actorId) return { success: false, error: 'Not authenticated.', code: 'unauthenticated' };
    if (!workspaceId) return { success: false, error: 'No workspace selected.' };

    const [notes, relations] = await Promise.all([
      getNotesForWorkspace(workspaceId),
      KnowledgeRelationRepository.fetchRelationsForWorkspace(workspaceId, { limit: 1000 }),
    ]);

    const baseGraph = buildAdjacencyGraph(relations, notes);
    const metrics = baseGraph.metrics;

    return {
      success: true,
      data: {
        metrics,
        totalRelations: relations.length,
      },
    };
  } catch (err) {
    console.error('[getKnowledgeGraphMetricsAction] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to compute graph metrics.',
    };
  }
}

/**
 * Triggers the Fetch, Enrich, Restore (FER) CRM migration runner from the Backoffice.
 */
export async function triggerBackfillCrmRelationsAction(
  workspaceId: string,
  actorId: string,
  actorName: string
): Promise<ActionResult<{ backfilledCount: number }>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const result = await backfillCrmRelationsAction(workspaceId, actorId, actorName);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        actionConfig: { path: '/backoffice/knowledge-graph', label: 'Return to Migration Runner' },
      };
    }

    await logActivity({
      organizationId: 'org_default',
      workspaceId,
      userId: actorId,
      displayName: actorName,
      type: 'knowledge_fer_migration_executed',
      source: 'backoffice_migration',
      description: `Executed FER migration: backfilled ${result.data.backfilledCount} explicit knowledge relationships.`,
      metadata: { backfilledCount: result.data.backfilledCount },
    }).catch((e) => console.warn('[triggerBackfillCrmRelationsAction] Activity log failed:', e));

    return { success: true, data: result.data };
  } catch (err) {
    console.error('[triggerBackfillCrmRelationsAction] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FER Migration runner encountered an error.',
      actionConfig: { path: '/backoffice/knowledge-graph', label: 'Return to Migration Runner' },
    };
  }
}

/**
 * Resets workspace governance configuration back to the system baseline.
 */
export async function resetKnowledgeGraphGovernanceAction(
  workspaceId: string,
  actorId: string,
  actorName: string
): Promise<ActionResult<KnowledgeGraphGovernanceConfig>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const now = new Date().toISOString();
    const baselineConfig: KnowledgeGraphGovernanceConfig = {
      workspaceId,
      ...DEFAULT_KNOWLEDGE_GRAPH_GOVERNANCE,
      updatedAt: now,
      updatedBy: actorId,
    };

    const docRef = adminDb.collection(GOVERNANCE_COLLECTION).doc(workspaceId);
    await docRef.set(baselineConfig);

    await logActivity({
      organizationId: 'org_default',
      workspaceId,
      userId: actorId,
      displayName: actorName,
      type: 'knowledge_governance_reset',
      source: 'backoffice_governance',
      description: 'Reset Knowledge Graph governance parameters to system baseline defaults.',
      metadata: { baselineConfig },
    }).catch((e) => console.warn('[resetKnowledgeGraphGovernanceAction] Activity log failed:', e));

    return { success: true, data: baselineConfig };
  } catch (err) {
    console.error('[resetKnowledgeGraphGovernanceAction] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reset governance configuration.',
    };
  }
}
