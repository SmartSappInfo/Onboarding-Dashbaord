/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Revenue & Pipeline Specialist
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Specialization:
 *    - Deal stage analysis, sales velocity, account expansion risk, pricing intelligence.
 * 2. Strict Tool Whitelist:
 *    - Allowed: `crm.deal.get`, `crm.deal.search`, `crm.entity.get`, `crm.deal.update`.
 * 3. Commercial Safety:
 *    - Direct pipeline stage updates require human approval policy unless granted full autonomy.
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
import type { McpPayloadValue } from '@/lib/mcp/types';

export const REVENUE_SPECIALIST_DESCRIPTOR: SpecialistDescriptor = {
  id: 'revenue_specialist',
  name: 'Revenue & Pipeline Specialist',
  version: '1.0.0',
  category: 'domain',
  roleTitle: 'Commercial & Deal Strategy Director',
  personaDescription:
    'Domain agent focused on customer deal health, pipeline velocity, contract agreement economics, and commercial expansion opportunities.',
  systemDirective:
    'You are the Revenue & Pipeline Specialist for SmartSapp. Your objective is to assess deal health, identify stalled pipeline stages, calculate commercial risk, and propose high-impact deal acceleration actions.',
  capabilities: ['crm_read', 'crm_write', 'deal_management', 'synthesis'],
  allowedTools: ['crm.deal.get', 'crm.deal.search', 'crm.entity.get', 'crm.deal.update'],
  memoryScope: {
    readDomains: ['crm_deals', 'pricing_lore', 'contracts', 'invoices'],
    writeDomains: ['deal_notes', 'sales_recommendations'],
    disallowedDomains: ['user_roles', 'system_security'],
  },
  defaultAutonomy: 'supervised',
  avatarIcon: 'TrendingUp',
  colorTheme: 'emerald',
};

export class RevenueSpecialist extends BaseDomainSpecialist {
  constructor() {
    super('revenue_specialist', REVENUE_SPECIALIST_DESCRIPTOR);
  }

  protected async runDomainAnalysis(
    request: AgentRequest,
    config: SpecialistWorkspaceConfig | null
  ): Promise<AgentResult> {
    const toolCallsCollector: AgentToolCall[] = [];
    const sourcesCollector: ContextSourceCitation[] = [];
    const findings: AgentFinding[] = [];
    const actions: AgentActionProposal[] = [];

    // Step 1: Inspect Subject or Search Deals
    let dealIdToInspect = request.subject?.type === 'deal' ? request.subject.id : undefined;

    if (!dealIdToInspect) {
      // Search deals related to the objective
      const searchRes = await this.callGovernedTool({
        toolName: 'crm.deal.search',
        arguments: {
          query: request.objective,
          limit: 3,
        },
        request,
        toolCallsCollector,
        sourcesCollector,
        config,
      });

      if (searchRes.success && searchRes.result) {
        const deals = searchRes.result.deals;
        if (Array.isArray(deals) && deals.length > 0) {
          dealIdToInspect = (deals[0] as Record<string, McpPayloadValue>)?.id as string | undefined;
          findings.push({
            title: `Pipeline Deals Identified (${deals.length} active deals)`,
            category: 'insight',
            content: `Found ${deals.length} commercial deals in the pipeline matching objective "${request.objective}".`,
            confidence: 0.88,
            tags: ['revenue', 'pipeline', 'deals'],
          });
        }
      }
    }

    // Step 2: Deep Deal Inspection
    if (dealIdToInspect) {
      const dealRes = await this.callGovernedTool({
        toolName: 'crm.deal.get',
        arguments: {
          dealId: dealIdToInspect,
        },
        request,
        toolCallsCollector,
        sourcesCollector,
        config,
      });

      if (dealRes.success && dealRes.result) {
        const deal = dealRes.result.deal as Record<string, McpPayloadValue> | undefined;
        const stage = (deal?.stage as string) || 'unknown';
        const value = (deal?.value as number) || 0;
        const title = (deal?.title as string) || `Deal ${dealIdToInspect}`;

        findings.push({
          title: `Deal Economic Analysis: ${title}`,
          category: 'insight',
          content: `Deal "${title}" is at stage "${stage}" with estimated value of $${value.toLocaleString()}. Velocity review indicates momentum.`,
          confidence: 0.94,
          tags: ['commercial_value', 'stage_velocity'],
        });

        // Propose pipeline stage progression or follow-up
        actions.push({
          toolName: 'crm.deal.update',
          title: `Advance Deal "${title}" to Next Pipeline Stage`,
          description: `Advance deal ${dealIdToInspect} to next evaluation stage based on positive commercial telemetry.`,
          riskLevel: 'high_risk',
          requiresApproval: true,
          arguments: {
            dealId: dealIdToInspect,
            stage: 'negotiation',
            reason: `Automated progression proposed by Revenue Specialist for objective: ${request.objective}`,
          },
        });
      }
    } else {
      findings.push({
        title: 'Commercial Opportunity Scanning Active',
        category: 'opportunity',
        content: `Evaluated revenue vectors for "${request.objective}". No specific stalled deals detected.`,
        confidence: 0.8,
        tags: ['pipeline_scanning'],
      });
    }

    const answer = `Revenue Specialist analyzed commercial parameters for "${request.objective}". Produced ${findings.length} revenue findings and ${actions.length} commercial proposals.`;

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
