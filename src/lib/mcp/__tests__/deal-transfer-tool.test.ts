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
import { dealTransferTool, dealPreviewTransferTool } from '../tools/deal-tools';
import type { McpExecutionContext } from '../types';

// Mock transferDealCore
const { mockTransferDealCore } = vi.hoisted(() => ({
  mockTransferDealCore: vi.fn(),
}));

vi.mock('@/lib/deals/deal-transfer-core', () => ({
  transferDealCore: mockTransferDealCore,
}));

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
    expect(dealTransferTool.riskLevel).toBe('low_risk');
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

  it('invokes transferDealCore with agent principal and returns formatted result (Rule 16 & 69)', async () => {
    mockTransferDealCore.mockResolvedValueOnce({
      success: true,
      dealId: 'deal_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source_1',
      targetWorkspaceId: 'ws_target_1',
      targetPipelineId: 'pipe_target_1',
      targetStageId: 'stage_target_1',
      updatedAt: '2026-10-07T12:00:01.000Z',
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

    expect(mockTransferDealCore).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'service',
        service: 'api',
        workspaceId: 'ws_source_1',
        agentId: 'agent_sdr_rev',
      }),
      expect.objectContaining({
        dealId: 'deal_1',
        mode: 'move',
        sourceWorkspaceId: 'ws_source_1',
        targetWorkspaceId: 'ws_target_1',
      })
    );
  });

  it('fails closed and throws on capability execution error (Rule 31 & 48)', async () => {
    mockTransferDealCore.mockResolvedValueOnce({
      success: false,
      error: 'Destination stage does not belong to target pipeline.',
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

describe('dealPreviewTransferTool (MCP Layer - Two-Phase / Shadow Mode)', () => {
  const mockContext: McpExecutionContext = {
    callerType: 'agent',
    callerId: 'agent_evaluator_1',
    workspaceId: 'ws_source_1',
    organizationId: 'org_enterprise_1',
    requestId: 'req_preview_123',
    callDepth: 1,
    timestamp: '2026-10-07T12:00:00.000Z',
  };

  it('exposes compliant read-only metadata and zero mutation risk (Rule 11 & 12)', () => {
    expect(dealPreviewTransferTool.name).toBe('deal.preview_transfer');
    expect(dealPreviewTransferTool.version).toBe('1.0.0');
    expect(dealPreviewTransferTool.category).toBe('deal');
    expect(dealPreviewTransferTool.riskLevel).toBe('read_only');
  });

  it('invokes transferDealCore in dryRun mode and surfaces polymorphic conversion plan (Rule 21 & 22)', async () => {
    mockTransferDealCore.mockResolvedValueOnce({
      success: true,
      dealId: 'deal_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source_1',
      targetWorkspaceId: 'ws_target_person',
      targetPipelineId: 'pipe_target_1',
      targetStageId: 'stage_target_1',
      phase: 'PROPOSAL',
      requiresProposal: true,
      approvalId: 'prop_cross_scope_456',
      entityResolution: {
        sourceEntityId: 'ent_inst_1',
        targetEntityId: 'ent_inst_1',
        sourceScope: 'institution',
        targetScope: 'person',
        strategyUsed: 'promote_primary_focal_contact',
        wasCreated: false,
        auditEvidence: 'Scope mismatch requires Two-Phase human review proposal.',
      },
      auditEvidence: 'Dry-run preview simulation completed without state mutation.',
      updatedAt: '2026-10-07T12:00:00.000Z',
    });

    const result = await dealPreviewTransferTool.handler(
      {
        dealId: 'deal_1',
        mode: 'move',
        targetWorkspaceId: 'ws_target_person',
        targetPipelineId: 'pipe_target_1',
        targetStageId: 'stage_target_1',
        entityConversionStrategy: 'promote_primary_focal_contact',
      },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.phase).toBe('PROPOSAL');
    expect(result.requiresProposal).toBe(true);
    expect(result.approvalId).toBe('prop_cross_scope_456');
    expect(result.entityResolution?.sourceScope).toBe('institution');
    expect(result.entityResolution?.targetScope).toBe('person');

    expect(mockTransferDealCore).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        dealId: 'deal_1',
        dryRun: true,
        entityConversionStrategy: 'promote_primary_focal_contact',
      })
    );
  });
});

