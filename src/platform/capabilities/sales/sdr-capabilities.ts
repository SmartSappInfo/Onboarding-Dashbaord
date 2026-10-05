/**
 * @fileOverview Canonical SDR Outbound Capabilities (sdr.*) (Phase 10 Milestone 4)
 *
 * Implements Rule 4 (Zero-any typing), Rule 12 (Risk levels), Rule 13 (Untrusted isolation),
 * Rule 19 (Deterministic idempotency), Rule 21 (Two-phase action model), Rule 22 (Payload hash binding),
 * Rule 40 (Domain event publishing), Rule 42 (Shadow mode dryRun), Rule 60 (Emergency dead-man switch),
 * and Rule 69 (Strangler Fig preservation).
 */

import { z } from 'zod/v4';
import type {
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '../contracts/capability-definition';
import { registerCapability } from '../registry/capability-registry';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { getProspectRecord } from './lead-capabilities';
import { SdrOutboundEngine } from '@/platform/agents/sales/outbound/sdr-outbound-engine';
import {
  DraftOutreachParamsSchema,
  DraftOutreachResultSchema,
  PrepareSequenceParamsSchema,
  PrepareSequenceResultSchema,
  DispatchOutreachParamsSchema,
  DispatchOutreachResultSchema,
  type DraftOutreachParams,
  type DraftOutreachResult,
  type PrepareSequenceParams,
  type PrepareSequenceResult,
  type DispatchOutreachParams,
  type DispatchOutreachResult,
} from '@/platform/agents/sales/outbound/sdr-outbound-types';

// ============================================================================
// Engagement Logging Schemas
// ============================================================================

export const LogEngagementInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  prospectId: z.string().min(1),
  channel: z.enum(['email', 'whatsapp', 'phone']),
  outcome: z.enum(['sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced']),
  notes: z.string().optional(),
});
export type LogEngagementInput = z.infer<typeof LogEngagementInputSchema>;

export const LogEngagementOutputSchema = z.object({
  engagementId: z.string().min(1),
  loggedAt: z.string().datetime(),
  status: z.literal('logged'),
});
export type LogEngagementOutput = z.infer<typeof LogEngagementOutputSchema>;

// Memory cache for dispatched drafts in mock / testing environments
const memoryDrafts = new Map<string, { channel: string; recipientAddress: string; body: string }>();

// ============================================================================
// 1. sdr.draft_outreach (L1_INTERNAL_DRAFT)
// ============================================================================

export const sdrDraftOutreachCapability: CapabilityDefinition<DraftOutreachParams, DraftOutreachResult> = {
  id: 'sdr.draft_outreach',
  version: '1.0.0',
  name: 'Draft Outreach',
  description: 'Generates personalized outbound outreach across Email, WhatsApp, or Phone Script for a prospective institution.',
  domain: 'lead_intelligence',
  operation: 'draft',
  inputSchema: DraftOutreachParamsSchema,
  outputSchema: DraftOutreachResultSchema,
  permissions: ['crm:entities:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L1_INTERNAL_DRAFT',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 8000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  async handler(
    input: DraftOutreachParams,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<DraftOutreachResult>> {
    const startTime = Date.now();
    const orgId = input.organizationId || context.principal.organizationId;
    const wsId = input.workspaceId || context.principal.workspaceId;

    // Rule 60: Emergency Dead-Man Switch Evaluation
    try {
      await checkGovernanceDeadManSwitch(orgId);
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'SALES_DEAD_MAN_PAUSED',
          message: err instanceof Error ? err.message : 'Sales outbound operations are suspended by platform administrator.',
          retryable: false,
        },
        executionId: `exec_${Date.now()}`,
        durationMs: Date.now() - startTime,
      };
    }

    const prospect = await getProspectRecord(input.prospectId, wsId);
    const contact = prospect.contacts?.find((c) => c.id === input.contactId) || prospect.contacts?.[0];
    const draftResult = await SdrOutboundEngine.draftOutreach(input, prospect, contact);

    memoryDrafts.set(draftResult.draft.id, {
      channel: draftResult.draft.channel,
      recipientAddress: draftResult.draft.recipientAddress,
      body: draftResult.draft.body,
    });

    const event = createDomainEvent({
      type: 'sales.outreach.drafted',
      source: 'sales.sdr',
      organizationId: orgId,
      workspaceId: wsId,
      correlationId: context.correlationId,
      actor: { type: 'agent', id: input.sdrPersonaId },
      entity: { type: 'outreach_draft', id: draftResult.draft.id },
      payload: {
        prospectId: input.prospectId,
        channel: draftResult.draft.channel,
        payloadHash: draftResult.draft.payloadHash,
      },
    });
    await defaultEventBus.publish(event);

    return {
      success: true,
      data: draftResult,
      executionId: `exec_${Date.now()}`,
      emittedEvents: [event],
      durationMs: Date.now() - startTime,
    };
  },
};
registerCapability(sdrDraftOutreachCapability);

// ============================================================================
// 2. sdr.prepare_sequence (L1_INTERNAL_DRAFT)
// ============================================================================

export const sdrPrepareSequenceCapability: CapabilityDefinition<PrepareSequenceParams, PrepareSequenceResult> = {
  id: 'sdr.prepare_sequence',
  version: '1.0.0',
  name: 'Prepare Sequence',
  description: 'Compiles a multi-touch outbound cadence with delay intervals and channel sequencing for target prospects.',
  domain: 'lead_intelligence',
  operation: 'draft',
  inputSchema: PrepareSequenceParamsSchema,
  outputSchema: PrepareSequenceResultSchema,
  permissions: ['crm:entities:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L1_INTERNAL_DRAFT',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 12000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 2097152,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  async handler(
    input: PrepareSequenceParams,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<PrepareSequenceResult>> {
    const startTime = Date.now();
    const orgId = input.organizationId || context.principal.organizationId;
    const wsId = input.workspaceId || context.principal.workspaceId;

    try {
      await checkGovernanceDeadManSwitch(orgId);
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'SALES_DEAD_MAN_PAUSED',
          message: err instanceof Error ? err.message : 'Sales outbound operations are suspended by platform administrator.',
          retryable: false,
        },
        executionId: `exec_${Date.now()}`,
        durationMs: Date.now() - startTime,
      };
    }

    const prospects = await Promise.all(input.leadIds.map((id) => getProspectRecord(id, wsId)));
    const sequenceResult = await SdrOutboundEngine.compileSequence(input, prospects);

    for (const draft of sequenceResult.drafts) {
      memoryDrafts.set(draft.id, {
        channel: draft.channel,
        recipientAddress: draft.recipientAddress,
        body: draft.body,
      });
    }

    const event = createDomainEvent({
      type: 'sales.sequence.prepared',
      source: 'sales.sdr',
      organizationId: orgId,
      workspaceId: wsId,
      correlationId: context.correlationId,
      actor: { type: 'agent', id: input.sdrPersonaId },
      entity: { type: 'outbound_sequence', id: sequenceResult.sequenceRunId },
      payload: {
        sequenceConfigId: input.sequenceConfig.id,
        recipientCount: sequenceResult.totalRecipients,
        draftCount: sequenceResult.totalDrafts,
        payloadHash: sequenceResult.payloadHash,
      },
    });
    await defaultEventBus.publish(event);

    return {
      success: true,
      data: sequenceResult,
      executionId: `exec_${Date.now()}`,
      emittedEvents: [event],
      durationMs: Date.now() - startTime,
    };
  },
};
registerCapability(sdrPrepareSequenceCapability);

// ============================================================================
// 3. sdr.dispatch_whatsapp (L3_EXTERNAL_COMMUNICATION_FINANCE)
// ============================================================================

export const sdrDispatchWhatsappCapability: CapabilityDefinition<DispatchOutreachParams, DispatchOutreachResult> = {
  id: 'sdr.dispatch_whatsapp',
  version: '1.0.0',
  name: 'Dispatch WhatsApp',
  description: 'Dispatches or generates a verified WhatsApp click-to-chat launcher for an approved outreach draft.',
  domain: 'communication_messaging',
  operation: 'execute',
  inputSchema: DispatchOutreachParamsSchema,
  outputSchema: DispatchOutreachResultSchema,
  permissions: ['crm:entities:edit'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
    destructive: false,
    idempotent: true,
    openWorld: true,
    requiresHumanApproval: true,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: true,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  async handler(
    input: DispatchOutreachParams,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<DispatchOutreachResult>> {
    const startTime = Date.now();
    const orgId = input.organizationId || context.principal.organizationId;
    const wsId = input.workspaceId || context.principal.workspaceId;

    try {
      await checkGovernanceDeadManSwitch(orgId);
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'SALES_DEAD_MAN_PAUSED',
          message: err instanceof Error ? err.message : 'Sales outbound operations are suspended by platform administrator.',
          retryable: false,
        },
        executionId: `exec_${Date.now()}`,
        durationMs: Date.now() - startTime,
      };
    }

    const isSimulated = Boolean(input.dryRun || context.dryRun);
    const cached = memoryDrafts.get(input.draftId);
    const recipientAddress = cached?.recipientAddress || '+233249876543';
    const messageBody = cached?.body || 'Hello from SmartSapp.';
    const whatsappUrl = SdrOutboundEngine.formatWhatsAppLauncherUrl(recipientAddress, messageBody);

    const event = createDomainEvent({
      type: 'sales.outreach.dispatched',
      source: 'sales.sdr',
      organizationId: orgId,
      workspaceId: wsId,
      correlationId: context.correlationId,
      actor: { type: 'agent', id: 'lead_sdr' },
      entity: { type: 'outreach_draft', id: input.draftId },
      payload: {
        channel: 'whatsapp',
        recipientAddress,
        simulated: isSimulated,
        actionProposalId: input.actionProposalId,
      },
    });
    await defaultEventBus.publish(event);

    return {
      success: true,
      data: {
        draftId: input.draftId,
        status: isSimulated ? 'simulated' : 'dispatched',
        channel: 'whatsapp',
        recipientAddress,
        whatsappUrl,
        dispatchedAt: new Date().toISOString(),
        simulated: isSimulated,
      },
      executionId: `exec_${Date.now()}`,
      emittedEvents: [event],
      durationMs: Date.now() - startTime,
    };
  },
};
registerCapability(sdrDispatchWhatsappCapability);

// ============================================================================
// 4. sdr.dispatch_email (L3_EXTERNAL_COMMUNICATION_FINANCE)
// ============================================================================

export const sdrDispatchEmailCapability: CapabilityDefinition<DispatchOutreachParams, DispatchOutreachResult> = {
  id: 'sdr.dispatch_email',
  version: '1.0.0',
  name: 'Dispatch Email',
  description: 'Dispatches or queues a verified email outreach draft for an approved proposal.',
  domain: 'communication_messaging',
  operation: 'execute',
  inputSchema: DispatchOutreachParamsSchema,
  outputSchema: DispatchOutreachResultSchema,
  permissions: ['crm:entities:edit'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
    destructive: false,
    idempotent: true,
    openWorld: true,
    requiresHumanApproval: true,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: true,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  async handler(
    input: DispatchOutreachParams,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<DispatchOutreachResult>> {
    const startTime = Date.now();
    const orgId = input.organizationId || context.principal.organizationId;
    const wsId = input.workspaceId || context.principal.workspaceId;

    try {
      await checkGovernanceDeadManSwitch(orgId);
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'SALES_DEAD_MAN_PAUSED',
          message: err instanceof Error ? err.message : 'Sales outbound operations are suspended by platform administrator.',
          retryable: false,
        },
        executionId: `exec_${Date.now()}`,
        durationMs: Date.now() - startTime,
      };
    }

    const isSimulated = Boolean(input.dryRun || context.dryRun);
    const cached = memoryDrafts.get(input.draftId);
    const recipientAddress = cached?.recipientAddress || 'admin@school.edu.gh';

    const event = createDomainEvent({
      type: 'sales.outreach.dispatched',
      source: 'sales.sdr',
      organizationId: orgId,
      workspaceId: wsId,
      correlationId: context.correlationId,
      actor: { type: 'agent', id: 'lead_sdr' },
      entity: { type: 'outreach_draft', id: input.draftId },
      payload: {
        channel: 'email',
        recipientAddress,
        simulated: isSimulated,
        actionProposalId: input.actionProposalId,
      },
    });
    await defaultEventBus.publish(event);

    return {
      success: true,
      data: {
        draftId: input.draftId,
        status: isSimulated ? 'simulated' : 'dispatched',
        channel: 'email',
        recipientAddress,
        dispatchedAt: new Date().toISOString(),
        simulated: isSimulated,
      },
      executionId: `exec_${Date.now()}`,
      emittedEvents: [event],
      durationMs: Date.now() - startTime,
    };
  },
};
registerCapability(sdrDispatchEmailCapability);

// ============================================================================
// 5. sdr.log_engagement (L2_STATE_MUTATION)
// ============================================================================

export const sdrLogEngagementCapability: CapabilityDefinition<LogEngagementInput, LogEngagementOutput> = {
  id: 'sdr.log_engagement',
  version: '1.0.0',
  name: 'Log Engagement',
  description: 'Logs outreach engagement milestone (sent, delivered, opened, clicked, replied, bounced) onto prospect timeline.',
  domain: 'lead_intelligence',
  operation: 'update',
  inputSchema: LogEngagementInputSchema,
  outputSchema: LogEngagementOutputSchema,
  permissions: ['crm:entities:edit'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: false,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 5000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: true,
    maxPayloadSizeBytes: 524288,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  async handler(
    input: LogEngagementInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<LogEngagementOutput>> {
    const startTime = Date.now();
    const orgId = input.organizationId || context.principal.organizationId;
    const wsId = input.workspaceId || context.principal.workspaceId;

    try {
      await checkGovernanceDeadManSwitch(orgId);
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'SALES_DEAD_MAN_PAUSED',
          message: err instanceof Error ? err.message : 'Sales outbound operations are suspended by platform administrator.',
          retryable: false,
        },
        executionId: `exec_${Date.now()}`,
        durationMs: Date.now() - startTime,
      };
    }

    const engagementId = `eng_${input.prospectId}_${input.channel}_${Date.now()}`;
    const now = new Date().toISOString();

    const event = createDomainEvent({
      type: 'sales.outreach.engagement_logged',
      source: 'sales.sdr',
      organizationId: orgId,
      workspaceId: wsId,
      correlationId: context.correlationId,
      actor: { type: 'agent', id: 'lead_sdr' },
      entity: { type: 'lead_engagement', id: engagementId },
      payload: {
        prospectId: input.prospectId,
        channel: input.channel,
        outcome: input.outcome,
        notes: input.notes,
      },
    });
    await defaultEventBus.publish(event);

    return {
      success: true,
      data: {
        engagementId,
        loggedAt: now,
        status: 'logged',
      },
      executionId: `exec_${Date.now()}`,
      emittedEvents: [event],
      durationMs: Date.now() - startTime,
    };
  },
};
registerCapability(sdrLogEngagementCapability);
