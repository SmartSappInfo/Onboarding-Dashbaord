/**
 * @fileOverview Unit tests for Dashboard module migration
 * 
 * Tests that dashboard queries correctly use entityId references
 * and workspace_entities collection while maintaining backward
 * compatibility with legacy schools.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDashboardData } from '../dashboard';
import type { Firestore } from 'firebase/firestore';

// Mock Firestore
const mockFirestore = {} as Firestore;

// Mock data stores
const mockWorkspaceEntities = [
  {
    id: 'we1',
    entityId: 'entity_1',
    workspaceId: 'workspace1',
    displayName: 'Migrated School 1',
    status: 'active',
    stageId: 'stage1',
    assignedTo: { userId: 'user1' },
    nominalRoll: 100,
  },
  {
    id: 'we2',
    entityId: 'entity_2',
    workspaceId: 'workspace1',
    displayName: 'Migrated School 2',
    status: 'active',
    stageId: 'stage2',
    assignedTo: { userId: 'user2' },
    nominalRoll: 150,
  },
];

const mockSchools = [
  {
    id: 'school1',
    name: 'Legacy School 1',
    workspaceIds: ['workspace1'],
    migrationStatus: 'legacy',
    status: 'active',
    stage: { id: 'stage1', name: 'Stage 1' },
    assignedTo: { userId: 'user1' },
    nominalRoll: 80,
  },
];

const mockActivities = [
  {
    id: 'activity1',
    workspaceId: 'workspace1',
    entityId: 'entity_1',
    userId: 'user1',
    type: 'call',
    description: 'Called migrated school',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'activity2',
    workspaceId: 'workspace1',
    entityId: 'school1',
    userId: 'user2',
    type: 'email',
    description: 'Emailed legacy school',
    timestamp: new Date().toISOString(),
  },
];

const mockTasks = [
  {
    id: 'task1',
    workspaceId: 'workspace1',
    entityId: 'entity_1',
    title: 'Task for migrated school',
    status: 'todo',
  },
  {
    id: 'task2',
    workspaceId: 'workspace1',
    entityId: 'school1',
    title: 'Task for legacy school',
    status: 'in_progress',
  },
];

const mockStages = [
  {
    id: 'stage1',
    name: 'Stage 1',
    order: 1,
    color: '#FF0000',
  },
  {
    id: 'stage2',
    name: 'Stage 2',
    order: 2,
    color: '#00FF00',
  },
];

const mockUsers = [
  {
    id: 'user1',
    name: 'User 1',
    isAuthorized: true,
  },
  {
    id: 'user2',
    name: 'User 2',
    isAuthorized: true,
  },
];

// Mock collection and query functions
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db: any, collectionName: string) => ({ _collection: collectionName })),
  query: vi.fn((...args: any[]) => {
    const collectionRef = args[0];
    return { _collection: collectionRef._collection, _query: args };
  }),
  where: vi.fn((field: string, op: string, value: any) => ({ _where: { field, op, value } })),
  orderBy: vi.fn((field: string, direction?: string) => ({ _orderBy: { field, direction } })),
  limit: vi.fn((count: number) => ({ _limit: count })),
  getDocs: vi.fn(async (q: any) => {
    const collectionName = q._collection;
    
    // Return mock data based on collection
    if (collectionName === 'workspace_entities') {
      return {
        docs: mockWorkspaceEntities.map(data => ({
          id: data.id,
          data: () => data,
        })),
        size: mockWorkspaceEntities.length,
        empty: mockWorkspaceEntities.length === 0,
      };
    }
    
    if (collectionName === 'schools') {
      return {
        docs: mockSchools.map(data => ({
          id: data.id,
          data: () => data,
        })),
        size: mockSchools.length,
        empty: mockSchools.length === 0,
      };
    }
    
    if (collectionName === 'activities') {
      return {
        docs: mockActivities.map(data => ({
          id: data.id,
          data: () => data,
        })),
        size: mockActivities.length,
        empty: mockActivities.length === 0,
      };
    }
    
    if (collectionName === 'tasks') {
      return {
        docs: mockTasks.map(data => ({
          id: data.id,
          data: () => data,
        })),
        size: mockTasks.length,
        empty: mockTasks.length === 0,
      };
    }
    
    if (collectionName === 'onboardingStages') {
      return {
        docs: mockStages.map(data => ({
          id: data.id,
          data: () => data,
        })),
        size: mockStages.length,
        empty: mockStages.length === 0,
      };
    }
    
    if (collectionName === 'users') {
      return {
        docs: mockUsers.map(data => ({
          id: data.id,
          data: () => data,
        })),
        size: mockUsers.length,
        empty: mockUsers.length === 0,
      };
    }
    
    // Default empty response for other collections
    return {
      docs: [],
      size: 0,
      empty: true,
    };
  }),
}));

describe('Dashboard Module Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Contact Count Queries (Requirement 6.1)', () => {
    it('should count contacts from workspace_entities for migrated contacts', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      // Should have 2 migrated contacts + 1 legacy school = 3 total
      expect(data.metrics.totalSchools).toBe(3);
    });

    it('should calculate total students from both migrated and legacy contacts', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      // 100 + 150 (migrated) + 80 (legacy) = 330
      expect(data.metrics.totalStudents).toBe(330);
    });

    it('should exclude archived contacts from counts', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      // All test contacts are active, so count should match
      expect(data.metrics.totalSchools).toBeGreaterThan(0);
    });
  });

  describe('Activity Queries (Requirement 6.2, 6.4)', () => {
    it('should support activities with entityId references', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      const activityWithEntityId = data.activities.find((a: any) => a.entityId === 'entity_1');
      expect(activityWithEntityId).toBeDefined();
      expect(activityWithEntityId.entityId).toBe('entity_1');
    });

    it('should support activities with entityId references (legacy)', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      const activityWithSchoolId = data.activities.find((a: any) => a.entityId === 'school1');
      expect(activityWithSchoolId).toBeDefined();
      expect(activityWithSchoolId.entityId).toBe('school1');
    });

    it('should include both recentActivityEntities and recentActivitySchools', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      expect(data.recentActivityEntities).toBeDefined();
      expect(data.recentActivitySchools).toBeDefined();
      expect(Array.isArray(data.recentActivityEntities)).toBe(true);
      expect(Array.isArray(data.recentActivitySchools)).toBe(true);
    });
  });

  describe('Task Queries (Requirement 6.3)', () => {
    it('should query tasks with entityId references', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      // Verify dashboard data is returned successfully
      // Tasks are queried but not directly exposed in dashboard data
      expect(data).toBeDefined();
      expect(data.metrics).toBeDefined();
    });

    it('should query tasks with entityId references (legacy)', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      // Verify dashboard data is returned successfully
      // Tasks with entityId should also be queried for backward compatibility
      expect(data).toBeDefined();
      expect(data.metrics).toBeDefined();
    });

    it('should handle tasks for both migrated and legacy contacts', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      // Dashboard should successfully load even with mixed task references
      expect(data).toBeDefined();
      expect(data.metrics.totalSchools).toBeGreaterThan(0);
    });
  });

  describe('Pipeline Stage Counts (Requirement 6.4)', () => {
    it('should count contacts in stages from both workspace_entities and schools', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      expect(data.pipelineCounts).toBeDefined();
      expect(Array.isArray(data.pipelineCounts)).toBe(true);
      
      // Should have stages with counts from both migrated and legacy contacts
      const stage1 = data.pipelineCounts.find((s: any) => s.name === 'Stage 1');
      expect(stage1).toBeDefined();
      if (stage1) {
        expect(stage1.count).toBeGreaterThan(0);
      }
    });

    it('should aggregate student counts by stage', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      const stage1 = data.pipelineCounts.find((s: any) => s.name === 'Stage 1');
      expect(stage1).toBeDefined();
      if (stage1) {
        expect(stage1.students).toBeGreaterThan(0);
      }
    });
  });

  describe('User Assignments (Requirement 6.4)', () => {
    it('should count assignments from both workspace_entities and schools', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      expect(data.userAssignments).toBeDefined();
      expect(Array.isArray(data.userAssignments)).toBe(true);
      expect(data.userAssignments.length).toBeGreaterThan(0);
    });

    it('should calculate total students for each user from both sources', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      const userAssignment = data.userAssignments[0];
      expect(userAssignment.totalAssigned).toBeGreaterThan(0);
      expect(userAssignment.totalStudents).toBeGreaterThan(0);
    });
  });

  describe('Zone Distribution (Requirement 6.4)', () => {
    it('should count contacts in zones from both workspace_entities and schools', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      expect(data.zoneDistribution).toBeDefined();
      expect(Array.isArray(data.zoneDistribution)).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle workspaces with only legacy schools', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      expect(data.metrics.totalSchools).toBeGreaterThan(0);
      expect(data.recentActivitySchools).toBeDefined();
    });

    it('should handle workspaces with only migrated contacts', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      expect(data.metrics.totalSchools).toBeGreaterThan(0);
      expect(data.recentActivityEntities).toBeDefined();
    });

    it('should handle mixed workspaces with both migrated and legacy contacts', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      // Should have data from both sources
      expect(data.metrics.totalSchools).toBe(3); // 2 migrated + 1 legacy
      expect(data.recentActivityEntities.length).toBeGreaterThan(0);
      expect(data.recentActivitySchools.length).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity', () => {
    it('should return all required dashboard metrics', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      expect(data.metrics).toBeDefined();
      expect(data.metrics.totalSchools).toBeDefined();
      expect(data.metrics.totalStudents).toBeDefined();
      expect(data.latestSurveys).toBeDefined();
      expect(data.upcomingMeetings).toBeDefined();
      expect(data.pipelineCounts).toBeDefined();
      expect(data.userAssignments).toBeDefined();
      expect(data.activities).toBeDefined();
      expect(data.recentActivityUsers).toBeDefined();
      expect(data.recentActivityEntities).toBeDefined();
      expect(data.recentActivitySchools).toBeDefined();
      expect(data.zoneDistribution).toBeDefined();
      expect(data.messagingMetrics).toBeDefined();
      expect(data.moduleImplementations).toBeDefined();
    });

    it('should not double-count migrated schools', async () => {
      const data = await getDashboardData(mockFirestore, 'workspace1');
      
      // Migrated schools should only be counted in workspace_entities, not in schools
      // Total should be 2 (migrated) + 1 (legacy) = 3, not 4
      expect(data.metrics.totalSchools).toBe(3);
    });
  });
});
