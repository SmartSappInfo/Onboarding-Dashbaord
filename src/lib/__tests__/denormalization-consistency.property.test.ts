/**
 * Property 5: Denormalization Consistency Invariant
 * 
 * For any entity E with workspace_entities records [WE1, WE2, ..., WEn]:
 * ∀ WEi: WEi.displayName === E.name
 * ∀ WEi: WEi.primaryEmail === E.contacts[0].email (if contacts non-empty)
 * ∀ WEi: WEi.primaryPhone === E.contacts[0].phone (if contacts non-empty)
 * 
 * A property test should update E.name and assert that all related workspace_entities 
 * records reflect the updated displayName within one write cycle.
 * 
 * **Validates: Requirements 22**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Entity, WorkspaceEntity, EntityType } from '../types';

// Mock Next.js cache module
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// Mock activity logger
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined)
}));

// In-memory storage for testing
const entities = new Map<string, any>();
const workspaceEntities = new Map<string, any>();
const workspaces = new Map<string, any>();

// Mock Firestore
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const data = entities.get(id);
                return {
                  exists: !!data,
                  id,
                  data: () => data,
                };
              }),
              update: vi.fn().mockImplementation(async (updates: any) => {
                const existing = entities.get(id) || {};
                entities.set(id, { ...existing, ...updates });
              }),
            })),
            add: vi.fn().mockImplementation(async (data: any) => {
              const id = `entity_${Date.now()}_${Math.random()}`;
              entities.set(id, { ...data, id });
              return { id };
            }),
          };
        } else if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn(() => {
              const filters: Array<{ field: string; value: any }> = [];
              const chainable = {
                where: vi.fn((field: string, op: string, value: any) => {
                  filters.push({ field, value });
                  return chainable;
                }),
                get: vi.fn().mockImplementation(async () => {
                  let results = Array.from(workspaceEntities.values());
                  
                  // Apply filters
                  for (const filter of filters) {
                    results = results.filter((we: any) => we[filter.field] === filter.value);
                  }
                  
                  return {
                    empty: results.length === 0,
                    size: results.length,
                    docs: results.map((data: any) => ({
                      id: data.id,
                      ref: {
                        _docId: data.id, // Store the document ID for batch updates
                        update: vi.fn().mockImplementation(async (updates: any) => {
                          workspaceEntities.set(data.id, { ...data, ...updates });
                        }),
                      },
                      data: () => data,
                    })),
                  };
                }),
              };
              return chainable;
            }),
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const data = workspaceEntities.get(id);
                return {
                  exists: !!data,
                  id,
                  data: () => data,
                };
              }),
            })),
            add: vi.fn().mockImplementation(async (data: any) => {
              const id = `we_${Date.now()}_${Math.random()}`;
              workspaceEntities.set(id, { ...data, id });
              return { id };
            }),
          };
        } else if (collectionName === 'workspaces') {
          return {
            add: vi.fn().mockImplementation(async (data: any) => {
              const id = `workspace_${Date.now()}_${Math.random()}`;
              workspaces.set(id, { ...data, id });
              return { id };
            }),
          };
        }
        return {};
      }),
      batch: vi.fn(() => {
        const updates: Array<{ docId: string; data: any }> = [];
        return {
          update: vi.fn((ref: any, data: any) => {
            // Extract document ID from the ref object
            const docId = ref._docId;
            if (docId) {
              updates.push({ docId, data });
            }
          }),
          commit: vi.fn().mockImplementation(async () => {
            updates.forEach(({ docId, data }) => {
              const existing = workspaceEntities.get(docId);
              if (existing) {
                workspaceEntities.set(docId, { ...existing, ...data });
              }
            });
          }),
        };
      }),
    },
  };
});

// Import after mocks
import { adminDb } from '../firebase-admin';
import { updateEntityAction } from '../entity-actions';

const testOrgId = 'test-org-denorm-consistency';
const testUserId = 'test-user-denorm';

// Test storage access
const __testStorage = {
  entities,
  workspaceEntities,
  workspaces,
  reset: () => {
    entities.clear();
    workspaceEntities.clear();
    workspaces.clear();
  },
};

beforeEach(() => {
  __testStorage.reset();
  vi.clearAllMocks();
});

describe('Property 5: Denormalization Consistency Invariant', () => {
  it('should sync displayName to all workspace_entities when entity name changes', async () => {
    const timestamp = new Date().toISOString();

    // 1. Create test workspaces
    const workspaceRef = await adminDb.collection('workspaces').add({
      organizationId: testOrgId,
      name: 'Test Workspace 1',
      contactScope: 'institution',
      status: 'active',
      statuses: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const workspace2Ref = await adminDb.collection('workspaces').add({
      organizationId: testOrgId,
      name: 'Test Workspace 2',
      contactScope: 'institution',
      status: 'active',
      statuses: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // 2. Create test entity
    const entityData: Omit<Entity, 'id'> = {
      organizationId: testOrgId,
      entityType: 'institution',
      name: 'Original School Name',
      contacts: [
        {
          name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com',
          type: 'Principal',
          isSignatory: true,
        },
      ],
      globalTags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      institutionData: {
        nominalRoll: 500,
      },
    };

    const entityRef = await adminDb.collection('entities').add(entityData);

    // 3. Create workspace_entities links for both workspaces
    const workspaceEntity1Data: Omit<WorkspaceEntity, 'id'> = {
      organizationId: testOrgId,
      workspaceId: workspaceRef.id,
      entityId: entityRef.id,
      entityType: 'institution',
      pipelineId: 'test-pipeline-1',
      stageId: 'test-stage-1',
      status: 'active',
      workspaceTags: [],
      addedAt: timestamp,
      updatedAt: timestamp,
      displayName: entityData.name,
      primaryEmail: entityData.contacts[0].email,
      primaryPhone: entityData.contacts[0].phone,
    };

    const we1Ref = await adminDb.collection('workspace_entities').add(workspaceEntity1Data);

    const workspaceEntity2Data: Omit<WorkspaceEntity, 'id'> = {
      organizationId: testOrgId,
      workspaceId: workspace2Ref.id,
      entityId: entityRef.id,
      entityType: 'institution',
      pipelineId: 'test-pipeline-2',
      stageId: 'test-stage-2',
      status: 'active',
      workspaceTags: [],
      addedAt: timestamp,
      updatedAt: timestamp,
      displayName: entityData.name,
      primaryEmail: entityData.contacts[0].email,
      primaryPhone: entityData.contacts[0].phone,
    };

    const we2Ref = await adminDb.collection('workspace_entities').add(workspaceEntity2Data);

    // 4. Update entity name
    const newName = 'Updated School Name';
    const updateResult = await updateEntityAction(
      entityRef.id,
      { name: newName },
      testUserId,
      workspaceRef.id,
      'smartsapp-hq'
    );

    expect(updateResult.success).toBe(true);

    // 5. Verify all workspace_entities have updated displayName
    const we1Snap = await adminDb.collection('workspace_entities').doc(we1Ref.id).get();
    const we1Data = we1Snap.data() as WorkspaceEntity;
    expect(we1Data.displayName).toBe(newName);

    const we2Snap = await adminDb.collection('workspace_entities').doc(we2Ref.id).get();
    const we2Data = we2Snap.data() as WorkspaceEntity;
    expect(we2Data.displayName).toBe(newName);

    // Property invariant: ∀ WEi: WEi.displayName === E.name
    const updatedEntitySnap = await adminDb.collection('entities').doc(entityRef.id).get();
    const updatedEntity = updatedEntitySnap.data() as Entity;
    expect(we1Data.displayName).toBe(updatedEntity.name);
    expect(we2Data.displayName).toBe(updatedEntity.name);
  });

  it('should sync primaryEmail and primaryPhone when entity contacts change', async () => {
    const timestamp = new Date().toISOString();

    // 1. Create test workspace
    const workspaceRef = await adminDb.collection('workspaces').add({
      organizationId: testOrgId,
      name: 'Test Workspace Contacts',
      contactScope: 'person',
      status: 'active',
      statuses: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // 2. Create test entity
    const entityData: Omit<Entity, 'id'> = {
      organizationId: testOrgId,
      entityType: 'person',
      name: 'Jane Smith',
      contacts: [
        {
          name: 'Jane Smith',
          phone: '+1111111111',
          email: 'jane.old@example.com',
          type: 'Primary',
          isSignatory: false,
        },
      ],
      globalTags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      personData: {
        firstName: 'Jane',
        lastName: 'Smith',
        company: 'Acme Corp',
      },
    };

    const entityRef = await adminDb.collection('entities').add(entityData);

    // 3. Create workspace_entities link
    const workspaceEntityData: Omit<WorkspaceEntity, 'id'> = {
      organizationId: testOrgId,
      workspaceId: workspaceRef.id,
      entityId: entityRef.id,
      entityType: 'person',
      pipelineId: 'test-pipeline',
      stageId: 'test-stage',
      status: 'active',
      workspaceTags: [],
      addedAt: timestamp,
      updatedAt: timestamp,
      displayName: entityData.name,
      primaryEmail: entityData.contacts[0].email,
      primaryPhone: entityData.contacts[0].phone,
    };

    const weRef = await adminDb.collection('workspace_entities').add(workspaceEntityData);

    // 4. Update entity contacts
    const newContacts = [
      {
        name: 'Jane Smith',
        phone: '+2222222222',
        email: 'jane.new@example.com',
        type: 'Primary',
        isSignatory: false,
      },
    ];

    const updateResult = await updateEntityAction(
      entityRef.id,
      { contacts: newContacts },
      testUserId,
      workspaceRef.id,
      'smartsapp-hq'
    );

    expect(updateResult.success).toBe(true);

    // 5. Verify workspace_entities has updated primaryEmail and primaryPhone
    const weSnap = await adminDb.collection('workspace_entities').doc(weRef.id).get();
    const weData = weSnap.data() as WorkspaceEntity;
    expect(weData.primaryEmail).toBe(newContacts[0].email);
    expect(weData.primaryPhone).toBe(newContacts[0].phone);

    // Property invariant: WEi.primaryEmail === E.contacts[0].email
    const updatedEntitySnap = await adminDb.collection('entities').doc(entityRef.id).get();
    const updatedEntity = updatedEntitySnap.data() as Entity;
    expect(weData.primaryEmail).toBe(updatedEntity.contacts[0].email);
    expect(weData.primaryPhone).toBe(updatedEntity.contacts[0].phone);
  });

  it('should handle entity with multiple workspace_entities across different workspaces', async () => {
    const timestamp = new Date().toISOString();

    // 1. Create 3 test workspaces
    const workspaceRefs = await Promise.all([
      adminDb.collection('workspaces').add({
        organizationId: testOrgId,
        name: 'Workspace A',
        contactScope: 'family',
        status: 'active',
        statuses: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      adminDb.collection('workspaces').add({
        organizationId: testOrgId,
        name: 'Workspace B',
        contactScope: 'family',
        status: 'active',
        statuses: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      adminDb.collection('workspaces').add({
        organizationId: testOrgId,
        name: 'Workspace C',
        contactScope: 'family',
        status: 'active',
        statuses: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ]);

    // 2. Create test entity
    const entityData: Omit<Entity, 'id'> = {
      organizationId: testOrgId,
      entityType: 'family',
      name: 'The Johnson Family',
      contacts: [
        {
          name: 'Robert Johnson',
          phone: '+3333333333',
          email: 'robert@johnson.com',
          type: 'Guardian',
          isSignatory: true,
        },
      ],
      globalTags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      familyData: {
        guardians: [
          {
            name: 'Robert Johnson',
            phone: '+3333333333',
            email: 'robert@johnson.com',
            relationship: 'Father',
            isPrimary: true,
          },
        ],
        children: [],
      },
    };

    const entityRef = await adminDb.collection('entities').add(entityData);

    // 3. Create workspace_entities links for all 3 workspaces
    const weRefs = await Promise.all(
      workspaceRefs.map(async (wsRef) => {
        const weData: Omit<WorkspaceEntity, 'id'> = {
          organizationId: testOrgId,
          workspaceId: wsRef.id,
          entityId: entityRef.id,
          entityType: 'family',
          pipelineId: `pipeline-${wsRef.id}`,
          stageId: `stage-${wsRef.id}`,
          status: 'active',
          workspaceTags: [],
          addedAt: timestamp,
          updatedAt: timestamp,
          displayName: entityData.name,
          primaryEmail: entityData.contacts[0].email,
          primaryPhone: entityData.contacts[0].phone,
        };

        const ref = await adminDb.collection('workspace_entities').add(weData);
        return ref;
      })
    );

    // 4. Update entity name and contacts
    const newName = 'The Johnson-Smith Family';
    const newContacts = [
      {
        name: 'Sarah Johnson-Smith',
        phone: '+4444444444',
        email: 'sarah@johnsonsmith.com',
        type: 'Guardian',
        isSignatory: true,
      },
    ];

    const updateResult = await updateEntityAction(
      entityRef.id,
      { name: newName,
      contacts: newContacts },
      testUserId,
      workspaceRefs[0].id,
      'smartsapp-hq'
    );

    expect(updateResult.success).toBe(true);

    // 5. Verify ALL workspace_entities have updated denormalized fields
    const updatedEntitySnap = await adminDb.collection('entities').doc(entityRef.id).get();
    const updatedEntity = updatedEntitySnap.data() as Entity;

    for (const weRef of weRefs) {
      const weSnap = await adminDb.collection('workspace_entities').doc(weRef.id).get();
      const weData = weSnap.data() as WorkspaceEntity;

      // Property invariant: ∀ WEi: WEi.displayName === E.name
      expect(weData.displayName).toBe(updatedEntity.name);
      expect(weData.displayName).toBe(newName);

      // Property invariant: ∀ WEi: WEi.primaryEmail === E.contacts[0].email
      expect(weData.primaryEmail).toBe(updatedEntity.contacts[0].email);
      expect(weData.primaryEmail).toBe(newContacts[0].email);

      // Property invariant: ∀ WEi: WEi.primaryPhone === E.contacts[0].phone
      expect(weData.primaryPhone).toBe(updatedEntity.contacts[0].phone);
      expect(weData.primaryPhone).toBe(newContacts[0].phone);
    }
  });

  it('should handle entity with no contacts gracefully', async () => {
    const timestamp = new Date().toISOString();

    // 1. Create test workspace
    const workspaceRef = await adminDb.collection('workspaces').add({
      organizationId: testOrgId,
      name: 'Test Workspace No Contacts',
      contactScope: 'institution',
      status: 'active',
      statuses: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // 2. Create test entity with no contacts
    const entityData: Omit<Entity, 'id'> = {
      organizationId: testOrgId,
      entityType: 'institution',
      name: 'School Without Contacts',
      contacts: [],
      globalTags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      institutionData: {
        nominalRoll: 300,
      },
    };

    const entityRef = await adminDb.collection('entities').add(entityData);

    // 3. Create workspace_entities link
    const workspaceEntityData: Omit<WorkspaceEntity, 'id'> = {
      organizationId: testOrgId,
      workspaceId: workspaceRef.id,
      entityId: entityRef.id,
      entityType: 'institution',
      pipelineId: 'test-pipeline',
      stageId: 'test-stage',
      status: 'active',
      workspaceTags: [],
      addedAt: timestamp,
      updatedAt: timestamp,
      displayName: entityData.name,
      // No primaryEmail or primaryPhone since contacts is empty
    };

    const weRef = await adminDb.collection('workspace_entities').add(workspaceEntityData);

    // 4. Update entity name
    const newName = 'Updated School Without Contacts';
    const updateResult = await updateEntityAction(
      entityRef.id,
      { name: newName },
      testUserId,
      workspaceRef.id,
      'smartsapp-hq'
    );

    expect(updateResult.success).toBe(true);

    // 5. Verify workspace_entities has updated displayName
    const weSnap = await adminDb.collection('workspace_entities').doc(weRef.id).get();
    const weData = weSnap.data() as WorkspaceEntity;
    expect(weData.displayName).toBe(newName);

    // Verify primaryEmail and primaryPhone remain undefined
    expect(weData.primaryEmail).toBeUndefined();
    expect(weData.primaryPhone).toBeUndefined();
  });
});
