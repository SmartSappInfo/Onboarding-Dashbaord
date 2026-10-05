/**
 * @fileOverview Unit & Integration Tests for Sales Agent Server Actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchLeadsAction,
  scoreLeadAction,
  getLeadDossierAction,
  getDecisionMakersAction,
  getPitchRecommendationAction,
  getObjectionHandlersAction,
} from '@/app/actions/sales-agent-actions';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(),
}));

vi.mock('@/platform/events/event-bus', () => ({
  defaultEventBus: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/platform/capabilities/events/domain-event', () => ({
  createDomainEvent: vi.fn((args: unknown) => args),
}));

describe('Sales Agent Server Actions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockImplementation(async () => ({
      uid: 'user_123',
      profile: {
        id: 'user_123',
        email: 'agent@smartsapp.com',
        role: 'admin',
        organizationId: 'org_123',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isSystemAdmin: false,
    }));

    const { checkGovernanceDeadManSwitch } = await import('@/platform/policy/governance-dead-man');
    vi.mocked(checkGovernanceDeadManSwitch).mockImplementation(async (orgId: string) => {
      if (orgId === 'org_paused') {
        return { isPaused: true, reason: 'Emergency maintenance active: SALES_DEAD_MAN_PAUSED' };
      }
      return { isPaused: false, reason: '' };
    });
  });

  it('executes searchLeadsAction with authenticated session and tenant scoping', async () => {
    const result = await searchLeadsAction({
      organizationId: 'org_123',
      workspaceId: 'ws_456',
      queryText: 'Software',
      limit: 10,
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('leads');
    expect(Array.isArray(result.data?.leads)).toBe(true);
  });

  it('blocks execution when dead-man switch is active', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockImplementation(async () => ({
      uid: 'user_paused',
      profile: {
        id: 'user_paused',
        email: 'paused@smartsapp.com',
        role: 'admin',
        organizationId: 'org_paused',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isSystemAdmin: false,
    }));

    const result = await searchLeadsAction({
      organizationId: 'org_paused',
      workspaceId: 'ws_paused',
      queryText: 'Software',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('SALES_DEAD_MAN_PAUSED');
  });

  it('calculates explainable score for a lead', async () => {
    const result = await scoreLeadAction({
      organizationId: 'org_123',
      workspaceId: 'ws_456',
      prospectId: 'lead_sample_01',
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('overallScore');
    expect(result.data).toHaveProperty('priorityTier');
  });

  it('assembles complete lead intelligence dossier', async () => {
    const result = await getLeadDossierAction({
      organizationId: 'org_123',
      workspaceId: 'ws_456',
      prospectId: 'lead_sample_01',
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('dossier');
    expect(result.data).toHaveProperty('promptXml');
  });

  it('retrieves pitch recommendation and decision makers', async () => {
    const pitch = await getPitchRecommendationAction({
      organizationId: 'org_123',
      workspaceId: 'ws_456',
      prospectId: 'lead_sample_01',
    });
    expect(pitch.success).toBe(true);
    expect(pitch.data).toHaveProperty('pitchText');

    const makers = await getDecisionMakersAction({
      organizationId: 'org_123',
      workspaceId: 'ws_456',
      prospectId: 'lead_sample_01',
    });
    expect(makers.success).toBe(true);
    expect(makers.data).toHaveProperty('contacts');
  });

  it('retrieves objection handlers for a lead', async () => {
    const objections = await getObjectionHandlersAction({
      organizationId: 'org_123',
      workspaceId: 'ws_456',
      prospectId: 'lead_sample_01',
    });
    expect(objections.success).toBe(true);
    expect(objections.data).toHaveProperty('objections');
  });

  it('fails closed when tenant IDOR violation occurs', async () => {
    const result = await searchLeadsAction({
      organizationId: 'org_other_tenant',
      workspaceId: 'ws_456',
      queryText: 'Software',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('IDOR_VIOLATION');
  });
});
