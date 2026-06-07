// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logStepExecution } from '../automations/step-logger';

const mockUpdate = vi.fn();
const mockGet = vi.fn();

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'automation_runs') {
        return {
          doc: vi.fn(() => ({
            get: mockGet,
            update: mockUpdate,
          })),
        };
      }
      return {};
    }),
  },
}));

describe('Automation Step Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('atomically merges a new step with metadata', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        steps: {},
      }),
    });
    mockUpdate.mockResolvedValue(undefined);

    await logStepExecution('run-1', {
      nodeId: 'node-action-1',
      nodeType: 'actionNode',
      nodeLabel: 'Send email',
      status: 'success',
      executedAt: '2026-06-07T00:00:00.000Z',
      durationMs: 100,
      metadata: { actionType: 'SEND_MESSAGE' },
    });

    expect(mockGet).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      'steps.node-action-1': {
        nodeId: 'node-action-1',
        nodeType: 'actionNode',
        nodeLabel: 'Send email',
        status: 'success',
        executedAt: '2026-06-07T00:00:00.000Z',
        durationMs: 100,
        metadata: { actionType: 'SEND_MESSAGE' },
      },
    });
  });

  it('merges new metadata with existing metadata (preserves delayUntil)', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        steps: {
          'node-delay-1': {
            nodeId: 'node-delay-1',
            status: 'waiting',
            metadata: { delayUntil: '2026-06-07T00:15:00.000Z' },
          },
        },
      }),
    });
    mockUpdate.mockResolvedValue(undefined);

    await logStepExecution('run-1', {
      nodeId: 'node-delay-1',
      nodeType: 'delayNode',
      nodeLabel: 'Wait 15m',
      status: 'success',
      executedAt: '2026-06-07T00:05:00.000Z',
      metadata: { resumedAt: '2026-06-07T04:00:00.000Z' },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      'steps.node-delay-1': {
        nodeId: 'node-delay-1',
        nodeType: 'delayNode',
        nodeLabel: 'Wait 15m',
        status: 'success',
        executedAt: '2026-06-07T00:05:00.000Z',
        metadata: {
          delayUntil: '2026-06-07T00:15:00.000Z',
          resumedAt: '2026-06-07T04:00:00.000Z',
        },
      },
    });
  });

  it('stops logging and writes __overflow when step count reaches 500', async () => {
    // Generate 500 dummy steps
    const largeSteps = {};
    for (let i = 0; i < 500; i++) {
      largeSteps[`node-${i}`] = { nodeId: `node-${i}` };
    }

    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        steps: largeSteps,
      }),
    });
    mockUpdate.mockResolvedValue(undefined);

    await logStepExecution('run-1', {
      nodeId: 'node-501',
      nodeType: 'actionNode',
      status: 'success',
      executedAt: '2026-06-07T00:00:00.000Z',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      'steps.__overflow': true,
    });
  });

  it('immediately returns if __overflow is already set', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        steps: {
          __overflow: true,
        },
      }),
    });

    await logStepExecution('run-1', {
      nodeId: 'node-502',
      nodeType: 'actionNode',
      status: 'success',
      executedAt: '2026-06-07T00:00:00.000Z',
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('swallows firesore update errors to prevent execution failures', async () => {
    mockGet.mockRejectedValue(new Error('Firestore permission denied'));

    // Should not throw or crash
    await expect(
      logStepExecution('run-1', {
        nodeId: 'node-1',
        nodeType: 'actionNode',
        status: 'success',
      })
    ).resolves.not.toThrow();
  });
});
