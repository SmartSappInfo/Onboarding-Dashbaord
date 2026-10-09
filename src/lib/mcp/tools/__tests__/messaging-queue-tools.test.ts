import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messagingGetQueueStatsTool } from '../messaging-queue-tools';
import type { McpExecutionContext } from '../../types';

const mockGet = vi.fn();
const mockCountGet = vi.fn();
const mockWhere = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: (...args: unknown[]) => {
        mockWhere(...args);
        return {
          where: (...innerArgs: unknown[]) => {
            mockWhere(...innerArgs);
            return {
              count: () => ({
                get: mockCountGet,
              }),
              get: mockGet,
            };
          },
          count: () => ({
            get: mockCountGet,
          }),
          get: mockGet,
        };
      },
    })),
  },
}));

describe('messaging.get_queue_stats MCP tool', () => {
  const mockContext: McpExecutionContext = {
    workspaceId: 'ws_test',
    organizationId: 'org_test',
    callerId: 'agent_007',
    callerType: 'agent',
    requestId: 'req_123',
    callDepth: 1,
    timestamp: '2026-10-09T08:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCountGet.mockResolvedValue({
      data: () => ({ count: 5 }),
    });
  });

  it('declares read_only risk tier and exact 64-char schemaHash', () => {
    expect(messagingGetQueueStatsTool.riskLevel).toBe('read_only');
    expect(messagingGetQueueStatsTool.name).toBe('messaging.get_queue_stats');
    expect(messagingGetQueueStatsTool.category).toBe('campaign');
    expect(messagingGetQueueStatsTool.requiresApproval).toBe(false);
    expect(messagingGetQueueStatsTool.schemaHash).toHaveLength(64);
    expect(messagingGetQueueStatsTool.schemaHash).toBe(
      '5f8a1c3e7b9d2e4f6a8b0c1d3e5f7a9b2c4d6e8f0a1b3c5d7e9f1a3b5c7d9e1f'
    );
  });

  it('retrieves scoped queue counts for the workspace', async () => {
    // Return custom counts for each call
    mockCountGet
      .mockResolvedValueOnce({ data: () => ({ count: 12 }) }) // scheduled
      .mockResolvedValueOnce({ data: () => ({ count: 3 }) })  // pending
      .mockResolvedValueOnce({ data: () => ({ count: 1 }) }); // failed

    const res = await messagingGetQueueStatsTool.handler({}, mockContext);

    expect(res.success).toBe(true);
    expect(res.scheduledCount).toBe(12);
    expect(res.pendingApprovalCount).toBe(3);
    expect(res.failedCount).toBe(1);
    expect(mockWhere).toHaveBeenCalledWith('workspaceId', '==', 'ws_test');
  });

  it('enforces fail-closed multi-tenancy if context is missing workspaceId or organizationId', async () => {
    const badContext = { ...mockContext, workspaceId: '' };

    await expect(
      messagingGetQueueStatsTool.handler({}, badContext)
    ).rejects.toThrow(/missing required workspaceId or organizationId/i);
  });
});
