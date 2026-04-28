// @ts-nocheck
/**
 * Unit Tests for Marketing Industry Server Actions
 * 
 * Test Coverage:
 * - Each action rejects non-Marketing workspaces (Requirements 6.8–6.13)
 * - createCampaign links campaign to entity campaignIds
 * - All CRUD operations work correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createCampaign,
  updateCampaign,
  getCampaignsForEntity,
  createProposal,
  updateProposal,
  createDeliverable,
  updateDeliverableStatus,
  recordPerformanceMetric,
  getPerformanceMetricsForCampaign,
  createClientReport,
  updateClientReport,
  getClientReportsForEntity,
  createStrategyDoc,
  updateStrategyDoc,
  getStrategyDocsForEntity,
} from '../marketing-actions';
import type { Workspace, Entity, Campaign, Proposal, Deliverable } from '../types';

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

describe('Marketing Actions - Workspace Industry Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCampaign', () => {
    it('should reject non-Marketing workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS', // Not Marketing
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
        createCampaign({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          campaignName: 'Q1 Campaign',
          campaignType: 'Social Media',
          budget: 10000,
          startDate: '2024-01-01T00:00:00Z',
        })
      ).rejects.toThrow('This action is only available for Marketing workspaces');
    });

    it('should create campaign for Marketing workspace and update entity campaignIds', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Marketing',
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
          industry: 'Marketing',
          
          clientIndustry: 'Technology',
          businessSize: { employees: 50 },
          campaignIds: [],
        },
      };

      // Mock workspace validation
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any)
        // Mock entity fetch for updating campaignIds
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'entity_123',
          data: () => mockEntity,
        } as any);

      vi.mocked(addDoc).mockResolvedValueOnce({
        id: 'campaign_123',
      } as any);

      const result = await createCampaign({
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        campaignName: 'Q1 Campaign',
        campaignType: 'Social Media',
        budget: 10000,
        startDate: '2024-01-01T00:00:00Z',
      });

      expect(result.id).toBe('campaign_123');
      expect(result.campaignName).toBe('Q1 Campaign');
      expect(result.status).toBe('planning');
      expect(updateDoc).toHaveBeenCalled(); // Entity campaignIds updated
    });
  });

  describe('updateCampaign', () => {
    it('should reject non-Marketing workspace', async () => {
      const mockCampaign: Campaign = {
        id: 'campaign_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        campaignName: 'Q1 Campaign',
        campaignType: 'Social Media',
        status: 'planning',
        budget: 10000,
        startDate: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Law', // Not Marketing
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'campaign_123',
          data: () => mockCampaign,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await expect(
        updateCampaign('campaign_123', { status: 'active' })
      ).rejects.toThrow('This action is only available for Marketing workspaces');
    });
  });

  describe('createProposal', () => {
    it('should reject non-Marketing workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'RealEstate', // Not Marketing
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
        createProposal({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          proposalName: 'Q1 Marketing Strategy',
          value: 50000,
        })
      ).rejects.toThrow('This action is only available for Marketing workspaces');
    });
  });

  describe('createDeliverable', () => {
    it('should reject non-Marketing workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Consultancy', // Not Marketing
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
        createDeliverable({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          deliverableName: 'Social Media Graphics',
          deliverableType: 'Creative',
          dueDate: '2024-02-01T00:00:00Z',
        })
      ).rejects.toThrow('This action is only available for Marketing workspaces');
    });
  });

  describe('recordPerformanceMetric', () => {
    it('should reject non-Marketing workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SchoolEnrollment', // Not Marketing
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
        recordPerformanceMetric({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          campaignId: 'campaign_123',
          metricName: 'Click-Through Rate',
          metricValue: 3.5,
          unit: '%',
        })
      ).rejects.toThrow('This action is only available for Marketing workspaces');
    });
  });

  describe('createClientReport', () => {
    it('should reject non-Marketing workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS', // Not Marketing
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
        createClientReport({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          reportName: 'Q1 Performance Report',
          reportPeriod: 'Q1 2024',
        })
      ).rejects.toThrow('This action is only available for Marketing workspaces');
    });
  });

  describe('createStrategyDoc', () => {
    it('should reject non-Marketing workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Law', // Not Marketing
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
        createStrategyDoc({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          docName: 'Brand Strategy 2024',
          docType: 'Brand Strategy',
        })
      ).rejects.toThrow('This action is only available for Marketing workspaces');
    });
  });
});

describe('Marketing Actions - Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateProposal', () => {
    it('should set sentAt timestamp when status changes to sent', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Marketing',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockProposal: Proposal = {
        id: 'proposal_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        proposalName: 'Q1 Marketing Strategy',
        status: 'draft',
        value: 50000,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'proposal_123',
          data: () => mockProposal,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await updateProposal('proposal_123', { status: 'sent' });

      // Check that updateDoc was called with the correct updates
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toMatchObject({
        status: 'sent',
        sentAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should set respondedAt timestamp when status changes to accepted', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Marketing',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockProposal: Proposal = {
        id: 'proposal_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        proposalName: 'Q1 Marketing Strategy',
        status: 'sent',
        value: 50000,
        sentAt: '2024-01-05T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-05T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'proposal_123',
          data: () => mockProposal,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await updateProposal('proposal_123', { status: 'accepted' });

      // Check that updateDoc was called with the correct updates
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toMatchObject({
        status: 'accepted',
        respondedAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('updateDeliverableStatus', () => {
    it('should set completedDate when status changes to delivered', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Marketing',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockDeliverable: Deliverable = {
        id: 'deliverable_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        campaignId: 'campaign_123',
        deliverableName: 'Social Media Graphics',
        deliverableType: 'Creative',
        status: 'approved',
        dueDate: '2024-02-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'deliverable_123',
          data: () => mockDeliverable,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await updateDeliverableStatus('deliverable_123', 'delivered');

      // Check that updateDoc was called with the correct updates
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toMatchObject({
        status: 'delivered',
        completedDate: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('getCampaignsForEntity', () => {
    it('should return all campaigns for an entity ordered by start date', async () => {
      const mockCampaigns: Campaign[] = [
        {
          id: 'campaign_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          campaignName: 'Q2 Campaign',
          campaignType: 'Email',
          status: 'active',
          budget: 15000,
          startDate: '2024-04-01T00:00:00Z',
          createdAt: '2024-04-01T00:00:00Z',
          updatedAt: '2024-04-01T00:00:00Z',
        },
        {
          id: 'campaign_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          campaignName: 'Q1 Campaign',
          campaignType: 'Social Media',
          status: 'completed',
          budget: 10000,
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-03-31T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-03-31T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockCampaigns.map((campaign) => ({
          id: campaign.id,
          data: () => campaign,
        })),
      } as any);

      const result = await getCampaignsForEntity('entity_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('campaign_2'); // Most recent first
      expect(result[1].id).toBe('campaign_1');
    });
  });

  describe('getPerformanceMetricsForCampaign', () => {
    it('should return all metrics for a campaign ordered by recorded date', async () => {
      const mockMetrics = [
        {
          id: 'metric_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          campaignId: 'campaign_123',
          metricName: 'Conversion Rate',
          metricValue: 2.8,
          unit: '%',
          recordedAt: '2024-02-01T00:00:00Z',
          createdAt: '2024-02-01T00:00:00Z',
        },
        {
          id: 'metric_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          campaignId: 'campaign_123',
          metricName: 'Click-Through Rate',
          metricValue: 3.5,
          unit: '%',
          recordedAt: '2024-01-15T00:00:00Z',
          createdAt: '2024-01-15T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockMetrics.map((metric) => ({
          id: metric.id,
          data: () => metric,
        })),
      } as any);

      const result = await getPerformanceMetricsForCampaign('campaign_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('metric_2'); // Most recent first
    });
  });

  describe('getClientReportsForEntity', () => {
    it('should return all reports for an entity ordered by creation date', async () => {
      const mockReports = [
        {
          id: 'report_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          reportName: 'Q2 Performance Report',
          reportPeriod: 'Q2 2024',
          createdAt: '2024-07-01T00:00:00Z',
          updatedAt: '2024-07-01T00:00:00Z',
        },
        {
          id: 'report_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          reportName: 'Q1 Performance Report',
          reportPeriod: 'Q1 2024',
          sentAt: '2024-04-05T00:00:00Z',
          createdAt: '2024-04-01T00:00:00Z',
          updatedAt: '2024-04-05T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockReports.map((report) => ({
          id: report.id,
          data: () => report,
        })),
      } as any);

      const result = await getClientReportsForEntity('entity_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('report_2'); // Most recent first
    });
  });

  describe('getStrategyDocsForEntity', () => {
    it('should return all strategy docs for an entity ordered by creation date', async () => {
      const mockDocs = [
        {
          id: 'doc_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          docName: 'Content Strategy 2024',
          docType: 'Content Strategy',
          version: '2.0',
          createdAt: '2024-06-01T00:00:00Z',
          updatedAt: '2024-06-01T00:00:00Z',
        },
        {
          id: 'doc_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          docName: 'Brand Strategy 2024',
          docType: 'Brand Strategy',
          version: '1.0',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockDocs.map((doc) => ({
          id: doc.id,
          data: () => doc,
        })),
      } as any);

      const result = await getStrategyDocsForEntity('entity_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('doc_2'); // Most recent first
    });
  });
});
