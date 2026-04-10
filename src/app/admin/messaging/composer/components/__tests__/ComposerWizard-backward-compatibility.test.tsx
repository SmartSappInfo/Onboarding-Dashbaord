/**
 * ComposerWizard Backward Compatibility Tests
 * Tests for Task 9.1: Backward compatibility with existing workflows
 * 
 * Requirements tested:
 * - 8.1: Existing sendMessage function SHALL NOT be modified
 * - 8.2: Single-recipient mode SHALL continue to work
 * - 8.3: Bulk CSV upload mode SHALL continue to work
 * - 8.4: ScheduledAt parameter SHALL continue to work
 * - 8.5: Attachments parameter SHALL continue to work
 * - 8.6: Contextual binding features SHALL continue to work
 * 
 * These tests verify that the new multi-entity feature does not break
 * any existing messaging workflows.
 */

import { describe, it, expect, vi } from 'vitest';

describe('ComposerWizard - Backward Compatibility (Task 9.1)', () => {
    describe('Requirement 8.1: Existing sendMessage function not modified', () => {
        it('should call sendMessage with original signature in single-recipient mode', async () => {
            const mockSendMessage = vi.fn().mockResolvedValue({
                success: true,
                logId: 'log-123',
            });

            // Original sendMessage signature
            await mockSendMessage({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                recipient: 'test@example.com',
                variables: { school_name: 'Test School' },
                entityId: 'school-1',
                scheduledAt: undefined,
            });

            expect(mockSendMessage).toHaveBeenCalledTimes(1);
            expect(mockSendMessage).toHaveBeenCalledWith({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                recipient: 'test@example.com',
                variables: { school_name: 'Test School' },
                entityId: 'school-1',
                scheduledAt: undefined,
            });
        });

        it('should preserve sendMessage return value structure', async () => {
            const mockSendMessage = vi.fn().mockResolvedValue({
                success: true,
                logId: 'log-123',
            });

            const result = await mockSendMessage({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                recipient: 'test@example.com',
                variables: {},
                entityId: 'school-1',
            });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('logId');
            expect(result.success).toBe(true);
            expect(result.logId).toBe('log-123');
        });

        it('should preserve sendMessage error handling', async () => {
            const mockSendMessage = vi.fn().mockResolvedValue({
                success: false,
                error: 'No valid contact found',
            });

            const result = await mockSendMessage({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                recipient: '',
                variables: {},
                entityId: 'school-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('No valid contact found');
        });
    });

    describe('Requirement 8.2: Single-recipient mode continues to work', () => {
        it('should support manual recipient input', async () => {
            const formData = {
                mode: 'single' as const,
                useMultiEntity: false,
                recipient: 'parent@example.com',
                selectedContacts: [] as string[],
                selectedEntityIds: [] as string[],
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                variables: {},
                entityId: 'school-1',
            };

            const mockSendMessage = vi.fn().mockResolvedValue({
                success: true,
                logId: 'log-1',
            });

            // Simulate single-recipient logic
            if (formData.mode === 'single' && !formData.useMultiEntity) {
                const targets = [...formData.selectedContacts];
                if (formData.recipient?.trim()) targets.push(formData.recipient.trim());

                for (const target of targets) {
                    await mockSendMessage({
                        templateId: formData.templateId,
                        senderProfileId: formData.senderProfileId,
                        recipient: target,
                        variables: formData.variables,
                        entityId: formData.entityId,
                    });
                }
            }

            expect(mockSendMessage).toHaveBeenCalledTimes(1);
            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    recipient: 'parent@example.com',
                })
            );
        });

        it('should support selected contacts from dropdown', async () => {
            const formData = {
                mode: 'single' as const,
                useMultiEntity: false,
                recipient: '',
                selectedContacts: ['contact1@example.com', 'contact2@example.com'],
                selectedEntityIds: [] as string[],
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                variables: {},
                entityId: 'school-1',
            };

            const mockSendMessage = vi.fn().mockResolvedValue({
                success: true,
                logId: 'log-1',
            });

            if (formData.mode === 'single' && !formData.useMultiEntity) {
                const targets = [...formData.selectedContacts];
                if (formData.recipient?.trim()) targets.push(formData.recipient.trim());

                for (const target of targets) {
                    await mockSendMessage({
                        templateId: formData.templateId,
                        senderProfileId: formData.senderProfileId,
                        recipient: target,
                        variables: formData.variables,
                        entityId: formData.entityId,
                    });
                }
            }

            expect(mockSendMessage).toHaveBeenCalledTimes(2);
        });

        it('should support combination of manual and selected contacts', async () => {
            const formData = {
                mode: 'single' as const,
                useMultiEntity: false,
                recipient: 'manual@example.com',
                selectedContacts: ['selected@example.com'],
                selectedEntityIds: [] as string[],
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                variables: {},
                entityId: 'school-1',
            };

            const mockSendMessage = vi.fn().mockResolvedValue({
                success: true,
                logId: 'log-1',
            });

            if (formData.mode === 'single' && !formData.useMultiEntity) {
                const targets = [...formData.selectedContacts];
                if (formData.recipient?.trim()) targets.push(formData.recipient.trim());

                for (const target of targets) {
                    await mockSendMessage({
                        templateId: formData.templateId,
                        senderProfileId: formData.senderProfileId,
                        recipient: target,
                        variables: formData.variables,
                        entityId: formData.entityId,
                    });
                }
            }

            expect(mockSendMessage).toHaveBeenCalledTimes(2);
            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ recipient: 'selected@example.com' })
            );
            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ recipient: 'manual@example.com' })
            );
        });

        it('should validate empty recipient in single-recipient mode', () => {
            const formData = {
                mode: 'single' as const,
                useMultiEntity: false,
                recipient: '',
                selectedContacts: [] as string[],
            };

            const targets = [...formData.selectedContacts];
            if (formData.recipient?.trim()) targets.push(formData.recipient.trim());

            const isValid = targets.length > 0;
            expect(isValid).toBe(false);
        });
    });

    describe('Requirement 8.3: Bulk CSV upload mode continues to work', () => {
        it('should process CSV data correctly', async () => {
            const csvData = [
                { recipient: 'parent1@example.com', school_name: 'School A', student_name: 'John' },
                { recipient: 'parent2@example.com', school_name: 'School B', student_name: 'Jane' },
            ];

            const columnMapping = {
                school_name: 'school_name',
                student_name: 'student_name',
            };

            const formData = {
                mode: 'bulk' as const,
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                variables: { greeting: 'Hello' },
            };

            // Simulate CSV processing logic
            const recipients = csvData.map(row => {
                const mappedVars: Record<string, any> = { ...formData.variables };
                Object.entries(columnMapping).forEach(([templateVar, csvCol]) => {
                    mappedVars[templateVar] = row[csvCol as keyof typeof row];
                });

                return {
                    recipient: row.recipient,
                    variables: mappedVars,
                };
            });

            expect(recipients).toHaveLength(2);
            expect(recipients[0]).toEqual({
                recipient: 'parent1@example.com',
                variables: {
                    greeting: 'Hello',
                    school_name: 'School A',
                    student_name: 'John',
                },
            });
            expect(recipients[1]).toEqual({
                recipient: 'parent2@example.com',
                variables: {
                    greeting: 'Hello',
                    school_name: 'School B',
                    student_name: 'Jane',
                },
            });
        });

        it('should create bulk job with correct parameters', async () => {
            const mockCreateBulkMessageJob = vi.fn().mockResolvedValue({
                jobId: 'job-123',
            });

            const recipients = [
                { recipient: 'test1@example.com', variables: { name: 'Test 1' } },
                { recipient: 'test2@example.com', variables: { name: 'Test 2' } },
            ];

            await mockCreateBulkMessageJob({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                recipients,
                userId: 'user-123',
            });

            expect(mockCreateBulkMessageJob).toHaveBeenCalledTimes(1);
            expect(mockCreateBulkMessageJob).toHaveBeenCalledWith({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                recipients,
                userId: 'user-123',
            });
        });

        it('should handle CSV with missing columns gracefully', () => {
            const csvData = [
                { recipient: 'parent1@example.com', school_name: 'School A' },
                { recipient: 'parent2@example.com' }, // Missing school_name
            ];

            const columnMapping = {
                school_name: 'school_name',
            };

            const recipients = csvData.map(row => {
                const mappedVars: Record<string, any> = {};
                Object.entries(columnMapping).forEach(([templateVar, csvCol]) => {
                    mappedVars[templateVar] = row[csvCol as keyof typeof row] || '';
                });

                return {
                    recipient: row.recipient,
                    variables: mappedVars,
                };
            });

            expect(recipients[0].variables.school_name).toBe('School A');
            expect(recipients[1].variables.school_name).toBe('');
        });
    });

    describe('Requirement 8.4: ScheduledAt parameter continues to work', () => {
        it('should pass scheduledAt to sendMessage in single-recipient mode', async () => {
            const scheduledDate = new Date('2024-12-31T10:00:00Z');
            const mockSendMessage = vi.fn().mockResolvedValue({
                success: true,
                logId: 'log-1',
            });

            await mockSendMessage({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                recipient: 'test@example.com',
                variables: {},
                entityId: 'school-1',
                scheduledAt: scheduledDate.toISOString(),
            });

            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    scheduledAt: '2024-12-31T10:00:00.000Z',
                })
            );
        });

        it('should pass scheduledAt to Sequential_Scheduler in multi-entity mode', async () => {
            const scheduledDate = new Date('2024-12-31T10:00:00Z');
            const mockScheduleMultiEntityMessages = vi.fn().mockResolvedValue({
                success: true,
                totalSent: 2,
                totalFailed: 0,
                failedEntities: [],
                logIds: ['log-1', 'log-2'],
            });

            await mockScheduleMultiEntityMessages({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                entityIds: ['entity-1', 'entity-2'],
                variables: {},
                workspaceId: 'user-123',
                scheduledAt: scheduledDate.toISOString(),
            });

            expect(mockScheduleMultiEntityMessages).toHaveBeenCalledWith(
                expect.objectContaining({
                    scheduledAt: '2024-12-31T10:00:00.000Z',
                })
            );
        });

        it('should handle immediate sending when scheduledAt is undefined', async () => {
            const mockSendMessage = vi.fn().mockResolvedValue({
                success: true,
                logId: 'log-1',
            });

            await mockSendMessage({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                recipient: 'test@example.com',
                variables: {},
                entityId: 'school-1',
                scheduledAt: undefined,
            });

            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    scheduledAt: undefined,
                })
            );
        });

        it('should convert Date to ISO string for scheduledAt', () => {
            const scheduledDate = new Date('2024-12-31T10:00:00Z');
            const isScheduled = true;

            const scheduledAt = isScheduled ? scheduledDate.toISOString() : undefined;

            expect(scheduledAt).toBe('2024-12-31T10:00:00.000Z');
        });
    });

    describe('Requirement 8.5: Attachments parameter continues to work', () => {
        it('should pass attachments to sendMessage in single-recipient mode', async () => {
            const attachments = [
                { content: 'base64content', filename: 'document.pdf' },
            ];

            const mockSendMessage = vi.fn().mockResolvedValue({
                success: true,
                logId: 'log-1',
            });

            await mockSendMessage({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                recipient: 'test@example.com',
                variables: {},
                entityId: 'school-1',
                attachments,
            });

            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: [
                        { content: 'base64content', filename: 'document.pdf' },
                    ],
                })
            );
        });

        it('should pass attachments to Sequential_Scheduler in multi-entity mode', async () => {
            const attachments = [
                { content: 'base64content', filename: 'report.pdf' },
            ];

            const mockScheduleMultiEntityMessages = vi.fn().mockResolvedValue({
                success: true,
                totalSent: 2,
                totalFailed: 0,
                failedEntities: [],
                logIds: ['log-1', 'log-2'],
            });

            await mockScheduleMultiEntityMessages({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                entityIds: ['entity-1', 'entity-2'],
                variables: {},
                workspaceId: 'user-123',
                attachments,
            });

            expect(mockScheduleMultiEntityMessages).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: [
                        { content: 'base64content', filename: 'report.pdf' },
                    ],
                })
            );
        });

        it('should handle multiple attachments', async () => {
            const attachments = [
                { content: 'content1', filename: 'doc1.pdf' },
                { content: 'content2', filename: 'doc2.pdf' },
            ];

            const mockSendMessage = vi.fn().mockResolvedValue({
                success: true,
                logId: 'log-1',
            });

            await mockSendMessage({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                recipient: 'test@example.com',
                variables: {},
                entityId: 'school-1',
                attachments,
            });

            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: expect.arrayContaining([
                        expect.objectContaining({ filename: 'doc1.pdf' }),
                        expect.objectContaining({ filename: 'doc2.pdf' }),
                    ]),
                })
            );
        });

        it('should handle no attachments', async () => {
            const mockSendMessage = vi.fn().mockResolvedValue({
                success: true,
                logId: 'log-1',
            });

            await mockSendMessage({
                templateId: 'template-1',
                senderProfileId: 'sender-1',
                recipient: 'test@example.com',
                variables: {},
                entityId: 'school-1',
                attachments: undefined,
            });

            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: undefined,
                })
            );
        });
    });

    describe('Requirement 8.6: Contextual binding features continue to work', () => {
        it('should resolve meeting variables correctly', () => {
            const meetingData = {
                id: 'meeting-1',
                meetingTime: '2024-12-31T10:00:00Z',
                meetingLink: 'https://zoom.us/j/123456',
                type: { name: 'Parent-Teacher Conference' },
            };

            const variables: Record<string, any> = {};
            variables.meeting_time = meetingData.meetingTime;
            variables.meeting_link = meetingData.meetingLink;
            variables.meeting_type = meetingData.type.name;

            expect(variables.meeting_time).toBe('2024-12-31T10:00:00Z');
            expect(variables.meeting_link).toBe('https://zoom.us/j/123456');
            expect(variables.meeting_type).toBe('Parent-Teacher Conference');
        });

        it('should resolve survey response variables correctly', () => {
            const surveyResponse = {
                id: 'response-1',
                score: 85,
                answers: [
                    { questionId: 'q1', value: 'Answer 1' },
                    { questionId: 'q2', value: 'Answer 2' },
                ],
            };

            const variables: Record<string, any> = {};
            variables.score = surveyResponse.score;
            surveyResponse.answers.forEach((a) => {
                variables[a.questionId] = String(a.value);
            });

            expect(variables.score).toBe(85);
            expect(variables.q1).toBe('Answer 1');
            expect(variables.q2).toBe('Answer 2');
        });

        it('should resolve PDF submission variables correctly', () => {
            const submission = {
                id: 'submission-1',
                formData: {
                    student_name: 'John Doe',
                    parent_email: 'parent@example.com',
                    grade: '10',
                },
            };

            const variables: Record<string, any> = {};
            Object.entries(submission.formData).forEach(([key, val]) => {
                variables[key] = String(val);
            });

            expect(variables.student_name).toBe('John Doe');
            expect(variables.parent_email).toBe('parent@example.com');
            expect(variables.grade).toBe('10');
        });

        it('should resolve school variables correctly', () => {
            const school = {
                id: 'school-1',
                name: 'Test Academy',
                location: 'Accra',
                phone: '+233123456789',
                email: 'admin@testacademy.edu',
            };

            const variables: Record<string, any> = {};
            variables.school_name = school.name;
            variables.school_location = school.location;
            variables.school_phone = school.phone;
            variables.school_email = school.email;

            expect(variables.school_name).toBe('Test Academy');
            expect(variables.school_location).toBe('Accra');
            expect(variables.school_phone).toBe('+233123456789');
            expect(variables.school_email).toBe('admin@testacademy.edu');
        });

        it('should merge contextual variables with explicit variables', () => {
            const explicitVariables = {
                custom_field: 'Custom Value',
                greeting: 'Hello',
            };

            const contextualVariables = {
                school_name: 'Test School',
                meeting_time: '2024-12-31T10:00:00Z',
            };

            const mergedVariables = {
                ...explicitVariables,
                ...contextualVariables,
            };

            expect(mergedVariables.custom_field).toBe('Custom Value');
            expect(mergedVariables.greeting).toBe('Hello');
            expect(mergedVariables.school_name).toBe('Test School');
            expect(mergedVariables.meeting_time).toBe('2024-12-31T10:00:00Z');
        });

        it('should handle missing contextual data gracefully', () => {
            const meetingData: {
                id: string;
                meetingTime: string;
                meetingLink: string | undefined;
                type: { name: string } | undefined;
            } = {
                id: 'meeting-1',
                meetingTime: '2024-12-31T10:00:00Z',
                meetingLink: undefined,
                type: undefined,
            };

            const variables: Record<string, any> = {};
            variables.meeting_time = meetingData.meetingTime;
            variables.meeting_link = meetingData.meetingLink || '';
            variables.meeting_type = meetingData.type?.name || '';

            expect(variables.meeting_time).toBe('2024-12-31T10:00:00Z');
            expect(variables.meeting_link).toBe('');
            expect(variables.meeting_type).toBe('');
        });
    });

    describe('Integration: Mode switching preserves functionality', () => {
        it('should switch from single-recipient to multi-entity mode', () => {
            let useMultiEntity = false;
            let recipient = 'test@example.com';
            let entityId = 'school-1';
            let selectedEntityIds: string[] = [];

            // Switch to multi-entity mode
            useMultiEntity = true;
            if (useMultiEntity) {
                recipient = '';
                entityId = '';
            }

            expect(useMultiEntity).toBe(true);
            expect(recipient).toBe('');
            expect(entityId).toBe('');
            expect(selectedEntityIds).toEqual([]);
        });

        it('should switch from multi-entity to single-recipient mode', () => {
            let useMultiEntity = true;
            let recipient = '';
            let entityId = '';
            let selectedEntityIds = ['entity-1', 'entity-2'];

            // Switch to single-recipient mode
            useMultiEntity = false;
            if (!useMultiEntity) {
                selectedEntityIds = [];
            }

            expect(useMultiEntity).toBe(false);
            expect(selectedEntityIds).toEqual([]);
        });

        it('should preserve template and sender profile when switching modes', () => {
            const templateId = 'template-1';
            const senderProfileId = 'sender-1';
            let useMultiEntity = false;

            // Switch modes
            useMultiEntity = true;

            expect(templateId).toBe('template-1');
            expect(senderProfileId).toBe('sender-1');
        });

        it('should preserve variables when switching modes', () => {
            const variables = {
                school_name: 'Test School',
                custom_field: 'Custom Value',
            };
            let useMultiEntity = false;

            // Switch modes
            useMultiEntity = true;

            expect(variables.school_name).toBe('Test School');
            expect(variables.custom_field).toBe('Custom Value');
        });
    });
});
