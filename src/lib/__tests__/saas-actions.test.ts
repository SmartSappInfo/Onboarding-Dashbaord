// @ts-nocheck
/**
 * Unit Tests for SaaS Industry Server Actions
 * 
 * Test Coverage:
 * - Each action rejects non-SaaS workspaces (Requirements 8.17–8.23)
 * - createTrial updates entity trialIds array
 * - createHealthScore stores correct score fields
 * - All CRUD operations work correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createTrial,
  getTrialsForEntity,
  updateTrialStatus,
  createOnboarding,
  updateOnboardingMilestone,
  createSubscription,
  updateSubscription,
  createSupportTicket,
  updateSupportTicket,
  createHealthScore,
  getLatestHealthScore,
  recordProductUsage,
  recordFeatureAdoption,
} from '../saas-actions';
import type { Workspace, Entity, Trial, HealthScore } from '../types';

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

describe('SaaS Actions - Workspace Industry Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTrial', () => {
    it('should reject non-SaaS workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Marketing', // Not SaaS
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
        createTrial({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          trialStartDate: '2024-01-01T00:00:00Z',
          trialEndDate: '2024-01-31T00:00:00Z',
        })
      ).rejects.toThrow('This action is only available for SaaS workspaces');
    });

    it('should create trial for SaaS workspace and update entity trialIds', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockEntity: Entity = {
        id: 'entity_123',
        organizationId: 'org_123',
        
        name: 'Test Entity',
        entityContacts: [],
        entityType: 'institution',
    entityContacts: [],
    globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        industryData: {
          industry: 'SaaS',
          
          capacity: 100,
          // planType: 'Enterprise',
          // features: [],
          // signupDate: '2024-01-01T00:00:00Z',
          accountStatus: 'active',
          trialIds: [],
        },
      };

      // Mock workspace validation
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any)
        // Mock entity fetch for updating trialIds
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'entity_123',
          data: () => mockEntity,
        } as any);

      vi.mocked(addDoc).mockResolvedValueOnce({
        id: 'trial_123',
      } as any);

      const result = await createTrial({
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        trialStartDate: '2024-01-01T00:00:00Z',
        trialEndDate: '2024-01-31T00:00:00Z',
      });

      expect(result.id).toBe('trial_123');
      expect(result.trialStatus).toBe('active');
      expect(updateDoc).toHaveBeenCalled(); // Entity trialIds updated
    });
  });

  describe('createOnboarding', () => {
    it('should reject non-SaaS workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Law', // Not SaaS
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
        createOnboarding({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
        })
      ).rejects.toThrow('This action is only available for SaaS workspaces');
    });
  });

  describe('createSubscription', () => {
    it('should reject non-SaaS workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'RealEstate', // Not SaaS
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
        createSubscription({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          // planType: 'Enterprise',
          billingCycle: 'monthly',
          amount: 5000,
          currency: 'USD',
          startDate: '2024-01-01T00:00:00Z',
          renewalDate: '2024-02-01T00:00:00Z',
        })
      ).rejects.toThrow('This action is only available for SaaS workspaces');
    });
  });

  describe('createSupportTicket', () => {
    it('should reject non-SaaS workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Consultancy', // Not SaaS
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
        createSupportTicket({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          issueType: 'Technical',
          priority: 'high',
        })
      ).rejects.toThrow('This action is only available for SaaS workspaces');
    });
  });

  describe('createHealthScore', () => {
    it('should reject non-SaaS workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SchoolEnrollment', // Not SaaS
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
        createHealthScore({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          overallScore: 85,
          usageScore: 90,
          supportScore: 80,
          engagementScore: 85,
          churnRisk: 'low',
        })
      ).rejects.toThrow('This action is only available for SaaS workspaces');
    });

    it('should store correct score fields for SaaS workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockEntity: Entity = {
        id: 'entity_123',
        organizationId: 'org_123',
        
        name: 'Test Entity',
        entityContacts: [],
        entityType: 'institution',
    entityContacts: [],
    globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        industryData: {
          industry: 'SaaS',
          
          capacity: 100,
          // planType: 'Enterprise',
          // features: [],
          // signupDate: '2024-01-01T00:00:00Z',
          accountStatus: 'active',
          healthScoreIds: [],
        },
      };

      // Mock workspace validation
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any)
        // Mock entity fetch for updating healthScoreIds
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'entity_123',
          data: () => mockEntity,
        } as any);

      vi.mocked(addDoc).mockResolvedValueOnce({
        id: 'health_123',
      } as any);

      const result = await createHealthScore({
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        overallScore: 85,
        usageScore: 90,
        supportScore: 80,
        engagementScore: 85,
        churnRisk: 'low',
      });

      expect(result.id).toBe('health_123');
      expect(result.overallScore).toBe(85);
      expect(result.usageScore).toBe(90);
      expect(result.supportScore).toBe(80);
      expect(result.engagementScore).toBe(85);
      expect(result.churnRisk).toBe('low');
      expect(updateDoc).toHaveBeenCalled(); // Entity healthScoreIds updated
    });

    it('should reject scores outside 0-100 range', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS',
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
        createHealthScore({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          overallScore: 150, // Invalid: > 100
          usageScore: 90,
          supportScore: 80,
          engagementScore: 85,
          churnRisk: 'low',
        })
      ).rejects.toThrow('All scores must be between 0 and 100');
    });
  });

  describe('recordProductUsage', () => {
    it('should reject non-SaaS workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Marketing', // Not SaaS
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
        recordProductUsage({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          featureUsed: 'Dashboard',
          frequency: 10,
        })
      ).rejects.toThrow('This action is only available for SaaS workspaces');
    });
  });

  describe('recordFeatureAdoption', () => {
    it('should reject non-SaaS workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Law', // Not SaaS
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
        recordFeatureAdoption({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          featureName: 'Advanced Analytics',
          featureUsageStatus: 'adopted',
        })
      ).rejects.toThrow('This action is only available for SaaS workspaces');
    });
  });
});

describe('SaaS Actions - Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateTrialStatus', () => {
    it('should set conversionDate when status changes to converted', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockTrial: Trial = {
        id: 'trial_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        trialStartDate: '2024-01-01T00:00:00Z',
        trialEndDate: '2024-01-31T00:00:00Z',
        trialStatus: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'trial_123',
          data: () => mockTrial,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await updateTrialStatus('trial_123', 'converted');

      // Check that updateDoc was called with the correct updates
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toMatchObject({
        trialStatus: 'converted',
        conversionDate: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('updateOnboardingMilestone', () => {
    it('should mark milestone as completed and update status', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockOnboarding = {
        id: 'onboarding_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        onboardingStatus: 'in_progress',
        activationMilestones: [
          { name: 'Setup Account', completed: true, completedAt: '2024-01-01T00:00:00Z' },
          { name: 'Add Users', completed: false },
          { name: 'Configure Settings', completed: false },
        ],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'onboarding_123',
          data: () => mockOnboarding,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await updateOnboardingMilestone('onboarding_123', 'Add Users', true);

      // Check that updateDoc was called with the correct updates
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall).toBeDefined();
      
      const updates = updateCall[1] as any;
      expect(updates.onboardingStatus).toBe('in_progress'); // Not all completed yet
      expect(updates.updatedAt).toBeDefined();
      
      // Check that the milestone was updated
      const addUsersMilestone = updates.activationMilestones.find((m: any) => m.name === 'Add Users');
      expect(addUsersMilestone).toBeDefined();
      expect(addUsersMilestone.completed).toBe(true);
      expect(addUsersMilestone.completedAt).toBeDefined();
    });
  });

  describe('updateSupportTicket', () => {
    it('should calculate resolutionTime when status changes to resolved', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockTicket = {
        id: 'ticket_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        issueType: 'Technical',
        priority: 'high' as const,
        status: 'open' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ticket_123',
          data: () => mockTicket,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await updateSupportTicket('ticket_123', { status: 'resolved' });

      // Check that updateDoc was called with the correct updates
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toMatchObject({
        status: 'resolved',
        resolvedAt: expect.any(String),
        resolutionTime: expect.any(Number),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('getLatestHealthScore', () => {
    it('should return the most recent health score', async () => {
      const mockHealthScores: HealthScore[] = [
        {
          id: 'health_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          overallScore: 85,
          usageScore: 90,
          supportScore: 80,
          engagementScore: 85,
          churnRisk: 'low',
          calculatedAt: '2024-01-15T00:00:00Z',
          createdAt: '2024-01-15T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'health_1',
            data: () => mockHealthScores[0],
          },
        ],
      } as any);

      const result = await getLatestHealthScore('entity_123');

      expect(result).toEqual(mockHealthScores[0]);
    });

    it('should return null if no health scores exist', async () => {
      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: true,
        docs: [],
      } as any);

      const result = await getLatestHealthScore('entity_123');

      expect(result).toBeNull();
    });
  });

  describe('getTrialsForEntity', () => {
    it('should return all trials for an entity ordered by start date', async () => {
      const mockTrials: Trial[] = [
        {
          id: 'trial_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          trialStartDate: '2024-02-01T00:00:00Z',
          trialEndDate: '2024-02-28T00:00:00Z',
          trialStatus: 'active',
          createdAt: '2024-02-01T00:00:00Z',
          updatedAt: '2024-02-01T00:00:00Z',
        },
        {
          id: 'trial_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          trialStartDate: '2024-01-01T00:00:00Z',
          trialEndDate: '2024-01-31T00:00:00Z',
          trialStatus: 'converted',
          conversionDate: '2024-01-25T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-25T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockTrials.map((trial) => ({
          id: trial.id,
          data: () => trial,
        })),
      } as any);

      const result = await getTrialsForEntity('entity_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('trial_2'); // Most recent first
    });
  });
});
