/**
 * @fileOverview Canonical SDR Outbound Contracts, Schemas & Error Taxonomy (Phase 10 Milestone 4)
 *
 * Implements Rule 4 (Zero-any typing), Rule 10 (Maintainer guidance), Rule 12 (Risk levels),
 * Rule 19 (Deterministic idempotency), Rule 21 (Two-phase action model), Rule 22 (Payload hash binding),
 * Rule 48 (Sanitized error taxonomy), and Rule 60 (Emergency dead-man switch).
 */

import { z } from 'zod/v4';

// ============================================================================
// 1. Outreach Channels & Status Lifecycle
// ============================================================================

export const OutreachChannelSchema = z.enum(['email', 'whatsapp', 'phone_script']);
export type OutreachChannel = z.infer<typeof OutreachChannelSchema>;

export const OutreachStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'dispatched',
  'failed',
]);
export type OutreachStatus = z.infer<typeof OutreachStatusSchema>;

// ============================================================================
// 2. Message Draft Schemas
// ============================================================================

export const OutreachMessageDraftSchema = z.object({
  id: z.string().min(1),
  prospectId: z.string().min(1),
  contactId: z.string().optional(),
  channel: OutreachChannelSchema,
  recipientName: z.string().min(1),
  recipientAddress: z.string().min(1), // email address or phone number
  subject: z.string().optional(),
  body: z.string().min(1),
  whatsappUrl: z.string().optional(),
  mailtoUrl: z.string().optional(),
  variablesUsed: z.array(z.string()).default([]),
  groundingPoints: z.array(z.string()).default([]),
  status: OutreachStatusSchema.default('draft'),
  actionProposalId: z.string().optional(),
  payloadHash: z.string().min(1),
  stepIndex: z.number().int().optional(),
  dayOffset: z.number().int().optional(),
  explainability: z
    .object({
      what: z.string(),
      why: z.string(),
      expectedStateChange: z.string(),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OutreachMessageDraft = z.infer<typeof OutreachMessageDraftSchema>;

export const DraftOutreachParamsSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  prospectId: z.string().min(1),
  contactId: z.string().optional(),
  channel: OutreachChannelSchema,
  templateText: z.string().optional(),
  customInstructions: z.string().optional(),
  sdrPersonaId: z.string().default('lead_sdr'),
});
export type DraftOutreachParams = z.infer<typeof DraftOutreachParamsSchema>;

export const DraftOutreachResultSchema = z.object({
  draft: OutreachMessageDraftSchema,
  explainability: z.object({
    what: z.string().min(1),
    why: z.string().min(1),
    expectedStateChange: z.string().min(1),
  }),
});
export type DraftOutreachResult = z.infer<typeof DraftOutreachResultSchema>;

// ============================================================================
// 3. Multi-Touch Cadence & Sequence Schemas
// ============================================================================

export const OutboundSequenceStepSchema = z.object({
  stepIndex: z.number().int().min(1),
  dayOffset: z.number().int().min(0),
  channel: OutreachChannelSchema,
  name: z.string().min(1),
  condition: z.enum(['always', 'no_reply', 'opened_no_reply']).default('always'),
  templateText: z.string().optional(),
});
export type OutboundSequenceStep = z.infer<typeof OutboundSequenceStepSchema>;

export const OutboundSequenceConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  steps: z.array(OutboundSequenceStepSchema).min(1).max(5),
  dailySendingLimit: z.number().int().min(1).max(200).default(50),
});
export type OutboundSequenceConfig = z.infer<typeof OutboundSequenceConfigSchema>;

export const PrepareSequenceParamsSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  leadIds: z.array(z.string().min(1)).min(1).max(50),
  sequenceConfig: OutboundSequenceConfigSchema,
  sdrPersonaId: z.string().default('lead_sdr'),
});
export type PrepareSequenceParams = z.infer<typeof PrepareSequenceParamsSchema>;

export const PrepareSequenceResultSchema = z.object({
  sequenceRunId: z.string().min(1),
  totalRecipients: z.number().int().min(0),
  totalDrafts: z.number().int().min(0),
  drafts: z.array(OutreachMessageDraftSchema),
  payloadHash: z.string().min(1),
  status: z.enum(['staged', 'pending_approval']),
});
export type PrepareSequenceResult = z.infer<typeof PrepareSequenceResultSchema>;

// ============================================================================
// 4. Dispatch & Execution Schemas
// ============================================================================

export const DispatchOutreachParamsSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  draftId: z.string().min(1),
  actionProposalId: z.string().min(1),
  payloadHash: z.string().min(1),
  dryRun: z.boolean().default(false),
});
export type DispatchOutreachParams = z.infer<typeof DispatchOutreachParamsSchema>;

export const DispatchOutreachResultSchema = z.object({
  draftId: z.string().min(1),
  status: z.enum(['dispatched', 'simulated', 'failed']),
  channel: OutreachChannelSchema,
  recipientAddress: z.string().min(1),
  whatsappUrl: z.string().optional(),
  dispatchedAt: z.string().datetime(),
  simulated: z.boolean(),
});
export type DispatchOutreachResult = z.infer<typeof DispatchOutreachResultSchema>;

export const OutreachApprovalBindingSchema = z.object({
  proposalId: z.string().min(1),
  sequenceRunId: z.string().optional(),
  channel: OutreachChannelSchema,
  recipients: z.array(z.string()).min(1),
  templateId: z.string().optional(),
  payloadHash: z.string().min(1),
});
export type OutreachApprovalBinding = z.infer<typeof OutreachApprovalBindingSchema>;

// ============================================================================
// 5. Error Taxonomy & Typed SdrOutboundError Class
// ============================================================================

export const SDR_OUTBOUND_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  SALES_DEAD_MAN_PAUSED: 'SALES_DEAD_MAN_PAUSED',
  PAYLOAD_TAMPERED: 'PAYLOAD_TAMPERED',
  SELF_APPROVAL_FORBIDDEN: 'SELF_APPROVAL_FORBIDDEN',
  INVALID_CHANNEL: 'INVALID_CHANNEL',
  RECIPIENT_MISSING: 'RECIPIENT_MISSING',
  RATE_LIMITED: 'RATE_LIMITED',
  DELIVERABILITY_SUPPRESSED: 'DELIVERABILITY_SUPPRESSED',
  PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
  PROPOSAL_NOT_APPROVED: 'PROPOSAL_NOT_APPROVED',
  DRAFT_NOT_FOUND: 'DRAFT_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type SdrOutboundErrorCode = keyof typeof SDR_OUTBOUND_ERROR_CODES;

export class SdrOutboundError extends Error {
  public readonly code: SdrOutboundErrorCode;
  public readonly statusCode: number;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    code: SdrOutboundErrorCode = 'INTERNAL_ERROR',
    statusCode: number = 500,
    metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SdrOutboundError';
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
    Object.setPrototypeOf(this, SdrOutboundError.prototype);
  }
}
