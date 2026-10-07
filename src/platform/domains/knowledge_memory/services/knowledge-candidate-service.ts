/**
 * @fileOverview Governed Knowledge Candidate Ingestion Service (Phase 11 M3 · T1 & T2)
 *
 * Implements Rule 13 (Untrusted External Inputs & XML Containerization),
 * Rule 30 (Adversarial Directive Scanning & Injection Defense),
 * Rule 8 & 47 (Multi-Tenant Scoping & Anti-IDOR),
 * Rule 17 (Non-Delegable Human Decider),
 * Rule 40 (Domain Event Publishing).
 */

import { adminDb } from '@/lib/firebase-admin';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  KnowledgeCandidateSchema,
  type KnowledgeCandidate,
  type ProposeCandidateInput,
  type ReviewQueueDecideInput,
  type KnowledgeCandidateStatus,
} from '../contracts/knowledge-schemas';
import {
  KnowledgeDomainError,
  KNOWLEDGE_ERROR_CODES,
} from '../contracts/knowledge-errors';

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

export class KnowledgeCandidateService {
  private inMemoryCandidates = new Map<string, KnowledgeCandidate>();

  /**
   * Scans content and title for adversarial prompt injection directives (Rule 30).
   */
  private scanForAdversarialDirectives(title: string, content: string): boolean {
    const combined = `${title}\n${content}`;
    for (const pattern of ADVERSARIAL_DIRECTIVE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(combined)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Wraps untrusted text in strict XML isolation container (Rule 13 & 30).
   */
  private wrapUntrustedContent(candidateId: string, sourceType: string, sourceId: string, rawContent: string): string {
    return `<untrusted_reference_data id="${candidateId}" source="${sourceType}:${sourceId}">\n${rawContent.trim()}\n</untrusted_reference_data>`;
  }

  /**
   * Proposes a new knowledge candidate into the review queue (L1_INTERNAL_DRAFT).
   */
  async proposeCandidate(
    input: ProposeCandidateInput,
    _context?: { actorId?: string; actorType?: 'user' | 'agent' }
  ): Promise<KnowledgeCandidate> {
    // 1. Evaluate Rule 60 Emergency Dead-Man Switch
    try {
      checkGovernanceDeadManSwitch(input.organizationId);
    } catch {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.KNOWLEDGE_DEAD_MAN_PAUSED,
        'Knowledge candidate ingestion is paused under emergency governance.'
      );
    }

    // 2. Scan for prompt injection directives (Rule 30)
    if (this.scanForAdversarialDirectives(input.title, input.content)) {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.PROMPT_INJECTION_DETECTED,
        'Prompt injection directive detected in candidate text. Ingestion rejected.',
        { title: input.title }
      );
    }

    // 3. Generate candidate ID and XML-isolated content
    const now = new Date().toISOString();
    const candidateId = `kn_cand_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const wrappedContent = this.wrapUntrustedContent(
      candidateId,
      input.source.type,
      input.source.id,
      input.content
    );

    const candidate: KnowledgeCandidate = {
      id: candidateId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      source: input.source,
      type: input.type,
      title: input.title.trim(),
      content: wrappedContent,
      subjectRefs: input.subjectRefs ?? [],
      suggestedRelationships: input.suggestedRelationships ?? [],
      confidence: input.confidence ?? 0.8,
      verificationState: 'unverified',
      sensitivity: input.sensitivity ?? 'internal',
      status: 'pending',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    // Validate with Zod v4 schema
    const validated = KnowledgeCandidateSchema.parse(candidate);

    // 4. Persist to store (in-memory + Firestore if available)
    this.inMemoryCandidates.set(candidateId, validated);
    if (adminDb) {
      try {
        await adminDb.collection('knowledge_inbox_candidates').doc(candidateId).set(validated);
      } catch {
        // Fallback to in-memory during testing/offline environments
      }
    }

    // 5. Emit Domain Event (Rule 40)
    try {
      await defaultEventBus.publish(
        createDomainEvent({
          type: 'knowledge.candidate.proposed',
          organizationId: input.organizationId,
          workspaceId: input.workspaceId,
          actor: _context?.actorId
            ? { id: _context.actorId, type: _context.actorType ?? 'agent' }
            : { id: 'system', type: 'system' },
          entity: { type: 'knowledge_candidate', id: candidateId },
          payload: {
            candidateId,
            sourceType: input.source.type,
            sourceId: input.source.id,
            candidateType: input.type,
            confidence: candidate.confidence,
          },
          correlationId: `corr_${candidateId}`,
          source: 'knowledge_candidate_service',
        })
      );
    } catch {
      // Event publishing non-blocking for persistence
    }

    return validated;
  }

  /**
   * Retrieves candidate with strict anti-IDOR workspace scoping (Rule 8 & 47).
   */
  async getCandidate(candidateId: string, workspaceId: string): Promise<KnowledgeCandidate> {
    let candidate = this.inMemoryCandidates.get(candidateId);

    if (!candidate && adminDb) {
      try {
        const snap = await adminDb.collection('knowledge_inbox_candidates').doc(candidateId).get();
        if (snap.exists) {
          candidate = KnowledgeCandidateSchema.parse(snap.data());
          this.inMemoryCandidates.set(candidateId, candidate);
        }
      } catch {
        // Fall through to not found
      }
    }

    if (!candidate) {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.CANDIDATE_NOT_FOUND,
        `Candidate with id '${candidateId}' not found.`
      );
    }

    if (candidate.workspaceId !== workspaceId) {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.IDOR_VIOLATION,
        `Access denied: candidate '${candidateId}' does not belong to workspace '${workspaceId}'.`
      );
    }

    return candidate;
  }

  /**
   * Lists candidates for a workspace with optional status filtering.
   */
  async listCandidates(options: {
    workspaceId: string;
    status?: KnowledgeCandidateStatus;
    limit?: number;
  }): Promise<KnowledgeCandidate[]> {
    const limit = options.limit ?? 50;
    const memoryMatches = Array.from(this.inMemoryCandidates.values()).filter(
      (c) => c.workspaceId === options.workspaceId && (!options.status || c.status === options.status)
    );

    if (memoryMatches.length > 0 || !adminDb) {
      return memoryMatches.slice(0, limit);
    }

    try {
      let query: FirebaseFirestore.Query = adminDb
        .collection('knowledge_inbox_candidates')
        .where('workspaceId', '==', options.workspaceId);

      if (options.status) {
        query = query.where('status', '==', options.status);
      }

      const snap = await query.limit(limit).get();
      return snap.docs.map((doc) => KnowledgeCandidateSchema.parse(doc.data()));
    } catch {
      return memoryMatches.slice(0, limit);
    }
  }

  /**
   * Decides a review queue candidate. Strictly non-delegable to agents (Rule 17).
   */
  async decideCandidate(
    input: ReviewQueueDecideInput,
    actor: { id: string; type: 'user' | 'agent'; permissions?: string[] }
  ): Promise<KnowledgeCandidate> {
    // 1. Rule 17 Gate: Strictly Non-Delegable to AI Agents
    if (actor.type !== 'user') {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.NON_DELEGABLE_ACTION,
        'Review queue decisions are strictly non-delegable to AI agents (Rule 17 Non-Negotiable).'
      );
    }

    // 2. Fetch candidate and assert workspace boundary
    const candidate = await this.getCandidate(input.candidateId, input.workspaceId);

    // 3. Concurrency and state verification
    if (candidate.status !== 'pending') {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.CANDIDATE_ALREADY_DECIDED,
        `Candidate '${input.candidateId}' has already been decided with status '${candidate.status}'.`
      );
    }

    if (candidate.version !== input.version) {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.VERSION_MISMATCH,
        `Version conflict: expected version ${input.version}, but current version is ${candidate.version}.`
      );
    }

    const now = new Date().toISOString();
    const newStatus: KnowledgeCandidateStatus = input.decision === 'reject' ? 'rejected' : 'accepted';
    const newVerificationState = input.decision === 'reject' ? 'rejected' : 'verified';

    const updated: KnowledgeCandidate = {
      ...candidate,
      title: input.editedTitle ?? candidate.title,
      content: input.editedContent ? this.wrapUntrustedContent(candidate.id, candidate.source.type, candidate.source.id, input.editedContent) : candidate.content,
      status: newStatus,
      verificationState: newVerificationState,
      decidedAt: now,
      decidedBy: actor.id,
      decisionReason: input.reason,
      version: candidate.version + 1,
      updatedAt: now,
    };

    const validated = KnowledgeCandidateSchema.parse(updated);
    this.inMemoryCandidates.set(input.candidateId, validated);

    if (adminDb) {
      try {
        await adminDb.collection('knowledge_inbox_candidates').doc(input.candidateId).set(validated);
      } catch {
        // In-memory fallback
      }
    }

    // Emit domain event (Rule 40)
    try {
      await defaultEventBus.publish(
        createDomainEvent({
          type: 'knowledge.candidate.decided',
          organizationId: candidate.organizationId,
          workspaceId: candidate.workspaceId,
          actor: { id: actor.id, type: 'user' },
          entity: { type: 'knowledge_candidate', id: input.candidateId },
          payload: {
            candidateId: input.candidateId,
            decision: input.decision,
            status: newStatus,
            decidedBy: actor.id,
          },
          correlationId: `corr_${input.candidateId}`,
          source: 'knowledge_candidate_service',
        })
      );
    } catch {
      // Non-blocking
    }

    return validated;
  }
}

// Global HMR singleton preservation
const GLOBAL_KNOWLEDGE_CANDIDATE_SERVICE_KEY = Symbol.for('smartsapp.knowledge_candidate_service');
type GlobalWithCandidateService = typeof globalThis & {
  [GLOBAL_KNOWLEDGE_CANDIDATE_SERVICE_KEY]?: KnowledgeCandidateService;
};

export function getKnowledgeCandidateService(): KnowledgeCandidateService {
  const g = globalThis as GlobalWithCandidateService;
  if (!g[GLOBAL_KNOWLEDGE_CANDIDATE_SERVICE_KEY]) {
    g[GLOBAL_KNOWLEDGE_CANDIDATE_SERVICE_KEY] = new KnowledgeCandidateService();
  }
  return g[GLOBAL_KNOWLEDGE_CANDIDATE_SERVICE_KEY];
}
