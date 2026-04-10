import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scheduleMultiEntityMessages } from '../sequential-scheduler';
import type { ScheduleMessageInput } from '../sequential-scheduler';
import * as messagingEngine from '../messaging-engine';

// Mock the messaging-engine module
vi.mock('../messaging-engine', () => ({
  sendMessage: vi.fn()
}));

describe('Sequential_Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scheduleMultiEntityMessages', () => {
    it('should successfully send messages to all entities sequentially', async () => {
      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage.mockResolvedValue({ success: true, logId: 'log-123' });

      const input: ScheduleMessageInput = {
        templateId: 'template-1',
        senderProfileId: 'sender-1',
        entityIds: ['entity-1', 'entity-2', 'entity-3'],
        variables: { test: 'value' },
        delayMs: 10 // Short delay for testing
      };

      // Act
      const result = await scheduleMultiEntityMessages(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalSent).toBe(3);
      expect(result.totalFailed).toBe(0);
      expect(result.failedEntities).toHaveLength(0);
      expect(result.logIds).toHaveLength(3);
      expect(mockSendMessage).toHaveBeenCalledTimes(3);

      // Verify each call had correct parameters
      expect(mockSendMessage).toHaveBeenNthCalledWith(1, {
        templateId: 'template-1',
        senderProfileId: 'sender-1',
        recipient: '',
        variables: { test: 'value' },
        attachments: undefined,
        entityId: 'entity-1',
        workspaceId: undefined,
        scheduledAt: undefined
      });
    });

    it('should handle individual message failures and continue processing', async () => {
      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage
        .mockResolvedValueOnce({ success: true, logId: 'log-1' })
        .mockResolvedValueOnce({ success: false, error: 'No valid contact found' })
        .mockResolvedValueOnce({ success: true, logId: 'log-3' });

      const onErrorMock = vi.fn();
      const input: ScheduleMessageInput = {
        templateId: 'template-1',
        senderProfileId: 'sender-1',
        entityIds: ['entity-1', 'entity-2', 'entity-3'],
        variables: {},
        delayMs: 10,
        onError: onErrorMock
      };

      // Act
      const result = await scheduleMultiEntityMessages(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.totalSent).toBe(2);
      expect(result.totalFailed).toBe(1);
      expect(result.failedEntities).toHaveLength(1);
      expect(result.failedEntities[0]).toEqual({
        entityId: 'entity-2',
        error: 'No valid contact found'
      });
      expect(result.logIds).toHaveLength(2);
      expect(onErrorMock).toHaveBeenCalledWith('entity-2', 'No valid contact found');
      expect(mockSendMessage).toHaveBeenCalledTimes(3);
    });

    it('should invoke progress callback after each message', async () => {
      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage.mockResolvedValue({ success: true, logId: 'log-123' });

      const onProgressMock = vi.fn();
      const input: ScheduleMessageInput = {
        templateId: 'template-1',
        senderProfileId: 'sender-1',
        entityIds: ['entity-1', 'entity-2'],
        variables: {},
        delayMs: 10,
        onProgress: onProgressMock
      };

      // Act
      await scheduleMultiEntityMessages(input);

      // Assert
      expect(onProgressMock).toHaveBeenCalledTimes(2);
      expect(onProgressMock).toHaveBeenNthCalledWith(1, 1, 2, 'entity-1');
      expect(onProgressMock).toHaveBeenNthCalledWith(2, 2, 2, 'entity-2');
    });

    it('should reject when queue size exceeds 500 messages', async () => {
      // Arrange
      const entityIds = Array.from({ length: 501 }, (_, i) => `entity-${i}`);
      const input: ScheduleMessageInput = {
        templateId: 'template-1',
        senderProfileId: 'sender-1',
        entityIds,
        variables: {}
      };

      // Act & Assert
      await expect(scheduleMultiEntityMessages(input)).rejects.toThrow(
        'Maximum queue size of 500 messages exceeded'
      );
    });

    it('should pass attachments to sendMessage', async () => {
      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage.mockResolvedValue({ success: true, logId: 'log-123' });

      const attachments = [
        { content: 'base64content', filename: 'document.pdf' }
      ];

      const input: ScheduleMessageInput = {
        templateId: 'template-1',
        senderProfileId: 'sender-1',
        entityIds: ['entity-1'],
        variables: {},
        attachments,
        delayMs: 10
      };

      // Act
      await scheduleMultiEntityMessages(input);

      // Assert
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments
        })
      );
    });

    it('should pass workspaceId to sendMessage', async () => {
      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage.mockResolvedValue({ success: true, logId: 'log-123' });

      const input: ScheduleMessageInput = {
        templateId: 'template-1',
        senderProfileId: 'sender-1',
        entityIds: ['entity-1'],
        variables: {},
        workspaceId: 'workspace-123',
        delayMs: 10
      };

      // Act
      await scheduleMultiEntityMessages(input);

      // Assert
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-123'
        })
      );
    });

    it('should pass scheduledAt to sendMessage', async () => {
      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage.mockResolvedValue({ success: true, logId: 'log-123' });

      const scheduledAt = new Date('2024-12-31T10:00:00Z').toISOString();
      const input: ScheduleMessageInput = {
        templateId: 'template-1',
        senderProfileId: 'sender-1',
        entityIds: ['entity-1'],
        variables: {},
        scheduledAt,
        delayMs: 10
      };

      // Act
      await scheduleMultiEntityMessages(input);

      // Assert
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledAt
        })
      );
    });

    it('should handle exceptions thrown by sendMessage', async () => {
      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage
        .mockResolvedValueOnce({ success: true, logId: 'log-1' })
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({ success: true, logId: 'log-3' });

      const onErrorMock = vi.fn();
      const input: ScheduleMessageInput = {
        templateId: 'template-1',
        senderProfileId: 'sender-1',
        entityIds: ['entity-1', 'entity-2', 'entity-3'],
        variables: {},
        delayMs: 10,
        onError: onErrorMock
      };

      // Act
      const result = await scheduleMultiEntityMessages(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.totalSent).toBe(2);
      expect(result.totalFailed).toBe(1);
      expect(result.failedEntities[0]).toEqual({
        entityId: 'entity-2',
        error: 'Network timeout'
      });
      expect(onErrorMock).toHaveBeenCalledWith('entity-2', 'Network timeout');
    });

    it('should use default delay of 500ms when not specified', async () => {
      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage.mockResolvedValue({ success: true, logId: 'log-123' });

      const input: ScheduleMessageInput = {
        templateId: 'template-1',
        senderProfileId: 'sender-1',
        entityIds: ['entity-1', 'entity-2'],
        variables: {}
        // delayMs not specified - should default to 500ms
      };

      const startTime = Date.now();

      // Act
      await scheduleMultiEntityMessages(input);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Assert
      // Should take at least 500ms (one delay between two messages)
      // Allow some tolerance for execution time
      expect(elapsed).toBeGreaterThanOrEqual(450);
    });

    it('should handle empty entityIds array', async () => {
      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);

      const input: ScheduleMessageInput = {
        templateId: 'template-1',
        senderProfileId: 'sender-1',
        entityIds: [],
        variables: {}
      };

      // Act
      const result = await scheduleMultiEntityMessages(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalSent).toBe(0);
      expect(result.totalFailed).toBe(0);
      expect(result.failedEntities).toHaveLength(0);
      expect(result.logIds).toHaveLength(0);
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should pass empty recipient string to sendMessage', async () => {
      // Arrange
      const mockSendMessage = vi.mocked(messagingEngine.sendMessage);
      mockSendMessage.mockResolvedValue({ success: true, logId: 'log-123' });

      const input: ScheduleMessageInput = {
        templateId: 'template-1',
        senderProfileId: 'sender-1',
        entityIds: ['entity-1'],
        variables: {},
        delayMs: 10
      };

      // Act
      await scheduleMultiEntityMessages(input);

      // Assert
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: '' // Empty string - sendMessage resolves from entityId
        })
      );
    });
  });
});
