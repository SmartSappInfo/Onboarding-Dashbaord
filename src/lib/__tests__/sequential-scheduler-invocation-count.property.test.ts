import { describe, it, expect, vi, beforeEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { scheduleMultiEntityMessages } from '../sequential-scheduler';
import type { ScheduleMessageInput } from '../sequential-scheduler';
import * as messagingEngine from '../messaging-engine';

// Mock the messaging-engine module
vi.mock('../messaging-engine', () => ({
  sendMessage: vi.fn()
}));

describe('Sequential_Scheduler Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 7: Sequential Scheduler Invocation Count', () => {
    test.prop([
      fc.array(fc.string(), { minLength: 1, maxLength: 100 })
    ])('should invoke sendMessage exactly N times for N entities', async (entityIds) => {
      // Feature: multi-contact-messaging
      // Property 7: For any list of N entities, the Sequential_Scheduler should invoke 
      // sendMessage exactly N times, once per entity
      // Validates: Requirements 3.1

      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage.mockResolvedValue({ success: true, logId: 'log-123' });

      const input: ScheduleMessageInput = {
        templateId: 'test-template',
        senderProfileId: 'test-sender',
        entityIds,
        variables: {},
        delayMs: 0 // No delay for faster property testing
      };

      // Act
      await scheduleMultiEntityMessages(input);

      // Assert
      expect(mockSendMessage).toHaveBeenCalledTimes(entityIds.length);
    });

    test.prop([
      fc.array(fc.string(), { minLength: 1, maxLength: 100 })
    ])('should call sendMessage with correct schoolId for each entity', async (entityIds) => {
      // Feature: multi-contact-messaging
      // Property 7 (extended): Each sendMessage call should receive the correct schoolId
      // Validates: Requirements 3.1, 3.3

      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage.mockResolvedValue({ success: true, logId: 'log-123' });

      const input: ScheduleMessageInput = {
        templateId: 'test-template',
        senderProfileId: 'test-sender',
        entityIds,
        variables: {},
        delayMs: 0
      };

      // Act
      await scheduleMultiEntityMessages(input);

      // Assert
      // Verify each entity was passed as schoolId parameter
      entityIds.forEach((entityId, index) => {
        expect(mockSendMessage).toHaveBeenNthCalledWith(
          index + 1,
          expect.objectContaining({
            schoolId: entityId
          })
        );
      });
    });

    test.prop([
      fc.array(fc.string(), { minLength: 1, maxLength: 50 }),
      fc.record({
        templateId: fc.string(),
        senderProfileId: fc.string(),
        variables: fc.dictionary(fc.string(), fc.string())
      })
    ])('should invoke sendMessage N times regardless of input parameters', async (entityIds, params) => {
      // Feature: multi-contact-messaging
      // Property 7 (invariant): Invocation count should equal entity count regardless of other parameters
      // Validates: Requirements 3.1

      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage.mockResolvedValue({ success: true, logId: 'log-123' });

      const input: ScheduleMessageInput = {
        templateId: params.templateId,
        senderProfileId: params.senderProfileId,
        entityIds,
        variables: params.variables,
        delayMs: 0
      };

      // Act
      await scheduleMultiEntityMessages(input);

      // Assert
      expect(mockSendMessage).toHaveBeenCalledTimes(entityIds.length);
    });

    test.prop([
      fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 20 }),
      fc.integer({ min: 0, max: 100 }) // Random failure index
    ])('should invoke sendMessage N times even when some calls fail', async (entityIds, failureSeed) => {
      // Feature: multi-contact-messaging
      // Property 7 (resilience): Invocation count should equal entity count even with failures
      // Validates: Requirements 3.1, 4.3

      // Arrange
      const failureIndex = failureSeed % entityIds.length;
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      
      let callIndex = 0;
      mockSendMessage.mockImplementation(async (input) => {
        const currentCallIndex = callIndex++;
        if (currentCallIndex === failureIndex) {
          return { success: false, error: 'Simulated failure' };
        }
        return { success: true, logId: `log-${currentCallIndex}` };
      });

      const input: ScheduleMessageInput = {
        templateId: 'test-template',
        senderProfileId: 'test-sender',
        entityIds,
        variables: {},
        delayMs: 0
      };

      // Act
      const result = await scheduleMultiEntityMessages(input);

      // Assert
      expect(mockSendMessage).toHaveBeenCalledTimes(entityIds.length);
      expect(result.totalSent).toBe(entityIds.length - 1);
      expect(result.totalFailed).toBe(1);
    });

    test.prop([
      fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 20 }),
      fc.integer({ min: 0, max: 100 }) // Random exception index
    ])('should invoke sendMessage N times even when some calls throw exceptions', async (entityIds, exceptionSeed) => {
      // Feature: multi-contact-messaging
      // Property 7 (exception resilience): Invocation count should equal entity count even with exceptions
      // Validates: Requirements 3.1, 4.3, 9.3

      // Arrange
      const exceptionIndex = exceptionSeed % entityIds.length;
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      
      let callIndex = 0;
      mockSendMessage.mockImplementation(async (input) => {
        const currentCallIndex = callIndex++;
        if (currentCallIndex === exceptionIndex) {
          throw new Error('Network timeout');
        }
        return { success: true, logId: `log-${currentCallIndex}` };
      });

      const input: ScheduleMessageInput = {
        templateId: 'test-template',
        senderProfileId: 'test-sender',
        entityIds,
        variables: {},
        delayMs: 0
      };

      // Act
      const result = await scheduleMultiEntityMessages(input);

      // Assert
      expect(mockSendMessage).toHaveBeenCalledTimes(entityIds.length);
      expect(result.totalSent).toBe(entityIds.length - 1);
      expect(result.totalFailed).toBe(1);
    });

    it('should handle edge case: single entity', async () => {
      // Feature: multi-contact-messaging
      // Property 7 (edge case): Single entity should result in exactly one invocation
      // Validates: Requirements 3.1

      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage.mockResolvedValue({ success: true, logId: 'log-123' });

      const input: ScheduleMessageInput = {
        templateId: 'test-template',
        senderProfileId: 'test-sender',
        entityIds: ['single-entity'],
        variables: {},
        delayMs: 0
      };

      // Act
      await scheduleMultiEntityMessages(input);

      // Assert
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    it('should handle edge case: maximum allowed entities (100)', async () => {
      // Feature: multi-contact-messaging
      // Property 7 (edge case): Maximum entities should result in exactly 100 invocations
      // Validates: Requirements 3.1, 1.5

      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage.mockResolvedValue({ success: true, logId: 'log-123' });

      const entityIds = Array.from({ length: 100 }, (_, i) => `entity-${i}`);
      const input: ScheduleMessageInput = {
        templateId: 'test-template',
        senderProfileId: 'test-sender',
        entityIds,
        variables: {},
        delayMs: 0
      };

      // Act
      await scheduleMultiEntityMessages(input);

      // Assert
      expect(mockSendMessage).toHaveBeenCalledTimes(100);
    });
  });
});
