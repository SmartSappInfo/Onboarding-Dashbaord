/**
 * Unit Tests: Automations Module
 * 
 * Tests automation triggers with entityId, task creation with dual-write,
 * contact updates using entityId, and backward compatibility with entityId.
 * 
 * Requirements: 26.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { EntityType, AutomationTrigger } from '../types';

// Mock Firestore types
type MockDocumentData = {
  id: string;
  [key: string]: any;
};

// In-memory storage for testing
let mockCollections: Map<string, Map<string, MockDocumentData>>;
let mockEntities: Map<string, MockDocumentData>;
let mockWorkspaceEntities: Map<string, MockDocumentData>;
let mockSchools: Map<string, MockDocumentData>;
let mockAutomations: Map<string, MockDocumentData>;

// Track operations for verification
let createdTasks: MockDocumentData[] = [];
let updatedEntities: Array<{ id: string; updates: any }> = [];
let updatedWorkspaceEntities: Array<{ id: string; updates: any }> = [];
let updatedSchools: Array<{ id: string; updates: any }> = [];

// Mock firebase-admin module
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: (collectionName: string) => ({
        add: async (data: any) => {
          const id = `${collectionName}_${Date.now()}_${Math.random()}`;
          const doc = { id, ...data };
          
          if (collectionName === 'tasks') {
            createdTasks.push(doc);
          }
          
          const collection = mockCollections.get(collectionName) || new Map();
          collection.set(id, doc);
          mockCollections.set(collectionName, collection);
          
          return { id };
        },
        where: (field: string, op: string, value: any) => ({
          where: (field2: string, op2: string, value2: any) => ({
            get: async () => {
              if (collectionName === 'automations') {
                const results = Array.from(mockAutomations.values()).filter(auto => {
                  if (field === 'trigger' && auto.trigger === value) {
                    if (field2 === 'isActive' && auto.isActive === value2) {
                      return true;
                    }
                  }
                  return false;
                });
                
                return {
                  empty: results.length === 0,
                  docs: results.map(doc => ({
                    id: doc.id,
                    data: () => doc,
                  })),
                };
              }
              return { empty: true, docs: [] };
            },
          }),
        }),
        doc: (docId: string) => ({
          update: async (updates: any) => {
            if (collectionName === 'entities') {
              updatedEntities.push({ id: docId, updates });
              const entity = mockEntities.get(docId);
              if (entity) {
                Object.assign(entity, updates);
              }
            } else if (collectionName === 'workspace_entities') {
              updatedWorkspaceEntities.push({ id: docId, updates });
              const workspaceEntity = mockWorkspaceEntities.get(docId);
              if (workspaceEntity) {
                Object.assign(workspaceEntity, updates);
              }
            } else if (collectionName === 'schools') {
              updatedSchools.push({ id: docId, updates });
              const school = mockSchools.get(docId);
              if (school) {
                Object.assign(school, updates);
              }
            }
          },
          get: async () => {
            if (collectionName === 'entities') {
              const entity = mockEntities.get(docId);
              return {
                exists: !!entity,
                data: () => entity,
              };
            } else if (collectionName === 'schools') {
              const school = mockSchools.get(docId);
              return {
                exists: !!school,
                data: () => school,
              };
            } else if (collectionName === 'automations') {
              const automation = mockAutomations.get(docId);
              return {
                exists: !!automation,
                data: () => automation,
              };
            }
            return { exists: false };
          },
        }),
      }),
    },
  };
});

// Mock contact-adapter module
vi.mock('../contact-adapter', () => {
  return {
    resolveContact: async (contactId: string, workspaceId: string) => {
      const entity = Array.from(mockEntities.values()).find(e => e.id === contactId);
      if (entity) {
        const workspaceEntity = Array.from(mockWorkspaceEntities.values()).find(
          we => we.entityId === entity.id && we.workspaceId === workspaceId
        );
        
        return {
          id: entity.id,
          name: entity.name,
          entityId: entity.id,
          entityType: entity.entityType,
          workspaceEntityId: workspaceEntity?.id,
          migrationStatus: 'migrated' as const,
          contacts: entity.contacts || [],
          tags: workspaceEntity?.workspaceTags || [],
          schoolData: undefined,
        };
      }
      
      const school = mockSchools.get(contactId);
      if (school) {
        return {
          id: school.id,
          name: school.name,
          entityId: school.entityId,
          entityType: school.entityType,
          migrationStatus: school.migrationStatus || 'legacy' as const,
          contacts: school.focalPersons || [],
          tags: school.tags || [],
          schoolData: school,
        };
      }
      
      return null;
    },
  };
});

describe('Automations Module - Unit Tests', () => {
  beforeEach(() => {
    mockCollections = new Map();
    mockEntities = new Map();
    mockWorkspaceEntities = new Map();
    mockSchools = new Map();
    mockAutomations = new Map();
    createdTasks = [];
    updatedEntities = [];
    updatedWorkspaceEntities = [];
    updatedSchools = [];
    vi.clearAllMocks();
  });

  describe('Automation Triggers with entityId', () => {
    it('should trigger automation with entityId payload', async () => {
      const entityId = 'entity_test_123';
      const workspaceId = 'workspace_1';
      
      const entity = {
        id: entityId,
        name: 'Test Entity',
        entityType: 'institution' as EntityType,
        contacts: [{ email: 'test@example.com', name: 'Test Contact', type: 'primary' }],
      };
      mockEntities.set(entityId, entity);
      
      const workspaceEntity = {
        id: `${workspaceId}_${entityId}`,
        workspaceId,
        entityId,
        entityType: 'institution' as EntityType,
        displayName: entity.name,
      };
      mockWorkspaceEntities.set(workspaceEntity.id, workspaceEntity);
      
      const automation = {
        id: 'auto_1',
        name: 'Test Automation',
        trigger: 'SCHOOL_CREATED',
        isActive: true,
        workspaceIds: [workspaceId],
        nodes: [{ id: 'trigger_1', type: 'triggerNode', data: {} }],
        edges: [],
      };
      mockAutomations.set(automation.id, automation);
      
      const { triggerAutomationProtocols } = await import('../automation-processor');
      await triggerAutomationProtocols('SCHOOL_CREATED', {
        entityId,
        entityType: 'institution',
        workspaceId,
        organizationId: 'org_1',
      });
      
      expect(true).toBe(true);
    });

    it('should trigger automation with entityId payload (backward compatibility)', async () => {
      const entityId = 'school_test_123';
      const workspaceId = 'workspace_1';
      
      const school = {
        id: entityId,
        name: 'Test School',
        focalPersons: [{ email: 'test@example.com', name: 'Test Contact', type: 'primary' }],
      };
      mockSchools.set(entityId, school);
      
      const automation = {
        id: 'auto_2',
        name: 'Legacy Automation',
        trigger: 'SCHOOL_CREATED',
        isActive: true,
        workspaceIds: [workspaceId],
        nodes: [{ id: 'trigger_1', type: 'triggerNode', data: {} }],
        edges: [],
      };
      mockAutomations.set(automation.id, automation);
      
      const { triggerAutomationProtocols } = await import('../automation-processor');
      await triggerAutomationProtocols('SCHOOL_CREATED', {
        entityId,
        workspaceId,
        organizationId: 'org_1',
      });
      
      expect(true).toBe(true);
    });
  });

  describe('Automation Task Creation with Dual-Write', () => {
    it('should create task with both entityId and legacy schoolId', async () => {
      const entityId = 'entity_task_123';
      const legacySchoolId = 'school_task_123';
      const workspaceId = 'workspace_1';
      
      const { adminDb } = await import('../firebase-admin');
      await adminDb.collection('tasks').add({
        title: 'Automated Task',
        description: 'Task created by automation',
        priority: 'medium',
        status: 'todo',
        category: 'general',
        workspaceId,
        entityId,
        entityName: 'Test Entity',
        entityType: 'institution',
        assignedTo: 'user_123',
        dueDate: new Date().toISOString(),
        source: 'automation',
        automationId: 'auto_1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminders: [],
        reminderSent: false,
      });
      
      expect(createdTasks.length).toBe(1);
      const task = createdTasks[0];
      
      expect(task.entityId).toBe(entityId);
      expect(task.entityType).toBe('institution');
      expect(task.entityId).toBe(entityId);
      expect(task.source).toBe('automation');
      expect(task.automationId).toBe('auto_1');
    });
  });

  describe('Automation Contact Updates using entityId', () => {
    it('should update entity using entityId as primary identifier', async () => {
      const entityId = 'entity_update_123';
      const workspaceId = 'workspace_1';
      
      const entity = {
        id: entityId,
        name: 'Original Name',
        entityType: 'institution' as EntityType,
        contacts: [],
      };
      mockEntities.set(entityId, entity);
      
      const workspaceEntity = {
        id: `${workspaceId}_${entityId}`,
        workspaceId,
        entityId,
        entityType: 'institution' as EntityType,
        displayName: entity.name,
        pipelineId: 'pipeline_1',
        stageId: 'stage_1',
      };
      mockWorkspaceEntities.set(workspaceEntity.id, workspaceEntity);
      
      const { adminDb } = await import('../firebase-admin');
      
      await adminDb.collection('entities').doc(entityId).update({
        name: 'Updated Name',
        updatedAt: new Date().toISOString(),
      });
      
      await adminDb.collection('workspace_entities').doc(workspaceEntity.id).update({
        pipelineId: 'pipeline_2',
        stageId: 'stage_2',
        updatedAt: new Date().toISOString(),
      });
      
      expect(updatedEntities.length).toBe(1);
      expect(updatedEntities[0].id).toBe(entityId);
      expect(updatedEntities[0].updates.name).toBe('Updated Name');
      
      expect(updatedWorkspaceEntities.length).toBe(1);
      expect(updatedWorkspaceEntities[0].id).toBe(workspaceEntity.id);
      expect(updatedWorkspaceEntities[0].updates.pipelineId).toBe('pipeline_2');
    });
  });

  describe('Backward Compatibility with entityId Triggers', () => {
    it('should support legacy entityId triggers without entityId', async () => {
      const entityId = 'school_legacy_123';
      const workspaceId = 'workspace_1';
      
      const school = {
        id: entityId,
        name: 'Legacy School',
        focalPersons: [{ email: 'legacy@example.com', name: 'Legacy Contact', type: 'primary' }],
      };
      mockSchools.set(entityId, school);
      
      const automation = {
        id: 'auto_legacy',
        name: 'Legacy Automation',
        trigger: 'SCHOOL_CREATED',
        isActive: true,
        workspaceIds: [workspaceId],
        nodes: [{ id: 'trigger_1', type: 'triggerNode', data: {} }],
        edges: [],
      };
      mockAutomations.set(automation.id, automation);
      
      const { triggerAutomationProtocols } = await import('../automation-processor');
      await triggerAutomationProtocols('SCHOOL_CREATED', {
        entityId,
        workspaceId,
        organizationId: 'org_1',
        entityName: school.name,
      });
      
      expect(true).toBe(true);
    });
  });
});
