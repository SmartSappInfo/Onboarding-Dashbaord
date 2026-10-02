/**
 * @fileOverview Canonical Memory Service & Strangler Layer (Phase 4 Milestones 1 & 2)
 *
 * ARCHITECTURAL GUIDELINES (Roadmap §§19, 33 & Rules 4, 8, 21, 28, 29, 30, 40, 60, 69):
 * 1. Strangler Pattern: Unifies memory operations without breaking existing src/lib/memory/ logic.
 * 2. Governance Dead-Man Switch (Rule 60): Emergency pause halts autonomous mutations immediately.
 * 3. Reactive Event Emission (Rule 40): Emits typed domain events via EventBus on all mutations and retrievals.
 * 4. Temporal Validity & Decay Gate (Rule 29): Enforces validFrom/validUntil bounds and marks superseded items.
 * 5. Anti-Poisoning Integration (Rule 30): Automatically analyzes memory candidate content for hostile directives.
 * 6. Context Retrieval Engine (Roadmap §19): Multi-stage retrieval combining classification, hybrid RRF,
 *    temporal decay, 4-tier knapsack budgeting, and XML-isolated evidence packing.
 */

import {
  CanonicalMemoryObject,
  CreateMemoryInput,
  QueryMemoryInput,
  CreateMemoryInputSchema,
  QueryMemoryInputSchema,
  CanonicalMemoryObjectSchema,
  MemoryStats,
  MemoryTier,
  VerificationState,
  SensitivityLevel,
  MEMORY_ERROR_CODES,
} from '../contracts/memory-types';
import { VectorStore } from '../adapters/vector-store.interface';
import { MemoryVectorStore } from '../adapters/memory-vector-store';
import { evaluateMemoryContentRisk } from '../governance/anti-poisoning';
import { defaultEventBus, EventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';

import {
  classifyContextQuery,
  ClassifiedContextQuery,
} from '../retrieval/context-classifier';
import { SparseBM25Retriever } from '../retrieval/sparse-bm25-retriever';
import { HybridRetriever } from '../retrieval/hybrid-retriever';
import {
  StratifiedContextBudgetManager,
  BudgetableCandidate,
  ContextBudgetResult,
} from '../retrieval/context-budget-manager';
import {
  compileEvidencePack,
  EvidencePack,
  EvidenceItemInput,
} from '../retrieval/evidence-compiler';
import {
  EmbeddingProvider,
  DeterministicMemoryEmbeddingProvider,
} from '../ingestion/embedding-service';

export interface CanonicalMemoryServiceOptions {
  vectorStore?: VectorStore;
  eventBus?: EventBus;
  sparseRetriever?: SparseBM25Retriever;
  hybridRetriever?: HybridRetriever;
  embeddingProvider?: EmbeddingProvider;
}

export interface RetrieveContextRequest {
  query: string;
  organizationId: string;
  workspaceId: string;
  maxTokens?: number;
  depth?: 'shallow' | 'standard' | 'deep';
  vector?: number[];
  includeExpired?: boolean;
}

export interface RetrievedContextPackage {
  contextId: string;
  classifiedQuery: ClassifiedContextQuery;
  evidencePack: EvidencePack;
  budgetResult: ContextBudgetResult;
  telemetry: {
    latencyMs: number;
    denseHitsCount: number;
    sparseHitsCount: number;
    totalTokens: number;
  };
  generatedAt: string;
}

export class CanonicalMemoryService {
  private readonly vectorStore: VectorStore;
  private readonly eventBus: EventBus;
  private readonly sparseRetriever: SparseBM25Retriever;
  private readonly hybridRetriever: HybridRetriever;
  private readonly embeddingProvider?: EmbeddingProvider;
  private readonly memoryStore = new Map<string, CanonicalMemoryObject>();

  constructor(options: CanonicalMemoryServiceOptions = {}) {
    this.vectorStore = options.vectorStore ?? new MemoryVectorStore();
    this.eventBus = options.eventBus ?? defaultEventBus;
    this.sparseRetriever = options.sparseRetriever ?? new SparseBM25Retriever();
    this.embeddingProvider = options.embeddingProvider;
    this.hybridRetriever =
      options.hybridRetriever ??
      new HybridRetriever({
        vectorStore: this.vectorStore,
        sparseRetriever: this.sparseRetriever,
      });
  }

  public async createMemoryItem(input: CreateMemoryInput): Promise<CanonicalMemoryObject> {
    const validated = CreateMemoryInputSchema.parse(input);
    const { organizationId, workspaceId } = validated;

    // Rule 60: Emergency Dead-Man Switch Gate
    try {
      await checkGovernanceDeadManSwitch(organizationId);
    } catch {
      throw new Error(MEMORY_ERROR_CODES.DEAD_MAN_PAUSED);
    }

    // Anti-poisoning pre-scan (Rules 13 & 30)
    const risk = evaluateMemoryContentRisk(input.content);
    const content = risk.sanitized;

    const id = `mem_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const memoryItem: CanonicalMemoryObject = CanonicalMemoryObjectSchema.parse({
      id,
      organizationId,
      workspaceId,
      tier: input.tier,
      type: input.type,
      title: input.title,
      content,
      summary: input.summary,
      source: input.source,
      subjectRefs: input.subjectRefs ?? {},
      topics: input.topics ?? [],
      importance: input.importance ?? 0.5,
      confidence: input.confidence ?? 1.0,
      verification: input.verification ?? 'unverified',
      sensitivity: input.sensitivity ?? 'internal',
      lifecycle: { status: 'active' },
      temporal: {
        validFrom: now,
        validUntil: input.validUntil,
        decayRate: 0.0,
      },
      provenance: input.provenance,
      evidence: input.evidence,
      createdAt: now,
      updatedAt: now,
    });

    this.memoryStore.set(id, memoryItem);

    // Index sparse BM25
    await this.sparseRetriever.indexDocuments([
      {
        id,
        organizationId,
        workspaceId,
        content,
        metadata: {
          memoryType: input.type,
          tier: input.tier,
          importance: memoryItem.importance,
        },
      },
    ]);

    // Index vector if semantic or procedural
    if (input.tier === 'semantic' || input.tier === 'procedural') {
      let finalVector = input.vector;
      if (!finalVector && this.embeddingProvider) {
        try {
          finalVector = await this.embeddingProvider.embed(content);
        } catch (err) {
          console.warn('[CanonicalMemoryService] Embedding generation failed, using fallback vector', err);
        }
      }
      if (!finalVector || finalVector.length !== 768) {
        finalVector = DeterministicMemoryEmbeddingProvider.generateDeterministicVector(content);
      }

      await this.vectorStore.upsert([
        {
          id,
          vector: finalVector,
          payload: {
            organizationId,
            workspaceId,
            memoryId: id,
            content,
            memoryType: input.type,
            createdAt: now,
          },
        },
      ]);
    }

    // Emit domain event (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'memory.item.created',
        organizationId,
        workspaceId,
        actor: {
          type: input.provenance.createdBy === 'agent' ? 'agent' : 'user',
          id: input.provenance.agentId ?? input.provenance.userId ?? 'system',
        },
        entity: {
          type: 'memory_object',
          id,
        },
        correlationId: crypto.randomUUID(),
        source: 'canonical-memory-service',
        payload: {
          memoryId: id,
          tier: memoryItem.tier,
          type: memoryItem.type,
        },
      })
    );

    return memoryItem;
  }

  public async getMemoryItem(id: string): Promise<CanonicalMemoryObject | null> {
    return this.memoryStore.get(id) ?? null;
  }

  public async queryMemory(input: QueryMemoryInput): Promise<CanonicalMemoryObject[]> {
    const validated = QueryMemoryInputSchema.parse(input);
    const { organizationId, workspaceId, includeExpired, limit } = validated;

    const now = new Date().toISOString();
    const results: CanonicalMemoryObject[] = [];

    for (const item of this.memoryStore.values()) {
      if (item.organizationId !== organizationId || item.workspaceId !== workspaceId) {
        continue;
      }

      // Temporal validity gate (Rule 29)
      if (!includeExpired) {
        if (item.temporal.validUntil && item.temporal.validUntil < now) {
          continue;
        }
        if (item.temporal.supersededBy) {
          continue;
        }
      }

      results.push(item);
    }

    return results.slice(0, limit);
  }

  public async supersedeMemoryItem(originalId: string, replacementId: string): Promise<boolean> {
    const original = this.memoryStore.get(originalId);
    if (!original) return false;

    original.temporal.supersededBy = replacementId;
    original.lifecycle.status = 'archived';
    original.updatedAt = new Date().toISOString();

    await this.eventBus.publish(
      createDomainEvent({
        type: 'memory.item.superseded',
        organizationId: original.organizationId,
        workspaceId: original.workspaceId,
        actor: { type: 'system', id: 'memory-service' },
        entity: { type: 'memory_object', id: originalId },
        correlationId: crypto.randomUUID(),
        source: 'canonical-memory-service',
        payload: { originalId, replacementId },
      })
    );

    return true;
  }

  public async updateVerificationState(
    id: string,
    verificationState: VerificationState,
    notes?: string
  ): Promise<CanonicalMemoryObject | null> {
    const item = this.memoryStore.get(id);
    if (!item) return null;

    item.verification = verificationState;
    if (verificationState === 'invalidated') {
      item.lifecycle.status = 'disputed';
      if (notes) item.lifecycle.invalidationReason = notes;
    } else if (verificationState === 'user_confirmed' || verificationState === 'source_verified') {
      item.lifecycle.status = 'active';
      item.lifecycle.lastReviewedAt = new Date().toISOString();
      if (notes) item.lifecycle.reviewedBy = notes;
    }
    item.updatedAt = new Date().toISOString();

    await this.eventBus.publish(
      createDomainEvent({
        type: verificationState === 'invalidated' ? 'memory.item.rejected' : 'memory.item.verified',
        organizationId: item.organizationId,
        workspaceId: item.workspaceId,
        actor: { type: 'system', id: 'memory-service' },
        entity: { type: 'memory_object', id },
        correlationId: crypto.randomUUID(),
        source: 'canonical-memory-service',
        payload: { id, verificationState, notes },
      })
    );

    return item;
  }

  public async deleteMemoryItem(id: string): Promise<boolean> {
    const item = this.memoryStore.get(id);
    if (!item) return false;

    this.memoryStore.delete(id);
    await this.vectorStore.deleteByIds([id]);

    await this.eventBus.publish(
      createDomainEvent({
        type: 'memory.item.deleted',
        organizationId: item.organizationId,
        workspaceId: item.workspaceId,
        actor: { type: 'system', id: 'memory-service' },
        entity: { type: 'memory_object', id },
        correlationId: crypto.randomUUID(),
        source: 'canonical-memory-service',
        payload: { id },
      })
    );

    return true;
  }

  public async getMemoryStats(organizationId: string, workspaceId: string): Promise<MemoryStats> {
    if (!organizationId || !workspaceId) {
      throw new Error(MEMORY_ERROR_CODES.TENANT_REQUIRED);
    }

    const tierCounts: Record<MemoryTier, number> = {
      working: 0,
      episodic: 0,
      semantic: 0,
      relational: 0,
      procedural: 0,
    };

    const verificationCounts: Record<VerificationState, number> = {
      unverified: 0,
      ai_generated: 0,
      user_confirmed: 0,
      source_verified: 0,
      disputed: 0,
      invalidated: 0,
    };

    const sensitivityCounts: Record<SensitivityLevel, number> = {
      public: 0,
      internal: 0,
      confidential: 0,
      restricted: 0,
    };

    let totalIndexed = 0;
    let semanticVectors = 0;
    const sourcesSet = new Set<string>();
    let inboxPending = 0;

    for (const item of this.memoryStore.values()) {
      if (item.organizationId !== organizationId || item.workspaceId !== workspaceId) {
        continue;
      }

      totalIndexed++;
      if (item.tier) {
        tierCounts[item.tier] = (tierCounts[item.tier] || 0) + 1;
      }
      if (item.verification) {
        verificationCounts[item.verification] =
          (verificationCounts[item.verification] || 0) + 1;
      }
      if (item.sensitivity) {
        sensitivityCounts[item.sensitivity] =
          (sensitivityCounts[item.sensitivity] || 0) + 1;
      }

      if (item.source?.sourceId) {
        sourcesSet.add(item.source.sourceId);
      }

      if (
        item.verification === 'unverified' ||
        item.verification === 'ai_generated'
      ) {
        inboxPending++;
      }

      if (item.tier === 'semantic') {
        semanticVectors++;
      }
    }

    const health = await this.vectorStore.getHealth();
    const healthStatus: 'healthy' | 'degraded' | 'unhealthy' =
      health.status === 'offline' ? 'unhealthy' : health.status;

    return {
      totalIndexed,
      semanticVectors,
      activeSources: sourcesSet.size,
      inboxPending,
      tierCounts,
      verificationCounts,
      sensitivityCounts,
      healthStatus,
    };
  }

  /**
   * 8-Stage Context Retrieval Algorithm (Roadmap §19 & PRD §§37–44)
   *
   * 1. Intent & entity classification
   * 2. Hybrid dense vector + sparse BM25 retrieval
   * 3. Reciprocal Rank Fusion (RRF) & Rule 29 half-life temporal decay
   * 4. 4-tier stratified knapsack context budgeting (Rule 28)
   * 5. Evidence Pack assembly with Rule 30 XML prompt isolation
   * 6. Telemetry and event bus emission (Rule 40)
   */
  public async retrieveContext(request: RetrieveContextRequest): Promise<RetrievedContextPackage> {
    const startTime = Date.now();
    const { organizationId, workspaceId, query, maxTokens = 4000, vector } = request;

    if (!organizationId || !workspaceId) {
      throw new Error(MEMORY_ERROR_CODES.TENANT_REQUIRED);
    }

    // 1. Classify query intent and extract entity cues
    const classifiedQuery = classifyContextQuery({
      query,
      organizationId,
      workspaceId,
    });

    // 2. Hybrid retrieval (dense cosine + sparse BM25)
    let queryVector = vector;
    if (!queryVector && this.embeddingProvider) {
      try {
        queryVector = await this.embeddingProvider.embed(query);
      } catch (err) {
        console.warn('[CanonicalMemoryService] Query vector embedding failed, using fallback vector', err);
      }
    }
    if (!queryVector || queryVector.length !== 768) {
      queryVector = DeterministicMemoryEmbeddingProvider.generateDeterministicVector(query);
    }

    const hybridHits = await this.hybridRetriever.search({
      query: classifiedQuery.cleanSearchTerms,
      vector: queryVector,
      organizationId,
      workspaceId,
      limit: 20,
    });

    // 3. Map candidates into 4-tier knapsack items
    const candidates: BudgetableCandidate[] = [];
    const evidenceInputs: EvidenceItemInput[] = [];
    const now = new Date().toISOString();

    for (const hit of hybridHits) {
      const mem = this.memoryStore.get(hit.id);
      const content = mem ? mem.content : hit.content;
      const title = mem?.title ?? 'Retrieved Memory';
      const importance = mem?.importance ?? 0.5;
      const createdAt = mem?.createdAt ?? now;

      // Tier allocation based on importance and intent
      let tier: 1 | 2 | 3 | 4 = 3;
      if (importance >= 0.9 || (mem && classifiedQuery.targetEntityTypes.includes(mem.type))) {
        tier = 1; // Critical
      } else if (importance >= 0.7 || hit.finalScore >= 0.02) {
        tier = 2; // Relevant
      } else if (importance >= 0.4) {
        tier = 3; // Supporting
      } else {
        tier = 4; // Discoverable
      }

      candidates.push({
        id: hit.id,
        tier,
        title,
        content,
        importance,
      });

      evidenceInputs.push({
        id: hit.id,
        content,
        sourceType: mem?.source.type ?? 'semantic_search',
        sourceId: mem?.source.sourceId ?? hit.id,
        authorName: mem?.provenance.userId ?? mem?.provenance.agentId ?? 'System',
        createdAt,
        confidence: mem?.confidence ?? 0.85,
        sensitivity: mem?.sensitivity ?? 'internal',
      });
    }

    // 4. Knapsack Context Budget Allocation (Rule 28)
    const budgetResult = StratifiedContextBudgetManager.packContext(candidates, {
      maxTokens,
    });

    // Keep only budgeted items in evidence pack
    const budgetedIds = new Set(budgetResult.budgetedCandidates.map((c) => c.id));
    const budgetedEvidence = evidenceInputs.filter((e) => budgetedIds.has(e.id));

    // 5. Evidence Pack Compilation & XML Wrapping (Rules 16 & 30)
    const evidencePack = compileEvidencePack({
      items: budgetedEvidence,
      objective: query,
      organizationId,
      workspaceId,
    });

    const latencyMs = Date.now() - startTime;
    const contextId = `ctx_${crypto.randomUUID()}`;

    // 6. Emit Telemetry Domain Event (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'memory.context.retrieved',
        organizationId,
        workspaceId,
        actor: { type: 'system', id: 'retrieval-engine' },
        entity: { type: 'context_package', id: contextId },
        correlationId: crypto.randomUUID(),
        source: 'canonical-memory-service',
        payload: {
          contextId,
          intent: classifiedQuery.intent,
          itemsCount: evidencePack.itemCount,
          totalTokens: budgetResult.totalTokens,
          latencyMs,
        },
      })
    );

    return {
      contextId,
      classifiedQuery,
      evidencePack,
      budgetResult,
      telemetry: {
        latencyMs,
        denseHitsCount: hybridHits.filter((h) => h.denseRank !== null).length,
        sparseHitsCount: hybridHits.filter((h) => h.sparseRank !== null).length,
        totalTokens: budgetResult.totalTokens,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

declare global {
  var __smartsappCanonicalMemoryService: CanonicalMemoryService | undefined;
}

export function getCanonicalMemoryService(): CanonicalMemoryService {
  if (!globalThis.__smartsappCanonicalMemoryService) {
    globalThis.__smartsappCanonicalMemoryService = new CanonicalMemoryService();
  }
  return globalThis.__smartsappCanonicalMemoryService;
}

export function setCanonicalMemoryServiceForTests(service?: CanonicalMemoryService): void {
  globalThis.__smartsappCanonicalMemoryService = service;
}

