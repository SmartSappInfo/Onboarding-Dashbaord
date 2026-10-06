import { describe, it, expect } from 'vitest';
import { TaskCreateInputSchema } from '../task-create.contract';
import { TaskUpdateInputSchema } from '../task-update.contract';

describe('Task Capability Contracts — tagIds schema support (Phase 2)', () => {
  describe('TaskCreateInputSchema', () => {
    it('accepts valid input with optional tagIds array', () => {
      const parsed = TaskCreateInputSchema.parse({
        workspaceId: 'ws_test_123',
        title: 'Complete onboarding walkthrough',
        tagIds: ['tag_urgent', 'tag_customer'],
      });
      expect(parsed.tagIds).toEqual(['tag_urgent', 'tag_customer']);
    });

    it('accepts input without tagIds (backwards compatibility for v1 callers)', () => {
      const parsed = TaskCreateInputSchema.parse({
        workspaceId: 'ws_test_123',
        title: 'Review proposal',
      });
      expect(parsed.tagIds).toBeUndefined();
    });

    it('rejects non-string array for tagIds', () => {
      expect(() =>
        TaskCreateInputSchema.parse({
          workspaceId: 'ws_test_123',
          title: 'Review proposal',
          tagIds: [123, true],
        })
      ).toThrow();
    });
  });

  describe('TaskUpdateInputSchema', () => {
    it('accepts valid update with tagIds', () => {
      const parsed = TaskUpdateInputSchema.parse({
        workspaceId: 'ws_test_123',
        taskId: 'task_abc_456',
        tagIds: ['tag_vip'],
      });
      expect(parsed.tagIds).toEqual(['tag_vip']);
    });

    it('accepts empty tagIds array to clear tags', () => {
      const parsed = TaskUpdateInputSchema.parse({
        workspaceId: 'ws_test_123',
        taskId: 'task_abc_456',
        tagIds: [],
      });
      expect(parsed.tagIds).toEqual([]);
    });
  });
});
