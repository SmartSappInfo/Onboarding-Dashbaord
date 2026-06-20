// @vitest-environment node
// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { updateCallScriptAction } from '../call-centre-actions';

const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'call_scripts') {
        return {
          doc: vi.fn(() => ({
            update: mockUpdate,
          })),
        };
      }
      if (name === 'call_campaigns') {
        return {
          where: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [
                {
                  ref: { id: 'camp_1' },
                  data: () => ({ id: 'camp_1', status: 'draft', scriptId: 'script_123' }),
                },
                {
                  ref: { id: 'camp_2' },
                  data: () => ({ id: 'camp_2', status: 'active', scriptId: 'script_123' }),
                },
                {
                  ref: { id: 'camp_3' },
                  data: () => ({ id: 'camp_3', status: 'completed', scriptId: 'script_123' }),
                },
              ],
            }),
          })),
        };
      }
      return {};
    }),
    batch: vi.fn(() => ({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    })),
  },
}));

vi.mock('../workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Dynamic Script Propagation', () => {
  it('propagates script content only to draft/active campaigns', async () => {
    mockBatchUpdate.mockClear();
    mockBatchCommit.mockClear();
    mockUpdate.mockClear();

    const result = await updateCallScriptAction(
      'script_123',
      {
        workspaceId: 'ws_1',
        content: 'New Dynamic Content',
      },
      'user_123'
    );

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
    // Out of draft, active, completed, only draft and active should update (2 targets)
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalled();
  });
});
