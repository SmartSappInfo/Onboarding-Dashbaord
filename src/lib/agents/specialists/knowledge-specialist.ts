/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Knowledge & Research Specialist
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Specialization:
 *    - Deep semantic memory recall, fact contradiction checking, and knowledge gap discovery.
 * 2. Strict Tool Whitelist:
 *    - Allowed: `memory.search`, `memory.find_similar`, `memory.get_related`, `context.build`.
 * 3. Non-Destructive Invariant:
 *    - Only performs read and recall queries; never mutates commercial records.
 *
 * @testability Covered in `src/lib/agents/__tests__/domain-agents.test.ts`.
 */

import { BaseDomainSpecialist } from './base-domain-specialist';
import type { SpecialistDescriptor } from '../domain-types';
import type {
  AgentRequest,
  AgentResult,
  AgentToolCall,
  AgentFinding,
  AgentActionProposal,
} from '@/lib/supervisor/types';
import type { ContextSourceCitation } from '@/lib/memory/context-types';
import type { SpecialistWorkspaceConfig } from '../domain-types';

export const KNOWLEDGE_SPECIALIST_DESCRIPTOR: SpecialistDescriptor = {
  id: 'knowledge_specialist',
  name: 'Knowledge & Lore Specialist',
  version: '1.0.0',
  category: 'domain',
  roleTitle: 'Institutional Archivist & Research Lead',
  personaDescription:
    'Domain agent dedicated to deep semantic recall, cross-entity fact retrieval, institutional memory verification, and knowledge gap discovery.',
  systemDirective:
    'You are the Knowledge & Lore Specialist for SmartSapp. Your objective is to discover authoritative institutional facts, verify claims against past notes, cite sources, and identify contradictory or missing institutional knowledge.',
  capabilities: ['memory_recall', 'context_assembly', 'synthesis'],
  allowedTools: ['memory.search', 'memory.find_similar', 'memory.get_related', 'context.build'],
  memoryScope: {
    readDomains: ['all_notes', 'institutional_lore', 'meeting_notes', 'decisions'],
    writeDomains: ['knowledge_candidates'],
    disallowedDomains: ['financial_mutations', 'crm_deal_stages'],
  },
  defaultAutonomy: 'autonomous',
  avatarIcon: 'BookOpen',
  colorTheme: 'violet',
};

export class KnowledgeSpecialist extends BaseDomainSpecialist {
  constructor() {
    super('knowledge_specialist', KNOWLEDGE_SPECIALIST_DESCRIPTOR);
  }

  protected async runDomainAnalysis(
    request: AgentRequest,
    config: SpecialistWorkspaceConfig | null
  ): Promise<AgentResult> {
    const toolCallsCollector: AgentToolCall[] = [];
    const sourcesCollector: ContextSourceCitation[] = [];
    const findings: AgentFinding[] = [];
    const actions: AgentActionProposal[] = [];

    // Step 1: Search Memory Mesh for relevant knowledge
    const searchRes = await this.callGovernedTool({
      toolName: 'memory.search',
      arguments: {
        query: request.objective,
        limit: 5,
        threshold: 0.65,
      },
      request,
      toolCallsCollector,
      sourcesCollector,
      config,
    });

    let memoriesFoundCount = 0;
    if (searchRes.success && searchRes.result) {
      const results = searchRes.result.results;
      if (Array.isArray(results)) {
        memoriesFoundCount = results.length;
        if (results.length > 0) {
          findings.push({
            title: `Institutional Lore Verified (${results.length} memories)`,
            category: 'insight',
            content: `Found ${results.length} relevant historical notes and decisions matching "${request.objective}".`,
            confidence: 0.92,
            tags: ['knowledge', 'lore', 'verified_facts'],
          });
        }
      }
    }

    // Step 2: Build Grounded Context if subject is provided
    if (request.subject?.id) {
      const contextRes = await this.callGovernedTool({
        toolName: 'context.build',
        arguments: {
          objective: request.objective,
          subjectType: request.subject.type,
          subjectId: request.subject.id,
          maxTokens: 3000,
        },
        request,
        toolCallsCollector,
        sourcesCollector,
        config,
      });

      if (contextRes.success && contextRes.result) {
        findings.push({
          title: `Context Package Synthesized (${request.subject.type})`,
          category: 'insight',
          content: `Constructed grounded context package for ${request.subject.type} "${request.subject.id}". Citations and cross-store facts attached.`,
          confidence: 0.95,
          tags: ['context', request.subject.type],
        });
      }
    }

    // Propose action if knowledge gaps exist
    if (memoriesFoundCount === 0) {
      findings.push({
        title: 'Institutional Knowledge Gap Identified',
        category: 'warning',
        content: `No historical memories found for query: "${request.objective}". Proposing knowledge documentation action.`,
        confidence: 0.85,
        tags: ['knowledge_gap'],
      });

      actions.push({
        toolName: 'task.create',
        title: 'Document Missing Institutional Knowledge',
        description: `Schedule a quick capture session to document institutional guidance on: "${request.objective}".`,
        riskLevel: 'low_risk',
        requiresApproval: false,
        arguments: {
          title: `Capture knowledge: ${request.objective.substring(0, 50)}...`,
          priority: 'medium',
        },
      });
    }

    const answer = `Knowledge Specialist investigated "${request.objective}". Discovered ${memoriesFoundCount} relevant memories and synthesized ${findings.length} findings with ${sourcesCollector.length} grounded citations.`;

    return this.buildResult({
      status: 'completed',
      answer,
      findings,
      actions,
      toolCalls: toolCallsCollector,
      sources: sourcesCollector,
    });
  }
}
