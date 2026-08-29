import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createProductAction, 
  updateProductAction, 
  deleteProductAction, 
  listProductsAction,
  createProductCategoryAction,
  listProductCategoriesAction,
  createPriceBookAction,
  listPriceBooksAction 
} from '../product-actions';
import { saveDealLineItemsAction, acceptPublicQuoteAction } from '../deal-line-item-actions';
import { duplicateDealAction } from '../deal-actions';
import type { Deal, Product, ProductCategory, PriceBook, DealQuote, DealLineItem } from '@/lib/types';

// Mock canUser
let permissionGranted = true;
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockImplementation(async () => {
    return { granted: permissionGranted, reason: permissionGranted ? undefined : 'Permission denied' };
  }),
}));

// Mock activity logger
let loggedActivities: Array<Record<string, unknown>> = [];
vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockImplementation(async (activity: Record<string, unknown>) => {
    loggedActivities.push(activity);
  }),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// In-Memory Database Stores
const mockProductsStore = new Map<string, Product>();
const mockCategoriesStore = new Map<string, ProductCategory>();
const mockPriceBooksStore = new Map<string, PriceBook>();
const mockDealsStore = new Map<string, Deal>();
const mockQuotesStore = new Map<string, DealQuote>();

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((name: string) => {
        if (name === 'products') {
          return {
            doc: vi.fn((id: string) => ({
              id,
              get: vi.fn().mockImplementation(async () => ({
                exists: mockProductsStore.has(id),
                data: () => mockProductsStore.get(id),
              })),
              set: vi.fn().mockImplementation(async (data: Product) => {
                mockProductsStore.set(id, data);
              }),
              update: vi.fn().mockImplementation(async (data: Partial<Product>) => {
                const existing = mockProductsStore.get(id);
                if (existing) {
                  mockProductsStore.set(id, { ...existing, ...data } as Product);
                }
              }),
            })),
            where: vi.fn((field: string, op: string, val: unknown) => {
              return {
                where: vi.fn((field2: string, op2: string, val2: unknown) => ({
                  get: vi.fn().mockImplementation(async () => {
                    const docs = Array.from(mockProductsStore.values())
                      .filter(p => (p as unknown as Record<string, unknown>)[field] === val && (p as unknown as Record<string, unknown>)[field2] === val2)
                      .map(p => ({ data: () => p, id: p.id }));
                    return { docs, empty: docs.length === 0, size: docs.length };
                  }),
                })),
                get: vi.fn().mockImplementation(async () => {
                  const docs = Array.from(mockProductsStore.values())
                    .filter(p => (p as unknown as Record<string, unknown>)[field] === val)
                    .map(p => ({ data: () => p, id: p.id }));
                  return { docs, empty: docs.length === 0, size: docs.length };
                }),
              };
            }),
          };
        }

        if (name === 'product_categories') {
          return {
            doc: vi.fn((id: string) => ({
              id,
              set: vi.fn().mockImplementation(async (data: ProductCategory) => {
                mockCategoriesStore.set(id, data);
              }),
            })),
            where: vi.fn((field: string, op: string, val: unknown) => ({
              get: vi.fn().mockImplementation(async () => {
                const docs = Array.from(mockCategoriesStore.values())
                  .filter(c => (c as unknown as Record<string, unknown>)[field] === val)
                  .map(c => ({ data: () => c, id: c.id }));
                return { docs, empty: docs.length === 0, size: docs.length };
              }),
            })),
          };
        }

        if (name === 'price_books') {
          return {
            doc: vi.fn((id: string) => ({
              id,
              set: vi.fn().mockImplementation(async (data: PriceBook) => {
                mockPriceBooksStore.set(id, data);
              }),
            })),
            where: vi.fn((field: string, op: string, val: unknown) => ({
              where: vi.fn((field2: string, op2: string, val2: unknown) => ({
                get: vi.fn().mockImplementation(async () => {
                  const docs = Array.from(mockPriceBooksStore.values())
                    .filter(pb => (pb as unknown as Record<string, unknown>)[field] === val && (pb as unknown as Record<string, unknown>)[field2] === val2)
                    .map(pb => ({ data: () => pb, id: pb.id }));
                  return { docs, empty: docs.length === 0, size: docs.length };
                }),
              })),
            })),
          };
        }

        if (name === 'deals') {
          return {
            doc: vi.fn((id?: string) => {
              const docId = id || `deal_${Math.random().toString(36).substring(2, 9)}`;
              return {
                id: docId,
                get: vi.fn().mockImplementation(async () => ({
                  exists: mockDealsStore.has(docId),
                  data: () => mockDealsStore.get(docId),
                })),
                update: vi.fn().mockImplementation(async (data: Partial<Deal>) => {
                  const existing = mockDealsStore.get(docId);
                  if (existing) {
                    mockDealsStore.set(docId, { ...existing, ...data } as Deal);
                  }
                }),
              };
            }),
            add: vi.fn().mockImplementation(async (data: Omit<Deal, 'id'>) => {
              const id = `deal_${Math.random().toString(36).substring(2, 9)}`;
              mockDealsStore.set(id, { ...data, id } as Deal);
              return { id };
            }),
          };
        }

        if (name === 'deal_quotes') {
          return {
            where: vi.fn((field: string, op: string, val: unknown) => ({
              limit: vi.fn(() => ({
                get: vi.fn().mockImplementation(async () => {
                  const docs = Array.from(mockQuotesStore.values())
                    .filter(q => (q as unknown as Record<string, unknown>)[field] === val)
                    .map(q => ({
                      data: () => q,
                      id: q.id,
                      ref: {
                        update: vi.fn().mockImplementation(async (up: Partial<DealQuote>) => {
                          const existing = mockQuotesStore.get(q.id);
                          if (existing) {
                            mockQuotesStore.set(q.id, { ...existing, ...up });
                          }
                        }),
                      },
                    }));
                  return { docs, empty: docs.length === 0, size: docs.length };
                }),
              })),
            })),
          };
        }

        return {};
      }),
    },
  };
});

describe('Phase 4: Revenue & Commercial Layer Unit Tests', () => {
  const wsId = 'ws-test';
  const orgId = 'org-test';
  const uId = 'user-test';

  beforeEach(() => {
    vi.clearAllMocks();
    permissionGranted = true;
    loggedActivities = [];
    mockProductsStore.clear();
    mockCategoriesStore.clear();
    mockPriceBooksStore.clear();
    mockDealsStore.clear();
    mockQuotesStore.clear();
  });

  describe('Product Catalog & Category Actions', () => {
    it('should create a catalog product and log audit activity', async () => {
      const res = await createProductAction(
        {
          name: 'Smart School Enterprise',
          sku: 'SSE-2026',
          unitPrice: 500,
          currency: 'USD',
          isRecurring: true,
          billingInterval: 'monthly',
          taxRate: 15,
        },
        uId,
        wsId,
        orgId
      );

      expect(res.success).toBe(true);
      expect(res.product).toBeDefined();
      expect(res.product?.name).toBe('Smart School Enterprise');
      expect(res.product?.unitPrice).toBe(500);
      expect(res.product?.isRecurring).toBe(true);
      expect(res.product?.billingInterval).toBe('monthly');
      expect(res.product?.taxRate).toBe(15);
      expect(loggedActivities.length).toBe(1);
    });

    it('should reject product creation when unauthorized', async () => {
      permissionGranted = false;
      const res = await createProductAction({ name: 'Unallowed Product', unitPrice: 100 }, uId, wsId, orgId);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Permission denied');
    });

    it('should list products and categories for the workspace', async () => {
      await createProductCategoryAction({ name: 'Software Licenses' }, uId, wsId, orgId);
      await createProductAction({ name: 'Product A', unitPrice: 100 }, uId, wsId, orgId);
      await createProductAction({ name: 'Product B', unitPrice: 200 }, uId, wsId, orgId);

      const prodRes = await listProductsAction(wsId);
      const catRes = await listProductCategoriesAction(wsId);

      expect(prodRes.products?.length).toBe(2);
      expect(catRes.categories?.length).toBe(1);
    });

    it('should soft-archive a product on deletion', async () => {
      const created = await createProductAction({ name: 'To Archive', unitPrice: 100 }, uId, wsId, orgId);
      const prodId = created.product?.id || '';

      const delRes = await deleteProductAction(prodId, uId, wsId);
      expect(delRes.success).toBe(true);

      const product = mockProductsStore.get(prodId);
      expect(product?.isActive).toBe(false);
    });
  });

  describe('Price Books Actions', () => {
    it('should create a custom currency price book', async () => {
      const res = await createPriceBookAction(
        { name: 'West Africa Rate Card', currency: 'GHS', isStandard: false },
        uId,
        wsId,
        orgId
      );

      expect(res.success).toBe(true);
      expect(res.priceBook?.name).toBe('West Africa Rate Card');
      expect(res.priceBook?.currency).toBe('GHS');
    });
  });

  describe('Recurring Revenue & Line Items Integration', () => {
    it('should persist MRR, ARR, ACV, TCV, and Grand Total to deal on save', async () => {
      const dealId = 'deal-rec-1';
      mockDealsStore.set(dealId, {
        id: dealId,
        organizationId: orgId,
        workspaceId: wsId,
        entityId: 'ent-1',
        pipelineId: 'pipe-1',
        stageId: 'stage-1',
        name: 'Alpha Corp Expansion',
        value: 0,
        status: 'open',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      });

      const lineItems: DealLineItem[] = [
        {
          id: 'li-1',
          name: 'Monthly Software Subscription',
          quantity: 5,
          unitPrice: 200, // 1000/mo
          isRecurring: true,
          billingInterval: 'monthly',
          total: 1000,
        },
        {
          id: 'li-2',
          name: 'Implementation Onboarding',
          quantity: 1,
          unitPrice: 2000, // 2000 one-time
          isRecurring: false,
          billingInterval: 'one_time',
          total: 2000,
        },
      ];

      const saveRes = await saveDealLineItemsAction(dealId, lineItems, uId, 12);
      expect(saveRes.success).toBe(true);
      expect(saveRes.grandTotal).toBe(3000);
      expect(saveRes.mrr).toBe(1000);
      expect(saveRes.arr).toBe(12000);
      expect(saveRes.tcv).toBe(14000); // 2000 one-time + (1000 * 12) = 14000
      expect(saveRes.acv).toBe(14000);

      const savedDeal = mockDealsStore.get(dealId);
      expect(savedDeal?.mrr).toBe(1000);
      expect(savedDeal?.arr).toBe(12000);
      expect(savedDeal?.tcv).toBe(14000);
      expect(savedDeal?.value).toBe(3000);
    });

    it('should stamp contractStatus: signed onto parent deal when public quote is accepted', async () => {
      const dealId = 'deal-quote-1';
      const quoteToken = 'token_abc123456789012345678901234';

      mockDealsStore.set(dealId, {
        id: dealId,
        organizationId: orgId,
        workspaceId: wsId,
        entityId: 'ent-1',
        pipelineId: 'pipe-1',
        stageId: 'stage-1',
        name: 'Beta Deal',
        value: 5000,
        status: 'open',
        contractStatus: 'none',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      });

      mockQuotesStore.set('quote-1', {
        id: 'quote-1',
        quoteNumber: 'Q-2026-001',
        dealId,
        workspaceId: wsId,
        organizationId: orgId,
        entityId: 'ent-1',
        entityName: 'Beta Org',
        lineItems: [],
        subtotal: 5000,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 5000,
        currency: 'USD',
        status: 'sent',
        validUntil: '2026-09-01T00:00:00Z',
        token: quoteToken,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      });

      const acceptRes = await acceptPublicQuoteAction(quoteToken, 'John Doe', 'john@beta.com');
      expect(acceptRes.success).toBe(true);

      const deal = mockDealsStore.get(dealId);
      expect(deal?.contractStatus).toBe('signed');
      expect(deal?.probability).toBe(100);
      expect(deal?.forecastCategory).toBe('closed');
      expect(deal?.contractSignedAt).toBeDefined();
    });

    it('should copy recurring metrics and contract term when duplicating a deal', async () => {
      const dealId = 'deal-dup-source';
      mockDealsStore.set(dealId, {
        id: dealId,
        organizationId: orgId,
        workspaceId: wsId,
        entityId: 'ent-1',
        pipelineId: 'pipe-1',
        stageId: 'stage-1',
        name: 'Master Source Deal',
        value: 5000,
        mrr: 1500,
        arr: 18000,
        tcv: 36000,
        contractTermMonths: 24,
        status: 'open',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      });

      const dupRes = await duplicateDealAction(dealId, { newName: 'Master Deal (Clone)' }, uId);
      expect(dupRes.success).toBe(true);
      expect(dupRes.newDealId).toBeDefined();

      const clonedDeal = mockDealsStore.get(dupRes.newDealId || '');
      expect(clonedDeal?.name).toBe('Master Deal (Clone)');
      expect(clonedDeal?.mrr).toBe(1500);
      expect(clonedDeal?.arr).toBe(18000);
      expect(clonedDeal?.tcv).toBe(36000);
      expect(clonedDeal?.contractTermMonths).toBe(24);
      expect(clonedDeal?.contractStatus).toBe('none'); // Starts fresh
    });
  });
});
