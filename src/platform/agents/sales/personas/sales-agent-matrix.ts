/**
 * @fileOverview Sales Agent Permission, Tool, Failure, and Rollback Matrices (Phase 10 Milestone 2)
 *
 * Implements Rules 1, 2, 4, 8, 12, 14, 16, 17, 27, 48, 59, 67, 68, and 69.
 * Single Source of Truth for the 4 Mandatory Governance Matrices of the Sales Domain Workforce:
 *
 * 1. PERMISSION MATRIX (`SALES_PERMISSION_MATRIX`): Strict RBAC scope mapping per persona (zero wildcards).
 * 2. TOOL MATRIX (`SALES_TOOL_MATRIX`): Explicit capability inventory and risk level ceilings per persona.
 * 3. FAILURE MATRIX (`SALES_FAILURE_MATRIX`): Deterministic strategies for missing, stale, or timeout failures.
 * 4. ROLLBACK MATRIX (`SALES_ROLLBACK_MATRIX`): Reverse-LIFO Saga compensation mapping for mutating tools.
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded Zod v4 schemas only.
 */

import { z } from 'zod/v4';
import {
  type SalesPersonaId,
  SALES_PERSONA_IDS,
} from './sales-persona-types';

/**
 * Zod Schema for Tool Matrix Entry.
 */
export const SalesToolMatrixEntrySchema = z.object({
  capabilityId: z.string().min(1),
  domain: z.string().min(1),
  riskLevel: z.enum([
    'L0_READ',
    'L1_INTERNAL_DRAFT',
    'L2_STATE_MUTATION',
    'L3_EXTERNAL_COMMUNICATION_FINANCE',
    'L4_PRIVILEGED_DESTRUCTIVE',
  ]),
  description: z.string().min(1),
  allowedPersonas: z.array(z.enum(SALES_PERSONA_IDS)),
  compensatingCapabilityId: z.string().optional(),
});

export type SalesToolMatrixEntry = z.infer<typeof SalesToolMatrixEntrySchema>;

/**
 * Zod Schema for Failure Matrix Entry.
 */
export const SalesFailureMatrixEntrySchema = z.object({
  failureCode: z.string().min(1),
  strategy: z.enum([
    'FAIL_CLOSED',
    'RE_FETCH_AND_VERIFY',
    'FALLBACK_TO_STATIC',
    'DEGRADE_GRACEFULLY',
    'ROUTE_TO_PROPOSAL',
    'CIRCUIT_BREAKER_BACKOFF',
  ]),
  fallbackCode: z.string().min(1),
  description: z.string().min(1),
  retryable: z.boolean(),
  requiresIntervention: z.boolean(),
});

export type SalesFailureMatrixEntry = z.infer<typeof SalesFailureMatrixEntrySchema>;

/**
 * Zod Schema for Rollback Matrix Entry (Rule 27).
 */
export const SalesRollbackMatrixEntrySchema = z.object({
  mutatingCapabilityId: z.string().min(1),
  compensatingCapabilityId: z.string().min(1),
  strategy: z.literal('REVERSE_LIFO'),
  description: z.string().min(1),
});

export type SalesRollbackMatrixEntry = z.infer<typeof SalesRollbackMatrixEntrySchema>;

/**
 * 1. PERMISSION MATRIX
 * Maps each sales persona to explicit, non-wildcard RBAC permission scopes (Rule 16).
 */
export const SALES_PERMISSION_MATRIX: Readonly<Record<SalesPersonaId, readonly string[]>> = {
  lead_sdr: [
    'rbac:operations.campuses.view',
    'rbac:operations.campuses.create',
    'rbac:operations.campuses.edit',
    'rbac:operations.pipeline.view',
    'rbac:social.campaigns.view',
    'workspace:read',
    'crm:leads:search',
    'crm:leads:score',
    'crm:leads:enrich',
    'sdr:outreach:draft',
    'sdr:outreach:propose',
  ],

  prospecting_agent: [
    'rbac:operations.campuses.view',
    'workspace:read',
    'crm:leads:search',
    'crm:entities:read',
  ],

  enrichment_agent: [
    'rbac:operations.campuses.view',
    'rbac:operations.campuses.edit',
    'workspace:read',
    'crm:leads:enrich',
    'crm:entities:read',
    'crm:entities:edit',
  ],

  qualification_agent: [
    'rbac:operations.campuses.view',
    'workspace:read',
    'crm:leads:score',
    'crm:entities:read',
  ],

  sales_coach: [
    'rbac:operations.campuses.view',
    'workspace:read',
    'crm:leads:pitch',
    'crm:leads:objections',
    'sdr:outreach:draft',
  ],
};

/**
 * 2. TOOL MATRIX
 * Maps all 15 canonical sales & SDR capabilities with risk levels and allowed personas.
 */
export const SALES_TOOL_MATRIX: readonly SalesToolMatrixEntry[] = [
  {
    capabilityId: 'lead.search',
    domain: 'lead_intelligence',
    riskLevel: 'L0_READ',
    description: 'Searches prospect candidates across location, industry, and revenue criteria.',
    allowedPersonas: ['lead_sdr', 'prospecting_agent'],
  },
  {
    capabilityId: 'lead.score',
    domain: 'lead_intelligence',
    riskLevel: 'L0_READ',
    description: 'Calculates explainable ICP fit and intent scores with positive/negative drivers.',
    allowedPersonas: ['lead_sdr', 'qualification_agent'],
  },
  {
    capabilityId: 'lead.enrich',
    domain: 'lead_intelligence',
    riskLevel: 'L1_INTERNAL_DRAFT',
    description: 'Enriches prospect with firmographic, technographic, and contact intelligence.',
    allowedPersonas: ['lead_sdr', 'enrichment_agent'],
    compensatingCapabilityId: 'lead.revert_enrichment',
  },
  {
    capabilityId: 'lead.get_intelligence',
    domain: 'lead_intelligence',
    riskLevel: 'L0_READ',
    description: 'Retrieves comprehensive intelligence dossier for a prospect or account.',
    allowedPersonas: ['lead_sdr', 'prospecting_agent', 'enrichment_agent', 'qualification_agent', 'sales_coach'],
  },
  {
    capabilityId: 'lead.get_decision_makers',
    domain: 'lead_intelligence',
    riskLevel: 'L0_READ',
    description: 'Extracts identified key decision makers and leadership contacts with verified emails.',
    allowedPersonas: ['lead_sdr', 'enrichment_agent'],
  },
  {
    capabilityId: 'lead.get_buying_signals',
    domain: 'lead_intelligence',
    riskLevel: 'L0_READ',
    description: 'Surfaces recent hiring, funding, technographic, and organizational buying signals.',
    allowedPersonas: ['lead_sdr', 'qualification_agent', 'sales_coach'],
  },
  {
    capabilityId: 'lead.get_recommended_pitch',
    domain: 'lead_intelligence',
    riskLevel: 'L1_INTERNAL_DRAFT',
    description: 'Generates tailored pitch recommendations based on technographics and industry pain points.',
    allowedPersonas: ['lead_sdr', 'sales_coach'],
  },
  {
    capabilityId: 'lead.get_objection_handlers',
    domain: 'lead_intelligence',
    riskLevel: 'L1_INTERNAL_DRAFT',
    description: 'Provides objection handling playbooks for competitor and budget objections.',
    allowedPersonas: ['lead_sdr', 'sales_coach'],
  },
  {
    capabilityId: 'sdr.get_daily_briefing',
    domain: 'lead_intelligence',
    riskLevel: 'L0_READ',
    description: 'Synthesizes daily SDR priorities, high-intent leads, and pending approvals.',
    allowedPersonas: ['lead_sdr'],
  },
  {
    capabilityId: 'sdr.get_priority_queue',
    domain: 'lead_intelligence',
    riskLevel: 'L0_READ',
    description: 'Returns prioritized queue of scored leads awaiting outbound engagement.',
    allowedPersonas: ['lead_sdr'],
  },
  {
    capabilityId: 'sdr.generate_outreach_draft',
    domain: 'communication_messaging',
    riskLevel: 'L1_INTERNAL_DRAFT',
    description: 'Drafts personalized email or LinkedIn outreach messages for human review.',
    allowedPersonas: ['lead_sdr', 'sales_coach'],
    compensatingCapabilityId: 'sdr.delete_draft',
  },
  {
    capabilityId: 'sdr.create_whatsapp_link',
    domain: 'communication_messaging',
    riskLevel: 'L1_INTERNAL_DRAFT',
    description: 'Constructs validated WhatsApp click-to-chat URL with prefilled pitch.',
    allowedPersonas: ['lead_sdr', 'sales_coach'],
  },
  {
    capabilityId: 'sdr.request_outreach_approval',
    domain: 'communication_messaging',
    riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
    description: 'Submits outbound communication proposal to Unified Approval Center (Rule 21 & 22).',
    allowedPersonas: ['lead_sdr'],
    compensatingCapabilityId: 'sdr.cancel_approval_proposal',
  },
  {
    capabilityId: 'sdr.record_outreach_outcome',
    domain: 'lead_intelligence',
    riskLevel: 'L2_STATE_MUTATION',
    description: 'Records engagement results (opened, replied, meeting_booked, bounced) on prospect.',
    allowedPersonas: ['lead_sdr'],
    compensatingCapabilityId: 'sdr.revert_outreach_outcome',
  },
  {
    capabilityId: 'sdr.get_conversion_insights',
    domain: 'lead_intelligence',
    riskLevel: 'L0_READ',
    description: 'Analyzes outreach conversion metrics across industry, channel, and rep segments.',
    allowedPersonas: ['lead_sdr', 'sales_coach'],
  },
];

/**
 * 3. FAILURE MATRIX
 * Maps 12 distinct failure codes to deterministic recovery strategies (Rule 2 & 48).
 */
export const SALES_FAILURE_MATRIX: readonly SalesFailureMatrixEntry[] = [
  {
    failureCode: 'LEAD_NOT_FOUND',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'ERR_SALES_404_LEAD_NOT_FOUND',
    description: 'Target lead or prospect does not exist in the specified workspace.',
    retryable: false,
    requiresIntervention: false,
  },
  {
    failureCode: 'RATE_LIMITED',
    strategy: 'CIRCUIT_BREAKER_BACKOFF',
    fallbackCode: 'ERR_SALES_429_RATE_LIMITED',
    description: 'Enrichment provider or search API rate limit exceeded. Back off with jitter.',
    retryable: true,
    requiresIntervention: false,
  },
  {
    failureCode: 'PROMPT_INJECTION_DETECTED',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'ERR_SALES_400_PROMPT_INJECTION',
    description: 'Adversarial instruction detected in scraped meta tags or input text (Rule 30).',
    retryable: false,
    requiresIntervention: true,
  },
  {
    failureCode: 'DEAD_MAN_SWITCH_ENGAGED',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'ERR_SALES_503_DEAD_MAN_PAUSED',
    description: 'Emergency governance dead-man pause active. Abort execution immediately (Rule 60).',
    retryable: true,
    requiresIntervention: true,
  },
  {
    failureCode: 'IDOR_VIOLATION',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'ERR_SALES_403_IDOR_VIOLATION',
    description: 'Attempted to access or mutate lead outside authenticated tenant boundary (Rule 8).',
    retryable: false,
    requiresIntervention: true,
  },
  {
    failureCode: 'DNS_MX_UNRESOLVED',
    strategy: 'DEGRADE_GRACEFULLY',
    fallbackCode: 'WARN_SALES_MX_RECORD_MISSING',
    description: 'Domain MX records cannot be resolved. Mark email status as unverified.',
    retryable: false,
    requiresIntervention: false,
  },
  {
    failureCode: 'SSRF_DISALLOWED',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'ERR_SALES_400_SSRF_BLOCKED',
    description: 'Target website resolved to private subnet, loopback, or metadata address (Rule 34).',
    retryable: false,
    requiresIntervention: true,
  },
  {
    failureCode: 'DISPOSABLE_EMAIL',
    strategy: 'DEGRADE_GRACEFULLY',
    fallbackCode: 'WARN_SALES_DISPOSABLE_DOMAIN',
    description: 'Contact email belongs to disposable domain. Downgrade lead confidence score.',
    retryable: false,
    requiresIntervention: false,
  },
  {
    failureCode: 'MODEL_HALLUCINATION',
    strategy: 'FALLBACK_TO_STATIC',
    fallbackCode: 'ERR_SALES_PARSE_FAILED_FALLBACK',
    description: 'Model output failed Zod schema parsing. Fallback to heuristic rules (Rule 47).',
    retryable: true,
    requiresIntervention: false,
  },
  {
    failureCode: 'STALE_APPROVAL_PROPOSAL',
    strategy: 'ROUTE_TO_PROPOSAL',
    fallbackCode: 'ERR_SALES_PROPOSAL_EXPIRED',
    description: 'Outbound proposal exceeded 24-hour expiration window. Re-synthesize and re-propose.',
    retryable: true,
    requiresIntervention: true,
  },
  {
    failureCode: 'TOCTOU_CONCURRENCY_CONFLICT',
    strategy: 'RE_FETCH_AND_VERIFY',
    fallbackCode: 'ERR_SALES_TOCTOU_VERSION_MISMATCH',
    description: 'Lead was modified concurrently. Re-fetch current state and retry (Rule 18).',
    retryable: true,
    requiresIntervention: false,
  },
  {
    failureCode: 'BUDGET_EXCEEDED',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'ERR_SALES_BUDGET_EXCEEDED',
    description: 'Execution exceeded token, duration, or tool-call budget limits (Rule 23).',
    retryable: false,
    requiresIntervention: true,
  },
];

/**
 * 4. ROLLBACK MATRIX
 * Maps mutating sales capabilities to reverse-LIFO Saga compensating reversions (Rule 27).
 */
export const SALES_ROLLBACK_MATRIX: readonly SalesRollbackMatrixEntry[] = [
  {
    mutatingCapabilityId: 'lead.enrich',
    compensatingCapabilityId: 'lead.revert_enrichment',
    strategy: 'REVERSE_LIFO',
    description: 'Restores previous firmographic and contact state prior to enrichment.',
  },
  {
    mutatingCapabilityId: 'sdr.generate_outreach_draft',
    compensatingCapabilityId: 'sdr.delete_draft',
    strategy: 'REVERSE_LIFO',
    description: 'Deletes draft outreach message and clears proposal reference.',
  },
  {
    mutatingCapabilityId: 'sdr.request_outreach_approval',
    compensatingCapabilityId: 'sdr.cancel_approval_proposal',
    strategy: 'REVERSE_LIFO',
    description: 'Cancels pending proposal in Unified Approval Center.',
  },
  {
    mutatingCapabilityId: 'sdr.record_outreach_outcome',
    compensatingCapabilityId: 'sdr.revert_outreach_outcome',
    strategy: 'REVERSE_LIFO',
    description: 'Reverts lead status and activity log back to pre-outcome state.',
  },
];
