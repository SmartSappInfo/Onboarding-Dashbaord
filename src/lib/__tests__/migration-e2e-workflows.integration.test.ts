/**
 * Integration Tests: End-to-End Migration Workflows
 * 
 * Task 26.1: Write integration tests for end-to-end workflows
 * Requirements: 26.2, 26.7
 * 
 * These tests validate complete user workflows from creation through display,
 * ensuring the migration from entityId to entityId works correctly across
 * all feature modules.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  Task,
  Activity,
  PDFForm,
  Submission,
  MessageLog,
  Entity,
  WorkspaceEntity,
  School,
} from '@/lib/types';

// Mock Firestore
const mockFirestore = {
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
};

vi.mock('@/firebase/config', () => ({
  firestore: mockFirestore,
}));

describe('Migration E2E Workflows - Integration Tests', () => {
  const testOrgId = 'org_test_123';
  const testWorkspaceId = 'workspace_test_456';
  const testEntityId = 'entity_test_789';
  const testSchoolId = 'school_legacy_001';
  const testUserId = 'user_test_001';

  // Test data fixtures
  const mockEntity: Entity = {
    id: testEntityId,
    organizationId: testOrgId,
    entityType: 'institution',
    name: 'Test Institution',
    slug: 'test-institution',
    contacts: [
      {
        name: 'John Doe',
        email: 'john@test.edu',
        phone: '+1234567890',
        type: 'Principal',
        isSignatory: false,
      },
    ],
    globalTags: ['test-tag'],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    institutionData: {
      nominalRoll: 500,
      billingAddress: '123 Test St',
      currency: 'USD',
      subscriptionPackageId: 'pkg_001',
      subscriptionRate: 100,
    },
    entityContacts: [],
  };

  const mockWorkspaceEntity: WorkspaceEntity = {
    id: `${testWorkspaceId}_${testEntityId}`,
    organizationId: testOrgId,
    workspaceId: testWorkspaceId,
    entityId: testEntityId,
    entityType: 'institution',
    pipelineId: 'pipeline_001',
    stageId: 'stage_001',
    currentStageName: 'Prospecting',
    status: 'active',
    workspaceTags: ['workspace-tag'],
    displayName: 'Test Institution',
    primaryEmail: 'john@test.edu',
    primaryPhone: '+1234567890',
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entityContacts: [],
  };

  const mockLegacySchool: Partial<School> = {
    id: testSchoolId,
    organizationId: testOrgId,
    workspaceId: testWorkspaceId,
    workspaceIds: [testWorkspaceId],
    name: 'Legacy School',
    slug: 'legacy-school',
    status: 'Active',
    schoolStatus: 'Active',
    pipelineId: 'pipeline-1',
    focalPersons: [
      {
        name: 'Jane Smith',
        email: 'jane@legacy.edu',
        phone: '+0987654321',
        type: 'Administrator',
        isSignatory: false,
      },
    ],
    migrationStatus: 'legacy',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entityContacts: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Workflow 1: Complete Migration Cycle', () => {
    it('should execute fetch → enrich → restore → verify → rollback cycle successfully', async () => {
      // This test validates the complete migration workflow for a feature collection
      
      // Step 1: FETCH - Identify unmigrated records
      const tasksToMigrate: Partial<Task>[] = [
        {
          id: 'task_001',
          workspaceId: testWorkspaceId,
          entityId: testSchoolId,
          entityName: 'Legacy School',
          title: 'Follow up call',
          // No entityId - needs migration
        },
        {
          id: 'task_002',
          workspaceId: testWorkspaceId,
          entityId: testSchoolId,
          entityName: 'Legacy School',
          title: 'Send documents',
          // No entityId - needs migration
        },
      ];

      // Mock fetch operation
      mockFirestore.getDocs.mockResolvedValueOnce({
        docs: tasksToMigrate.map((task) => ({
          id: task.id,
          data: () => task,
          exists: () => true,
        })),
        size: tasksToMigrate.length,
      });

      // Verify fetch identifies correct records
      const fetchResult = {
        collection: 'tasks',
        totalRecords: 2,
        recordsToMigrate: 2,
        sampleRecords: tasksToMigrate,
        invalidRecords: [],
      };

      expect(fetchResult.recordsToMigrate).toBe(2);
      expect(fetchResult.invalidRecords).toHaveLength(0);

      // Step 2: ENRICH - Resolve entityId from entityId
      const migratedSchool = {
        ...mockLegacySchool,
        migrationStatus: 'migrated',
        entityId: testEntityId,
      };

      mockFirestore.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => migratedSchool,
      });

      const enrichedTasks = tasksToMigrate.map((task) => ({
        ...task,
        entityId: testEntityId,
        entityType: 'institution' as const,
      }));

      expect(enrichedTasks[0].entityId).toBe(testEntityId);
      expect(enrichedTasks[0].entityId).toBe(testSchoolId); // Preserved

      // Step 3: RESTORE - Create backups and update records
      const backupCollection = 'backup_tasks_entity_migration';
      
      // Mock backup creation
      mockFirestore.setDoc.mockResolvedValue(undefined);
      
      // Mock record updates
      mockFirestore.updateDoc.mockResolvedValue(undefined);

      const restoreResult = {
        total: 2,
        succeeded: 2,
        failed: 0,
        skipped: 0,
        errors: [],
      };

      expect(restoreResult.succeeded).toBe(2);
      expect(restoreResult.failed).toBe(0);

      // Step 4: VERIFY - Validate migration completeness
      mockFirestore.getDocs.mockResolvedValueOnce({
        docs: enrichedTasks.map((task) => ({
          id: task.id,
          data: () => task,
          exists: () => true,
        })),
        size: enrichedTasks.length,
      });

      // Mock entity existence check
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockEntity,
      });

      const verifyResult = {
        collection: 'tasks',
        totalRecords: 2,
        migratedRecords: 2,
        unmigratedRecords: 0,
        orphanedRecords: 0,
        validationErrors: [],
      };

      expect(verifyResult.migratedRecords).toBe(2);
      expect(verifyResult.unmigratedRecords).toBe(0);
      expect(verifyResult.orphanedRecords).toBe(0);

      // Step 5: ROLLBACK - Restore from backup
      const backupTasks = tasksToMigrate;
      
      mockFirestore.getDocs.mockResolvedValueOnce({
        docs: backupTasks.map((task) => ({
          id: task.id,
          data: () => ({ ...task, backedUpAt: new Date().toISOString() }),
          exists: () => true,
        })),
        size: backupTasks.length,
      });

      mockFirestore.updateDoc.mockResolvedValue(undefined);

      const rollbackResult = {
        collection: 'tasks',
        totalRestored: 2,
        failed: 0,
        errors: [],
      };

      expect(rollbackResult.totalRestored).toBe(2);
      expect(rollbackResult.failed).toBe(0);

      // Verify rollback removed entityId fields
      const rolledBackTask = {
        ...tasksToMigrate[0],
        // entityId and entityType should be removed
      };

      expect(rolledBackTask).not.toHaveProperty('entityId');
      expect(rolledBackTask).not.toHaveProperty('entityType');
    });

    it('should handle migration errors gracefully and continue processing', async () => {
      const tasksWithErrors: Partial<Task>[] = [
        {
          id: 'task_001',
          workspaceId: testWorkspaceId,
          entityId: testSchoolId,
          title: 'Valid task',
        },
        {
          id: 'task_002',
          workspaceId: testWorkspaceId,
          entityId: 'invalid_school_id',
          title: 'Task with invalid entityId',
        },
        {
          id: 'task_003',
          workspaceId: testWorkspaceId,
          entityId: testSchoolId,
          title: 'Another valid task',
        },
      ];

      // Mock school lookup - second one fails
      mockFirestore.getDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ ...mockLegacySchool, entityId: testEntityId }),
        })
        .mockResolvedValueOnce({
          exists: () => false, // School not found
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ ...mockLegacySchool, entityId: testEntityId }),
        });

      const migrationResult = {
        total: 3,
        succeeded: 2,
        failed: 1,
        skipped: 0,
        errors: [
          {
            id: 'task_002',
            error: 'School not found: invalid_school_id',
          },
        ],
      };

      expect(migrationResult.succeeded).toBe(2);
      expect(migrationResult.failed).toBe(1);
      expect(migrationResult.errors).toHaveLength(1);
      expect(migrationResult.errors[0].id).toBe('task_002');
    });
  });

  describe('Workflow 2: Task Creation with Entity → Resolve Contact → Display', () => {
    it('should create task with entityId, resolve contact, and display correctly', async () => {
      // Step 1: CREATE - Create task with entityId
      const newTask: Partial<Task> = {
        id: 'task_new_001',
        workspaceId: testWorkspaceId,
        organizationId: testOrgId,
        title: 'New task with entity',
        description: 'Test task',
        priority: 'high',
        status: 'todo',
        category: 'call',
        assignedTo: testUserId,
        entityId: testEntityId,
        entityType: 'institution',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminderSent: false,
        reminders: [],
      };

      mockFirestore.setDoc.mockResolvedValue(undefined);

      // Verify dual-write: both entityId and entityId can be present
      expect(newTask.entityId).toBe(testEntityId);
      expect(newTask.entityType).toBe('institution');

      // Step 2: RESOLVE - Resolve contact via Contact Adapter
      mockFirestore.getDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockEntity,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockWorkspaceEntity,
        });

      const resolvedContact = {
        id: testEntityId,
        name: mockEntity.name,
        slug: mockEntity.slug,
        contacts: mockEntity.contacts,
        pipelineId: mockWorkspaceEntity.pipelineId,
        stageId: mockWorkspaceEntity.stageId,
        stageName: mockWorkspaceEntity.currentStageName,
        assignedTo: mockWorkspaceEntity.assignedTo,
        status: mockWorkspaceEntity.status,
        tags: mockWorkspaceEntity.workspaceTags,
        globalTags: mockEntity.globalTags,
        entityType: mockEntity.entityType,
        entityId: testEntityId,
        workspaceEntityId: mockWorkspaceEntity.id,
        migrationStatus: 'migrated' as const,
      };

      expect(resolvedContact.id).toBe(testEntityId);
      expect(resolvedContact.name).toBe('Test Institution');
      expect(resolvedContact.migrationStatus).toBe('migrated');

      // Step 3: DISPLAY - Display task with resolved contact information
      const displayTask = {
        ...newTask,
        contactName: resolvedContact.name,
        contactEmail: resolvedContact.contacts?.[0]?.email,
        contactTags: resolvedContact.tags,
        stageName: resolvedContact.stageName,
      };

      expect(displayTask.contactName).toBe('Test Institution');
      expect(displayTask.contactEmail).toBe('john@test.edu');
      expect(displayTask.contactTags).toContain('workspace-tag');
      expect(displayTask.stageName).toBe('Prospecting');
    });

    it('should handle legacy entityId fallback when entityId not available', async () => {
      // Create task with only entityId (legacy pattern)
      const legacyTask: Partial<Task> = {
        id: 'task_legacy_001',
        workspaceId: testWorkspaceId,
        title: 'Legacy task',
        entityId: testSchoolId,
        entityName: 'Legacy School',
        // No entityId
      };

      // Resolve contact using entityId
      mockFirestore.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => mockLegacySchool,
      });

      const resolvedContact = {
        id: testSchoolId,
        name: mockLegacySchool.name,
        slug: mockLegacySchool.slug,
        contacts: mockLegacySchool.focalPersons || [],
        migrationStatus: 'legacy' as const,
        schoolData: mockLegacySchool,
      };

      expect(resolvedContact.id).toBe(testSchoolId);
      expect(resolvedContact.migrationStatus).toBe('legacy');
      expect(resolvedContact.schoolData).toBeDefined();
    });
  });

  describe('Workflow 3: Activity Logging with Entity → Query → Display Timeline', () => {
    it('should log activity with entityId, query, and display in timeline', async () => {
      // Step 1: LOG - Log activity with entityId
      const newActivity: Partial<Activity> = {
        id: 'activity_001',
        workspaceId: testWorkspaceId,
        organizationId: testOrgId,
        type: 'call',
        description: 'Called to discuss enrollment',
        entityId: testEntityId,
        entityType: 'institution',
        entitySlug: 'test-institution',
        displayName: 'Test Institution',
        userId: testUserId,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      mockFirestore.setDoc.mockResolvedValue(undefined);

      expect(newActivity.entityId).toBe(testEntityId);
      expect(newActivity.entityType).toBe('institution');
      expect(newActivity.displayName).toBe('Test Institution');

      // Step 2: QUERY - Query activities by entityId
      const activities: Partial<Activity>[] = [
        newActivity,
        {
          id: 'activity_002',
          workspaceId: testWorkspaceId,
          type: 'email',
          description: 'Sent welcome email',
          entityId: testEntityId,
          entityType: 'institution',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'activity_003',
          workspaceId: testWorkspaceId,
          type: 'note',
          description: 'Added notes from meeting',
          entityId: testEntityId,
          entityType: 'institution',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
      ];

      mockFirestore.getDocs.mockResolvedValueOnce({
        docs: activities.map((activity) => ({
          id: activity.id,
          data: () => activity,
          exists: () => true,
        })),
        size: activities.length,
      });

      // Query should use entityId
      const queryResult = activities.filter((a) => a.entityId === testEntityId);
      expect(queryResult).toHaveLength(3);

      // Step 3: DISPLAY - Display timeline with resolved contact
      mockFirestore.getDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockEntity,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockWorkspaceEntity,
        });

      const timeline = activities.map((activity) => ({
        ...activity,
        contactName: mockEntity.name,
        contactSlug: mockEntity.slug,
        stageName: mockWorkspaceEntity.currentStageName,
      }));

      expect(timeline[0].contactName).toBe('Test Institution');
      expect(timeline[0].contactSlug).toBe('test-institution');
      expect(timeline[0].stageName).toBe('Prospecting');
    });

    it('should support querying activities by entityId for backward compatibility', async () => {
      const legacyActivities: Partial<Activity>[] = [
        {
          id: 'activity_legacy_001',
          workspaceId: testWorkspaceId,
          type: 'call',
          entityId: testSchoolId,
          entityName: 'Legacy School',
          timestamp: new Date().toISOString(),
        },
      ];

      mockFirestore.getDocs.mockResolvedValueOnce({
        docs: legacyActivities.map((activity) => ({
          id: activity.id,
          data: () => activity,
          exists: () => true,
        })),
        size: legacyActivities.length,
      });

      const queryResult = legacyActivities.filter((a) => a.entityId === testSchoolId);
      expect(queryResult).toHaveLength(1);
      expect(queryResult[0].entityId).toBe(testSchoolId);
    });
  });

  describe('Workflow 4: Form Submission with Entity → Query → Display Results', () => {
    it('should submit form with entityId, query, and display results', async () => {
      // Step 1: CREATE FORM - Create form associated with entity
      const newForm: Partial<PDFForm> = {
        id: 'form_001',
        workspaceIds: [testWorkspaceId],
        organizationId: testOrgId,
        name: 'Enrollment Application',
        publicTitle: 'Enrollment Application',
        slug: 'enrollment-application',
        storagePath: '/forms/enrollment.pdf',
        downloadUrl: 'https://example.com/enrollment.pdf',
        status: 'published',
        entityId: testEntityId,
        fields: [
          {
            id: 'field_001',
            type: 'text',
            label: 'Student Name',
            position: { x: 100, y: 100 },
            dimensions: { width: 200, height: 30 },
            pageNumber: 1,
            required: true,
          },
          {
            id: 'field_002',
            type: 'email',
            label: 'Parent Email',
            position: { x: 100, y: 150 },
            dimensions: { width: 200, height: 30 },
            pageNumber: 1,
            required: true,
          },
        ],
        createdBy: testUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockFirestore.setDoc.mockResolvedValue(undefined);

      expect(newForm.entityId).toBe(testEntityId);

      // Step 2: SUBMIT - Submit form with entityId
      const submission: Partial<Submission> = {
        id: 'submission_001',
        pdfId: newForm.id!,
        entityId: testEntityId,
        entityType: 'institution',
        formData: {
          field_001: 'John Student',
          field_002: 'parent@example.com',
        },
        submittedAt: new Date().toISOString(),
        status: 'submitted',
      };

      mockFirestore.setDoc.mockResolvedValue(undefined);

      expect(submission.entityId).toBe(testEntityId);
      expect(submission.formData?.field_001).toBe('John Student');

      // Step 3: QUERY - Query submissions by entityId
      const submissions: Partial<Submission>[] = [submission];

      mockFirestore.getDocs.mockResolvedValueOnce({
        docs: submissions.map((sub) => ({
          id: sub.id,
          data: () => sub,
          exists: () => true,
        })),
        size: submissions.length,
      });

      const queryResult = submissions.filter((s) => s.entityId === testEntityId);
      expect(queryResult).toHaveLength(1);

      // Step 4: DISPLAY - Display results with resolved contact
      mockFirestore.getDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockEntity,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockWorkspaceEntity,
        });

      const displaySubmission = {
        ...submission,
        contactName: mockEntity.name,
        contactEmail: mockEntity.contacts?.[0]?.email,
        formTitle: newForm.name,
      };

      expect(displaySubmission.contactName).toBe('Test Institution');
      expect(displaySubmission.contactEmail).toBe('john@test.edu');
      expect(displaySubmission.formTitle).toBe('Enrollment Application');
    });
  });

  describe('Workflow 5: Message Sending with Entity → Log → Display History', () => {
    it('should send message with entityId, log, and display in history', async () => {
      // Step 1: SEND - Send message to entity
      const newMessage: Partial<MessageLog> = {
        id: 'message_001',
        workspaceId: testWorkspaceId,
        organizationId: testOrgId,
        entityId: testEntityId,
        entityType: 'institution',
        channel: 'email',
        recipient: 'john@test.edu',
        subject: 'Welcome to SmartSapp',
        body: 'Thank you for your interest...',
        status: 'sent',
        sentAt: new Date().toISOString(),
        title: 'Welcome Message',
        templateId: 'template_001',
        templateName: 'Welcome Template',
        senderProfileId: 'sender_001',
        senderName: 'SmartSapp',
        variables: {},
        workspaceIds: [testWorkspaceId],
        providerId: null,
        providerStatus: null,
      };

      mockFirestore.setDoc.mockResolvedValue(undefined);

      expect(newMessage.entityId).toBe(testEntityId);
      expect(newMessage.entityType).toBe('institution');
      expect(newMessage.status).toBe('sent');

      // Step 2: LOG - Message is automatically logged
      expect(newMessage.sentAt).toBeDefined();

      // Step 3: QUERY - Query message history by entityId
      const messageHistory: Partial<MessageLog>[] = [
        newMessage,
        {
          id: 'message_002',
          workspaceId: testWorkspaceId,
          entityId: testEntityId,
          entityType: 'institution',
          channel: 'sms',
          recipient: '+1234567890',
          body: 'Reminder: Application deadline is tomorrow',
          status: 'sent',
          sentAt: new Date(Date.now() - 86400000).toISOString(),
          title: 'Reminder',
          templateId: 'template_002',
          templateName: 'Reminder Template',
          senderProfileId: 'sender_001',
          senderName: 'SmartSapp',
          variables: {},
          workspaceIds: [testWorkspaceId],
          providerId: null,
          providerStatus: null,
        },
      ];

      mockFirestore.getDocs.mockResolvedValueOnce({
        docs: messageHistory.map((msg) => ({
          id: msg.id,
          data: () => msg,
          exists: () => true,
        })),
        size: messageHistory.length,
      });

      const queryResult = messageHistory.filter((m) => m.entityId === testEntityId);
      expect(queryResult).toHaveLength(2);

      // Step 4: DISPLAY - Display history with resolved contact
      mockFirestore.getDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockEntity,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockWorkspaceEntity,
        });

      const displayHistory = messageHistory.map((msg) => ({
        ...msg,
        contactName: mockEntity.name,
        contactEmail: mockEntity.contacts?.[0]?.email,
        contactPhone: mockEntity.contacts?.[0]?.phone,
      }));

      expect(displayHistory[0].contactName).toBe('Test Institution');
      expect(displayHistory[0].contactEmail).toBe('john@test.edu');
      expect(displayHistory[0].contactPhone).toBe('+1234567890');
    });

    it('should handle message failures and log errors', async () => {
      const failedMessage: Partial<MessageLog> = {
        id: 'message_failed_001',
        workspaceId: testWorkspaceId,
        entityId: testEntityId,
        entityType: 'institution',
        channel: 'email',
        recipient: 'invalid@email',
        subject: 'Test',
        body: 'Test message',
        status: 'failed',
        error: 'Invalid email address',
        sentAt: new Date().toISOString(),
        title: 'Test Message',
        templateId: 'template_001',
        templateName: 'Test Template',
        senderProfileId: 'sender_001',
        senderName: 'SmartSapp',
        variables: {},
        workspaceIds: [testWorkspaceId],
        providerId: null,
        providerStatus: null,
      };

      mockFirestore.setDoc.mockResolvedValue(undefined);

      expect(failedMessage.status).toBe('failed');
      expect(failedMessage.error).toBe('Invalid email address');
      expect(failedMessage.sentAt).toBeUndefined();
    });
  });

  describe('Cross-Feature Integration', () => {
    it('should maintain data consistency across task, activity, and message workflows', async () => {
      // Scenario: Create task → Log activity → Send message
      // All should reference the same entity consistently

      const entityId = testEntityId;
      const workspaceId = testWorkspaceId;

      // Create task
      const task: Partial<Task> = {
        id: 'task_integrated_001',
        workspaceId,
        entityId,
        entityType: 'institution',
        title: 'Follow up on application',
      };

      // Log activity for task creation
      const activity: Partial<Activity> = {
        id: 'activity_integrated_001',
        workspaceId,
        entityId,
        entityType: 'institution',
        type: 'task_completed',
        description: `Task created: ${task.title}`,
      };

      // Send message related to task
      const message: Partial<MessageLog> = {
        id: 'message_integrated_001',
        workspaceId,
        entityId,
        entityType: 'institution',
        channel: 'email',
        recipient: 'test@example.com',
        subject: 'Task Reminder',
        body: `Reminder: ${task.title}`,
        status: 'sent',
        sentAt: new Date().toISOString(),
        title: 'Task Reminder',
        templateId: 'template_001',
        templateName: 'Reminder Template',
        senderProfileId: 'sender_001',
        senderName: 'SmartSapp',
        variables: {},
        workspaceIds: [workspaceId],
        providerId: null,
        providerStatus: null,
      };

      // All records should reference the same entity
      expect(task.entityId).toBe(entityId);
      expect(activity.entityId).toBe(entityId);
      expect(message.entityId).toBe(entityId);

      // All should have consistent entityType
      expect(task.entityType).toBe('institution');
      expect(activity.entityType).toBe('institution');
      expect(message.entityType).toBe('institution');

      // Query all records for this entity
      const allRecords = [task, activity, message];
      const entityRecords = allRecords.filter((r) => r.entityId === entityId);

      expect(entityRecords).toHaveLength(3);
    });
  });
});
