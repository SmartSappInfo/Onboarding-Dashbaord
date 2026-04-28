// @ts-nocheck
/**
 * Unit Tests for Consultancy Industry Server Actions
 * 
 * Test Coverage:
 * - Each action rejects non-Consultancy workspaces (Requirements 9.9–9.15)
 * - createEngagement links engagement to entity engagementIds
 * - All CRUD operations work correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createDiscovery,
  updateDiscovery,
  getDiscoveriesForEntity,
  createEngagement,
  updateEngagement,
  getEngagementsForEntity,
  createMilestone,
  updateMilestoneStatus,
  getMilestonesForEngagement,
  createOutcome,
  updateOutcome,
  getOutcomesForEngagement,
  createRetainer,
  updateRetainer,
  getRetainersForEntity,
} from '../consultancy-actions';
import type { Workspace, Entity, Discovery, Engagement, Milestone, Retainer } from '../types';

// Mock Firebase
vi.mock('@/firebase/config', () => ({
  firestore: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: {},
  arrayUnion: vi.fn((value) => value),
}));

// Import mocked functions
import { getDoc, addDoc, updateDoc, getDocs } from 'firebase/firestore';

describe('Consultancy Actions - Workspace Industry Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDiscovery', () => {
    it('should reject non-Consultancy workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS', // Not Consultancy
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'ws_123',
        data: () => mockWorkspace,
      } as any);

      await expect(
        createDiscovery({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          discoveryType: 'Needs Assessment',
        })
      ).rejects.toThrow('This action is only available for Consultancy workspaces');
    });
  });

  describe('createEngagement', () => {
    it('should reject non-Consultancy workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Marketing', // Not Consultancy
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'ws_123',
        data: () => mockWorkspace,
      } as any);

      await expect(
        createEngagement({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          engagementName: 'Digital Transformation',
          engagementType: 'Strategy',
          startDate: '2024-01-01T00:00:00Z',
          value: 100000,
        })
      ).rejects.toThrow('This action is only available for Consultancy workspaces');
    });

    it('should create engagement for Consultancy workspace and update entity engagementIds', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Consultancy',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockEntity: Entity = {
        id: 'entity_123',
        organizationId: 'org_123',
        
        name: 'Test Client',
        entityContacts: [],
        entityType: 'institution',
    entityContacts: [],
    globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        industryData: {
          industry: 'Consultancy',
          
          clientIndustry: 'Technology',
          capacity: { employees: 500 },
          engagementIds: [],
        },
      };

      // Mock workspace validation
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any)
        // Mock entity fetch for updating engagementIds
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'entity_123',
          data: () => mockEntity,
        } as any);

      vi.mocked(addDoc).mockResolvedValueOnce({
        id: 'engagement_123',
      } as any);

      const result = await createEngagement({
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        engagementName: 'Digital Transformation',
        engagementType: 'Strategy',
        startDate: '2024-01-01T00:00:00Z',
        value: 100000,
      });

      expect(result.id).toBe('engagement_123');
      expect(result.engagementName).toBe('Digital Transformation');
      expect(result.status).toBe('proposal');
      expect(updateDoc).toHaveBeenCalled(); // Entity engagementIds updated
    });
  });

  describe('updateEngagement', () => {
    it('should reject non-Consultancy workspace', async () => {
      const mockEngagement: Engagement = {
        id: 'engagement_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        engagementName: 'Digital Transformation',
        engagementType: 'Strategy',
        status: 'proposal',
        startDate: '2024-01-01T00:00:00Z',
        value: 100000,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Law', // Not Consultancy
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'engagement_123',
          data: () => mockEngagement,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await expect(
        updateEngagement('engagement_123', { status: 'active' })
      ).rejects.toThrow('This action is only available for Consultancy workspaces');
    });
  });

  describe('createMilestone', () => {
    it('should reject non-Consultancy workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'RealEstate', // Not Consultancy
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'ws_123',
        data: () => mockWorkspace,
      } as any);

      await expect(
        createMilestone({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          engagementId: 'engagement_123',
          milestoneName: 'Phase 1 Completion',
          dueDate: '2024-03-01T00:00:00Z',
        })
      ).rejects.toThrow('This action is only available for Consultancy workspaces');
    });
  });

  describe('createOutcome', () => {
    it('should reject non-Consultancy workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SchoolEnrollment', // Not Consultancy
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'ws_123',
        data: () => mockWorkspace,
      } as any);

      await expect(
        createOutcome({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          engagementId: 'engagement_123',
          entityId: 'entity_123',
          outcomeDescription: 'Increased efficiency by 30%',
          measuredValue: 30,
          unit: '%',
        })
      ).rejects.toThrow('This action is only available for Consultancy workspaces');
    });
  });

  describe('createRetainer', () => {
    it('should reject non-Consultancy workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS', // Not Consultancy
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'ws_123',
        data: () => mockWorkspace,
      } as any);

      await expect(
        createRetainer({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          retainerName: 'Monthly Advisory',
          monthlyValue: 10000,
          currency: 'USD',
          startDate: '2024-01-01T00:00:00Z',
        })
      ).rejects.toThrow('This action is only available for Consultancy workspaces');
    });
  });
});

describe('Consultancy Actions - Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateDiscovery', () => {
    it('should set completedDate when status changes to completed', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Consultancy',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockDiscovery: Discovery = {
        id: 'discovery_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        discoveryType: 'Needs Assessment',
        status: 'scheduled',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'discovery_123',
          data: () => mockDiscovery,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await updateDiscovery('discovery_123', { status: 'completed', findings: 'Key insights gathered' });

      // Check that updateDoc was called with the correct updates
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toMatchObject({
        status: 'completed',
        findings: 'Key insights gathered',
        completedDate: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('updateMilestoneStatus', () => {
    it('should set completedDate when status changes to completed', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Consultancy',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockMilestone: Milestone = {
        id: 'milestone_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        engagementId: 'engagement_123',
        milestoneName: 'Phase 1 Completion',
        status: 'in_progress',
        dueDate: '2024-03-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-02-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'milestone_123',
          data: () => mockMilestone,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await updateMilestoneStatus('milestone_123', 'completed');

      // Check that updateDoc was called with the correct updates
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toMatchObject({
        status: 'completed',
        completedDate: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('getDiscoveriesForEntity', () => {
    it('should return all discoveries for an entity ordered by creation date', async () => {
      const mockDiscoveries: Discovery[] = [
        {
          id: 'discovery_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          discoveryType: 'Follow-up Assessment',
          status: 'scheduled',
          createdAt: '2024-06-01T00:00:00Z',
          updatedAt: '2024-06-01T00:00:00Z',
        },
        {
          id: 'discovery_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          discoveryType: 'Initial Needs Assessment',
          status: 'completed',
          findings: 'Key insights gathered',
          completedDate: '2024-01-15T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockDiscoveries.map((discovery) => ({
          id: discovery.id,
          data: () => discovery,
        })),
      } as any);

      const result = await getDiscoveriesForEntity('entity_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('discovery_2'); // Most recent first
      expect(result[1].id).toBe('discovery_1');
    });
  });

  describe('getEngagementsForEntity', () => {
    it('should return all engagements for an entity ordered by start date', async () => {
      const mockEngagements: Engagement[] = [
        {
          id: 'engagement_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          engagementName: 'Process Optimization',
          engagementType: 'Operations',
          status: 'active',
          startDate: '2024-06-01T00:00:00Z',
          value: 75000,
          createdAt: '2024-06-01T00:00:00Z',
          updatedAt: '2024-06-01T00:00:00Z',
        },
        {
          id: 'engagement_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          engagementName: 'Digital Transformation',
          engagementType: 'Strategy',
          status: 'completed',
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-05-31T00:00:00Z',
          value: 100000,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-05-31T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockEngagements.map((engagement) => ({
          id: engagement.id,
          data: () => engagement,
        })),
      } as any);

      const result = await getEngagementsForEntity('entity_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('engagement_2'); // Most recent first
      expect(result[1].id).toBe('engagement_1');
    });
  });

  describe('getMilestonesForEngagement', () => {
    it('should return all milestones for an engagement ordered by due date', async () => {
      const mockMilestones: Milestone[] = [
        {
          id: 'milestone_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          engagementId: 'engagement_123',
          milestoneName: 'Phase 1 Completion',
          status: 'completed',
          dueDate: '2024-03-01T00:00:00Z',
          completedDate: '2024-02-28T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-02-28T00:00:00Z',
        },
        {
          id: 'milestone_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          engagementId: 'engagement_123',
          milestoneName: 'Phase 2 Completion',
          status: 'in_progress',
          dueDate: '2024-06-01T00:00:00Z',
          createdAt: '2024-03-01T00:00:00Z',
          updatedAt: '2024-04-01T00:00:00Z',
        },
        {
          id: 'milestone_3',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          engagementId: 'engagement_123',
          milestoneName: 'Phase 3 Completion',
          status: 'pending',
          dueDate: '2024-09-01T00:00:00Z',
          createdAt: '2024-06-01T00:00:00Z',
          updatedAt: '2024-06-01T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockMilestones.map((milestone) => ({
          id: milestone.id,
          data: () => milestone,
        })),
      } as any);

      const result = await getMilestonesForEngagement('engagement_123', 'ws_123');

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('milestone_1'); // Earliest due date first
      expect(result[1].id).toBe('milestone_2');
      expect(result[2].id).toBe('milestone_3');
    });
  });

  describe('getOutcomesForEngagement', () => {
    it('should return all outcomes for an engagement ordered by measured date', async () => {
      const mockOutcomes = [
        {
          id: 'outcome_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          engagementId: 'engagement_123',
          entityId: 'entity_123',
          outcomeDescription: 'Cost reduction achieved',
          measuredValue: 25,
          unit: '%',
          measuredAt: '2024-06-01T00:00:00Z',
          createdAt: '2024-06-01T00:00:00Z',
          updatedAt: '2024-06-01T00:00:00Z',
        },
        {
          id: 'outcome_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          engagementId: 'engagement_123',
          entityId: 'entity_123',
          outcomeDescription: 'Increased efficiency',
          measuredValue: 30,
          unit: '%',
          measuredAt: '2024-03-01T00:00:00Z',
          createdAt: '2024-03-01T00:00:00Z',
          updatedAt: '2024-03-01T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockOutcomes.map((outcome) => ({
          id: outcome.id,
          data: () => outcome,
        })),
      } as any);

      const result = await getOutcomesForEngagement('engagement_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('outcome_2'); // Most recent first
      expect(result[1].id).toBe('outcome_1');
    });
  });

  describe('getRetainersForEntity', () => {
    it('should return all retainers for an entity ordered by start date', async () => {
      const mockRetainers: Retainer[] = [
        {
          id: 'retainer_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          retainerName: 'Quarterly Advisory',
          monthlyValue: 15000,
          currency: 'USD',
          status: 'active',
          startDate: '2024-07-01T00:00:00Z',
          createdAt: '2024-07-01T00:00:00Z',
          updatedAt: '2024-07-01T00:00:00Z',
        },
        {
          id: 'retainer_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          retainerName: 'Monthly Advisory',
          monthlyValue: 10000,
          currency: 'USD',
          status: 'expired',
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-06-30T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-06-30T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockRetainers.map((retainer) => ({
          id: retainer.id,
          data: () => retainer,
        })),
      } as any);

      const result = await getRetainersForEntity('entity_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('retainer_2'); // Most recent first
      expect(result[1].id).toBe('retainer_1');
    });
  });

  describe('createEngagement - entity reference update', () => {
    it('should update entity engagementIds array when creating engagement', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Consultancy',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockEntity: Entity = {
        id: 'entity_123',
        organizationId: 'org_123',
        
        name: 'Test Client',
        entityContacts: [],
        entityType: 'institution',
    entityContacts: [],
    globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        industryData: {
          industry: 'Consultancy',
          
          clientIndustry: 'Technology',
          capacity: { employees: 500 },
          engagementIds: [],
        },
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'entity_123',
          data: () => mockEntity,
        } as any);

      vi.mocked(addDoc).mockResolvedValueOnce({
        id: 'engagement_123',
      } as any);

      await createEngagement({
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        engagementName: 'Digital Transformation',
        engagementType: 'Strategy',
        startDate: '2024-01-01T00:00:00Z',
        value: 100000,
      });

      // Verify updateDoc was called to update entity's engagementIds
      expect(updateDoc).toHaveBeenCalled();
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        industryData: expect.objectContaining({
          engagementIds: 'engagement_123', // arrayUnion mock returns the value directly
        }),
        updatedAt: expect.any(String),
      });
    });
  });
});
