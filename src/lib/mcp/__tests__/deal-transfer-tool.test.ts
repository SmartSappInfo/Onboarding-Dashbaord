/**
 * @fileoverview Unit Tests: dealTransferTool (MCP Tool Layer)
 *
 * Verifies Governed MCP Tool standards (Rule 11, 12, 13, 16, 69):
 * - Tool metadata, versioning, risk level (L2_STATE_MUTATION / high_risk)
 * - Trust boundary Zod schema validation
 * - Agent execution context with principal attribution
 * - Error propagation and failure closed defaults
 *
 * Compliance: agents_mcp_rules.md, theme.md.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dealTransferTool } from '../tools/deal-tools';
import type { McpExecutionContext } from '../types';

// Mock dealTransferCapability
const { mockCapabilityHandler } = vi.hoisted(() => ({
  mockCapabilityHandler: vi.fn(),
}));

vi.mock('@/platform/domains/deals_revenue/contracts/deal-capabilities.contract', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/domains/deals_revenue/contracts/deal-capabilities.contract')>();
  return {
    ...actual,
    dealTransferCapability: {
      ...actual.dealTransferCapability,
      handler: mockCapabilityHandler,
    },
  };
});

// Mock Firestore
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }),
    }),
  },
}));

describe('dealTransferTool (MCP Layer)', () => {
  const mockContext: McpExecutionContext = {
    callerType: 'agent',
    callerId: 'agent_sdr_rev',
    workspaceId: 'ws_source_1',
    organizationId: 'org_enterprise_1',
    requestId: 'req_mcp_123',
    callDepth: 1,
    timestamp: '2026-10-07T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes compliant tool metadata and risk tier (Rule 11 & 12)', () => {
    expect(dealTransferTool.name).toBe('deal.transfer');
    expect(dealTransferTool.version).toBe('1.0.0');
    expect(dealTransferTool.category).toBe('deal');
    expect(dealTransferTool.riskLevel).toBe('high_risk');
  });

  it('validates tool arguments at trust boundary (Rule 4 & 13)', () => {
    const invalidInput = {
      dealId: 'deal_1',
      // Missing targetWorkspaceId, targetPipelineId, targetStageId
    };
    const parsed = dealTransferTool.parameters.safeParse(invalidInput);
    expect(parsed.success).toBe(false);

    const validInput = {
      dealId: 'deal_1',
      mode: 'move',
      targetWorkspaceId: 'ws_target_1',
      targetPipelineId: 'pipe_target_1',
      targetStageId: 'stage_target_1',
    };
    const validParsed = dealTransferTool.parameters.safeParse(validInput);
    expect(validParsed.success).toBe(true);
  });

  it('invokes canonical capability with agent principal and returns formatted result (Rule 16 & 69)', async () => {
    mockCapabilityHandler.mockResolvedValueOnce({
      success: true,
      data: {
        dealId: 'deal_1',
        mode: 'move',
        targetWorkspaceId: 'ws_target_1',
        targetPipelineId: 'pipe_target_1',
        targetStageId: 'stage_target_1',
        success: true,
        updatedAt: '2026-10-07T12:00:01.000Z',
      },
    });

    const result = await dealTransferTool.handler(
      {
        dealId: 'deal_1',
        mode: 'move',
        targetWorkspaceId: 'ws_target_1',
        targetPipelineId: 'pipe_target_1',
        targetStageId: 'stage_target_1',
        summary: 'Transferred by AI SDR Agent',
      },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.dealId).toBe('deal_1');
    expect(result.targetWorkspaceId).toBe('ws_target_1');

    expect(mockCapabilityHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: 'deal_1',
        mode: 'move',
        sourceWorkspaceId: 'ws_source_1',
        targetWorkspaceId: 'ws_target_1',
      }),
      expect.objectContaining({
        principal: expect.objectContaining({
          actorType: 'agent',
          agentId: 'agent_sdr_rev',
          workspaceId: 'ws_source_1',
          organizationId: 'org_enterprise_1',
        }),
      })
    );
  });

  it('fails closed and throws on capability execution error (Rule 31 & 48)', async () => {
    mockCapabilityHandler.mockResolvedValueOnce({
      success: false,
      error: {
        code: 'VALIDATION',
        message: 'Destination stage does not belong to target pipeline.',
      },
    });

    await expect(
      dealTransferTool.handler(
        {
          dealId: 'deal_1',
          mode: 'move',
          targetWorkspaceId: 'ws_target_1',
          targetPipelineId: 'pipe_target_1',
          targetStageId: 'stage_invalid',
        },
        mockContext
      )
    ).rejects.toThrow(/Destination stage does not belong to target pipeline/);
  });
});
