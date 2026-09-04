'use server';

/**
 * @fileOverview CompanyBrain 2.0 Phase 5: Context Builder Server Actions
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Tenant Authorization Gate:
 *    - Gated by `checkWorkspaceAccess` before querying any relational or vector data.
 * 2. Actionable Error Navigation (Rule 1):
 *    - All error responses strictly include relative paths starting with `/`.
 * 3. Strict Zero-`any` Standard:
 *    - All arguments, return models, and discriminated unions are strictly typed.
 * 4. Grounded AI Dossier Synthesis:
 *    - Seamlessly bridges ContextBuilderService with Genkit Gemini 2.5 Flash flow.
 *
 * @testability Covered in `src/lib/memory/__tests__/context-builder.test.ts`.
 */

import { checkWorkspaceAccess } from '@/lib/workspace-permissions';
import { ContextBuilderService } from '../services/context-builder-service';
import {
  generateContextDossierFlow,
  type ContextDossierOutput,
} from '@/ai/flows/generate-context-dossier-flow';
import type {
  ContextBuildRequest,
  ContextPackage,
  SubjectDossier,
  ContextSubjectType,
} from '../context-types';

export type ActionResult<T> =
  | { success: true; data: T; error?: never; code?: never; actionConfig?: never }
  | {
      success: false;
      data?: never;
      error: string;
      code?: 'unauthenticated' | 'unauthorized' | 'validation_error' | 'not_found' | 'server_error';
      actionConfig?: { path: string; label: string };
    };

/**
 * Assembles a unified, token-budgeted ContextPackage.
 */
export async function buildContextAction(
  params: ContextBuildRequest & { userId: string }
): Promise<ActionResult<ContextPackage>> {
  const { workspaceId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes', label: 'Back to Notes' },
    };
  }

  try {
    const pkg = await ContextBuilderService.buildContext(params);
    return { success: true, data: pkg };
  } catch (err) {
    console.error('[buildContextAction] Failed to assemble context package:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Context assembly failed.',
      code: 'server_error',
      actionConfig: { path: '/admin/quick-notes', label: 'Back to Notes' },
    };
  }
}

/**
 * Assembles a comprehensive executive dossier for an Entity.
 */
export async function getEntityDossierAction(params: {
  entityId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
}): Promise<ActionResult<SubjectDossier>> {
  const { entityId, workspaceId, organizationId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: `/admin/entities/${entityId}`, label: 'Back to Entity' },
    };
  }

  try {
    const dossier = await ContextBuilderService.buildSubjectDossier({
      subjectId: entityId,
      subjectType: 'entity',
      workspaceId,
      organizationId,
    });
    return { success: true, data: dossier };
  } catch (err) {
    console.error('[getEntityDossierAction] Failed to build entity dossier:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to compile entity dossier.',
      code: 'server_error',
      actionConfig: { path: `/admin/entities/${entityId}`, label: 'Back to Entity' },
    };
  }
}

/**
 * Assembles a comprehensive executive dossier for a Deal.
 */
export async function getDealDossierAction(params: {
  dealId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
}): Promise<ActionResult<SubjectDossier>> {
  const { dealId, workspaceId, organizationId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/deals', label: 'Back to Deals' },
    };
  }

  try {
    const dossier = await ContextBuilderService.buildSubjectDossier({
      subjectId: dealId,
      subjectType: 'deal',
      workspaceId,
      organizationId,
    });
    return { success: true, data: dossier };
  } catch (err) {
    console.error('[getDealDossierAction] Failed to build deal dossier:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to compile deal dossier.',
      code: 'server_error',
      actionConfig: { path: '/admin/deals', label: 'Back to Deals' },
    };
  }
}

/**
 * Runs Genkit Gemini 2.5 Flash to synthesize an executive AI brief from the subject dossier.
 */
export async function synthesizeContextDossierWithAIAction(params: {
  subjectId: string;
  subjectType: ContextSubjectType;
  workspaceId: string;
  organizationId: string;
  userId: string;
}): Promise<ActionResult<ContextDossierOutput>> {
  const { subjectId, subjectType, workspaceId, organizationId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes', label: 'Back to Notes' },
    };
  }

  try {
    const pkg = await ContextBuilderService.buildContext({
      workspaceId,
      organizationId,
      subject: { type: subjectType, id: subjectId },
      objective: `Synthesize high-level executive briefing for ${subjectType} ${subjectId}`,
      maxTokens: 4000,
    });

    const aiOutput = await generateContextDossierFlow({
      subjectName: pkg.subject?.name || 'Account',
      subjectType,
      category: pkg.subject?.category,
      dealValue: pkg.subject?.value,
      facts: pkg.structuredFacts.map((f) => `${f.label}: ${f.value}`),
      memories: pkg.memories.map((m) => m.memory.content),
      openActions: pkg.openActions.map((a) => a.title),
      activeConflicts: pkg.conflicts.map((c) => c.summary),
      citationCount: pkg.sources.length,
    });

    return { success: true, data: aiOutput };
  } catch (err) {
    console.error('[synthesizeContextDossierWithAIAction] AI synthesis failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to synthesize AI briefing.',
      code: 'server_error',
      actionConfig: { path: '/admin/quick-notes', label: 'Back to Notes' },
    };
  }
}
