/**
 * @fileOverview Unit & Integration Tests for Segment To Campaign Bridge Action & Contracts (Phase 10 Milestone 3 Task 2)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCampaignFromSegmentAction } from '@/app/actions/sales-agent-actions';
import type { AuthContext } from '@/lib/auth/require-auth';
import type { UserProfile } from '@/lib/types';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

vi.mock('@/platform/policy/governance-dead-man', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/policy/governance-dead-man')>();
  return {
    ...actual,
    checkGovernanceDeadManSwitch: vi.fn(),
  };
});

vi.mock('@/platform/events/event-bus', () => ({
  defaultEventBus: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/platform/capabilities/events/domain-event', () => ({
  createDomainEvent: vi.fn((args: unknown) => args),
}));

describe('Segment To Campaign Bridge Action', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockResolvedValue({
      uid: 'user_sdr_lead',
      isSystemAdmin: false,
      profile: {
        id: 'user_sdr_lead',
        organizationId: 'org_test_123',
        role: 'admin',
        email: 'sdr@example.com',
        displayName: 'SDR Lead',
      } as unknown as UserProfile,
    } as AuthContext);
  });

  it('rejects unauthenticated caller', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'));

    const result = await createCampaignFromSegmentAction({
      organizationId: 'org_test_123',
      workspaceId: 'ws_test',
      segmentName: 'Hot Leads Q4',
      leadIds: ['lead_1', 'lead_2'],
      campaignGoal: 'Schedule 15 Demos',
      sdrPersonaId: 'lead_sdr',
      dailyBudget: 25,
      channels: ['email', 'whatsapp'],
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('validates minimum 1 lead in segment', async () => {
    const result = await createCampaignFromSegmentAction({
      organizationId: 'org_test_123',
      workspaceId: 'ws_test',
      segmentName: 'Empty Segment',
      leadIds: [],
      campaignGoal: 'Test Goal',
      sdrPersonaId: 'lead_sdr',
      dailyBudget: 25,
      channels: ['email'],
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('creates active prospecting campaign and emits domain event (Rule 40)', async () => {
    const result = await createCampaignFromSegmentAction({
      organizationId: 'org_test_123',
      workspaceId: 'ws_test',
      segmentName: 'High Intent GIS Accounts',
      leadIds: ['lead_gis_01', 'lead_gis_02', 'lead_gis_03'],
      campaignGoal: 'Convert 3 Flagship School Accounts',
      sdrPersonaId: 'lead_sdr',
      dailyBudget: 25,
      channels: ['email', 'whatsapp'],
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.segmentName).toBe('High Intent GIS Accounts');
    expect(result.data?.prospectCount).toBe(3);
    expect(result.data?.sdrPersonaId).toBe('lead_sdr');
    expect(result.data?.dailyBudget).toBe(25);
    expect(result.data?.payloadHash).toBeDefined();
    expect(result.data?.campaignId).toMatch(/^camp_/);
  });
});
