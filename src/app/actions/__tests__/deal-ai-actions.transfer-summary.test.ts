/**
 * @fileOverview Unit tests for generateDealTransferAiSummaryAction
 * 
 * Verifies:
 * - Successful AI synthesis of deal transfer summary and next step.
 * - Resilient circuit breaker fallback (Rule 24) when AI throws or times out.
 * - Authorization enforcement via canUser RBAC.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDealTransferAiSummaryAction } from '../deal-ai-actions';

// Mock dependencies
vi.mock('@/lib/firebase-admin', () => {
  const mockActivities = [
    {
      data: () => ({
        description: 'Discovery call held with CTO',
        timestamp: '2026-10-01T10:00:00.000Z',
      }),
    },
  ];

  const mockNotes = [
    {
      data: () => ({
        content: 'Budget approved for Q4 enterprise deployment',
        createdAt: '2026-10-02T14:00:00.000Z',
      }),
    },
  ];

  const mockDealDoc = {
    exists: true,
    data: () => ({
      id: 'deal-100',
      name: 'Global Corp Enterprise License',
      workspaceId: 'ws-src',
      stageId: 'stage-1',
      stageName: 'Negotiation',
      status: 'active',
      value: 75000,
      currency: 'USD',
      entityId: 'ent-100',
      focalContacts: [{ name: 'Jane Doe', role: 'VP Operations' }],
      assignedTo: { userId: 'u-1', name: 'Alex Rep', email: 'alex@example.com' },
    }),
  };

  const getCollection = (name: string) => {
    if (name === 'deals') {
      return {
        doc: vi.fn(() => ({
          get: vi.fn(async () => mockDealDoc),
        })),
      };
    }
    if (name === 'activities') {
      return {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn(async () => ({
          size: mockActivities.length,
          forEach: (cb: (doc: typeof mockActivities[0]) => void) => mockActivities.forEach(cb),
        })),
      };
    }
    if (name === 'notes') {
      return {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn(async () => ({
          docs: mockNotes,
        })),
      };
    }
    return {
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn(async () => ({ docs: [], size: 0, forEach: () => {} })),
    };
  };

  return {
    adminDb: {
      collection: vi.fn((colName: string) => getCollection(colName)),
    },
  };
});

vi.mock('@/lib/auth-server', () => ({
  requireAuth: vi.fn(async () => ({ uid: 'test-user-123' })),
}));

vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn(async () => ({ granted: true })),
}));

const mockGenerate = vi.fn();
vi.mock('@/ai/genkit', () => ({
  getModel: vi.fn(async () => ({
    modelString: 'googleai/gemini-3-flash-preview',
    customAi: {
      generate: (...args: unknown[]) => mockGenerate(...args),
    },
  })),
  ai: {
    generate: (...args: unknown[]) => mockGenerate(...args),
    defineFlow: vi.fn((_config, fn) => fn),
  },
}));

describe('generateDealTransferAiSummaryAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates structured deal transfer summary and next step via AI', async () => {
    mockGenerate.mockResolvedValueOnce({
      output: {
        summary: 'Global Corp Enterprise License is in the negotiation stage for a $75,000 deployment. The lead stakeholder has confirmed budget availability.',
        nextStepTitle: 'Deliver revised commercial terms and schedule sign-off meeting',
        nextStepType: 'meeting',
        nextStepDueDays: 3,
        rationale: 'Moving directly to sign-off closes the loop on budget confirmation.',
      },
    });

    const result = await generateDealTransferAiSummaryAction('deal-100', 'ws-dest');

    expect(result.success).toBe(true);
    expect(result.summary).toContain('Global Corp Enterprise License');
    expect(result.nextStep?.title).toBe('Deliver revised commercial terms and schedule sign-off meeting');
    expect(result.nextStep?.type).toBe('meeting');
    expect(result.isFallback).toBe(false);
  });

  it('gracefully activates circuit breaker fallback when AI generation fails with 503', async () => {
    mockGenerate.mockRejectedValueOnce(new Error('503 Service Unavailable: High demand'));

    const result = await generateDealTransferAiSummaryAction('deal-100', 'ws-dest');

    // Circuit breaker guarantees successful baseline response without crashing client
    expect(result.success).toBe(true);
    expect(result.isFallback).toBe(true);
    expect(result.summary).toContain('Opportunity "Global Corp Enterprise License"');
    expect(result.nextStep?.title).toContain('Follow up with Jane Doe');
  });

  it('rejects execution if caller lacks view permission', async () => {
    const { canUser } = await import('@/lib/workspace-permissions');
    vi.mocked(canUser).mockResolvedValueOnce({ granted: false, reason: 'Insufficient workspace permissions' });

    const result = await generateDealTransferAiSummaryAction('deal-100', 'ws-dest');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient workspace permissions');
  });
});
