/**
 * Tests for metrics actions (Requirement 21)
 * 
 * Validates that metrics correctly distinguish between:
 * - Unique entities (from entities collection)
 * - Workspace memberships (from workspace_entities collection)
 * - Active pipeline items
 * - Shared contacts across workspaces
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { adminDb } from '../firebase-admin';
import {
  getUniqueEntityMetrics,
  getWorkspaceMembershipMetrics,
  getPipelineMetrics,
  getSharedContactMetrics,
} from '../metrics-actions';
import type { Entity, WorkspaceEntity, Workspace } from '../types';

const TEST_ORG_ID = 'test-org-metrics';
const TEST_WORKSPACE_1 = 'workspace-1';
const TEST_WORKSPACE_2 = 'workspace-2';

describe('Metrics Actions - Requirement 21', () => {
  beforeEach(async () => {
    // Clean up test data
    await cleanupTestData();

    // Create test workspaces
    await adminDb.collection('workspaces').doc(TEST_WORKSPACE_1).set({
      id: TEST_WORKSPACE_1,
      organizationId: TEST_ORG_ID,
      name: 'Workspace One',
      status: 'active',
      contactScope: 'institution',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Workspace);

    await adminDb.collection('workspaces').doc(TEST_WORKSPACE_2).set({
      id: TEST_WORKSPACE_2,
      organizationId: TEST_ORG_ID,
      name: 'Workspace Two',
      status: 'active',
      contactScope: 'family',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Workspace);
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('getUniqueEntityMetrics', () => {
    it('should count unique entities by type (Requirement 21.1)', async () => {
      // Create test entities
      await createTestEntity('entity-1', 'institution');
      await createTestEntity('entity-2', 'family');
      await createTestEntity('entity-3', 'person');
      await createTestEntity('entity-4', 'institution');

      const metrics = await getUniqueEntityMetrics(TEST_ORG_ID);

      expect(metrics.totalUnique).toBe(4);
      expect(metrics.totalByType.institution).toBe(2);
      expect(metrics.totalByType.family).toBe(1);
      expect(metrics.totalByType.person).toBe(1);
    });

    it('should not count archived entities', async () => {
      await createTestEntity('entity-1', 'institution');
      await createTestEntity('entity-2', 'institution', 'archived');

      const metrics = await getUniqueEntityMetrics(TEST_ORG_ID);

      expect(metrics.totalUnique).toBe(1);
      expect(metrics.totalByType.institution).toBe(1);
    });

    it('should filter by entityType (Task 32.3, Requirement 21.4)', async () => {
      await createTestEntity('entity-1', 'institution');
      await createTestEntity('entity-2', 'family');
      await createTestEntity('entity-3', 'person');
      await createTestEntity('entity-4', 'institution');

      const institutionMetrics = await getUniqueEntityMetrics(TEST_ORG_ID, 'institution');
      expect(institutionMetrics.totalUnique).toBe(2);
      expect(institutionMetrics.totalByType.institution).toBe(2);
      expect(institutionMetrics.totalByType.family).toBe(0);
      expect(institutionMetrics.totalByType.person).toBe(0);

      const familyMetrics = await getUniqueEntityMetrics(TEST_ORG_ID, 'family');
      expect(familyMetrics.totalUnique).toBe(1);
      expect(familyMetrics.totalByType.family).toBe(1);

      const personMetrics = await getUniqueEntityMetrics(TEST_ORG_ID, 'person');
      expect(personMetrics.totalUnique).toBe(1);
      expect(personMetrics.totalByType.person).toBe(1);
    });
  });

  describe('getWorkspaceMembershipMetrics', () => {
    it('should count workspace_entities records per workspace (Requirement 21.3)', async () => {
      // Create entities
      const entity1 = await createTestEntity('entity-1', 'institution');
      const entity2 = await createTestEntity('entity-2', 'family');

      // Create workspace memberships
      await createWorkspaceEntity('we-1', entity1, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-2', entity2, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-3', entity1, TEST_WORKSPACE_2);

      const metrics = await getWorkspaceMembershipMetrics(TEST_ORG_ID);

      expect(metrics).toHaveLength(2);

      const ws1 = metrics.find((m) => m.workspaceId === TEST_WORKSPACE_1);
      expect(ws1?.totalMemberships).toBe(2);
      expect(ws1?.byType.institution).toBe(1);
      expect(ws1?.byType.family).toBe(1);

      const ws2 = metrics.find((m) => m.workspaceId === TEST_WORKSPACE_2);
      expect(ws2?.totalMemberships).toBe(1);
      expect(ws2?.byType.institution).toBe(1);
    });

    it('should provide workspace-scoped reports (Task 32.2, Requirement 21)', async () => {
      // Create entities
      const entity1 = await createTestEntity('entity-1', 'institution');
      const entity2 = await createTestEntity('entity-2', 'family');
      const entity3 = await createTestEntity('entity-3', 'person');

      // Create workspace memberships - entity1 appears in both workspaces
      await createWorkspaceEntity('we-1', entity1, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-2', entity2, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-3', entity3, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-4', entity1, TEST_WORKSPACE_2);

      // Get workspace-scoped report for workspace 1
      const ws1Report = await getWorkspaceMembershipMetrics(TEST_ORG_ID, TEST_WORKSPACE_1);
      
      expect(ws1Report).toHaveLength(1);
      expect(ws1Report[0].workspaceId).toBe(TEST_WORKSPACE_1);
      expect(ws1Report[0].totalMemberships).toBe(3); // 3 workspace_entities records
      expect(ws1Report[0].byType.institution).toBe(1);
      expect(ws1Report[0].byType.family).toBe(1);
      expect(ws1Report[0].byType.person).toBe(1);

      // Get workspace-scoped report for workspace 2
      const ws2Report = await getWorkspaceMembershipMetrics(TEST_ORG_ID, TEST_WORKSPACE_2);
      
      expect(ws2Report).toHaveLength(1);
      expect(ws2Report[0].workspaceId).toBe(TEST_WORKSPACE_2);
      expect(ws2Report[0].totalMemberships).toBe(1); // 1 workspace_entities record
      expect(ws2Report[0].byType.institution).toBe(1);

      // Verify the reports count workspace_entities, not unique entities
      // entity1 appears in both reports because it has 2 workspace_entities records
      const allWorkspaces = await getWorkspaceMembershipMetrics(TEST_ORG_ID);
      const totalMemberships = allWorkspaces.reduce((sum, w) => sum + w.totalMemberships, 0);
      expect(totalMemberships).toBe(4); // 4 workspace_entities records total

      // Compare with unique entity count
      const uniqueMetrics = await getUniqueEntityMetrics(TEST_ORG_ID);
      expect(uniqueMetrics.totalUnique).toBe(3); // Only 3 unique entities
      
      // This demonstrates that workspace reports count memberships, not unique entities
      expect(totalMemberships).toBeGreaterThan(uniqueMetrics.totalUnique);
    });

    it('should filter by specific workspace when provided', async () => {
      const entity1 = await createTestEntity('entity-1', 'institution');
      await createWorkspaceEntity('we-1', entity1, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-2', entity1, TEST_WORKSPACE_2);

      const metrics = await getWorkspaceMembershipMetrics(TEST_ORG_ID, TEST_WORKSPACE_1);

      expect(metrics).toHaveLength(1);
      expect(metrics[0].workspaceId).toBe(TEST_WORKSPACE_1);
      expect(metrics[0].totalMemberships).toBe(1);
    });

    it('should not conflate unique entities with memberships (Requirement 21.2)', async () => {
      // One entity in two workspaces = 2 memberships, not 1 entity
      const entity1 = await createTestEntity('entity-1', 'institution');
      await createWorkspaceEntity('we-1', entity1, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-2', entity1, TEST_WORKSPACE_2);

      const metrics = await getWorkspaceMembershipMetrics(TEST_ORG_ID);

      const totalMemberships = metrics.reduce((sum, m) => sum + m.totalMemberships, 0);
      expect(totalMemberships).toBe(2); // 2 memberships, not 1 unique entity
    });

    it('should filter by entityType (Task 32.3, Requirement 21.4)', async () => {
      const entity1 = await createTestEntity('entity-1', 'institution');
      const entity2 = await createTestEntity('entity-2', 'family');
      const entity3 = await createTestEntity('entity-3', 'person');

      await createWorkspaceEntity('we-1', entity1, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-2', entity2, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-3', entity3, TEST_WORKSPACE_1);

      const institutionMetrics = await getWorkspaceMembershipMetrics(TEST_ORG_ID, undefined, 'institution');
      expect(institutionMetrics).toHaveLength(1);
      expect(institutionMetrics[0].totalMemberships).toBe(1);
      expect(institutionMetrics[0].byType.institution).toBe(1);
      expect(institutionMetrics[0].byType.family).toBe(0);

      const familyMetrics = await getWorkspaceMembershipMetrics(TEST_ORG_ID, undefined, 'family');
      expect(familyMetrics[0].totalMemberships).toBe(1);
      expect(familyMetrics[0].byType.family).toBe(1);
    });

    it('should filter by both workspaceId and entityType independently (Task 32.3, Requirement 21.4)', async () => {
      const entity1 = await createTestEntity('entity-1', 'institution');
      const entity2 = await createTestEntity('entity-2', 'family');
      const entity3 = await createTestEntity('entity-3', 'institution');

      await createWorkspaceEntity('we-1', entity1, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-2', entity2, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-3', entity3, TEST_WORKSPACE_2);

      // Filter by workspace only
      const ws1Metrics = await getWorkspaceMembershipMetrics(TEST_ORG_ID, TEST_WORKSPACE_1);
      expect(ws1Metrics[0].totalMemberships).toBe(2);

      // Filter by entityType only
      const institutionMetrics = await getWorkspaceMembershipMetrics(TEST_ORG_ID, undefined, 'institution');
      const totalInstitutions = institutionMetrics.reduce((sum, m) => sum + m.totalMemberships, 0);
      expect(totalInstitutions).toBe(2);

      // Filter by both workspace AND entityType
      const ws1InstitutionMetrics = await getWorkspaceMembershipMetrics(TEST_ORG_ID, TEST_WORKSPACE_1, 'institution');
      expect(ws1InstitutionMetrics[0].totalMemberships).toBe(1);
      expect(ws1InstitutionMetrics[0].byType.institution).toBe(1);
      expect(ws1InstitutionMetrics[0].byType.family).toBe(0);
    });
  });

  describe('getPipelineMetrics', () => {
    it('should count entities active in pipeline (Requirement 21.1)', async () => {
      const entity1 = await createTestEntity('entity-1', 'institution');
      const entity2 = await createTestEntity('entity-2', 'family');
      const entity3 = await createTestEntity('entity-3', 'person');

      // Create workspace entities with stageId (active in pipeline)
      await createWorkspaceEntity('we-1', entity1, TEST_WORKSPACE_1, 'stage-1');
      await createWorkspaceEntity('we-2', entity2, TEST_WORKSPACE_1, 'stage-2');
      // This one has no stageId (not in pipeline)
      await createWorkspaceEntity('we-3', entity3, TEST_WORKSPACE_1);

      const metrics = await getPipelineMetrics(TEST_ORG_ID);

      const ws1 = metrics.find((m) => m.workspaceId === TEST_WORKSPACE_1);
      expect(ws1?.activeInPipeline).toBe(2); // Only entities with stageId
      expect(ws1?.byType.institution).toBe(1);
      expect(ws1?.byType.family).toBe(1);
      expect(ws1?.byType.person).toBe(0); // Not in pipeline
    });

    it('should filter by entityType (Task 32.3, Requirement 21.4)', async () => {
      const entity1 = await createTestEntity('entity-1', 'institution');
      const entity2 = await createTestEntity('entity-2', 'family');
      const entity3 = await createTestEntity('entity-3', 'institution');

      await createWorkspaceEntity('we-1', entity1, TEST_WORKSPACE_1, 'stage-1');
      await createWorkspaceEntity('we-2', entity2, TEST_WORKSPACE_1, 'stage-2');
      await createWorkspaceEntity('we-3', entity3, TEST_WORKSPACE_1, 'stage-3');

      const institutionMetrics = await getPipelineMetrics(TEST_ORG_ID, undefined, 'institution');
      const ws1 = institutionMetrics.find((m) => m.workspaceId === TEST_WORKSPACE_1);
      expect(ws1?.activeInPipeline).toBe(2);
      expect(ws1?.byType.institution).toBe(2);
      expect(ws1?.byType.family).toBe(0);

      const familyMetrics = await getPipelineMetrics(TEST_ORG_ID, undefined, 'family');
      const ws1Family = familyMetrics.find((m) => m.workspaceId === TEST_WORKSPACE_1);
      expect(ws1Family?.activeInPipeline).toBe(1);
      expect(ws1Family?.byType.family).toBe(1);
    });

    it('should filter by both workspaceId and entityType independently (Task 32.3, Requirement 21.4)', async () => {
      const entity1 = await createTestEntity('entity-1', 'institution');
      const entity2 = await createTestEntity('entity-2', 'family');
      const entity3 = await createTestEntity('entity-3', 'institution');

      await createWorkspaceEntity('we-1', entity1, TEST_WORKSPACE_1, 'stage-1');
      await createWorkspaceEntity('we-2', entity2, TEST_WORKSPACE_1, 'stage-2');
      await createWorkspaceEntity('we-3', entity3, TEST_WORKSPACE_2, 'stage-3');

      // Filter by workspace only
      const ws1Metrics = await getPipelineMetrics(TEST_ORG_ID, TEST_WORKSPACE_1);
      expect(ws1Metrics[0].activeInPipeline).toBe(2);

      // Filter by entityType only
      const institutionMetrics = await getPipelineMetrics(TEST_ORG_ID, undefined, 'institution');
      const totalInstitutions = institutionMetrics.reduce((sum, m) => sum + m.activeInPipeline, 0);
      expect(totalInstitutions).toBe(2);

      // Filter by both workspace AND entityType
      const ws1InstitutionMetrics = await getPipelineMetrics(TEST_ORG_ID, TEST_WORKSPACE_1, 'institution');
      expect(ws1InstitutionMetrics[0].activeInPipeline).toBe(1);
      expect(ws1InstitutionMetrics[0].byType.institution).toBe(1);
      expect(ws1InstitutionMetrics[0].byType.family).toBe(0);
    });
  });

  describe('getSharedContactMetrics', () => {
    it('should identify entities in 2+ workspaces (Requirement 21.1, 21.5)', async () => {
      const entity1 = await createTestEntity('entity-1', 'institution');
      const entity2 = await createTestEntity('entity-2', 'family');
      const entity3 = await createTestEntity('entity-3', 'person');

      // entity1 is in both workspaces (shared)
      await createWorkspaceEntity('we-1', entity1, TEST_WORKSPACE_1, 'stage-1');
      await createWorkspaceEntity('we-2', entity1, TEST_WORKSPACE_2, 'stage-2');

      // entity2 is only in one workspace (not shared)
      await createWorkspaceEntity('we-3', entity2, TEST_WORKSPACE_1);

      // entity3 is in both workspaces (shared)
      await createWorkspaceEntity('we-4', entity3, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-5', entity3, TEST_WORKSPACE_2);

      const shared = await getSharedContactMetrics(TEST_ORG_ID);

      expect(shared).toHaveLength(2);
      expect(shared.some((s) => s.entityId === entity1)).toBe(true);
      expect(shared.some((s) => s.entityId === entity3)).toBe(true);
      expect(shared.some((s) => s.entityId === entity2)).toBe(false);
    });

    it('should include per-workspace stage and assignee (Requirement 21.5)', async () => {
      const entity1 = await createTestEntity('entity-1', 'institution');

      await createWorkspaceEntity('we-1', entity1, TEST_WORKSPACE_1, 'stage-1', 'John Doe');
      await createWorkspaceEntity('we-2', entity1, TEST_WORKSPACE_2, 'stage-2', 'Jane Smith');

      const shared = await getSharedContactMetrics(TEST_ORG_ID);

      expect(shared).toHaveLength(1);
      const contact = shared[0];
      expect(contact.workspaceCount).toBe(2);
      expect(contact.workspaces).toHaveLength(2);

      const ws1 = contact.workspaces.find((w) => w.workspaceId === TEST_WORKSPACE_1);
      expect(ws1?.stageName).toBe('Stage One');
      expect(ws1?.assignedTo).toBe('John Doe');

      const ws2 = contact.workspaces.find((w) => w.workspaceId === TEST_WORKSPACE_2);
      expect(ws2?.stageName).toBe('Stage Two');
      expect(ws2?.assignedTo).toBe('Jane Smith');
    });

    it('should filter by entity type (Requirement 21.4)', async () => {
      const entity1 = await createTestEntity('entity-1', 'institution');
      const entity2 = await createTestEntity('entity-2', 'family');

      await createWorkspaceEntity('we-1', entity1, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-2', entity1, TEST_WORKSPACE_2);
      await createWorkspaceEntity('we-3', entity2, TEST_WORKSPACE_1);
      await createWorkspaceEntity('we-4', entity2, TEST_WORKSPACE_2);

      const institutionShared = await getSharedContactMetrics(TEST_ORG_ID, 'institution');
      expect(institutionShared).toHaveLength(1);
      expect(institutionShared[0].entityType).toBe('institution');

      const familyShared = await getSharedContactMetrics(TEST_ORG_ID, 'family');
      expect(familyShared).toHaveLength(1);
      expect(familyShared[0].entityType).toBe('family');
    });
  });
});

// Helper functions

async function cleanupTestData() {
  const collections = ['entities', 'workspace_entities', 'workspaces'];
  for (const collectionName of collections) {
    const snapshot = await adminDb
      .collection(collectionName)
      .where('organizationId', '==', TEST_ORG_ID)
      .get();
    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function createTestEntity(
  id: string,
  entityType: 'institution' | 'family' | 'person',
  status: 'active' | 'archived' = 'active'
): Promise<string> {
  const entity: Entity = {
    id,
    organizationId: TEST_ORG_ID,
    entityType,
    name: `Test ${entityType} ${id}`,
    contacts: [],
    globalTags: [],
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entityContacts: [],
  };

  await adminDb.collection('entities').doc(id).set(entity);
  return id;
}

async function createWorkspaceEntity(
  id: string,
  entityId: string,
  workspaceId: string,
  stageId?: string,
  assignedToName?: string
): Promise<void> {
  const entityDoc = await adminDb.collection('entities').doc(entityId).get();
  const entityData = entityDoc.data() as Entity;

  const workspaceEntity: WorkspaceEntity = {
    id,
    organizationId: TEST_ORG_ID,
    workspaceId,
    entityId,
    entityType: entityData.entityType,
    pipelineId: 'test-pipeline',
    stageId: stageId || '',
    status: 'active',
    workspaceTags: [],
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entityContacts: [],
    displayName: entityData.name,
    currentStageName: stageId ? `Stage ${stageId.split('-')[1].charAt(0).toUpperCase() + stageId.split('-')[1].slice(1)}` : undefined,
    assignedTo: assignedToName
      ? {
          userId: 'user-1',
          name: assignedToName,
          email: null,
        }
      : undefined,
  };

  await adminDb.collection('workspace_entities').doc(id).set(workspaceEntity);
}
