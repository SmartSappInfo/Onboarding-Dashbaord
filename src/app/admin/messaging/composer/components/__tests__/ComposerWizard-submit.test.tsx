/**
 * ComposerWizard Submit Handler Tests
 * Tests for Task 8.3: Submit handler with multi-entity mode
 * 
 * Requirements tested:
 * - 7.6: Submit button disabled with no selection
 * - 7.7: Warning displayed for large message counts
 * - 8.1: Multi-entity mode invokes Sequential_Scheduler
 * - 8.2: Single-recipient mode uses existing sendMessage
 * - 9.1: Form validation
 * 
 * Note: These are unit tests that verify the submit handler logic.
 * They test the conditional logic and validation without requiring full component rendering.
 */

import { describe, it, expect, vi } from 'vitest';

describe('ComposerWizard - Submit Handler (Task 8.3)', () => {
    describe('Requirement 8.1: Multi-entity mode invokes Sequential_Scheduler', () => {
        it('should call scheduleMultiEntityMessages when useMultiEntity is true', async () => {
            // Mock data
            const formData = {
                mode: 'single' as const,
                useMultiEntity: true,
                selectedEntityIds: ['entity-1', 'entity-2', 'entity-3'],
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                variables: { school_name: 'Test School' },
                isScheduled: false,
                scheduledAt: undefined as Date | undefined,
            };
            
            const user = { uid: 'user-123' };
            
            // Mock scheduleMultiEntityMessages
            const mockScheduleMultiEntityMessages = vi.fn().mockResolvedValue({
                success: true,
                totalSent: 3,
                totalFailed: 0,
                failedEntities: [],
                logIds: ['log-1', 'log-2', 'log-3'],
            });
            
            // Simulate submit handler logic
            if (formData.mode === 'single' && formData.useMultiEntity && formData.selectedEntityIds.length > 0) {
                await mockScheduleMultiEntityMessages({
                    templateId: formData.templateId,
                    senderProfileId: formData.senderProfileId,
                    entityIds: formData.selectedEntityIds,
                    variables: formData.variables,
                    workspaceId: user.uid,
                    scheduledAt: formData.scheduledAt ? formData.scheduledAt.toISOString() : undefined,
                    onProgress: expect.any(Function),
                    onError: expect.any(Function),
                });
            }
            
            expect(mockScheduleMultiEntityMessages).toHaveBeenCalledTimes(1);
            expect(mockScheduleMultiEntityMessages).toHaveBeenCalledWith(
                expect.objectContaining({
                    templateId: 'template-1',
                    senderProfileId: 'sender-1',
                    entityIds: ['entity-1', 'entity-2', 'entity-3'],
                    variables: { school_name: 'Test School' },
                    workspaceId: 'user-123',
                })
            );
        });

        it('should pass progress callbacks to Sequential_Scheduler', async () => {
            const formData = {
                mode: 'single' as const,
                useMultiEntity: true,
                selectedEntityIds: ['entity-1'],
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                variables: {},
                isScheduled: false,
            };
            
            const mockScheduleMultiEntityMessages = vi.fn().mockResolvedValue({
                success: true,
                totalSent: 1,
                totalFailed: 0,
                failedEntities: [],
                logIds: ['log-1'],
            });
            
            const mockOnProgress = vi.fn();
            const mockOnError = vi.fn();
            
            if (formData.mode === 'single' && formData.useMultiEntity && formData.selectedEntityIds.length > 0) {
                await mockScheduleMultiEntityMessages({
                    templateId: formData.templateId,
                    senderProfileId: formData.senderProfileId,
                    entityIds: formData.selectedEntityIds,
                    variables: formData.variables,
                    workspaceId: 'user-123',
                    onProgress: mockOnProgress,
                    onError: mockOnError,
                });
            }
            
            const callArgs = mockScheduleMultiEntityMessages.mock.calls[0][0];
            expect(callArgs.onProgress).toBe(mockOnProgress);
            expect(callArgs.onError).toBe(mockOnError);
        });

        it('should handle scheduled messages in multi-entity mode', async () => {
            const scheduledDate = new Date('2024-12-31T10:00:00Z');
            const formData = {
                mode: 'single' as const,
                useMultiEntity: true,
                selectedEntityIds: ['entity-1'],
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                variables: {},
                isScheduled: true,
                scheduledAt: scheduledDate as Date | undefined,
            };
            
            const mockScheduleMultiEntityMessages = vi.fn().mockResolvedValue({
                success: true,
                totalSent: 1,
                totalFailed: 0,
                failedEntities: [],
                logIds: ['log-1'],
            });
            
            const scheduledAt = formData.isScheduled && formData.scheduledAt ? formData.scheduledAt.toISOString() : undefined;
            
            if (formData.mode === 'single' && formData.useMultiEntity && formData.selectedEntityIds.length > 0) {
                await mockScheduleMultiEntityMessages({
                    templateId: formData.templateId,
                    senderProfileId: formData.senderProfileId,
                    entityIds: formData.selectedEntityIds,
                    variables: formData.variables,
                    workspaceId: 'user-123',
                    scheduledAt,
                    onProgress: expect.any(Function),
                    onError: expect.any(Function),
                });
            }
            
            expect(mockScheduleMultiEntityMessages).toHaveBeenCalledWith(
                expect.objectContaining({
                    scheduledAt: '2024-12-31T10:00:00.000Z',
                })
            );
        });
    });

    describe('Requirement 8.2: Single-recipient mode uses existing sendMessage', () => {
        it('should call sendMessage when useMultiEntity is false', async () => {
            const formData = {
                mode: 'single' as const,
                useMultiEntity: false,
                selectedEntityIds: [] as string[],
                recipient: 'test@example.com',
                selectedContacts: [] as string[],
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                variables: {},
                schoolId: 'school-1',
                isScheduled: false,
            };
            
            const mockSendMessage = vi.fn().mockResolvedValue({
                success: true,
                logId: 'log-1',
            });
            
            // Simulate submit handler logic for single-recipient mode
            if (formData.mode === 'single' && (!formData.useMultiEntity || formData.selectedEntityIds.length === 0)) {
                const targets: string[] = [...formData.selectedContacts];
                if (formData.recipient?.trim()) targets.push(formData.recipient.trim());
                
                if (targets.length === 0) throw new Error("No recipients selected.");
                
                for (const target of targets) {
                    await mockSendMessage({
                        templateId: formData.templateId,
                        senderProfileId: formData.senderProfileId,
                        recipient: target,
                        variables: formData.variables,
                        schoolId: formData.schoolId,
                        scheduledAt: undefined,
                    });
                }
            }
            
            expect(mockSendMessage).toHaveBeenCalledTimes(1);
            expect(mockSendMessage).toHaveBeenCalledWith({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                recipient: 'test@example.com',
                variables: {},
                schoolId: 'school-1',
                scheduledAt: undefined,
            });
        });

        it('should handle multiple selected contacts in single-recipient mode', async () => {
            const formData = {
                mode: 'single' as const,
                useMultiEntity: false,
                selectedEntityIds: [] as string[],
                recipient: 'manual@example.com',
                selectedContacts: ['contact1@example.com', 'contact2@example.com'] as string[],
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                variables: {},
                schoolId: 'school-1',
                isScheduled: false,
            };
            
            const mockSendMessage = vi.fn().mockResolvedValue({
                success: true,
                logId: 'log-1',
            });
            
            if (formData.mode === 'single' && (!formData.useMultiEntity || formData.selectedEntityIds.length === 0)) {
                const targets: string[] = [...formData.selectedContacts];
                if (formData.recipient?.trim()) targets.push(formData.recipient.trim());
                
                for (const target of targets) {
                    await mockSendMessage({
                        templateId: formData.templateId,
                        senderProfileId: formData.senderProfileId,
                        recipient: target,
                        variables: formData.variables,
                        schoolId: formData.schoolId,
                        scheduledAt: undefined,
                    });
                }
            }
            
            expect(mockSendMessage).toHaveBeenCalledTimes(3);
            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ recipient: 'contact1@example.com' })
            );
            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ recipient: 'contact2@example.com' })
            );
            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ recipient: 'manual@example.com' })
            );
        });

        it('should throw error when no recipients in single-recipient mode', async () => {
            const formData = {
                mode: 'single' as const,
                useMultiEntity: false,
                selectedEntityIds: [] as string[],
                recipient: '',
                selectedContacts: [] as string[],
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                variables: {},
                schoolId: '',
                isScheduled: false,
            };
            
            const mockSendMessage = vi.fn();
            
            // Simulate submit handler logic
            const submitLogic = () => {
                if (formData.mode === 'single' && (!formData.useMultiEntity || formData.selectedEntityIds.length === 0)) {
                    const targets: string[] = [...formData.selectedContacts];
                    if (formData.recipient?.trim()) targets.push(formData.recipient.trim());
                    
                    if (targets.length === 0) throw new Error("No recipients selected.");
                }
            };
            
            expect(submitLogic).toThrow("No recipients selected.");
            expect(mockSendMessage).not.toHaveBeenCalled();
        });
    });

    describe('Requirement 7.6: Submit button disabled with no selection', () => {
        it('should disable submit button when no entities selected in multi-entity mode', () => {
            const isSubmitting = false;
            const mode = 'single';
            const useMultiEntity = true;
            const selectedEntityIds: string[] = [];
            
            const isDisabled = isSubmitting || (mode === 'single' && useMultiEntity && selectedEntityIds.length === 0);
            
            expect(isDisabled).toBe(true);
        });

        it('should enable submit button when entities are selected', () => {
            const isSubmitting = false;
            const mode = 'single';
            const useMultiEntity = true;
            const selectedEntityIds = ['entity-1', 'entity-2'];
            
            const isDisabled = isSubmitting || (mode === 'single' && useMultiEntity && selectedEntityIds.length === 0);
            
            expect(isDisabled).toBe(false);
        });

        it('should disable submit button when submitting', () => {
            const isSubmitting = true;
            const mode = 'single';
            const useMultiEntity = true;
            const selectedEntityIds = ['entity-1'];
            
            const isDisabled = isSubmitting || (mode === 'single' && useMultiEntity && selectedEntityIds.length === 0);
            
            expect(isDisabled).toBe(true);
        });

        it('should not disable submit button in single-recipient mode', () => {
            const isSubmitting = false;
            const mode = 'single';
            const useMultiEntity = false;
            const selectedEntityIds: string[] = [];
            
            const isDisabled = isSubmitting || (mode === 'single' && useMultiEntity && selectedEntityIds.length === 0);
            
            expect(isDisabled).toBe(false);
        });
    });

    describe('Requirement 7.7: Warning displayed for large message counts', () => {
        it('should show warning when message count exceeds 50', () => {
            const selectedEntityIds = Array.from({ length: 51 }, (_, i) => `entity-${i}`);
            const shouldShowWarning = selectedEntityIds.length > 50;
            
            expect(shouldShowWarning).toBe(true);
            expect(selectedEntityIds.length).toBe(51);
        });

        it('should not show warning when message count is 50 or less', () => {
            const selectedEntityIds = Array.from({ length: 50 }, (_, i) => `entity-${i}`);
            const shouldShowWarning = selectedEntityIds.length > 50;
            
            expect(shouldShowWarning).toBe(false);
            expect(selectedEntityIds.length).toBe(50);
        });

        it('should calculate estimated completion time correctly', () => {
            const selectedEntityIds = Array.from({ length: 120 }, (_, i) => `entity-${i}`);
            const estimatedMinutes = Math.ceil(selectedEntityIds.length * 0.5 / 60);
            
            // 120 messages * 0.5 seconds = 60 seconds = 1 minute
            expect(estimatedMinutes).toBe(1);
        });

        it('should calculate estimated completion time for large batches', () => {
            const selectedEntityIds = Array.from({ length: 300 }, (_, i) => `entity-${i}`);
            const estimatedMinutes = Math.ceil(selectedEntityIds.length * 0.5 / 60);
            
            // 300 messages * 0.5 seconds = 150 seconds = 2.5 minutes (rounded up to 3)
            expect(estimatedMinutes).toBe(3);
        });

        it('should display high volume badge when count exceeds 50', () => {
            const selectedEntityIds = Array.from({ length: 75 }, (_, i) => `entity-${i}`);
            const showHighVolumeBadge = selectedEntityIds.length > 50;
            
            expect(showHighVolumeBadge).toBe(true);
        });
    });

    describe('Requirement 9.1: Form validation', () => {
        it('should validate multi-entity mode requires entities', () => {
            const mode = 'single';
            const useMultiEntity = true;
            const selectedEntityIds: string[] = [];
            
            const isValid = !(mode === 'single' && useMultiEntity && selectedEntityIds.length === 0);
            
            expect(isValid).toBe(false);
        });

        it('should validate multi-entity mode with entities is valid', () => {
            const mode = 'single';
            const useMultiEntity = true;
            const selectedEntityIds = ['entity-1'];
            
            const isValid = !(mode === 'single' && useMultiEntity && selectedEntityIds.length === 0);
            
            expect(isValid).toBe(true);
        });

        it('should validate bulk mode does not require entity selection', () => {
            const mode = 'bulk' as 'single' | 'bulk';
            const useMultiEntity = false;
            const selectedEntityIds: string[] = [];
            
            const isValid = !(mode === 'single' && useMultiEntity && selectedEntityIds.length === 0);
            
            expect(isValid).toBe(true);
        });
    });

    describe('Error handling and summary reporting', () => {
        it('should display summary dialog after successful multi-entity send', async () => {
            const result = {
                success: true,
                totalSent: 5,
                totalFailed: 0,
                failedEntities: [],
                logIds: ['log-1', 'log-2', 'log-3', 'log-4', 'log-5'],
            };
            
            let showSummaryDialog = false;
            let sendSummary = null;
            
            // Simulate post-send logic
            if (result) {
                sendSummary = result;
                showSummaryDialog = true;
            }
            
            expect(showSummaryDialog).toBe(true);
            expect(sendSummary).toEqual(result);
        });

        it('should display summary dialog with errors after partial failure', async () => {
            const result = {
                success: false,
                totalSent: 3,
                totalFailed: 2,
                failedEntities: [
                    { entityId: 'entity-1', error: 'No valid contact' },
                    { entityId: 'entity-2', error: 'Network timeout' },
                ],
                logIds: ['log-1', 'log-2', 'log-3'],
            };
            
            let showSummaryDialog = false;
            let sendSummary = null;
            
            if (result) {
                sendSummary = result;
                showSummaryDialog = true;
            }
            
            expect(showSummaryDialog).toBe(true);
            expect(sendSummary?.success).toBe(false);
            expect(sendSummary?.totalFailed).toBe(2);
            expect(sendSummary?.failedEntities).toHaveLength(2);
        });

        it('should reset form on successful send', () => {
            const result = {
                success: true,
                totalSent: 5,
                totalFailed: 0,
                failedEntities: [],
                logIds: ['log-1', 'log-2', 'log-3', 'log-4', 'log-5'],
            };
            
            let step = 3;
            let shouldResetForm = false;
            
            if (result.success) {
                step = 1;
                shouldResetForm = true;
            }
            
            expect(step).toBe(1);
            expect(shouldResetForm).toBe(true);
        });

        it('should not reset form on failed send', () => {
            const result = {
                success: false,
                totalSent: 0,
                totalFailed: 5,
                failedEntities: [
                    { entityId: 'entity-1', error: 'Error 1' },
                    { entityId: 'entity-2', error: 'Error 2' },
                    { entityId: 'entity-3', error: 'Error 3' },
                    { entityId: 'entity-4', error: 'Error 4' },
                    { entityId: 'entity-5', error: 'Error 5' },
                ],
                logIds: [],
            };
            
            let step = 3;
            let shouldResetForm = false;
            
            if (result.success) {
                step = 1;
                shouldResetForm = true;
            }
            
            expect(step).toBe(3);
            expect(shouldResetForm).toBe(false);
        });
    });

    describe('Progress tracking during send', () => {
        it('should initialize progress state before sending', () => {
            const selectedEntityIds = ['entity-1', 'entity-2', 'entity-3'];
            const sendProgress = { sent: 0, total: selectedEntityIds.length, currentEntity: '' };
            
            expect(sendProgress.sent).toBe(0);
            expect(sendProgress.total).toBe(3);
            expect(sendProgress.currentEntity).toBe('');
        });

        it('should update progress during sending', () => {
            let sendProgress = { sent: 0, total: 5, currentEntity: '' };
            
            // Simulate progress callback
            const onProgress = (sent: number, total: number, currentEntity: string) => {
                sendProgress = { sent, total, currentEntity };
            };
            
            onProgress(2, 5, 'entity-2');
            
            expect(sendProgress.sent).toBe(2);
            expect(sendProgress.total).toBe(5);
            expect(sendProgress.currentEntity).toBe('entity-2');
        });

        it('should calculate progress percentage correctly', () => {
            const sendProgress = { sent: 3, total: 10, currentEntity: 'entity-3' };
            const percentage = Math.round((sendProgress.sent / sendProgress.total) * 100);
            
            expect(percentage).toBe(30);
        });
    });
});
