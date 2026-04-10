/**
 * @fileOverview Unit tests for Invoice Module Migration
 * 
 * Tests invoice creation, queries, and UI integration with Contact Adapter.
 * Validates Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 23.1, 26.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock firebase-admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      })),
      add: vi.fn(),
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            get: vi.fn(),
          })),
        })),
        orderBy: vi.fn(() => ({
          get: vi.fn(),
        })),
      })),
    })),
  },
}));

// Mock contact-adapter
vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn(),
}));

// Mock activity-logger
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn(),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { adminDb } from '../firebase-admin';
import { resolveContact } from '../contact-adapter';
import { logActivity } from '../activity-logger';
import { 
  generateInvoiceAction, 
  updateInvoiceAction,
  getInvoicesForContactAction 
} from '../billing-actions';
import type { Invoice, BillingProfile, BillingPeriod, School } from '../types';

describe('Invoice Module Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Invoice Creation with entityId (Requirement 8.1)', () => {
    it('should create invoice with both entityId and entityId when entity is migrated', async () => {
      // Arrange
      const mockSchool: School = {
        id: 'school_123',
        name: 'Test School',
        slug: 'test-school',
        organizationId: 'org_1',
        nominalRoll: 100,
        subscriptionPackageId: 'pkg_1',
        subscriptionPackageName: 'Standard',
        subscriptionRate: 50,
        currency: 'GHS',
        arrearsBalance: 0,
        creditBalance: 0,
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact = {
        id: 'entity_123',
        name: 'Test School',
        contacts: [],
        entityId: 'entity_123',
        entityType: 'institution' as const,
        schoolData: mockSchool,
        migrationStatus: 'migrated' as const,
      };

      const mockProfile: BillingProfile = {
        id: 'profile_1',
        organizationId: 'org_1',
        name: 'Default Profile',
        levyPercent: 5,
        vatPercent: 15,
        defaultDiscount: 0,
        paymentInstructions: 'Pay here',
        signatureName: 'John Doe',
        signatureDesignation: 'Finance Manager',
        workspaceIds: ['workspace_1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPeriod: BillingPeriod = {
        id: 'period_1',
        name: 'Term 1 2024',
        startDate: '2024-01-01',
        endDate: '2024-04-30',
        invoiceDate: '2024-04-25',
        paymentDueDate: '2024-05-10',
        status: 'open',
        workspaceIds: ['workspace_1'],
      };

      vi.mocked(resolveContact).mockResolvedValue(mockContact);
      
      const mockAdd = vi.fn().mockResolvedValue({ id: 'invoice_123' });
      
      const mockDoc = vi.fn((docId: string) => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => docId === 'profile_1' ? mockProfile : mockPeriod,
        }),
      }));
      
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: mockDoc,
        add: mockAdd,
      } as any);

      // Act
      const result = await generateInvoiceAction(
        'school_123',
        'period_1',
        'profile_1',
        'user_1',
        'workspace_1'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockAdd).toHaveBeenCalled();
      
      const invoiceData = mockAdd.mock.calls[0][0];
      expect(invoiceData.entityId).toBe('school_123');
      expect(invoiceData.entityId).toBe('entity_123');
      expect(invoiceData.entityType).toBe('institution');
      expect(invoiceData.entityName).toBe('Test School');
    });

    it('should create invoice with entityId only when entity is not migrated', async () => {
      // Arrange
      const mockSchool: School = {
        id: 'school_456',
        name: 'Legacy School',
        slug: 'legacy-school',
        organizationId: 'org_1',
        nominalRoll: 50,
        subscriptionPackageId: 'pkg_1',
        subscriptionPackageName: 'Basic',
        subscriptionRate: 30,
        currency: 'GHS',
        arrearsBalance: 0,
        creditBalance: 0,
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact = {
        id: 'school_456',
        name: 'Legacy School',
        contacts: [],
        entityId: null,
        entityType: null,
        schoolData: mockSchool,
        migrationStatus: 'legacy' as const,
      };

      const mockProfile: BillingProfile = {
        id: 'profile_1',
        organizationId: 'org_1',
        name: 'Default Profile',
        levyPercent: 5,
        vatPercent: 15,
        defaultDiscount: 0,
        paymentInstructions: 'Pay here',
        signatureName: 'John Doe',
        signatureDesignation: 'Finance Manager',
        workspaceIds: ['workspace_1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPeriod: BillingPeriod = {
        id: 'period_1',
        name: 'Term 1 2024',
        startDate: '2024-01-01',
        endDate: '2024-04-30',
        invoiceDate: '2024-04-25',
        paymentDueDate: '2024-05-10',
        status: 'open',
        workspaceIds: ['workspace_1'],
      };

      vi.mocked(resolveContact).mockResolvedValue(mockContact);
      
      const mockAdd = vi.fn().mockResolvedValue({ id: 'invoice_456' });
      
      const mockDoc = vi.fn((docId: string) => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => docId === 'profile_1' ? mockProfile : mockPeriod,
        }),
      }));
      
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: mockDoc,
        add: mockAdd,
      } as any);

      // Act
      const result = await generateInvoiceAction(
        'school_456',
        'period_1',
        'profile_1',
        'user_1',
        'workspace_1'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockAdd).toHaveBeenCalled();
      
      const invoiceData = mockAdd.mock.calls[0][0];
      expect(invoiceData.entityId).toBe('school_456');
      expect(invoiceData.entityId).toBeNull();
      expect(invoiceData.entityType).toBeNull();
    });
  });

  describe('Invoice Update with entityId Preservation (Requirement 8.2)', () => {
    it('should preserve entityId and entityType during invoice updates', async () => {
      // Arrange
      const existingInvoice: Invoice = {
        id: 'invoice_123',
        invoiceNumber: 'INV-2024-ABC',
        entityId: 'school_123',
        entityName: 'Test School',
        entityId: 'entity_123',
        entityType: 'institution',
        periodId: 'period_1',
        periodName: 'Term 1 2024',
        nominalRoll: 100,
        packageId: 'pkg_1',
        packageName: 'Standard',
        ratePerStudent: 50,
        currency: 'GHS',
        subtotal: 5000,
        discount: 0,
        levyAmount: 250,
        vatAmount: 750,
        arrearsAdded: 0,
        creditDeducted: 0,
        totalPayable: 6000,
        status: 'draft',
        items: [],
        billingProfileId: 'profile_1',
        paymentInstructions: '',
        signatureName: '',
        signatureDesignation: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workspaceIds: ['workspace_1'],
      };

      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => existingInvoice,
      });

      const mockUpdate = vi.fn().mockResolvedValue(undefined);

      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: mockGet,
          update: mockUpdate,
        })),
      } as any);

      // Act
      const updates = {
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      const result = await updateInvoiceAction('invoice_123', updates, 'user_1');

      // Assert
      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      
      const updateData = mockUpdate.mock.calls[0][0];
      expect(updateData.entityId).toBe('school_123');
      expect(updateData.entityId).toBe('entity_123');
      expect(updateData.entityType).toBe('institution');
      expect(updateData.status).toBe('sent');
    });

    it('should not allow entityId to be accidentally removed', async () => {
      // Arrange
      const existingInvoice: Invoice = {
        id: 'invoice_123',
        invoiceNumber: 'INV-2024-ABC',
        entityId: 'school_123',
        entityName: 'Test School',
        entityId: 'entity_123',
        entityType: 'institution',
        periodId: 'period_1',
        periodName: 'Term 1 2024',
        nominalRoll: 100,
        packageId: 'pkg_1',
        packageName: 'Standard',
        ratePerStudent: 50,
        currency: 'GHS',
        subtotal: 5000,
        discount: 0,
        levyAmount: 250,
        vatAmount: 750,
        arrearsAdded: 0,
        creditDeducted: 0,
        totalPayable: 6000,
        status: 'draft',
        items: [],
        billingProfileId: 'profile_1',
        paymentInstructions: '',
        signatureName: '',
        signatureDesignation: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workspaceIds: ['workspace_1'],
      };

      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => existingInvoice,
      });

      const mockUpdate = vi.fn().mockResolvedValue(undefined);

      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: mockGet,
          update: mockUpdate,
        })),
      } as any);

      // Act - Try to update without entityId in the updates object
      const updates = {
        discount: 100,
      };

      const result = await updateInvoiceAction('invoice_123', updates, 'user_1');

      // Assert
      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      
      const updateData = mockUpdate.mock.calls[0][0];
      // entityId should be preserved from existing invoice
      expect(updateData.entityId).toBe('entity_123');
      expect(updateData.entityType).toBe('institution');
      expect(updateData.entityId).toBe('school_123');
    });
  });

  describe('Invoice Query with Fallback (Requirement 8.4, 22.1)', () => {
    it('should query invoices by entityId when provided', async () => {
      // Arrange
      const mockInvoices = [
        {
          id: 'invoice_1',
          invoiceNumber: 'INV-001',
          entityId: 'school_123',
          createdAt: '2024-01-01',
        },
        {
          id: 'invoice_2',
          invoiceNumber: 'INV-002',
          entityId: 'school_123',
          createdAt: '2024-02-01',
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        docs: mockInvoices.map(inv => ({
          data: () => inv,
          id: inv.id,
        })),
      });

      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnValue({ get: mockGet });

      vi.mocked(adminDb.collection).mockReturnValue({
        where: mockWhere,
        orderBy: mockOrderBy,
      } as any);

      // Act
      const result = await getInvoicesForContactAction(
        { entityId: 'entity_123' },
        'workspace_1'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.invoices).toHaveLength(2);
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_123');
      expect(mockWhere).toHaveBeenCalledWith('workspaceIds', 'array-contains', 'workspace_1');
    });

    it('should fallback to entityId when entityId is not provided', async () => {
      // Arrange
      const mockInvoices = [
        {
          id: 'invoice_3',
          invoiceNumber: 'INV-003',
          entityId: 'school_456',
          createdAt: '2024-01-01',
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        docs: mockInvoices.map(inv => ({
          data: () => inv,
          id: inv.id,
        })),
      });

      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnValue({ get: mockGet });

      vi.mocked(adminDb.collection).mockReturnValue({
        where: mockWhere,
        orderBy: mockOrderBy,
      } as any);

      // Act
      const result = await getInvoicesForContactAction(
        { entityId: 'school_456' },
        'workspace_1'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.invoices).toHaveLength(1);
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'school_456');
    });

    it('should prefer entityId when both entityId and entityId are provided', async () => {
      // Arrange
      const mockInvoices = [
        {
          id: 'invoice_1',
          invoiceNumber: 'INV-001',
          entityId: 'school_123',
          createdAt: '2024-01-01',
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        docs: mockInvoices.map(inv => ({
          data: () => inv,
          id: inv.id,
        })),
      });

      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnValue({ get: mockGet });

      vi.mocked(adminDb.collection).mockReturnValue({
        where: mockWhere,
        orderBy: mockOrderBy,
      } as any);

      // Act
      const result = await getInvoicesForContactAction(
        { entityId: 'school_123' }
      );

      // Assert
      expect(result.success).toBe(true);
      // Should use entityId, not entityId
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_123');
      expect(mockWhere).not.toHaveBeenCalledWith('entityId', '==', 'school_123');
    });

    it('should throw error when neither entityId nor entityId is provided', async () => {
      // Act
      const result = await getInvoicesForContactAction({});

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Either entityId or entityId must be provided');
    });
  });

  describe('Contact Adapter Integration (Requirement 23.1)', () => {
    it('should use Contact Adapter to resolve entity information during invoice creation', async () => {
      // Arrange
      const mockSchool: School = {
        id: 'school_123',
        name: 'Test School',
        slug: 'test-school',
        organizationId: 'org_1',
        nominalRoll: 100,
        subscriptionPackageId: 'pkg_1',
        subscriptionPackageName: 'Standard',
        subscriptionRate: 50,
        currency: 'GHS',
        arrearsBalance: 0,
        creditBalance: 0,
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact = {
        id: 'entity_123',
        name: 'Test School',
        contacts: [],
        entityId: 'entity_123',
        entityType: 'institution' as const,
        schoolData: mockSchool,
        migrationStatus: 'migrated' as const,
      };

      vi.mocked(resolveContact).mockResolvedValue(mockContact);
      
      const mockGet = vi.fn()
        .mockResolvedValueOnce({ exists: true, data: () => ({}) })
        .mockResolvedValueOnce({ exists: true, data: () => ({}) });
      
      const mockAdd = vi.fn().mockResolvedValue({ id: 'invoice_123' });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({ get: mockGet })),
        add: mockAdd,
      } as any);

      // Act
      await generateInvoiceAction(
        'school_123',
        'period_1',
        'profile_1',
        'user_1',
        'workspace_1'
      );

      // Assert
      expect(resolveContact).toHaveBeenCalledWith('school_123', 'workspace_1');
    });

    it('should log activity with both entityId and entityId', async () => {
      // Arrange
      const mockSchool: School = {
        id: 'school_123',
        name: 'Test School',
        slug: 'test-school',
        organizationId: 'org_1',
        nominalRoll: 100,
        subscriptionPackageId: 'pkg_1',
        subscriptionPackageName: 'Standard',
        subscriptionRate: 50,
        currency: 'GHS',
        arrearsBalance: 0,
        creditBalance: 0,
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact = {
        id: 'entity_123',
        name: 'Test School',
        contacts: [],
        entityId: 'entity_123',
        entityType: 'institution' as const,
        schoolData: mockSchool,
        migrationStatus: 'migrated' as const,
      };

      const mockProfile: BillingProfile = {
        id: 'profile_1',
        organizationId: 'org_1',
        name: 'Default Profile',
        levyPercent: 5,
        vatPercent: 15,
        defaultDiscount: 0,
        paymentInstructions: 'Pay here',
        signatureName: 'John Doe',
        signatureDesignation: 'Finance Manager',
        workspaceIds: ['workspace_1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPeriod: BillingPeriod = {
        id: 'period_1',
        name: 'Term 1 2024',
        startDate: '2024-01-01',
        endDate: '2024-04-30',
        invoiceDate: '2024-04-25',
        paymentDueDate: '2024-05-10',
        status: 'open',
        workspaceIds: ['workspace_1'],
      };

      vi.mocked(resolveContact).mockResolvedValue(mockContact);
      
      const mockAdd = vi.fn().mockResolvedValue({ id: 'invoice_123' });
      
      const mockDoc = vi.fn((docId: string) => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => docId === 'profile_1' ? mockProfile : mockPeriod,
        }),
      }));
      
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: mockDoc,
        add: mockAdd,
      } as any);

      // Act
      await generateInvoiceAction(
        'school_123',
        'period_1',
        'profile_1',
        'user_1',
        'workspace_1'
      );

      // Assert
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_123',
          workspaceId: 'workspace_1',
        })
      );
    });
  });

  describe('Invoice PDF Generation with Entity Information (Requirement 8.5)', () => {
    it('should include entity information in invoice data for PDF rendering', async () => {
      // Arrange
      const mockSchool: School = {
        id: 'school_123',
        name: 'Test Institution',
        slug: 'test-institution',
        organizationId: 'org_1',
        nominalRoll: 150,
        subscriptionPackageId: 'pkg_premium',
        subscriptionPackageName: 'Premium',
        subscriptionRate: 75,
        currency: 'USD',
        arrearsBalance: 500,
        creditBalance: 100,
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact = {
        id: 'entity_456',
        name: 'Test Institution',
        contacts: [],
        entityId: 'entity_456',
        entityType: 'institution' as const,
        schoolData: mockSchool,
        migrationStatus: 'migrated' as const,
      };

      const mockProfile: BillingProfile = {
        id: 'profile_1',
        organizationId: 'org_1',
        name: 'Premium Profile',
        levyPercent: 5,
        vatPercent: 15,
        defaultDiscount: 10,
        paymentInstructions: 'Wire transfer to account XYZ',
        signatureName: 'Jane Smith',
        signatureDesignation: 'CFO',
        workspaceIds: ['workspace_1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPeriod: BillingPeriod = {
        id: 'period_2',
        name: 'Q1 2024',
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        invoiceDate: '2024-01-01',
        paymentDueDate: '2024-01-15',
        status: 'open',
        workspaceIds: ['workspace_1'],
      };

      vi.mocked(resolveContact).mockResolvedValue(mockContact);
      
      const mockAdd = vi.fn().mockResolvedValue({ id: 'invoice_pdf_test' });
      
      const mockDoc = vi.fn((docId: string) => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => docId === 'profile_1' ? mockProfile : mockPeriod,
        }),
      }));
      
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: mockDoc,
        add: mockAdd,
      } as any);

      // Act
      const result = await generateInvoiceAction(
        'school_123',
        'period_2',
        'profile_1',
        'user_1',
        'workspace_1'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockAdd).toHaveBeenCalled();
      
      const invoiceData = mockAdd.mock.calls[0][0];
      
      // Verify entity information is included for PDF rendering
      expect(invoiceData.entityName).toBe('Test Institution');
      expect(invoiceData.entityId).toBe('entity_456');
      expect(invoiceData.entityType).toBe('institution');
      
      // Verify billing details are correct
      expect(invoiceData.nominalRoll).toBe(150);
      expect(invoiceData.currency).toBe('USD');
      expect(invoiceData.packageName).toBe('Premium');
      
      // Verify payment instructions are included for PDF
      expect(invoiceData.paymentInstructions).toBe('Wire transfer to account XYZ');
      expect(invoiceData.signatureName).toBe('Jane Smith');
      expect(invoiceData.signatureDesignation).toBe('CFO');
    });

    it('should include legacy school information when entity is not migrated', async () => {
      // Arrange
      const mockSchool: School = {
        id: 'school_legacy',
        name: 'Legacy School',
        slug: 'legacy-school',
        organizationId: 'org_1',
        nominalRoll: 80,
        subscriptionPackageId: 'pkg_basic',
        subscriptionPackageName: 'Basic',
        subscriptionRate: 40,
        currency: 'GHS',
        arrearsBalance: 0,
        creditBalance: 0,
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact = {
        id: 'school_legacy',
        name: 'Legacy School',
        contacts: [],
        entityId: null,
        entityType: null,
        schoolData: mockSchool,
        migrationStatus: 'legacy' as const,
      };

      const mockProfile: BillingProfile = {
        id: 'profile_1',
        organizationId: 'org_1',
        name: 'Default Profile',
        levyPercent: 5,
        vatPercent: 15,
        defaultDiscount: 0,
        paymentInstructions: 'Bank transfer',
        signatureName: 'John Doe',
        signatureDesignation: 'Finance Manager',
        workspaceIds: ['workspace_1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPeriod: BillingPeriod = {
        id: 'period_1',
        name: 'Term 1 2024',
        startDate: '2024-01-01',
        endDate: '2024-04-30',
        invoiceDate: '2024-01-01',
        paymentDueDate: '2024-01-15',
        status: 'open',
        workspaceIds: ['workspace_1'],
      };

      vi.mocked(resolveContact).mockResolvedValue(mockContact);
      
      const mockAdd = vi.fn().mockResolvedValue({ id: 'invoice_legacy' });
      
      const mockDoc = vi.fn((docId: string) => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => docId === 'profile_1' ? mockProfile : mockPeriod,
        }),
      }));
      
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: mockDoc,
        add: mockAdd,
      } as any);

      // Act
      const result = await generateInvoiceAction(
        'school_legacy',
        'period_1',
        'profile_1',
        'user_1',
        'workspace_1'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockAdd).toHaveBeenCalled();
      
      const invoiceData = mockAdd.mock.calls[0][0];
      
      // Verify legacy school information is included for PDF
      expect(invoiceData.entityName).toBe('Legacy School');
      expect(invoiceData.entityId).toBe('school_legacy');
      expect(invoiceData.entityId).toBeNull();
      expect(invoiceData.entityType).toBeNull();
    });

    it('should include all financial details required for PDF rendering', async () => {
      // Arrange
      const mockSchool: School = {
        id: 'school_789',
        name: 'Complete Test School',
        slug: 'complete-test-school',
        organizationId: 'org_1',
        nominalRoll: 200,
        subscriptionPackageId: 'pkg_1',
        subscriptionPackageName: 'Standard',
        subscriptionRate: 60,
        currency: 'GHS',
        arrearsBalance: 1000,
        creditBalance: 200,
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockContact = {
        id: 'entity_789',
        name: 'Complete Test School',
        contacts: [],
        entityId: 'entity_789',
        entityType: 'institution' as const,
        schoolData: mockSchool,
        migrationStatus: 'migrated' as const,
      };

      const mockProfile: BillingProfile = {
        id: 'profile_1',
        organizationId: 'org_1',
        name: 'Default Profile',
        levyPercent: 5,
        vatPercent: 15,
        defaultDiscount: 5,
        paymentInstructions: 'Payment instructions here',
        signatureName: 'Authorized Signatory',
        signatureDesignation: 'Director',
        signatureUrl: 'https://example.com/signature.png',
        workspaceIds: ['workspace_1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPeriod: BillingPeriod = {
        id: 'period_1',
        name: 'Term 1 2024',
        startDate: '2024-01-01',
        endDate: '2024-04-30',
        invoiceDate: '2024-01-01',
        paymentDueDate: '2024-01-15',
        status: 'open',
        workspaceIds: ['workspace_1'],
      };

      vi.mocked(resolveContact).mockResolvedValue(mockContact);
      
      const mockAdd = vi.fn().mockResolvedValue({ id: 'invoice_complete' });
      
      const mockDoc = vi.fn((docId: string) => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => docId === 'profile_1' ? mockProfile : mockPeriod,
        }),
      }));
      
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: mockDoc,
        add: mockAdd,
      } as any);

      // Act
      const result = await generateInvoiceAction(
        'school_789',
        'period_1',
        'profile_1',
        'user_1',
        'workspace_1'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockAdd).toHaveBeenCalled();
      
      const invoiceData = mockAdd.mock.calls[0][0];
      
      // Verify all financial details for PDF
      expect(invoiceData.subtotal).toBe(12000); // 200 * 60
      expect(invoiceData.levyAmount).toBe(600); // 5% of 12000
      expect(invoiceData.vatAmount).toBe(1800); // 15% of 12000
      expect(invoiceData.discount).toBe(600); // 5% of 12000
      expect(invoiceData.arrearsAdded).toBe(1000);
      expect(invoiceData.creditDeducted).toBe(200);
      expect(invoiceData.totalPayable).toBe(14600); // 12000 + 600 + 1800 + 1000 - 200 - 600
      
      // Verify line items for PDF
      expect(invoiceData.items).toHaveLength(1);
      expect(invoiceData.items[0]).toMatchObject({
        name: 'SmartSapp Subscription (Standard)',
        quantity: 200,
        unitPrice: 60,
        amount: 12000,
      });
      
      // Verify signature details for PDF
      expect(invoiceData.signatureName).toBe('Authorized Signatory');
      expect(invoiceData.signatureDesignation).toBe('Director');
      expect(invoiceData.signatureUrl).toBe('https://example.com/signature.png');
    });
  });
});
