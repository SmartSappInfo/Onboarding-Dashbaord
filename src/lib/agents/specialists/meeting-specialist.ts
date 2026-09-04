/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Meeting & Briefing Specialist
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Specialization:
 *    - Pre-meeting executive briefings, attendee historical lore, and post-meeting commitment extraction.
 * 2. Strict Tool Whitelist:
 *    - Allowed: `crm.entity.get`, `memory.search`, `task.create`, `task.assign`.
 * 3. Operational Integrity:
 *    - Produces action items for meeting participants with grounded priority tags.
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

export const MEETING_SPECIALIST_DESCRIPTOR: SpecialistDescriptor = {
  id: 'meeting_specialist',
  name: 'Meeting & Briefing Specialist',
  version: '1.0.0',
  category: 'domain',
  roleTitle: 'Executive Briefing & Action Coordinator',
  personaDescription:
    'Domain agent focused on executive meeting preparation, participant context, commitment extraction, and follow-up task orchestration.',
  systemDirective:
    'You are the Meeting & Briefing Specialist for SmartSapp. Your objective is to extract attendee discussion context, summarize key stakeholder positions, and ensure follow-up action items are accurately routed.',
  capabilities: ['crm_read', 'memory_recall', 'task_orchestration', 'synthesis'],
  allowedTools: ['crm.entity.get', 'memory.search', 'task.create', 'task.assign'],
  memoryScope: {
    readDomains: ['meeting_transcripts', 'attendee_profiles', 'action_items'],
    writeDomains: ['meeting_briefs', 'action_tasks'],
    disallowedDomains: ['financial_mutations', 'billing_cycles'],
  },
  defaultAutonomy: 'autonomous',
  avatarIcon: 'Calendar',
  colorTheme: 'blue',
};

export class MeetingSpecialist extends BaseDomainSpecialist {
  constructor() {
    super('meeting_specialist', MEETING_SPECIALIST_DESCRIPTOR);
  }

  protected async runDomainAnalysis(
    request: AgentRequest,
    config: SpecialistWorkspaceConfig | null
  ): Promise<AgentResult> {
    const toolCallsCollector: AgentToolCall[] = [];
    const sourcesCollector: ContextSourceCitation[] = [];
    const findings: AgentFinding[] = [];
    const actions: AgentActionProposal[] = [];

    // Step 1: Recall attendee context & past meeting notes
    const searchRes = await this.callGovernedTool({
      toolName: 'memory.search',
      arguments: {
        query: `meeting notes commitments ${request.objective}`,
        limit: 3,
        threshold: 0.6,
      },
      request,
      toolCallsCollector,
      sourcesCollector,
      config,
    });

    let pastNotesCount = 0;
    if (searchRes.success && searchRes.result) {
      const results = searchRes.result.results;
      if (Array.isArray(results)) {
        pastNotesCount = results.length;
        if (results.length > 0) {
          findings.push({
            title: `Historical Meeting Commitments Recalled (${results.length} records)`,
            category: 'insight',
            content: `Extracted ${results.length} historical discussions and agreements relevant to upcoming meeting context.`,
            confidence: 0.9,
            tags: ['meetings', 'commitments', 'attendees'],
          });
        }
      }
    }

    // Step 2: Propose Follow-up Action Items
    actions.push({
      toolName: 'task.create',
      title: 'Distribute Pre-Meeting Executive Briefing',
      description: `Send 1-page executive brief covering historical lore and open commitments to meeting attendees.`,
      riskLevel: 'low_risk',
      requiresApproval: false,
      arguments: {
        title: `Meeting Brief: ${request.objective.substring(0, 40)}...`,
        priority: 'high',
      },
    });

    actions.push({
      toolName: 'task.create',
      title: 'Record Post-Meeting Decisions into Memory Mesh',
      description: 'Capture decisions and assigned action items into Quick Notes for permanent institutional indexing.',
      riskLevel: 'low_risk',
      requiresApproval: false,
      arguments: {
        title: `Post-meeting capture: ${request.objective.substring(0, 40)}...`,
        priority: 'medium',
      },
    });

    const answer = `Meeting Specialist synthesized briefing materials for "${request.objective}". Verified ${pastNotesCount} historical records and scheduled 2 meeting workflow actions.`;

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
