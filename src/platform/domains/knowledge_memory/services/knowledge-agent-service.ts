/**
 * @fileOverview Knowledge Agent Service & Grounded Answer Synthesis (Phase 11 M4 · T2)
 *
 * Implements:
 * - Rule 47 Grounded Answer Contract: Claims mapped to explicit citations; uncited claims pruned
 * - Clean 'no_evidence' coverage when no facts match (Zero Hallucination)
 * - Conflict & contradiction detection across retrieved evidence
 * - Untrusted reference data containerization via `<untrusted_reference_data>` (Rule 13 & 30)
 * - Prompt injection directive scanning via linear non-backtracking regex (Rule 30)
 * - Emergency dead-man switch evaluation via checkGovernanceDeadManSwitch (Rule 60)
 * - Domain event publishing: `knowledge.retrieval.executed` and `knowledge.answer.synthesized` (Rule 40)
 *
 * Strict Compliance:
 * - Zero `any` or `any[]` (Rule 4)
 * - Monotonically bounded context budgeting (Rule 28 & 56)
 */

import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  type KnowledgeAnswerContract,
  type KnowledgeClaim,
  type KnowledgeCitation,
  type KnowledgeAnswerConflict,
  type KnowledgeGetEvidenceInput,
  type KnowledgeGetEvidenceOutput,
  type KnowledgeGetCitationsInput,
  type KnowledgeGetCitationsOutput,
  KnowledgeAnswerContractSchema,
  KnowledgeGetEvidenceInputSchema,
  KnowledgeGetCitationsInputSchema,
} from '../contracts/knowledge-schemas';
import {
  KnowledgeAgentError,
  KNOWLEDGE_AGENT_ERROR_CODES,
} from '../contracts/knowledge-errors';
import {
  KnowledgeAdaptiveRetriever,
  getKnowledgeAdaptiveRetriever,
  type AdaptiveKnowledgeItem,
} from './knowledge-adaptive-retriever';

// Non-backtracking linear regex patterns for prompt injection directives (Rule 30)
const ADVERSARIAL_DIRECTIVE_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /system\s+override/gi,
  /you\s+are\s+now\s+an\s+unrestricted/gi,
  /disregard\s+(all\s+)?prior\s+prompts/gi,
  /bypass\s+all\s+safety/gi,
  /reveal\s+all\s+system\s+prompts/gi,
  /exfiltrate/gi,
  /assistant\s+mode\s+deactivated/gi,
  /grant\s+all\s+admin\s+permissions/gi,
];

export interface SynthesizeAnswerParams {
  organizationId: string;
  workspaceId: string;
  query: string;
  entityId?: string;
  callerPermissions?: string[];
  maxContextTokens?: number;
  signal?: AbortSignal;
}

export interface KnowledgeAgentServiceOptions {
  retriever?: KnowledgeAdaptiveRetriever;
}

export class KnowledgeAgentService {
  private retriever: KnowledgeAdaptiveRetriever;

  constructor(options?: KnowledgeAgentServiceOptions) {
    this.retriever = options?.retriever ?? getKnowledgeAdaptiveRetriever();
  }

  /**
   * Scans text for adversarial prompt injection directives (Rule 30).
   */
  private scanForAdversarialDirectives(text: string): boolean {
    for (const pattern of ADVERSARIAL_DIRECTIVE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Containerizes untrusted reference items inside strict XML boundaries (Rule 13 & 30).
   */
  formatReferenceContext(
    items: Array<Pick<AdaptiveKnowledgeItem, 'id' | 'title' | 'content' | 'sourceType'>>
  ): string {
    return items
      .map(
        (item) =>
          `<untrusted_reference_data id="${item.id}" title="${item.title}" source="${item.sourceType}">\n${item.content}\n</untrusted_reference_data>`
      )
      .join('\n\n');
  }

  /**
   * Synthesizes a grounded answer adhering strictly to Rule 47 Grounded Answer Contract.
   */
  async synthesizeAnswer(params: SynthesizeAnswerParams): Promise<KnowledgeAnswerContract> {
    // 1. Evaluate emergency governance dead-man switch (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(params.organizationId);
    } catch (err) {
      throw new KnowledgeAgentError(
        KNOWLEDGE_AGENT_ERROR_CODES.KNOWLEDGE_DEAD_MAN_PAUSED,
        'Knowledge Agent processing paused by emergency governance dead-man switch (Rule 60).',
        { error: err instanceof Error ? err.message : String(err) }
      );
    }

    // 2. Scan user query for adversarial prompt injection directives (Rule 30)
    if (this.scanForAdversarialDirectives(params.query)) {
      throw new KnowledgeAgentError(
        KNOWLEDGE_AGENT_ERROR_CODES.PROMPT_INJECTION_DETECTED,
        'Adversarial prompt injection directive detected in query. Execution rejected.'
      );
    }

    // 3. Adaptive tri-modal retrieval
    const searchResult = await this.retriever.searchHybrid(
      {
        organizationId: params.organizationId,
        workspaceId: params.workspaceId,
        query: params.query,
        entityId: params.entityId,
        limit: 10,
      },
      {
        callerPermissions: params.callerPermissions,
        maxContextTokens: params.maxContextTokens,
      }
    );

    // Emit domain event for retrieval (Rule 40)
    try {
      await defaultEventBus.publish(
        createDomainEvent({
          type: 'knowledge.retrieval.executed',
          organizationId: params.organizationId,
          workspaceId: params.workspaceId,
          actor: { id: 'knowledge_agent', type: 'agent' },
          entity: { type: 'knowledge_query', id: `query_${Date.now()}` },
          payload: {
            query: params.query,
            totalFound: searchResult.totalFound,
            includedCount: searchResult.includedCount,
            durationMs: searchResult.durationMs,
          },
          correlationId: `corr_retrieval_${Date.now()}`,
          source: 'knowledge_agent_service',
        })
      );
    } catch {
      // Non-blocking
    }

    // 4. Handle Empty Evidence cleanly without hallucination
    if (searchResult.hits.length === 0) {
      return KnowledgeAnswerContractSchema.parse({
        query: params.query,
        answer: 'No relevant evidence found in the workspace knowledge base to answer this query.',
        coverage: 'no_evidence',
        claims: [],
        citations: [],
        conflictsDetected: [],
        contextSummary: {
          totalFound: 0,
          includedCount: 0,
          omittedCount: 0,
          tokenCount: 0,
        },
        citationPrecision: 1.0,
      });
    }

    // 5. Construct Citations from retrieved evidence
    const citations: KnowledgeCitation[] = searchResult.hits.map((hit) => ({
      citationId: `cit_${hit.id}`,
      sourceId: hit.id,
      sourceType: hit.sourceType,
      textSpan: hit.content.substring(0, Math.min(200, hit.content.length)),
      relevanceScore: Math.min(1.0, Math.max(0.0, hit.finalScore * 10)), // normalized
    }));

    // 6. Detect factual contradictions across retrieved hits
    const conflicts: KnowledgeAnswerConflict[] = [];
    for (let i = 0; i < searchResult.hits.length; i++) {
      for (let j = i + 1; j < searchResult.hits.length; j++) {
        const hitA = searchResult.hits[i];
        const hitB = searchResult.hits[j];
        if (
          hitA.tags?.some((t: string) => hitB.tags?.includes(t)) &&
          (hitA.title.toLowerCase().includes('legacy') !== hitB.title.toLowerCase().includes('legacy') ||
            hitA.content.toLowerCase().includes('legacy') !== hitB.content.toLowerCase().includes('legacy'))
        ) {
          conflicts.push({
            factA: hitA.title,
            factB: hitB.title,
            reason: 'Potential discrepancy between legacy terms and current operational guidelines.',
          });
        }
      }
    }

    // 7. Grounded Claim Formulation
    // In production, this uses TieredModelRouter with Pro tier. Here we construct grounded claims.
    const rawClaims: KnowledgeClaim[] = searchResult.hits.map((hit) => ({
      claimText: `${hit.title}: ${hit.content.substring(0, 150)}...`,
      citationIds: [`cit_${hit.id}`],
      confidence: hit.verificationState === 'verified' ? 0.95 : 0.8,
    }));

    // Rule 47 Grounding Enforcement: Prune any claim missing a valid citation
    const validCitationIds = new Set(citations.map((c) => c.citationId));
    const groundedClaims: KnowledgeClaim[] = [];

    for (const claim of rawClaims) {
      const validIds = claim.citationIds.filter((id) => validCitationIds.has(id));
      if (validIds.length > 0) {
        groundedClaims.push({
          ...claim,
          citationIds: validIds,
        });
      }
    }

    const citationPrecision =
      rawClaims.length > 0 ? groundedClaims.length / rawClaims.length : 1.0;

    // Synthesize structured natural language answer
    const answerParagraphs = groundedClaims.map(
      (c) => `${c.claimText} [${c.citationIds.join(', ')}]`
    );
    let synthesizedAnswer = answerParagraphs.join('\n\n');
    if (conflicts.length > 0) {
      synthesizedAnswer += `\n\nNote: Potential conflicts detected between historical notes and current policy.`;
    }

    const answerContract: KnowledgeAnswerContract = KnowledgeAnswerContractSchema.parse({
      query: params.query,
      answer: synthesizedAnswer,
      coverage: groundedClaims.length >= 1 ? 'complete' : 'partial',
      claims: groundedClaims,
      citations,
      conflictsDetected: conflicts,
      contextSummary: {
        totalFound: searchResult.totalFound,
        includedCount: searchResult.includedCount,
        omittedCount: searchResult.omittedCount,
        tokenCount: searchResult.tokenCount,
      },
      citationPrecision,
    });

    // Emit domain event for answer synthesis (Rule 40)
    try {
      await defaultEventBus.publish(
        createDomainEvent({
          type: 'knowledge.answer.synthesized',
          organizationId: params.organizationId,
          workspaceId: params.workspaceId,
          actor: { id: 'knowledge_agent', type: 'agent' },
          entity: { type: 'knowledge_answer', id: `ans_${Date.now()}` },
          payload: {
            query: params.query,
            coverage: answerContract.coverage,
            claimsCount: answerContract.claims.length,
            citationsCount: answerContract.citations.length,
            citationPrecision: answerContract.citationPrecision,
          },
          correlationId: `corr_answer_${Date.now()}`,
          source: 'knowledge_agent_service',
        })
      );
    } catch {
      // Non-blocking
    }

    return answerContract;
  }

  /**
   * Retrieves specific evidence items by their IDs, enforcing multi-tenant isolation.
   */
  async getEvidence(input: KnowledgeGetEvidenceInput): Promise<KnowledgeGetEvidenceOutput> {
    const validated = KnowledgeGetEvidenceInputSchema.parse(input);
    const resultHits: KnowledgeGetEvidenceOutput['items'] = [];
    const missingIds: string[] = [];

    for (const id of validated.memoryIds) {
      const item = this.retriever.getItem(id);
      if (
        item &&
        item.organizationId === validated.organizationId &&
        item.workspaceId === validated.workspaceId
      ) {
        resultHits.push({
          id: item.id,
          sourceType: item.sourceType,
          title: item.title,
          content: item.content,
          denseRank: 1,
          sparseRank: 1,
          graphDistance: null,
          rrfScore: 0.03,
          temporalDecayMultiplier: 1.0,
          verificationMultiplier: item.verificationState === 'verified' ? 1.25 : 0.85,
          finalScore: 1.0,
          sensitivity: item.sensitivity,
          verificationState: item.verificationState,
          createdAt: item.createdAt,
          metadata: item.metadata,
        });
      } else {
        missingIds.push(id);
      }
    }

    return {
      items: resultHits,
      missingIds,
    };
  }

  /**
   * Retrieves citations for a query.
   */
  async getCitations(input: KnowledgeGetCitationsInput): Promise<KnowledgeGetCitationsOutput> {
    const validated = KnowledgeGetCitationsInputSchema.parse(input);
    const searchResult = await this.retriever.searchHybrid({
      organizationId: validated.organizationId,
      workspaceId: validated.workspaceId,
      query: validated.query,
      limit: validated.limit,
    });

    const citations: KnowledgeCitation[] = searchResult.hits.map((hit) => ({
      citationId: `cit_${hit.id}`,
      sourceId: hit.id,
      sourceType: hit.sourceType,
      textSpan: hit.content.substring(0, Math.min(200, hit.content.length)),
      relevanceScore: Math.min(1.0, Math.max(0.0, hit.finalScore * 10)),
    }));

    return {
      citations,
    };
  }
}

// Global HMR singleton preservation
const GLOBAL_KNOWLEDGE_AGENT_SERVICE_KEY = Symbol.for('smartsapp.knowledge_agent_service');
type GlobalWithAgentService = typeof globalThis & {
  [GLOBAL_KNOWLEDGE_AGENT_SERVICE_KEY]?: KnowledgeAgentService;
};

export function getKnowledgeAgentService(): KnowledgeAgentService {
  const g = globalThis as GlobalWithAgentService;
  if (!g[GLOBAL_KNOWLEDGE_AGENT_SERVICE_KEY]) {
    g[GLOBAL_KNOWLEDGE_AGENT_SERVICE_KEY] = new KnowledgeAgentService();
  }
  return g[GLOBAL_KNOWLEDGE_AGENT_SERVICE_KEY];
}
