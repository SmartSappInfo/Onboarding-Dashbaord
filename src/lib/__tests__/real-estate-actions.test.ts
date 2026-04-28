/**
 * Unit Tests for Real Estate Industry Server Actions
 * 
 * Test Coverage:
 * - Each action rejects non-RealEstate workspaces (Requirements 7.7–7.13)
 * - createProperty links property to entity propertyIds
 * - All CRUD operations work correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createProperty,
  updateProperty,
  getPropertiesForEntity,
  createPropertyPreference,
  updatePropertyPreference,
  getPropertyPreferencesForEntity,
  createViewing,
  updateViewingStatus,
  getViewingsForProperty,
  getViewingsForClient,
  createOffer,
  updateOfferStatus,
  getOffersForProperty,
  getOffersForBuyer,
  createNegotiation,
  updateNegotiation,
  getNegotiationsForProperty,
  createDeal,
  updateDeal,
  getDealsForProperty,
  getDealsForBuyer,
  createPropertyDocument,
  updatePropertyDocument,
  getPropertyDocuments,
} from '../real-estate-actions';
import type { Workspace, Entity, Property, Viewing, Offer } from '../types';

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

describe('Real Estate Actions - Workspace Industry Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createProperty', () => {
    it('should reject non-RealEstate workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS', // Not RealEstate
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
        createProperty({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          propertyType: 'residential',
          address: '123 Main St, City, State 12345',
          price: 500000,
        })
      ).rejects.toThrow('This action is only available for RealEstate workspaces');
    });

    it('should create property for RealEstate workspace and update entity propertyIds', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'RealEstate',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockEntity: Entity = {
        id: 'entity_123',
        organizationId: 'org_123',
        entityType: 'institution',
        name: 'Test Developer',
        entityContacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        industryData: {
          industry: 'RealEstate',
          entityType: 'institution',
          developerType: 'residential',
          propertyIds: [],
        },
      };

      // Mock workspace validation
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any)
        // Mock entity fetch for updating propertyIds
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'entity_123',
          data: () => mockEntity,
        } as any);

      vi.mocked(addDoc).mockResolvedValueOnce({
        id: 'property_123',
      } as any);

      const result = await createProperty({
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        propertyType: 'residential',
        address: '123 Main St, City, State 12345',
        price: 500000,
      });

      expect(result.id).toBe('property_123');
      expect(result.propertyType).toBe('residential');
      expect(result.status).toBe('available');
      expect(updateDoc).toHaveBeenCalled(); // Entity propertyIds updated
    });
  });

  describe('updateProperty', () => {
    it('should reject non-RealEstate workspace', async () => {
      const mockProperty: Property = {
        id: 'property_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        propertyType: 'residential',
        address: '123 Main St, City, State 12345',
        price: 500000,
        status: 'available',
        listedDate: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Marketing', // Not RealEstate
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'property_123',
          data: () => mockProperty,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await expect(
        updateProperty('property_123', { status: 'under_contract' })
      ).rejects.toThrow('This action is only available for RealEstate workspaces');
    });
  });

  describe('createPropertyPreference', () => {
    it('should reject non-RealEstate workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Law', // Not RealEstate
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
        createPropertyPreference({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          propertyType: 'residential',
          budgetRange: { min: 400000, max: 600000 },
          preferredLocations: ['Downtown', 'Suburbs'],
          bedrooms: 3,
        })
      ).rejects.toThrow('This action is only available for RealEstate workspaces');
    });
  });

  describe('createViewing', () => {
    it('should reject non-RealEstate workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Consultancy', // Not RealEstate
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
        createViewing({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          clientEntityId: 'entity_456',
          viewingDate: '2024-02-15T14:00:00Z',
        })
      ).rejects.toThrow('This action is only available for RealEstate workspaces');
    });
  });

  describe('createOffer', () => {
    it('should reject non-RealEstate workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SchoolEnrollment', // Not RealEstate
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
        createOffer({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          buyerEntityId: 'entity_456',
          offerAmount: 480000,
        })
      ).rejects.toThrow('This action is only available for RealEstate workspaces');
    });
  });

  describe('createNegotiation', () => {
    it('should reject non-RealEstate workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS', // Not RealEstate
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
        createNegotiation({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          offerId: 'offer_123',
          buyerEntityId: 'entity_456',
          sellerEntityId: 'entity_123',
        })
      ).rejects.toThrow('This action is only available for RealEstate workspaces');
    });
  });

  describe('createDeal', () => {
    it('should reject non-RealEstate workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Marketing', // Not RealEstate
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
        createDeal({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          buyerEntityId: 'entity_456',
          sellerEntityId: 'entity_123',
          dealValue: 495000,
          closingDate: '2024-03-15T00:00:00Z',
        })
      ).rejects.toThrow('This action is only available for RealEstate workspaces');
    });
  });

  describe('createPropertyDocument', () => {
    it('should reject non-RealEstate workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Law', // Not RealEstate
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
        createPropertyDocument({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          documentName: 'Title Deed',
          documentType: 'Legal',
          storageUrl: 'https://storage.example.com/docs/title-deed.pdf',
        })
      ).rejects.toThrow('This action is only available for RealEstate workspaces');
    });
  });
});

describe('Real Estate Actions - Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPropertiesForEntity', () => {
    it('should return all properties for an entity ordered by listed date', async () => {
      const mockProperties: Property[] = [
        {
          id: 'property_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          propertyType: 'commercial',
          address: '456 Business Ave, City, State 12345',
          price: 1200000,
          status: 'available',
          listedDate: '2024-02-01T00:00:00Z',
          createdAt: '2024-02-01T00:00:00Z',
          updatedAt: '2024-02-01T00:00:00Z',
        },
        {
          id: 'property_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          propertyType: 'residential',
          address: '123 Main St, City, State 12345',
          price: 500000,
          status: 'sold',
          listedDate: '2024-01-01T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockProperties.map((property) => ({
          id: property.id,
          data: () => property,
        })),
      } as any);

      const result = await getPropertiesForEntity('entity_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('property_2'); // Most recent first
      expect(result[1].id).toBe('property_1');
    });
  });

  describe('getViewingsForProperty', () => {
    it('should return all viewings for a property ordered by viewing date', async () => {
      const mockViewings: Viewing[] = [
        {
          id: 'viewing_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          clientEntityId: 'entity_456',
          viewingDate: '2024-02-20T15:00:00Z',
          status: 'scheduled',
          createdAt: '2024-02-15T00:00:00Z',
          updatedAt: '2024-02-15T00:00:00Z',
        },
        {
          id: 'viewing_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          clientEntityId: 'entity_789',
          viewingDate: '2024-02-10T14:00:00Z',
          status: 'completed',
          feedback: 'Very interested, would like to make an offer',
          createdAt: '2024-02-05T00:00:00Z',
          updatedAt: '2024-02-10T15:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockViewings.map((viewing) => ({
          id: viewing.id,
          data: () => viewing,
        })),
      } as any);

      const result = await getViewingsForProperty('property_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('viewing_2'); // Most recent first
    });
  });

  describe('getViewingsForClient', () => {
    it('should return all viewings for a client entity ordered by viewing date', async () => {
      const mockViewings: Viewing[] = [
        {
          id: 'viewing_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_789',
          clientEntityId: 'entity_456',
          viewingDate: '2024-02-20T15:00:00Z',
          status: 'scheduled',
          createdAt: '2024-02-15T00:00:00Z',
          updatedAt: '2024-02-15T00:00:00Z',
        },
        {
          id: 'viewing_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          clientEntityId: 'entity_456',
          viewingDate: '2024-02-10T14:00:00Z',
          status: 'completed',
          feedback: 'Very interested',
          createdAt: '2024-02-05T00:00:00Z',
          updatedAt: '2024-02-10T15:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockViewings.map((viewing) => ({
          id: viewing.id,
          data: () => viewing,
        })),
      } as any);

      const result = await getViewingsForClient('entity_456', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('viewing_2'); // Most recent first
    });
  });

  describe('getOffersForProperty', () => {
    it('should return all offers for a property ordered by submission date', async () => {
      const mockOffers: Offer[] = [
        {
          id: 'offer_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          buyerEntityId: 'entity_789',
          offerAmount: 510000,
          status: 'submitted',
          submittedAt: '2024-02-15T00:00:00Z',
          createdAt: '2024-02-15T00:00:00Z',
          updatedAt: '2024-02-15T00:00:00Z',
        },
        {
          id: 'offer_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          buyerEntityId: 'entity_456',
          offerAmount: 480000,
          status: 'rejected',
          submittedAt: '2024-02-10T00:00:00Z',
          createdAt: '2024-02-10T00:00:00Z',
          updatedAt: '2024-02-11T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockOffers.map((offer) => ({
          id: offer.id,
          data: () => offer,
        })),
      } as any);

      const result = await getOffersForProperty('property_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('offer_2'); // Most recent first
    });
  });

  describe('getOffersForBuyer', () => {
    it('should return all offers made by a buyer entity ordered by submission date', async () => {
      const mockOffers: Offer[] = [
        {
          id: 'offer_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_789',
          buyerEntityId: 'entity_456',
          offerAmount: 650000,
          status: 'under_review',
          submittedAt: '2024-02-20T00:00:00Z',
          createdAt: '2024-02-20T00:00:00Z',
          updatedAt: '2024-02-20T00:00:00Z',
        },
        {
          id: 'offer_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          buyerEntityId: 'entity_456',
          offerAmount: 480000,
          status: 'rejected',
          submittedAt: '2024-02-10T00:00:00Z',
          createdAt: '2024-02-10T00:00:00Z',
          updatedAt: '2024-02-11T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockOffers.map((offer) => ({
          id: offer.id,
          data: () => offer,
        })),
      } as any);

      const result = await getOffersForBuyer('entity_456', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('offer_2'); // Most recent first
    });
  });

  describe('getNegotiationsForProperty', () => {
    it('should return all negotiations for a property ordered by creation date', async () => {
      const mockNegotiations = [
        {
          id: 'negotiation_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          offerId: 'offer_789',
          buyerEntityId: 'entity_789',
          sellerEntityId: 'entity_123',
          status: 'in_progress',
          createdAt: '2024-02-16T00:00:00Z',
          updatedAt: '2024-02-16T00:00:00Z',
        },
        {
          id: 'negotiation_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          offerId: 'offer_456',
          buyerEntityId: 'entity_456',
          sellerEntityId: 'entity_123',
          status: 'agreed',
          agreedPrice: 495000,
          createdAt: '2024-02-11T00:00:00Z',
          updatedAt: '2024-02-13T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockNegotiations.map((negotiation) => ({
          id: negotiation.id,
          data: () => negotiation,
        })),
      } as any);

      const result = await getNegotiationsForProperty('property_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('negotiation_2'); // Most recent first
    });
  });

  describe('getDealsForProperty', () => {
    it('should return all deals for a property ordered by closing date', async () => {
      const mockDeals = [
        {
          id: 'deal_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          buyerEntityId: 'entity_456',
          sellerEntityId: 'entity_123',
          dealValue: 495000,
          closingDate: '2024-03-15T00:00:00Z',
          status: 'pending',
          createdAt: '2024-02-14T00:00:00Z',
          updatedAt: '2024-02-14T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockDeals.map((deal) => ({
          id: deal.id,
          data: () => deal,
        })),
      } as any);

      const result = await getDealsForProperty('property_123', 'ws_123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('deal_1');
      expect(result[0].dealValue).toBe(495000);
    });
  });

  describe('getDealsForBuyer', () => {
    it('should return all deals for a buyer entity ordered by closing date', async () => {
      const mockDeals = [
        {
          id: 'deal_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_789',
          buyerEntityId: 'entity_456',
          sellerEntityId: 'entity_999',
          dealValue: 650000,
          closingDate: '2024-04-01T00:00:00Z',
          status: 'pending',
          createdAt: '2024-02-25T00:00:00Z',
          updatedAt: '2024-02-25T00:00:00Z',
        },
        {
          id: 'deal_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          buyerEntityId: 'entity_456',
          sellerEntityId: 'entity_123',
          dealValue: 495000,
          closingDate: '2024-03-15T00:00:00Z',
          status: 'closed',
          createdAt: '2024-02-14T00:00:00Z',
          updatedAt: '2024-03-15T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockDeals.map((deal) => ({
          id: deal.id,
          data: () => deal,
        })),
      } as any);

      const result = await getDealsForBuyer('entity_456', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('deal_2'); // Most recent closing date first
    });
  });

  describe('getPropertyDocuments', () => {
    it('should return all documents for a property ordered by upload date', async () => {
      const mockDocuments = [
        {
          id: 'doc_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          documentName: 'Inspection Report',
          documentType: 'Inspection',
          storageUrl: 'https://storage.example.com/docs/inspection.pdf',
          uploadedAt: '2024-02-20T00:00:00Z',
          createdAt: '2024-02-20T00:00:00Z',
          updatedAt: '2024-02-20T00:00:00Z',
        },
        {
          id: 'doc_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          propertyId: 'property_123',
          documentName: 'Title Deed',
          documentType: 'Legal',
          storageUrl: 'https://storage.example.com/docs/title-deed.pdf',
          uploadedAt: '2024-01-15T00:00:00Z',
          createdAt: '2024-01-15T00:00:00Z',
          updatedAt: '2024-01-15T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockDocuments.map((doc) => ({
          id: doc.id,
          data: () => doc,
        })),
      } as any);

      const result = await getPropertyDocuments('property_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('doc_2'); // Most recent first
    });
  });
});
