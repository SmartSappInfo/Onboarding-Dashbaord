/**
 * @fileOverview Unit & Integration Tests for SDR Capabilities (Phase 10 Milestone 4 Task 3)
 */

import { describe, it, expect, vi } from 'vitest';
import { getCapability } from '@/platform/capabilities/registry/capability-registry';
import type { CapabilityExecutionContext } from '@/platform/capabilities/contracts/capability-definition';
import '@/platform/capabilities/sales/sdr-capabilities';

// Mock governance dead man switch
vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(async (orgId?: string) => {
    if (orgId === 'org_paused') {
      throw new Error('Operator emergency maintenance');
    }
  }),
}));

const mockContext: CapabilityExecutionContext = {
  principal: {
    actorType: 'user',
    userId: 'user_kwame',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    grantedScopes: ['admin'],
    effectiveRole: 'admin',
  },
  correlationId: 'corr_test_123',
  dryRun: false,
  timestamp: new Date().toISOString(),
};

describe('SDR Capabilities (sdr.*)', () => {
  it('registers sdr.draft_outreach with L1_INTERNAL_DRAFT and generates drafts', async () => {
    const cap = getCapability('sdr.draft_outreach');
    expect(cap).toBeDefined();
    expect(cap?.risk.level).toBe('L1_INTERNAL_DRAFT');

    const result = await cap!.handler(
      {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        prospectId: 'prosp_test_1',
        channel: 'whatsapp',
        sdrPersonaId: 'lead_sdr',
      },
      mockContext
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    const data = result.data as { draft: { channel: string } };
    expect(data).toBeDefined();
    expect(data.draft.channel).toBe('whatsapp');
  });

  it('registers sdr.prepare_sequence with L1_INTERNAL_DRAFT and stages cadences', async () => {
    const cap = getCapability('sdr.prepare_sequence');
    expect(cap).toBeDefined();
    expect(cap?.risk.level).toBe('L1_INTERNAL_DRAFT');

    const result = await cap!.handler(
      {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        leadIds: ['prosp_test_1'],
        sequenceConfig: {
          id: 'seq_fast',
          name: 'Fast Track',
          steps: [
            { stepIndex: 1, dayOffset: 0, channel: 'whatsapp', name: 'Intro', condition: 'always' },
          ],
          dailySendingLimit: 25,
        },
        sdrPersonaId: 'lead_sdr',
      },
      mockContext
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    const data = result.data as { status: string; payloadHash: string };
    expect(data.status).toBe('staged');
    expect(data.payloadHash).toHaveLength(64);
  });

  it('registers sdr.dispatch_whatsapp with L3_EXTERNAL_COMMUNICATION_FINANCE and dryRun support', async () => {
    const cap = getCapability('sdr.dispatch_whatsapp');
    expect(cap).toBeDefined();
    expect(cap?.risk.level).toBe('L3_EXTERNAL_COMMUNICATION_FINANCE');

    const result = await cap!.handler(
      {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        draftId: 'draft_123',
        actionProposalId: 'prop_456',
        payloadHash: 'a'.repeat(64),
        dryRun: true,
      },
      mockContext
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    const data = result.data as { simulated: boolean; status: string };
    expect(data.simulated).toBe(true);
    expect(data.status).toBe('simulated');
  });

  it('halts with SALES_DEAD_MAN_PAUSED when emergency pause is engaged (Rule 60)', async () => {
    const cap = getCapability('sdr.dispatch_whatsapp');
    const pausedContext: CapabilityExecutionContext = {
      ...mockContext,
      principal: {
        ...mockContext.principal,
        organizationId: 'org_paused',
      },
    };

    const result = await cap!.handler(
      {
        organizationId: 'org_paused',
        workspaceId: 'ws_test',
        draftId: 'draft_123',
        actionProposalId: 'prop_456',
        payloadHash: 'a'.repeat(64),
        dryRun: false,
      },
      pausedContext
    );

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected failure');
    expect(result.error.code).toBe('SALES_DEAD_MAN_PAUSED');
  });

  it('registers sdr.log_engagement with L2_STATE_MUTATION and records milestones', async () => {
    const cap = getCapability('sdr.log_engagement');
    expect(cap).toBeDefined();
    expect(cap?.risk.level).toBe('L2_STATE_MUTATION');

    const result = await cap!.handler(
      {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        prospectId: 'prosp_test_1',
        channel: 'whatsapp',
        outcome: 'replied',
        notes: 'Requested tuition fees discount breakdown.',
      },
      mockContext
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    const data = result.data as { status: string };
    expect(data.status).toBe('logged');
  });
});
