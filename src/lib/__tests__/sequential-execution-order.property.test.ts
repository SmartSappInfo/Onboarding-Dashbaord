import { describe, it, expect, vi, beforeEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { scheduleMultiEntityMessages } from '../sequential-scheduler';
import type { ScheduleMessageInput } from '../sequential-scheduler';
import * as messagingEngine from '../messaging-engine';

// Mock the messaging-engine module
vi.mock('../messaging-engine', () => ({
  sendMessage: vi.fn()
}));

describe('Sequential_Scheduler Property Tests - Execution Order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 11: Sequential Execution Order', () => {
    test.prop([
      fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 10 })
    ])('should complete each sendMessage call before starting the next', async (entityIds) => {
      // Feature: multi-contact-messaging
      // Property 11: For any list of messages in the queue, each sendMessage call 
      // should complete before the next sendMessage call begins
      // Validates: Requirements 4.1, 4.2

      // Arrange
      const executionOrder: string[] = [];
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      
      mockSendMessage.mockImplementation(async (input) => {
        const entityId = input.schoolId || 'unknown';
        executionOrder.push(`start-${entityId}`);
        
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));
        
        executionOrder.push(`end-${entityId}`);
        return { success: true, logId: `log-${entityId}` };
      });

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
      // Verify sequential execution: each end should come before next start
      for (let i = 0; i < entityIds.length - 1; i++) {
        const currentEndIndex = executionOrder.indexOf(`end-${entityIds[i]}`);
        const nextStartIndex = executionOrder.indexOf(`start-${entityIds[i + 1]}`);
        
        expect(currentEndIndex).toBeLessThan(nextStartIndex);
      }
    });

    test.prop([
      fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 10 })
    ])('should maintain sequential order even with varying execution times', async (entityIds) => {
      // Feature: multi-contact-messaging
      // Property 11 (timing variance): Sequential order should be maintained regardless 
      // of individual message execution times
      // Validates: Requirements 4.1, 4.2

      // Arrange
      const executionOrder: string[] = [];
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      
      let callIndex = 0;
      mockSendMessage.mockImplementation(async (input) => {
        const entityId = input.schoolId || 'unknown';
        const currentCallIndex = callIndex++;
        
        executionOrder.push(`start-${entityId}`);
        
        // Vary execution time: some fast, some slow
        const delay = currentCallIndex % 2 === 0 ? 5 : 20;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        executionOrder.push(`end-${entityId}`);
        return { success: true, logId: `log-${entityId}` };
      });

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
      // Verify no overlapping execution
      for (let i = 0; i < entityIds.length - 1; i++) {
        const currentEndIndex = executionOrder.indexOf(`end-${entityIds[i]}`);
        const nextStartIndex = executionOrder.indexOf(`start-${entityIds[i + 1]}`);
        
        expect(currentEndIndex).toBeLessThan(nextStartIndex);
      }
    });

    test.prop([
      fc.array(fc.string({ minLength: 1 }), { minLength: 3, maxLength: 15 }),
      fc.integer({ min: 0, max: 100 }) // Random failure index
    ])('should maintain sequential order even when some messages fail', async (entityIds, failureSeed) => {
      // Feature: multi-contact-messaging
      // Property 11 (error resilience): Sequential order should be maintained even 
      // when individual messages fail
      // Validates: Requirements 4.1, 4.2, 4.3

      // Arrange
      const failureIndex = failureSeed % entityIds.length;
      const executionOrder: string[] = [];
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      
      let callIndex = 0;
      mockSendMessage.mockImplementation(async (input) => {
        const entityId = input.schoolId || 'unknown';
        const currentCallIndex = callIndex++;
        
        executionOrder.push(`start-${entityId}`);
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push(`end-${entityId}`);
        
        if (currentCallIndex === failureIndex) {
          return { success: false, error: 'Simulated failure' };
        }
        return { success: true, logId: `log-${entityId}` };
      });

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
      // Verify sequential execution continues despite failure
      for (let i = 0; i < entityIds.length - 1; i++) {
        const currentEndIndex = executionOrder.indexOf(`end-${entityIds[i]}`);
        const nextStartIndex = executionOrder.indexOf(`start-${entityIds[i + 1]}`);
        
        expect(currentEndIndex).toBeLessThan(nextStartIndex);
      }
    });

    test.prop([
      fc.array(fc.string({ minLength: 1 }), { minLength: 3, maxLength: 15 }),
      fc.integer({ min: 0, max: 100 }) // Random exception index
    ])('should maintain sequential order even when some messages throw exceptions', async (entityIds, exceptionSeed) => {
      // Feature: multi-contact-messaging
      // Property 11 (exception resilience): Sequential order should be maintained even 
      // when individual messages throw exceptions
      // Validates: Requirements 4.1, 4.2, 4.3, 9.3

      // Arrange
      const exceptionIndex = exceptionSeed % entityIds.length;
      const executionOrder: string[] = [];
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      
      let callIndex = 0;
      mockSendMessage.mockImplementation(async (input) => {
        const entityId = input.schoolId || 'unknown';
        const currentCallIndex = callIndex++;
        
        executionOrder.push(`start-${entityId}`);
        
        if (currentCallIndex === exceptionIndex) {
          executionOrder.push(`end-${entityId}`);
          throw new Error('Network timeout');
        }
        
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push(`end-${entityId}`);
        return { success: true, logId: `log-${entityId}` };
      });

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
      // Verify sequential execution continues despite exception
      for (let i = 0; i < entityIds.length - 1; i++) {
        const currentEndIndex = executionOrder.indexOf(`end-${entityIds[i]}`);
        const nextStartIndex = executionOrder.indexOf(`start-${entityIds[i + 1]}`);
        
        expect(currentEndIndex).toBeLessThan(nextStartIndex);
      }
    });

    it('should execute messages in the exact order provided', async () => {
      // Feature: multi-contact-messaging
      // Property 11 (order preservation): Messages should be executed in the exact 
      // order they appear in the entityIds array
      // Validates: Requirements 4.1, 4.2

      // Arrange
      const entityIds = ['entity-1', 'entity-2', 'entity-3', 'entity-4'];
      const executionOrder: string[] = [];
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      
      mockSendMessage.mockImplementation(async (input) => {
        const entityId = input.schoolId || 'unknown';
        executionOrder.push(entityId);
        await new Promise(resolve => setTimeout(resolve, 5));
        return { success: true, logId: `log-${entityId}` };
      });

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
      expect(executionOrder).toEqual(entityIds);
    });

    it('should not have overlapping execution windows', async () => {
      // Feature: multi-contact-messaging
      // Property 11 (non-overlapping): No two sendMessage calls should execute 
      // simultaneously
      // Validates: Requirements 4.1, 4.2

      // Arrange
      const entityIds = ['entity-1', 'entity-2', 'entity-3'];
      const activeExecutions = new Set<string>();
      const maxConcurrent = { value: 0 };
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      
      mockSendMessage.mockImplementation(async (input) => {
        const entityId = input.schoolId || 'unknown';
        
        // Track active executions
        activeExecutions.add(entityId);
        maxConcurrent.value = Math.max(maxConcurrent.value, activeExecutions.size);
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        activeExecutions.delete(entityId);
        return { success: true, logId: `log-${entityId}` };
      });

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
      // Maximum concurrent executions should never exceed 1
      expect(maxConcurrent.value).toBe(1);
    });

    test.prop([
      fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 10 }),
      fc.integer({ min: 0, max: 1000 }) // Configurable delay
    ])('should respect inter-message delay without breaking sequential order', async (entityIds, delayMs) => {
      // Feature: multi-contact-messaging
      // Property 11 (with delay): Sequential order should be maintained regardless 
      // of configured delay between messages
      // Validates: Requirements 4.1, 4.2, 4.4

      // Arrange
      const executionOrder: string[] = [];
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      
      mockSendMessage.mockImplementation(async (input) => {
        const entityId = input.schoolId || 'unknown';
        executionOrder.push(`start-${entityId}`);
        await new Promise(resolve => setTimeout(resolve, 5));
        executionOrder.push(`end-${entityId}`);
        return { success: true, logId: `log-${entityId}` };
      });

      const input: ScheduleMessageInput = {
        templateId: 'test-template',
        senderProfileId: 'test-sender',
        entityIds,
        variables: {},
        delayMs: Math.min(delayMs, 100) // Cap at 100ms for test performance
      };

      // Act
      await scheduleMultiEntityMessages(input);

      // Assert
      // Verify sequential execution with delay
      for (let i = 0; i < entityIds.length - 1; i++) {
        const currentEndIndex = executionOrder.indexOf(`end-${entityIds[i]}`);
        const nextStartIndex = executionOrder.indexOf(`start-${entityIds[i + 1]}`);
        
        expect(currentEndIndex).toBeLessThan(nextStartIndex);
      }
    });
  });
});
