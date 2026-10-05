/**
 * @fileOverview Canonical Definitions for Specialized Sales Agent Personas (Phase 10 Milestone 2)
 *
 * Implements Rules 4, 10, 12, 16, 17, 23, 67, 68, and 69.
 * Single Source of Truth for the 5 Specialized Sales Agent Personas:
 * 1. `lead_sdr` - Outbound Sales Development Representative (L2_STATE_MUTATION)
 * 2. `prospecting_agent` - Account & Lead Discovery Specialist (L0_READ)
 * 3. `enrichment_agent` - Multi-Provider Waterfall Specialist (L1_INTERNAL_DRAFT)
 * 4. `qualification_agent` - Lead Scoring & ICP Qualification Analyst (L0_READ)
 * 5. `sales_coach` - Objections & Value Proposition Coach (L1_INTERNAL_DRAFT)
 *
 * ARCHITECTURAL INVARIANTS:
 * - Rule 12: Enforces immutable persona risk level ceilings.
 * - Rule 16: Zero wildcard permissions (`*`). Every allowed permission is explicitly qualified.
 * - Rule 17: Non-delegable destructive actions (e.g. unsolicited bulk sending without approval) are strictly excluded.
 * - Rule 23: Deterministic resource budgets for duration, tokens, tool calls, and records mutated.
 * - Rule 69: Preserves the dual-tier CRM model. All state mutations target `/workspace_entities`.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  type SalesPersonaId,
  type SalesPersonaDefinition,
  SALES_PERSONA_IDS,
  isSalesPersonaId,
} from './sales-persona-types';

export {
  type SalesPersonaId,
  type SalesPersonaDefinition,
  SALES_PERSONA_IDS,
  isSalesPersonaId,
};

/**
 * Canonical definitions for the 5 specialized sales agent personas.
 */
export const SALES_PERSONA_DEFINITIONS: Readonly<Record<SalesPersonaId, SalesPersonaDefinition>> = {
  lead_sdr: {
    id: 'lead_sdr',
    name: 'Autonomous Lead SDR Agent',
    version: '1.0.0',
    role: 'Lead Discovery & Outreach Specialist',
    description:
      'Discovers, enriches, technographically profiles, scores, and prepares personalized outreach for prospective leads. Outbound sends require human approval.',
    icon: 'Target',
    allowedDomains: ['lead_intelligence', 'crm_contacts', 'communication_messaging'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'rbac:operations.campuses.create',
      'rbac:operations.campuses.edit',
      'rbac:operations.pipeline.view',
      'rbac:social.campaigns.view',
      'workspace:read',
      'crm:leads:search',
      'crm:leads:score',
      'sdr:outreach:draft',
    ],
    maxAutonomousRiskLevel: 'L2_STATE_MUTATION',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 25,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet:
      'You are the SmartSapp Autonomous Lead SDR Agent. You qualify prospects, enrich company intelligence, update contact tags, and draft personalized outreach. All outbound message dispatching requires human approval.',
  },

  prospecting_agent: {
    id: 'prospecting_agent',
    name: 'Account & Lead Discovery Specialist',
    version: '1.0.0',
    role: 'Market & Account Prospecting Analyst',
    description:
      'Identifies high-fit target accounts, executes Boolean and technographic queries, and structures clean lead candidate lists. Strictly read-only.',
    icon: 'Search',
    allowedDomains: ['lead_intelligence', 'crm_contacts'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'workspace:read',
      'crm:leads:search',
      'crm:entities:read',
    ],
    maxAutonomousRiskLevel: 'L0_READ',
    budgets: {
      maxDurationMs: 60000,
      maxTokens: 30000,
      maxToolCalls: 10,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet:
      'You are the SmartSapp Prospecting Agent. You discover high-fit accounts across industry sectors, locations, and revenue tiers. You never mutate records.',
  },

  enrichment_agent: {
    id: 'enrichment_agent',
    name: 'Multi-Provider Waterfall Enrichment Specialist',
    version: '1.0.0',
    role: 'Company & Contact Enrichment Specialist',
    description:
      'Executes multi-provider waterfall enrichment (Clearbit -> Apollo -> Hunter -> BuiltWith), verifies email deliverability, and populates technographic attributes into workspace entities.',
    icon: 'Layers',
    allowedDomains: ['lead_intelligence', 'crm_contacts'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'rbac:operations.campuses.edit',
      'workspace:read',
      'crm:leads:enrich',
      'crm:entities:read',
      'crm:entities:edit',
    ],
    maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 40000,
      maxToolCalls: 15,
      maxRecordsMutated: 15,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet:
      'You are the SmartSapp Enrichment Agent. You synthesize company dossiers, verify MX records and contact details, and enrich workspace CRM records via waterfall providers.',
  },

  qualification_agent: {
    id: 'qualification_agent',
    name: 'Lead Scoring & ICP Qualification Analyst',
    version: '1.0.0',
    role: 'Predictive Lead Qualification Analyst',
    description:
      'Evaluates leads against Ideal Customer Profile (ICP) criteria, calculates explainable fit and intent scores, and detects active buying signals. Strictly read-only.',
    icon: 'CheckCircle2',
    allowedDomains: ['lead_intelligence', 'crm_contacts', 'knowledge_memory'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'workspace:read',
      'crm:leads:score',
      'crm:entities:read',
    ],
    maxAutonomousRiskLevel: 'L0_READ',
    budgets: {
      maxDurationMs: 60000,
      maxTokens: 30000,
      maxToolCalls: 10,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet:
      'You are the SmartSapp Qualification Agent. You analyze ICP fit, surface positive and negative score drivers, and rank prospects without altering underlying data.',
  },

  sales_coach: {
    id: 'sales_coach',
    name: 'Objections & Value Proposition Coach',
    version: '1.0.0',
    role: 'Sales Enablement & Pitch Strategist',
    description:
      'Formulates tailored pitch narratives, analyzes competitor positioning, provides counter-objection scripts, and suggests optimal communication channels.',
    icon: 'HelpCircle',
    allowedDomains: ['lead_intelligence', 'knowledge_memory', 'communication_messaging'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'workspace:read',
      'crm:leads:pitch',
      'crm:leads:objections',
      'sdr:outreach:draft',
    ],
    maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
    budgets: {
      maxDurationMs: 90000,
      maxTokens: 40000,
      maxToolCalls: 10,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet:
      'You are the SmartSapp Sales Coach Agent. You synthesize strategic pitch talking points, craft contextual objection handlers, and elevate rep productivity.',
  },
};
