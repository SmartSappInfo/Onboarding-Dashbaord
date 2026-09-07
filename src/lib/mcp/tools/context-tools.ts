/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Governed Context MCP Tools
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Prompt Assembly:
 *    - Delegates exclusively to `ContextBuilderService` (Phase 5 Façade).
 * 2. Risk Tier:
 *    - `context.build`: read_only (Zero mutations, token budgeted, cached).
 *    - `context.get_dossier`: read_only (Executive intelligence summary).
 * 3. Strict Zero-`any` & Zero-`unknown` Invariant:
 *    - Uses Zod schemas and recursive `McpPayloadValue`.
 * 4. Grounded Citation Traceability:
 *    - Returns structured citations for human inspection and model grounding.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

import { z } from 'zod';
import { McpToolDefinition } from '../types';
import { ContextBuilderService } from '@/lib/memory/services/context-builder-service';
import type { ContextSubjectType } from '@/lib/memory/context-types';

// ==========================================
// 1. context.build (Read-Only)
// ==========================================

const buildContextInputSchema = z.object({
  objective: z.string().min(1).describe('The user goal or reasoning task for which context is being compiled.'),
  subjectId: z.string().optional().describe('Optional ID of target entity, deal, or meeting.'),
  subjectType: z.enum(['entity', 'deal', 'task', 'meeting', 'ticket']).optional().describe('Type of subject entity.'),
  maxTokens: z.number().int().min(500).max(16000).optional().describe('Maximum token budget (default 4000).'),
  depth: z.enum(['shallow', 'standard', 'deep']).optional().describe('Context expansion depth (default standard).'),
});

const buildContextOutputSchema = z.object({
  objective: z.string(),
  totalEstimatedTokens: z.number(),
  executionTimeMs: z.number(),
  factsCount: z.number(),
  memoriesCount: z.number(),
  relationshipsCount: z.number(),
  conflictsCount: z.number(),
  assembledPrompt: z.string(),
  citations: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      label: z.string(),
      relevanceScore: z.number(),
      whyRelevant: z.string(),
    })
  ),
  conflicts: z.array(
    z.object({
      conflictId: z.string(),
      summary: z.string(),
      severity: z.string(),
    })
  ),
});

export const contextBuildTool: McpToolDefinition<
  z.infer<typeof buildContextInputSchema>,
  z.infer<typeof buildContextOutputSchema>
> = {
  name: 'context.build',
  version: '1.0.0',
  category: 'context',
  description: 'Compiles a multi-store token-budgeted prompt package combining CRM data, vector memory, knowledge graph topology, and conflict warnings.',
  riskLevel: 'read_only',
  requiresApproval: false,
  parameters: buildContextInputSchema,
  responseSchema: buildContextOutputSchema,
  handler: async (params, context) => {
    const subject = params.subjectId && params.subjectType
      ? { type: params.subjectType as ContextSubjectType, id: params.subjectId }
      : undefined;

    const pkg = await ContextBuilderService.buildContext({
      workspaceId: context.workspaceId,
      organizationId: context.organizationId,
      objective: params.objective,
      subject,
      maxTokens: params.maxTokens ?? 4000,
      depth: params.depth ?? 'standard',
    });

    return {
      objective: pkg.objective,
      totalEstimatedTokens: pkg.tokenBudget.totalEstimatedTokens ?? pkg.tokenBudget.totalTokens,
      executionTimeMs: pkg.executionTimeMs,
      factsCount: (pkg.facts || pkg.structuredFacts).length,
      memoriesCount: pkg.memories.length,
      relationshipsCount: pkg.relationships.length,
      conflictsCount: pkg.conflicts.length,
      assembledPrompt: pkg.assembledPrompt ?? '',
      citations: pkg.sources.map((s) => ({
        id: s.id || s.sourceId || '',
        type: String(s.sourceType || 'note'),
        label: s.label || s.title || s.sourceTitle || 'Knowledge Source',
        relevanceScore: s.relevanceScore ?? s.confidence ?? 0.8,
        whyRelevant: s.whyRelevant ?? s.quoteSnippet ?? s.excerpt ?? '',
      })),
      conflicts: pkg.conflicts.map((c) => ({
        conflictId: c.conflictId || c.id || '',
        summary: c.summary || '',
        severity: c.severity || 'low',
      })),
    };
  },
};

// ==========================================
// 2. context.get_dossier (Read-Only)
// ==========================================

const getDossierInputSchema = z.object({
  subjectId: z.string().min(1).describe('The ID of the subject (e.g. CRM entity or deal).'),
  subjectType: z.enum(['entity', 'deal', 'task', 'meeting', 'ticket']).describe('Subject classification.'),
});

const getDossierOutputSchema = z.object({
  subjectId: z.string(),
  subjectType: z.string(),
  title: z.string(),
  executiveSummary: z.string(),
  commercialHealth: z.string(),
  currentConcerns: z.array(z.string()),
  suggestedTalkingPoints: z.array(z.string()),
  stakeholders: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      relationshipStatus: z.string(),
    })
  ),
  recentSignals: z.array(
    z.object({
      trend: z.string(),
      label: z.string(),
      description: z.string(),
    })
  ),
});

export const contextGetDossierTool: McpToolDefinition<
  z.infer<typeof getDossierInputSchema>,
  z.infer<typeof getDossierOutputSchema>
> = {
  name: 'context.get_dossier',
  version: '1.0.0',
  category: 'context',
  description: 'Generates a structured executive dossier for an account, deal, or meeting with health telemetry, stakeholders, and talking points.',
  riskLevel: 'read_only',
  requiresApproval: false,
  parameters: getDossierInputSchema,
  responseSchema: getDossierOutputSchema,
  handler: async (params, context) => {
    const dossier = await ContextBuilderService.buildSubjectDossier({
      subjectId: params.subjectId,
      subjectType: params.subjectType as ContextSubjectType,
      workspaceId: context.workspaceId,
      organizationId: context.organizationId,
    });

    return {
      subjectId: dossier.subjectId,
      subjectType: dossier.subjectType,
      title: dossier.title,
      executiveSummary: dossier.executiveSummary,
      commercialHealth: dossier.commercialHealth?.status || dossier.commercialOutlook.revenueMomentum || 'stable',
      currentConcerns: dossier.currentConcerns,
      suggestedTalkingPoints: dossier.suggestedTalkingPoints || [],
      stakeholders: dossier.keyStakeholders.map((s) => ({
        name: s.name,
        role: s.role,
        relationshipStatus: s.relationshipStatus,
      })),
      recentSignals: dossier.recentSignals.map((sig) => ({
        trend: sig.trend,
        label: sig.label,
        description: sig.description,
      })),
    };
  },
};
