/**
 * @fileoverview Unit Tests: Deal Cadence MCP Tools (deal.preview_task_cadence & deal.execute_task_cadence)
 *
 * Verifies Governed MCP Tool standards:
 * - Tool metadata, versioning, risk tiers (read_only vs low_risk)
 * - Trust boundary Zod schema validation
 * - Agent execution context with caller attribution
 * - Preview non-mutating simulation vs low-risk execution
 *
 * Compliance: agents_mcp_rules.md, theme.md.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dealPreviewTaskCadenceTool, dealExecuteTaskCadenceTool } from '../tools/deal-tools';
import type { McpExecutionContext } from '../types';

// Mock core functions
const { mockGenerateCadencePreview, mockExecuteCadenceSchedule } = vi.hoisted(() => ({
  mockGenerateCadencePreview: vi.fn(),
  mockExecuteCadenceSchedule: vi.fn(),
}));

vi.mock('@/lib/deals/deal-task-cadence-core', () => ({
  generateCadencePreview: mockGenerateCadencePreview,
  executeCadenceSchedule: mockExecuteCadenceSchedule,
}));

// Mock PersonService
vi.mock('@/lib/services/person-service', () => ({
  PersonService: {
    getPerson: vi.fn().mockImplementation(async (id: string) => ({
      id,
      displayName: `Rep ${id}`,
      email: `${id}@example.com`,
    })),
  },
}));

// Mock Firestore
const mockDealsSnap = {
  docs: [
    {
      id: 'deal_1',
      data: () => ({ name: 'Acme Renewal', value: 10000, stageId: 'stage_1', workspaceId: 'ws_test_1' }),
    },
    {
      id: 'deal_2',
      data: () => ({ name: 'Wayne Expansion', value: 25000, stageId: 'stage_1', workspaceId: 'ws_test_1' }),
    },
  ],
};

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockImplementation(async () => mockDealsSnap),
      }),
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }),
    }),
  },
}));

describe('Deal Cadence MCP Tools', () => {
  const mockContext: McpExecutionContext = {
    callerType: 'agent',
    callerId: 'agent_cleaner',
    workspaceId: 'ws_test_1',
    organizationId: 'org_test_1',
    requestId: 'req_cadence_123',
    callDepth: 1,
    timestamp: '2026-10-09T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dealPreviewTaskCadenceTool', () => {
    it('exposes compliant tool metadata and risk tier', () => {
      expect(dealPreviewTaskCadenceTool.name).toBe('deal.preview_task_cadence');
      expect(dealPreviewTaskCadenceTool.version).toBe('1.0.0');
      expect(dealPreviewTaskCadenceTool.category).toBe('deal');
      expect(dealPreviewTaskCadenceTool.riskLevel).toBe('read_only');
      expect(dealPreviewTaskCadenceTool.requiresApproval).toBe(false);
    });

    it('rejects invalid inputs failing boundary validation', () => {
      const invalidInput = {
        dealIds: [], // Empty array not allowed
        startDate: 'invalid-date',
        targetAssigneeIds: [],
      };

      const result = dealPreviewTaskCadenceTool.parameters.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('simulates cadence schedule without database mutations', async () => {
      mockGenerateCadencePreview.mockReturnValueOnce({
        workspaceId: 'ws_test_1',
        totalDeals: 2,
        totalPipelineValue: 35000,
        totalDaysSpanned: 1,
        startDate: '2026-10-10',
        endDate: '2026-10-10',
        slots: [
          { dealId: 'deal_1', dealTitle: 'Acme Renewal', assigneeName: 'Rep user_1', scheduledAt: '2026-10-10T09:00:00Z' },
          { dealId: 'deal_2', dealTitle: 'Wayne Expansion', assigneeName: 'Rep user_1', scheduledAt: '2026-10-10T09:30:00Z' },
        ],
        daySummaries: [
          {
            date: '2026-10-10',
            dayNumber: 1,
            taskCount: 2,
            deals: [
              { id: 'deal_1', title: 'Acme Renewal', assigneeName: 'Rep user_1', time: '09:00' },
              { id: 'deal_2', title: 'Wayne Expansion', assigneeName: 'Rep user_1', time: '09:30' },
            ],
          },
        ],
      });

      const params = {
        dealIds: ['deal_1', 'deal_2'],
        actionType: 'call' as const,
        taskTitle: 'Discovery Call',
        taskPriority: 'medium' as const,
        startDate: '2026-10-10',
        maxFrequencyPerDay: 5,
        intervalMinutes: 30,
        startTime: '09:00',
        skipWeekends: true,
        assigneeMode: 'round_robin' as const,
        targetAssigneeIds: ['user_1'],
      };

      const res = await dealPreviewTaskCadenceTool.handler(params, mockContext);

      expect(res.workspaceId).toBe('ws_test_1');
      expect(res.totalDeals).toBe(2);
      expect(res.totalPipelineValue).toBe(35000);
      expect(res.slotsCount).toBe(2);
      expect(res.daySummaries.length).toBe(1);
      expect(mockGenerateCadencePreview).toHaveBeenCalledTimes(1);
    });
  });

  describe('dealExecuteTaskCadenceTool', () => {
    it('exposes compliant tool metadata and low_risk tier', () => {
      expect(dealExecuteTaskCadenceTool.name).toBe('deal.execute_task_cadence');
      expect(dealExecuteTaskCadenceTool.version).toBe('1.0.0');
      expect(dealExecuteTaskCadenceTool.category).toBe('deal');
      expect(dealExecuteTaskCadenceTool.riskLevel).toBe('low_risk');
      expect(dealExecuteTaskCadenceTool.requiresApproval).toBe(false);
    });

    it('executes scheduled cadence and assigns deals to representatives', async () => {
      mockExecuteCadenceSchedule.mockResolvedValueOnce({
        jobId: 'cadence_ws_test_1_123',
        workspaceId: 'ws_test_1',
        totalDealsProcessed: 2,
        tasksCreatedCount: 2,
        dealsUpdatedCount: 2,
        startDate: '2026-10-10',
        endDate: '2026-10-10',
        executedAt: '2026-10-09T10:00:00.000Z',
        status: 'completed',
      });

      const params = {
        dealIds: ['deal_1', 'deal_2'],
        actionType: 'call' as const,
        taskTitle: 'Discovery Call',
        taskPriority: 'medium' as const,
        startDate: '2026-10-10',
        maxFrequencyPerDay: 5,
        intervalMinutes: 30,
        startTime: '09:00',
        skipWeekends: true,
        assigneeMode: 'round_robin' as const,
        targetAssigneeIds: ['user_1'],
      };

      const res = await dealExecuteTaskCadenceTool.handler(params, mockContext);

      expect(res.jobId).toBe('cadence_ws_test_1_123');
      expect(res.totalDealsProcessed).toBe(2);
      expect(res.tasksCreatedCount).toBe(2);
      expect(res.dealsUpdatedCount).toBe(2);
      expect(res.status).toBe('completed');
      expect(mockExecuteCadenceSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws_test_1',
          organizationId: 'org_test_1',
          dealIds: ['deal_1', 'deal_2'],
          targetAssigneeIds: ['user_1'],
        }),
        'system-agent_cleaner'
      );
    });
  });
});
