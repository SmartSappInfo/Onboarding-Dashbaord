/**
 * @fileoverview Unit Tests: transferDealCore (Canonical Engine)
 *
 * Verifies core transfer engine under diverse actor models (Rule 16 & Rule 69):
 * - Service actor (automations engine)
 * - Agent actor (governed MCP execution)
 * - TOCTOU optimistic concurrency conflict detection (Rule 18)
 * - Idempotency replay protection (Rule 19 & 20)
 * - Cross-organization tenant boundary enforcement (Rule 8)
 *
 * Compliance: agents_mcp_rules.md, theme.md, .agents/AGENTS.md.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transferDealCore } from '../deal-transfer-core';
import type { TransferDealInput, Deal } from '@/lib/types';
import type { CrmActor } from '@/lib/crm/deal-core';

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock activity logger
vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue({ id: 'act_123' }),
}));

// Mock deal event bus
const { mockEmitDealDomainEvent } = vi.hoisted(() => ({
  mockEmitDealDomainEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/deals/deal-event-bus', () => ({
  emitDealDomainEvent: mockEmitDealDomainEvent,
}));

// Mock platform event bus
vi.mock('@/platform/events/event-bus', () => ({
  defaultEventBus: {
    publish: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock deal-core helpers
const mockSourceDeal: Deal = {
  id: 'deal_core_test_1',
  name: 'Enterprise Cloud Deal',
  workspaceId: 'ws_source',
  organizationId: 'org_main',
  entityId: 'ent_1',
  pipelineId: 'pipe_source',
  stageId: 'stage_source_1',
  stageName: 'Discovery',
  value: 75000,
  currency: 'USD',
  status: 'open',
  probability: 40,
  assignedTo: {
    userId: 'user_sales_1',
    name: 'John Connor',
    email: 'john@example.com',
  },
  stageEnteredAt: '2026-10-01T10:00:00.000Z',
  stageHistory: [
    {
      stageId: 'stage_source_1',
      stageName: 'Discovery',
      enteredAt: '2026-10-01T10:00:00.000Z',
      exitedAt: null,
      durationSeconds: null,
      changedByUserId: 'user_orig',
      notes: 'Initial creation',
    },
  ],
  focalContacts: [
    {
      id: 'focal_contact_sarah_1',
      name: 'Sarah Connor',
      email: 'sarah@example.com',
      phone: '+15551234567',
      role: 'Chief Technology Officer',
      isPrimary: true,
    },
  ],
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

const mockUpdateFn = vi.fn().mockResolvedValue(undefined);
let targetOrgId = 'org_main';
let idempotencyFound = false;
let targetWorkspaceScope = 'institution';
let sourceEntityScope = 'institution';
let pipelineCrossScopeApprovalRequired = false;
let pipelineDisableAutonomousTransfers = false;
const deletedDocIds: string[] = [];
let nextCreatedEntityId = 'ent_person_new_123';

vi.mock('@/lib/crm/deal-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crm/deal-core')>();
  return {
    ...actual,
    loadAuthorizedDeal: vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        deal: { ...mockSourceDeal },
        ref: { update: mockUpdateFn },
      };
    }),
    checkDealPlacement: vi.fn().mockResolvedValue({ granted: true }),
    workspaceOrganizationId: vi.fn().mockImplementation(async () => targetOrgId),
    resolveWorkspaceEntityRecord: vi.fn().mockResolvedValue({ id: 'we_existing' }),
  };
});

// Mock Firestore
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockImplementation((col: string) => {
      if (col === 'deal_transfers_idempotency') {
        return {
          doc: vi.fn().mockImplementation((docId: string) => ({
            get: vi.fn().mockResolvedValue({
              exists: idempotencyFound,
              data: () => ({ dealId: 'deal_cached_idempotent_123' }),
            }),
            set: vi.fn().mockResolvedValue(undefined),
          })),
        };
      }
      if (col === 'workspaces') {
        return {
          doc: vi.fn().mockImplementation((wsId: string) => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ contactScope: wsId === 'ws_dest_person' ? 'person' : targetWorkspaceScope }),
            }),
          })),
        };
      }
      if (col === 'entities') {
        return {
          doc: vi.fn().mockImplementation((entId?: string) => {
            const actualId = entId || nextCreatedEntityId;
            return {
              id: actualId,
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ entityType: sourceEntityScope, name: 'Acme Global Corp' }),
              }),
              set: vi.fn().mockResolvedValue(undefined),
              delete: vi.fn().mockImplementation(async () => {
                deletedDocIds.push(actualId);
              }),
            };
          }),
        };
      }
      if (col === 'workspace_entities') {
        return {
          doc: vi.fn().mockImplementation((weId: string) => ({
            id: weId,
            get: vi.fn().mockResolvedValue({ exists: false }),
            set: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockImplementation(async () => {
              deletedDocIds.push(weId);
            }),
          })),
        };
      }
      if (col === 'onboardingStages') {
        return {
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                name: 'Negotiation',
                defaultProbability: 70,
                terminalType: 'open',
              }),
            }),
          }),
        };
      }
      if (col === 'pipelines') {
        return {
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                name: 'Enterprise Pipeline',
                targetCloseDays: 30,
                entityScopeConversionPolicy: {
                  requireApprovalForCrossScope: pipelineCrossScopeApprovalRequired,
                  disableAutonomousTransfers: pipelineDisableAutonomousTransfers,
                  institutionToPersonStrategy: 'promote_primary_focal_contact',
                  personToInstitutionStrategy: 'derive_from_company_field',
                  toFamilyStrategy: 'promote_primary_as_guardian',
                },
              }),
            }),
          }),
        };
      }
      if (col === 'deals') {
        return {
          add: vi.fn().mockResolvedValue({ id: 'deal_new_copy_456' }),
        };
      }
      return {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
        }),
      };
    }),
  },
}));

describe('transferDealCore (Canonical Engine)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    targetOrgId = 'org_main';
    idempotencyFound = false;
  });

  it('successfully moves deal with a service actor (Automations engine)', async () => {
    const actor: CrmActor = {
      kind: 'service',
      service: 'automations',
      workspaceId: 'ws_source',
      allowedWorkspaceIds: ['ws_source', 'ws_dest'],
    };

    const input: TransferDealInput = {
      dealId: 'deal_core_test_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_dest',
      targetPipelineId: 'pipe_dest',
      targetStageId: 'stage_dest_1',
      summary: 'Automated transfer via workflow',
    };

    const result = await transferDealCore(actor, input);
    expect(result.success).toBe(true);
    expect(result.dealId).toBe('deal_core_test_1');
    expect(mockUpdateFn).toHaveBeenCalled();
  });

  it('successfully executes with an agent actor (MCP tool execution)', async () => {
    const actor: CrmActor = {
      kind: 'service',
      service: 'api',
      workspaceId: 'ws_source',
      allowedWorkspaceIds: ['ws_source', 'ws_dest'],
      agentId: 'agent_revenue_specialist',
      agentVersion: '2.1.0',
      runId: 'run_mcp_789',
      onBehalfOf: 'user_sales_lead',
    };

    const input: TransferDealInput = {
      dealId: 'deal_core_test_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_dest',
      targetPipelineId: 'pipe_dest',
      targetStageId: 'stage_dest_1',
      summary: 'Moved by Revenue Specialist agent',
    };

    const result = await transferDealCore(actor, input);
    expect(result.success).toBe(true);
    expect(result.dealId).toBe('deal_core_test_1');
  });

  it('rejects cross-organization transfer attempts (Rule 8 Tenant Isolation)', async () => {
    targetOrgId = 'org_competing_firm';

    const actor: CrmActor = {
      kind: 'service',
      service: 'automations',
      workspaceId: 'ws_source',
    };

    const input: TransferDealInput = {
      dealId: 'deal_core_test_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_foreign',
      targetPipelineId: 'pipe_dest',
      targetStageId: 'stage_dest_1',
    };

    const result = await transferDealCore(actor, input);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cross-organization');
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it('detects TOCTOU concurrency conflicts when expectedUpdatedAt does not match (Rule 18)', async () => {
    const actor: CrmActor = {
      kind: 'service',
      service: 'automations',
      workspaceId: 'ws_source',
      allowedWorkspaceIds: ['ws_source', 'ws_dest'],
    };

    const input: TransferDealInput = {
      dealId: 'deal_core_test_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_dest',
      targetPipelineId: 'pipe_dest',
      targetStageId: 'stage_dest_1',
      expectedUpdatedAt: '2026-09-01T00:00:00.000Z', // Outdated timestamp
    };

    const result = await transferDealCore(actor, input);
    expect(result.success).toBe(false);
    expect(result.error).toContain('CONCURRENCY_CONFLICT');
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it('returns cached result on idempotent retries without modifying deal again (Rule 19 & 20)', async () => {
    idempotencyFound = true;

    const actor: CrmActor = {
      kind: 'service',
      service: 'automations',
      workspaceId: 'ws_source',
      allowedWorkspaceIds: ['ws_source', 'ws_dest'],
    };

    const input: TransferDealInput = {
      dealId: 'deal_core_test_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_dest',
      targetPipelineId: 'pipe_dest',
      targetStageId: 'stage_dest_1',
      idempotencyKey: 'idem_key_already_run_123',
    };

    const result = await transferDealCore(actor, input);
    expect(result.success).toBe(true);
    expect(result.dealId).toBe('deal_cached_idempotent_123');
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it('promotes primary focal contact into a Person entity when transferring from Institution to Person workspace (Rule 61 & 64)', async () => {
    targetWorkspaceScope = 'person';
    sourceEntityScope = 'institution';
    pipelineCrossScopeApprovalRequired = false;

    const actor: CrmActor = {
      kind: 'service',
      service: 'automations',
      workspaceId: 'ws_source',
      allowedWorkspaceIds: ['ws_source', 'ws_dest'],
    };

    const input: TransferDealInput = {
      dealId: 'deal_core_test_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_dest',
      targetPipelineId: 'pipe_dest',
      targetStageId: 'stage_dest_1',
      entityConversionStrategy: 'promote_primary_focal_contact',
    };

    const result = await transferDealCore(actor, input);
    expect(result.success).toBe(true);
    expect(result.entityResolution).toBeDefined();
    expect(result.entityResolution?.sourceScope).toBe('institution');
    expect(result.entityResolution?.targetScope).toBe('person');
    expect(result.entityResolution?.wasCreated).toBe(true);
    expect(result.entityResolution?.promotedContactId).toBe('focal_contact_sarah_1');

    // Confirm deal document was updated with the promoted person entity ID
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: expect.any(String),
        workspaceId: 'ws_dest',
        pipelineId: 'pipe_dest',
        stageId: 'stage_dest_1',
      })
    );
  });

  it('creates Two-Phase PROPOSAL when cross-scope transfer requires approval according to pipeline policy (Rule 21 & 22)', async () => {
    targetWorkspaceScope = 'person';
    sourceEntityScope = 'institution';
    pipelineCrossScopeApprovalRequired = true; // Mandated by Backoffice Pipeline Policy

    const actor: CrmActor = {
      kind: 'service',
      service: 'api',
      workspaceId: 'ws_source',
      allowedWorkspaceIds: ['ws_source', 'ws_dest'],
      agentId: 'agent_autonomous_transfer',
    };

    const input: TransferDealInput = {
      dealId: 'deal_core_test_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_dest',
      targetPipelineId: 'pipe_dest',
      targetStageId: 'stage_dest_1',
    };

    const result = await transferDealCore(actor, input);
    expect(result.success).toBe(true);
    expect(result.phase).toBe('PROPOSAL');
    expect(result.requiresProposal).toBe(true);
    expect(result.approvalId).toBeDefined();
    // Zero state mutation committed before approval
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it('executes Saga compensation rollback and emits compensated event when downstream operation throws an error (Rule 27)', async () => {
    targetWorkspaceScope = 'person';
    sourceEntityScope = 'institution';
    pipelineCrossScopeApprovalRequired = false;
    deletedDocIds.length = 0;

    mockUpdateFn.mockRejectedValueOnce(new Error('Firestore commit network failure'));

    const actor: CrmActor = {
      kind: 'service',
      service: 'automations',
      workspaceId: 'ws_source',
      allowedWorkspaceIds: ['ws_source', 'ws_dest'],
    };

    const input: TransferDealInput = {
      dealId: 'deal_core_test_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_dest',
      targetPipelineId: 'pipe_dest',
      targetStageId: 'stage_dest_1',
      entityConversionStrategy: 'promote_primary_focal_contact',
    };

    const result = await transferDealCore(actor, input);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Firestore commit network failure');

    // Verify Saga compensating transaction purged created entity/projection
    expect(deletedDocIds.length).toBeGreaterThan(0);

    // Verify compensated domain event was published to the ledger
    expect(mockEmitDealDomainEvent).toHaveBeenCalledWith(
      'deal.transfer.compensated',
      expect.objectContaining({
        dealId: 'deal_core_test_1',
      })
    );
  });

  it('blocks autonomous transfer when disableAutonomousTransfers dead-man switch is enabled (Rule 60)', async () => {
    pipelineDisableAutonomousTransfers = true;

    const actor: CrmActor = {
      kind: 'service',
      service: 'api',
      workspaceId: 'ws_source',
      allowedWorkspaceIds: ['ws_source', 'ws_dest'],
      agentId: 'agent_autonomous_transfer',
    };

    const input: TransferDealInput = {
      dealId: 'deal_core_test_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_dest',
      targetPipelineId: 'pipe_dest',
      targetStageId: 'stage_dest_1',
    };

    const result = await transferDealCore(actor, input);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Autonomous cross-workspace deal transfers are disabled');

    pipelineDisableAutonomousTransfers = false;
  });
});
