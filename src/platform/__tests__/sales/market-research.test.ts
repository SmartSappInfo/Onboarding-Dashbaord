/**
 * @fileOverview Unit & Integration Tests for Market Research Action & Contracts (Phase 10 Milestone 3 Task 1)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { researchMarketAction } from '@/app/actions/sales-agent-actions';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
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

describe('Market Research Canvas Action', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockResolvedValue({
      uid: 'user_sales_lead',
      isSystemAdmin: false,
      profile: { organizationId: 'org_test_123', role: 'admin' },
    } as any);
  });

  it('rejects unauthorized caller without session', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockResolvedValue(null as any);

    const result = await researchMarketAction({
      organizationId: 'org_test_123',
      workspaceId: 'ws_test',
      industry: 'Education',
      region: 'Kumasi, Ghana',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('blocks IDOR cross-tenant access', async () => {
    const result = await researchMarketAction({
      organizationId: 'org_attacker_999',
      workspaceId: 'ws_test',
      industry: 'Education',
      region: 'Accra, Ghana',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('IDOR_VIOLATION');
  });

  it('halts when emergency dead-man pause switch is engaged (Rule 60)', async () => {
    const { checkGovernanceDeadManSwitch } = await import('@/platform/policy/governance-dead-man');
    vi.mocked(checkGovernanceDeadManSwitch).mockRejectedValueOnce(new Error('GOVERNANCE_PAUSED'));

    const result = await researchMarketAction({
      organizationId: 'org_test_123',
      workspaceId: 'ws_test',
      industry: 'Healthcare',
      region: 'Nairobi, Kenya',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('SALES_DEAD_MAN_PAUSED');
  });

  it('synthesizes market trends, TAM/SAM, and outreach angles for valid input', async () => {
    const result = await researchMarketAction({
      organizationId: 'org_test_123',
      workspaceId: 'ws_test',
      industry: 'EdTech',
      region: 'West Africa',
      targetAudience: 'K-12 Private School Administrators',
      competitors: ['Legacy Books', 'Manual Spreadsheets'],
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.industry).toBe('EdTech');
    expect(result.data?.region).toBe('West Africa');
    expect(result.data?.marketTrends.length).toBeGreaterThan(0);
    expect(result.data?.recommendedAngles.length).toBeGreaterThan(0);
    expect(result.data?.tamSamEstimate).toContain('TAM:');
    expect(result.data?.researchId).toMatch(/^mkt_res_/);
  });
});
