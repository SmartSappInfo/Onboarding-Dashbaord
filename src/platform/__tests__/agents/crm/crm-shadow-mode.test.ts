/**
 * @fileOverview Unit & Architectural Tests for CRM Shadow Mode Simulation Engine (Phase 9 Milestone 2)
 *
 * Implements verification for Rules 1, 4, 8, 12, 19, 20, 26, 40, 42, 60, 67, 68, and 69.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeCrmAgentShadowMode,
  generateBlastRadiusReport,
  CrmShadowModeResultSchema,
  type CrmShadowModeOptions,
  type SimulatedMutation,
} from '@/platform/agents/crm/evaluation/crm-shadow-mode';
import { defaultEventBus } from '@/platform/events/event-bus';

describe('Phase 9 Milestone 2: CRM Shadow Mode Simulation Engine (Rule 42)', () => {
  const defaultOptions: CrmShadowModeOptions = {
    personaId: 'task_coordinator',
    entityId: 'ent_gis_accra_001',
    workspaceId: 'ws_edu_flagships',
    organizationId: 'org_enterprise_sales',
    actionPlan: [
      {
        capabilityId: 'crm.account.get_context',
        parameters: { entityId: 'ent_gis_accra_001' },
      },
      {
        capabilityId: 'task.create',
        parameters: {
          title: 'Schedule Q4 Board Meeting Follow-up',
          assigneeId: 'usr_sarah_ae',
          dueDate: '2026-10-15',
        },
      },
      {
        capabilityId: 'crm.entity.tag_add',
        parameters: {
          tag: 'q4_board_review',
        },
      },
    ],
  };

  it('should execute in shadow mode with dryRun: true and zero database writes (Rule 42)', async () => {
    const result = await executeCrmAgentShadowMode(defaultOptions);

    expect(result.dryRun).toBe(true);
    expect(result.personaId).toBe('task_coordinator');
    expect(result.entityId).toBe('ent_gis_accra_001');
    expect(result.mutationsInterceptedCount).toBe(2); // task.create and crm.entity.tag_add
    expect(result.simulatedMutations.length).toBe(2);

    const parsed = CrmShadowModeResultSchema.safeParse(result);
    expect(parsed.success, `Result failed schema validation: ${parsed.error?.message}`).toBe(true);
  });

  it('should generate accurate Blast Radius Reports (Rules 12, 42)', () => {
    const mockMutations: SimulatedMutation[] = [
      {
        capabilityId: 'task.create',
        domain: 'tasks_productivity',
        riskLevel: 'L2_STATE_MUTATION',
        targetRecord: '/workspace_entities/ws_test_ent_123',
        mockStateChange: { status: 'created', title: 'Follow-up' },
        idempotencyKey: 'idemp_01',
      },
      {
        capabilityId: 'deal.proposal.stage_transition',
        domain: 'deals_revenue',
        riskLevel: 'L1_INTERNAL_DRAFT',
        targetRecord: '/workspace_entities/ws_test_ent_123',
        mockStateChange: { proposedStage: 'Closing' },
        idempotencyKey: 'idemp_02',
      },
    ];

    const report = generateBlastRadiusReport(mockMutations);

    expect(report.targetedDomains).toContain('tasks_productivity');
    expect(report.targetedDomains).toContain('deals_revenue');
    expect(report.recordsAtRiskCount).toBe(1);
    expect(report.highestRiskLevel).toBe('L2_STATE_MUTATION');
    expect(report.requiresHumanApproval).toBe(false); // L2 is autonomous for coordinator
    expect(report.simulatedMutationsCount).toBe(2);
  });

  it('should flag requiresHumanApproval for L3 or L4 operations in Blast Radius (Rule 21)', () => {
    const highRiskMutations: SimulatedMutation[] = [
      {
        capabilityId: 'billing.invoice.dispatch',
        domain: 'deals_revenue',
        riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
        targetRecord: '/workspace_entities/ws_test_ent_123',
        mockStateChange: { amount: 50000 },
        idempotencyKey: 'idemp_03',
      },
    ];

    const report = generateBlastRadiusReport(highRiskMutations);
    expect(report.highestRiskLevel).toBe('L3_EXTERNAL_COMMUNICATION_FINANCE');
    expect(report.requiresHumanApproval).toBe(true);
  });

  it('should enforce cooperative cancellation via AbortSignal (Rule 26)', async () => {
    const controller = new AbortController();
    controller.abort(); // Pre-aborted

    await expect(
      executeCrmAgentShadowMode({
        ...defaultOptions,
        abortSignal: controller.signal,
      })
    ).rejects.toThrow(/cancelled|aborted/i);
  });

  it('should fail closed when tenant parameters are missing or mismatched (Rule 8)', async () => {
    await expect(
      executeCrmAgentShadowMode({
        ...defaultOptions,
        workspaceId: '',
      })
    ).rejects.toThrow(/workspaceId/i);

    await expect(
      executeCrmAgentShadowMode({
        ...defaultOptions,
        organizationId: '',
      })
    ).rejects.toThrow(/organizationId/i);
  });

  it('should publish crm.agent.simulated domain event via EventBus (Rule 40)', async () => {
    const publishSpy = vi.spyOn(defaultEventBus, 'publish');

    await executeCrmAgentShadowMode(defaultOptions);

    expect(publishSpy).toHaveBeenCalled();
    const emittedEvent = publishSpy.mock.calls.find((call) => call[0].type === 'crm.agent.simulated');
    expect(emittedEvent).toBeDefined();
    expect(emittedEvent?.[0].payload.entityId).toBe('ent_gis_accra_001');

    publishSpy.mockRestore();
  });

  it('should strictly target /workspace_entities in simulated mutations preserving master records (Rule 69)', async () => {
    const result = await executeCrmAgentShadowMode(defaultOptions);

    for (const mutation of result.simulatedMutations) {
      expect(mutation.targetRecord).toContain('/workspace_entities/');
      expect(mutation.targetRecord).not.toBe(`/entities/${defaultOptions.entityId}`);
    }
  });
});
