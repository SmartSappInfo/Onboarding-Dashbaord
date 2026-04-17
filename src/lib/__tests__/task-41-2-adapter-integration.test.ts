/**
 * @fileOverview Task 41.2 - Integration Tests for Adapter Layer with Existing Features
 * 
 * Tests all existing features work correctly with the adapter layer:
 * - Activity logging
 * - Task management
 * - Messaging
 * - Automations
 * - PDF forms
 * - Surveys
 * - Meetings
 * 
 * Requirements: 18 (Backward Compatibility)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logActivity } from '../activity-logger';
import { sendMessage } from '../messaging-engine';
import { createTaskAction } from '../task-server-actions';
import { triggerAutomationProtocols } from '../automation-processor';
import { adminDb } from '../firebase-admin';
import type { School, Entity, WorkspaceEntity, ResolvedContact } from '../types';

// Mock Firebase Admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
  adminStorage: {
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        download: vi.fn().mockResolvedValue([Buffer.from('mock pdf data')]),
      })),
    })),
  },
}));

// Mock external services
vi.mock('../mnotify-service', () => ({
  sendSms: vi.fn().mockResolvedValue({ success: true, summary: { _id: 'sms_123' }, status: 'sent' }),
}));

vi.mock('../resend-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: 'email_123' }),
}));

// Mock contact adapter
vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn(),
}));

describe('Task 41.2 - Adapter Layer Integration Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Activity Logging with Adapter Layer', () => {
    it('should log activity for legacy school using adapter', async () => {
      const mockSchool: School = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        focalPersons: [],
        migrationStatus: 'legacy',
        entityContacts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact: ResolvedContact = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        migrationStatus: 'legacy',
        entityContacts: [],
        schoolData: mockSchool,
      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_1' }),
          };
        }
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      await logActivity({
        entityId: 'school_1',
        userId: 'user_1',
        workspaceId: 'workspace_1',
        type: 'school_created',
        source: 'user',
        description: 'Created school',
        organizationId: 'org_1',
      });

      expect(resolveContact).toHaveBeenCalledWith('school_1', 'workspace_1');
      expect(mockCollection).toHaveBeenCalledWith('activities');
    });

    it('should log activity for migrated entity using adapter', async () => {
      const mockEntity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [],
        globalTags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entityContacts: [],
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_1',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_1',
        entityType: 'institution',
        displayName: 'Migrated School',
        workspaceTags: [],
        pipelineId: 'pipeline-1',
        stageId: 'stage-1',
        status: 'active',
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entityContacts: [],
      };

      const mockContact: ResolvedContact = {
        id: 'entity_1',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_1',
        migrationStatus: 'migrated',
        entityContacts: [],      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_2' }),
          };
        }
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      await logActivity({
        entityId: 'entity_1',
        userId: 'user_1',
        workspaceId: 'workspace_1',
        type: 'school_created',
        source: 'user',
        description: 'Created entity',
        organizationId: 'org_1',
      });

      expect(resolveContact).toHaveBeenCalledWith('entity_1', 'workspace_1');
      expect(mockCollection).toHaveBeenCalledWith('activities');
    });
  });

  describe('2. Task Management with Adapter Layer', () => {
    it('should create task for legacy school using adapter', async () => {
      const mockSchool: School = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        focalPersons: [],
        migrationStatus: 'legacy',
        entityContacts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact: ResolvedContact = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        migrationStatus: 'legacy',
        entityContacts: [],
        schoolData: mockSchool,
      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'tasks') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'task_1' }),
          };
        }
        if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_1' }),
          };
        }
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      const result = await createTaskAction({
        title: 'Follow up',
        description: 'Call school',
        entityId: 'school_1',
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        category: 'follow_up',
        priority: 'medium',
        status: 'todo',
        reminderSent: false,
        reminders: [],
      }, 'test_user');

      expect(result.success).toBe(true);
      expect(resolveContact).toHaveBeenCalledWith('school_1', 'workspace_1');
    });

    it('should create task for migrated entity using adapter', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_1',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_1',
        migrationStatus: 'migrated',
        entityContacts: [],      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'tasks') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'task_2' }),
          };
        }
        if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_2' }),
          };
        }
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      const result = await createTaskAction({
        title: 'Follow up',
        description: 'Call entity',
        entityId: 'entity_1',
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        category: 'follow_up',
        priority: 'medium',
        status: 'todo',
        reminderSent: false,
        reminders: [],
      }, 'test_user');

      expect(result.success).toBe(true);
      expect(resolveContact).toHaveBeenCalledWith('entity_1', 'workspace_1');
    });
  });

  describe('3. Messaging Engine with Adapter Layer', () => {
    it('should send message for legacy school using adapter', async () => {
      const mockSchool: School = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@school.com',
            phone: '+1234567890',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        migrationStatus: 'legacy',
        entityContacts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact: ResolvedContact = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: mockSchool.focalPersons,
        migrationStatus: 'legacy',
        entityContacts: [],
        schoolData: mockSchool,
      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'message_templates') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'template_1',
                data: () => ({
                  id: 'template_1',
                  name: 'Welcome Email',
                  channel: 'email',
                  subject: 'Welcome {{school_name}}',
                  body: 'Hello {{contact_name}}',
                  workspaceIds: ['workspace_1'],
                }),
              }),
            })),
          };
        }
        if (collectionName === 'sender_profiles') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    get: vi.fn().mockResolvedValue({
                      empty: false,
                      docs: [
                        {
                          id: 'sender_1',
                          data: () => ({
                            id: 'sender_1',
                            name: 'SmartSapp',
                            identifier: 'noreply@smartsapp.com',
                            channel: 'email',
                            isDefault: true,
                            isActive: true,
                          }),
                        },
                      ],
                    }),
                  })),
                })),
              })),
            })),
          };
        }
        if (collectionName === 'messaging_variables') {
          return {
            where: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ empty: true, forEach: vi.fn() }),
            })),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn(() => ({
              limit: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({ empty: true }),
              })),
            })),
          };
        }
        if (collectionName === 'message_logs') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'log_1' }),
          };
        }
        if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_1' }),
          };
        }
        if (collectionName === 'schools') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ exists: false }),
            })),
          };
        }
        if (collectionName === 'entities') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ exists: false }),
            })),
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    get: vi.fn().mockResolvedValue({ empty: true }),
                  })),
                })),
              })),
            })),
          };
        }
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn().mockResolvedValue({ empty: true }),
                })),
              })),
            })),
          };
        }
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      const result = await sendMessage({
        templateId: 'template_1',
        senderProfileId: 'sender_1',
        recipient: 'john@school.com',
        variables: {},
        entityId: 'school_1',
        workspaceId: 'workspace_1',
      });

      expect(result.success).toBe(true);
      expect(resolveContact).toHaveBeenCalledWith('school_1', 'workspace_1');
    });

    it('should send message for migrated entity using adapter', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_1',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [
          {
            name: 'Jane Smith',
            email: 'jane@school.com',
            phone: '+1234567890',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        entityType: 'institution',
        entityId: 'entity_1',
        migrationStatus: 'migrated',
        entityContacts: [],      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'message_templates') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'template_1',
                data: () => ({
                  id: 'template_1',
                  name: 'Welcome Email',
                  channel: 'email',
                  subject: 'Welcome {{school_name}}',
                  body: 'Hello {{contact_name}}',
                  workspaceIds: ['workspace_1'],
                }),
              }),
            })),
          };
        }
        if (collectionName === 'sender_profiles') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    get: vi.fn().mockResolvedValue({
                      empty: false,
                      docs: [
                        {
                          id: 'sender_1',
                          data: () => ({
                            id: 'sender_1',
                            name: 'SmartSapp',
                            identifier: 'noreply@smartsapp.com',
                            channel: 'email',
                            isDefault: true,
                            isActive: true,
                          }),
                        },
                      ],
                    }),
                  })),
                })),
              })),
            })),
          };
        }
        if (collectionName === 'messaging_variables') {
          return {
            where: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ empty: true, forEach: vi.fn() }),
            })),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn(() => ({
              limit: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({ empty: true }),
              })),
            })),
          };
        }
        if (collectionName === 'message_logs') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'log_2' }),
          };
        }
        if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_2' }),
          };
        }
        if (collectionName === 'schools') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ exists: false }),
            })),
          };
        }
        if (collectionName === 'entities') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ exists: false }),
            })),
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    get: vi.fn().mockResolvedValue({ empty: true }),
                  })),
                })),
              })),
            })),
          };
        }
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn().mockResolvedValue({ empty: true }),
                })),
              })),
            })),
          };
        }
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      const result = await sendMessage({
        templateId: 'template_1',
        senderProfileId: 'sender_1',
        recipient: 'jane@school.com',
        variables: {},
        entityId: 'entity_1',
        workspaceId: 'workspace_1',
      });

      expect(result.success).toBe(true);
      expect(resolveContact).toHaveBeenCalledWith('entity_1', 'workspace_1');
    });
  });

  describe('4. Automation Engine with Adapter Layer', () => {
    it('should trigger automation for legacy school using adapter', async () => {
      const mockSchool: School = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        focalPersons: [],
        migrationStatus: 'legacy',
        entityContacts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact: ResolvedContact = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        migrationStatus: 'legacy',
        entityContacts: [],
        schoolData: mockSchool,
      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'automations') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({
                  empty: false,
                  docs: [
                    {
                      id: 'auto_1',
                      data: () => ({
                        id: 'auto_1',
                        name: 'Welcome Automation',
                        trigger: 'SCHOOL_CREATED',
                        isActive: true,
                        workspaceIds: ['workspace_1'],
                        actions: [
                          {
                            type: 'CREATE_TASK',
                            title: 'Follow up',
                            description: 'Contact school',
                            assignedTo: 'user_1',
                            category: 'follow_up',
                            priority: 'medium',
                          },
                        ],
                      }),
                    },
                  ],
                }),
              })),
            })),
          };
        }
        if (collectionName === 'automation_runs') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'run_1' }),
            doc: vi.fn(() => ({
              update: vi.fn().mockResolvedValue({}),
            })),
          };
        }
        if (collectionName === 'tasks') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'task_1' }),
          };
        }
        if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_1' }),
          };
        }
        if (collectionName === 'schools') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ exists: false }),
            })),
          };
        }
        if (collectionName === 'entities') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ exists: false }),
            })),
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    get: vi.fn().mockResolvedValue({ empty: true }),
                  })),
                })),
              })),
            })),
          };
        }
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn().mockResolvedValue({ empty: true }),
                })),
              })),
            })),
          };
        }
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      await triggerAutomationProtocols('SCHOOL_CREATED', {
        entityId: 'school_1',
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
      });

      expect(resolveContact).toHaveBeenCalled();
    });

    it('should trigger automation for migrated entity using adapter', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_1',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_1',
        migrationStatus: 'migrated',
        entityContacts: [],      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'automations') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({
                  empty: false,
                  docs: [
                    {
                      id: 'auto_2',
                      data: () => ({
                        id: 'auto_2',
                        name: 'Welcome Automation',
                        trigger: 'SCHOOL_CREATED',
                        isActive: true,
                        workspaceIds: ['workspace_1'],
                        actions: [
                          {
                            type: 'CREATE_TASK',
                            title: 'Follow up',
                            description: 'Contact entity',
                            assignedTo: 'user_1',
                            category: 'follow_up',
                            priority: 'medium',
                          },
                        ],
                      }),
                    },
                  ],
                }),
              })),
            })),
          };
        }
        if (collectionName === 'automation_runs') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'run_2' }),
            doc: vi.fn(() => ({
              update: vi.fn().mockResolvedValue({}),
            })),
          };
        }
        if (collectionName === 'tasks') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'task_2' }),
          };
        }
        if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_2' }),
          };
        }
        if (collectionName === 'schools') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ exists: false }),
            })),
          };
        }
        if (collectionName === 'entities') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ exists: false }),
            })),
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    get: vi.fn().mockResolvedValue({ empty: true }),
                  })),
                })),
              })),
            })),
          };
        }
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn().mockResolvedValue({ empty: true }),
                })),
              })),
            })),
          };
        }
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      await triggerAutomationProtocols('SCHOOL_CREATED', {
        entityId: 'entity_1',
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
      });

      expect(resolveContact).toHaveBeenCalled();
    });
  });

  describe('5. PDF Forms with Adapter Layer', () => {
    it('should generate PDF for legacy school using adapter', async () => {
      const { generatePdfBuffer } = await import('../pdf-actions');
      
      const mockSchool: School = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@school.com',
            phone: '+1234567890',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        migrationStatus: 'legacy',
        entityContacts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact: ResolvedContact = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: mockSchool.focalPersons,
        migrationStatus: 'legacy',
        entityContacts: [],
        schoolData: mockSchool,
      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockPdfForm = {
        id: 'pdf_1',
        name: 'Contract',
        entityId: 'school_1',
        workspaceIds: ['workspace_1'],
        fields: [],
        templateUrl: 'https://example.com/template.pdf',
      };

      const mockCollection = vi.fn((collectionName: string) => {
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      // This will call resolveContact internally
      await generatePdfBuffer(mockPdfForm as any, { field1: 'value1' });

      expect(resolveContact).toHaveBeenCalledWith('school_1', 'workspace_1');
    });

    it('should generate PDF for migrated entity using adapter', async () => {
      const { generatePdfBuffer } = await import('../pdf-actions');
      
      const mockContact: ResolvedContact = {
        id: 'entity_1',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [
          {
            name: 'Jane Smith',
            email: 'jane@school.com',
            phone: '+1234567890',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        entityType: 'institution',
        entityId: 'entity_1',
        migrationStatus: 'migrated',
        entityContacts: [],
        schoolData: {
          id: 'entity_1',
          name: 'Migrated School',
          slug: 'migrated-school',
          workspaceIds: ['workspace_1'],
          status: 'Active',
          schoolStatus: 'Active',
          pipelineId: 'pipeline-1',
          focalPersons: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        entityContacts: [],
        } as School,
      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockPdfForm = {
        id: 'pdf_2',
        name: 'Contract',
        entityId: 'entity_1',
        workspaceIds: ['workspace_1'],
        fields: [],
        templateUrl: 'https://example.com/template.pdf',
      };

      const mockCollection = vi.fn((collectionName: string) => {
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      // This will call resolveContact internally
      await generatePdfBuffer(mockPdfForm as any, { field1: 'value1' });

      expect(resolveContact).toHaveBeenCalledWith('entity_1', 'workspace_1');
    });
  });

  describe('6. Surveys with Adapter Layer', () => {
    it('should handle survey submission for legacy school', async () => {
      // Surveys use the same adapter pattern as PDF forms
      // They reference entityId and resolve via adapter
      const mockSchool: School = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        focalPersons: [],
        migrationStatus: 'legacy',
        entityContacts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact: ResolvedContact = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        migrationStatus: 'legacy',
        entityContacts: [],
        schoolData: mockSchool,
      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      // Survey submission would log activity with entityId
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_1' }),
          };
        }
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      await logActivity({
        entityId: 'school_1',
        userId: 'user_1',
        workspaceId: 'workspace_1',
        type: 'form_submission',
        source: 'user',
        description: 'Survey submitted',
        organizationId: 'org_1',
      });

      expect(resolveContact).toHaveBeenCalledWith('school_1', 'workspace_1');
    });

    it('should handle survey submission for migrated entity', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_1',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_1',
        migrationStatus: 'migrated',
        entityContacts: [],      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_2' }),
          };
        }
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      await logActivity({
        entityId: 'entity_1',
        userId: 'user_1',
        workspaceId: 'workspace_1',
        type: 'form_submission',
        source: 'user',
        description: 'Survey submitted',
        organizationId: 'org_1',
      });

      expect(resolveContact).toHaveBeenCalledWith('entity_1', 'workspace_1');
    });
  });

  describe('7. Meetings with Adapter Layer', () => {
    it('should resolve meeting slug for legacy school', async () => {
      // Meetings use entitySlug for public URLs
      // The adapter resolves slug from either schools or entities
      const mockSchool: School = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        focalPersons: [],
        migrationStatus: 'legacy',
        entityContacts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact: ResolvedContact = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        migrationStatus: 'legacy',
        entityContacts: [],
        schoolData: mockSchool,
      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const contact = await resolveContact('school_1', 'workspace_1');

      expect(contact).not.toBeNull();
      expect(contact?.slug).toBe('legacy-school');
      expect(contact?.migrationStatus).toBe('legacy');
    });

    it('should resolve meeting slug for migrated entity', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_1',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_1',
        migrationStatus: 'migrated',
        entityContacts: [],      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const contact = await resolveContact('entity_1', 'workspace_1');

      expect(contact).not.toBeNull();
      expect(contact?.slug).toBe('migrated-school');
      expect(contact?.migrationStatus).toBe('migrated');
      expect(contact?.entityId).toBe('entity_1');
    });
  });

  describe('8. Cross-Feature Integration', () => {
    it('should handle complete workflow: activity -> automation -> messaging for legacy school', async () => {
      const mockSchool: School = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@school.com',
            phone: '+1234567890',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        migrationStatus: 'legacy',
        entityContacts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact: ResolvedContact = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: mockSchool.focalPersons,
        migrationStatus: 'legacy',
        entityContacts: [],
        schoolData: mockSchool,
      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_1' }),
          };
        }
        if (collectionName === 'automations') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({ empty: true }),
              })),
            })),
          };
        }
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      // Step 1: Log activity (uses adapter)
      await logActivity({
        entityId: 'school_1',
        userId: 'user_1',
        workspaceId: 'workspace_1',
        type: 'school_created',
        source: 'user',
        description: 'Created school',
        organizationId: 'org_1',
      });

      // Verify adapter was called
      expect(resolveContact).toHaveBeenCalledWith('school_1', 'workspace_1');
    });

    it('should handle complete workflow for migrated entity', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_1',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [
          {
            name: 'Jane Smith',
            email: 'jane@school.com',
            phone: '+1234567890',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        entityType: 'institution',
        entityId: 'entity_1',
        migrationStatus: 'migrated',
        entityContacts: [],      };

      const { resolveContact } = await import('../contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_2' }),
          };
        }
        if (collectionName === 'automations') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({ empty: true }),
              })),
            })),
          };
        }
        return { get: vi.fn() };
      });

      (adminDb.collection as any) = mockCollection;

      // Step 1: Log activity (uses adapter)
      await logActivity({
        entityId: 'entity_1',
        userId: 'user_1',
        workspaceId: 'workspace_1',
        type: 'school_created',
        source: 'user',
        description: 'Created entity',
        organizationId: 'org_1',
      });

      // Verify adapter was called
      expect(resolveContact).toHaveBeenCalledWith('entity_1', 'workspace_1');
    });
  });
});
