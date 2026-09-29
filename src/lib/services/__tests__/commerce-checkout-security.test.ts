// @vitest-environment node
/**
 * @fileOverview Checkout fail-closed tests (auth hotfix, agents_mcp Phase 1 §1.1a).
 * No payment gateway is integrated, so a paid order must never provision access, consume a coupon
 * or pay an affiliate. Offers can only be bought in their own portal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Doc = Record<string, unknown>;

const h = vi.hoisted(() => ({
  store: new Map<string, Map<string, Record<string, unknown>>>(),
  seq: 0,
}));

function col(name: string): Map<string, Doc> {
  let c = h.store.get(name);
  if (!c) {
    c = new Map();
    h.store.set(name, c);
  }
  return c;
}

vi.mock('@/lib/firebase-admin', () => {
  // Minimal in-memory Firestore: doc get/set/update and equality `where` queries.
  const docRef = (name: string, id: string) => ({
    id,
    get: async () => {
      const data = col(name).get(id);
      return { exists: data !== undefined, id, data: () => data };
    },
    set: async (data: Doc) => void col(name).set(id, { ...data }),
    update: async (patch: Doc) => void col(name).set(id, { ...(col(name).get(id) ?? {}), ...patch }),
  });
  const query = (name: string, filters: Array<[string, unknown]>) => ({
    where: (field: string, _op: string, value: unknown) => query(name, [...filters, [field, value]]),
    limit: () => query(name, filters),
    orderBy: () => query(name, filters),
    get: async () => {
      const docs = [...col(name).entries()]
        .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
        .map(([id, d]) => ({ id, data: () => d, ref: docRef(name, id) }));
      return { empty: docs.length === 0, docs };
    },
  });
  return {
    adminDb: {
      collection: (name: string) => ({
        ...query(name, []),
        doc: (id?: string) => docRef(name, id ?? `auto-${++h.seq}`),
      }),
    },
  };
});

const enroll = vi.hoisted(() => vi.fn(async () => undefined));
const awardPoints = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/lib/services/enrollment-service', () => ({ EnrollmentService: { enrollUserInCourse: enroll } }));
vi.mock('@/lib/services/portal-membership-service', () => ({ PortalMembershipService: { awardPoints } }));
vi.mock('@/lib/services/engagement-service', () => ({ EngagementService: { logMemberActivity: vi.fn(async () => undefined) } }));

import { CommerceService } from '@/lib/services/commerce-service';

const baseInput = {
  organizationId: 'org-1',
  portalId: 'p1',
  offerId: 'offer-paid',
  userId: 'buyer-1',
  customerName: 'Ama',
  customerEmail: 'ama@x.com',
  paymentMethod: 'card' as const,
};

beforeEach(() => {
  h.store.clear();
  enroll.mockClear();
  awardPoints.mockClear();
  col('portal_offers').set('offer-paid', { id: 'offer-paid', portalId: 'p1', title: 'Pro', price: 200, currency: 'GHS', grantedCourseIds: ['c1'], grantedPlanId: 'plan-pro', isActive: true });
  col('portal_offers').set('offer-free', { id: 'offer-free', portalId: 'p1', title: 'Starter', price: 0, currency: 'GHS', grantedCourseIds: ['c0'], isActive: true });
  col('portal_offers').set('offer-other', { id: 'offer-other', portalId: 'p2', title: 'Other', price: 0, currency: 'GHS', isActive: true });
  col('portal_coupons').set('cp1', { id: 'cp1', portalId: 'p1', code: 'HALF', discountType: 'percentage', discountValue: 50, isActive: true, usedCount: 0 });
  col('affiliate_partners').set('aff1', { id: 'aff1', portalId: 'p1', userId: 'partner-1', referralCode: 'KOFI', status: 'active', commissionType: 'fixed', commissionRate: 30 });
  col('portal_memberships').set('m1', { id: 'm1', portalId: 'p1', userId: 'buyer-1', planId: 'free' });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('processCheckoutOrder without a verified payment', () => {
  it('records a paid order as pending and provisions nothing', async () => {
    const order = await CommerceService.processCheckoutOrder({ ...baseInput, couponCode: 'HALF', affiliateCode: 'KOFI' });

    expect(order.paymentStatus).toBe('pending');
    expect(order.completedAt).toBeUndefined();
    expect(order.commissionAmount).toBeUndefined();
    expect(enroll).not.toHaveBeenCalled();
    expect(awardPoints).not.toHaveBeenCalled();
    expect(col('portal_memberships').get('m1')?.planId).toBe('free');
    expect(col('portal_coupons').get('cp1')?.usedCount).toBe(0);
    expect(col('affiliate_referrals').size).toBe(0);
  });

  it('settles free offers immediately without paying any affiliate commission', async () => {
    const order = await CommerceService.processCheckoutOrder({ ...baseInput, offerId: 'offer-free', affiliateCode: 'KOFI' });

    expect(order.paymentStatus).toBe('completed');
    expect(order.paymentMethod).toBe('free');
    expect(order.commissionAmount).toBeUndefined();
    expect(enroll).toHaveBeenCalledWith('c0', 'buyer-1', 'p1', 'purchase');
    expect(col('affiliate_referrals').size).toBe(0);
  });

  it('refuses an offer that belongs to another portal', async () => {
    await expect(CommerceService.processCheckoutOrder({ ...baseInput, offerId: 'offer-other' })).rejects.toThrow('Commercial offer not found.');
    expect(col('portal_orders').size).toBe(0);
  });

  it('settles paid orders only when simulated payments are enabled outside production', async () => {
    vi.stubEnv('PORTAL_CHECKOUT_SIMULATE_PAYMENTS', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    await expect(CommerceService.processCheckoutOrder(baseInput)).resolves.toMatchObject({ paymentStatus: 'pending' });

    vi.stubEnv('NODE_ENV', 'development');
    const order = await CommerceService.processCheckoutOrder({ ...baseInput, affiliateCode: 'KOFI' });
    expect(order.paymentStatus).toBe('completed');
    expect(order.commissionAmount).toBe(30);
    expect(enroll).toHaveBeenCalledWith('c1', 'buyer-1', 'p1', 'purchase');
  });
});

describe('validateCoupon', () => {
  it('does not price an offer from another portal', async () => {
    const res = await CommerceService.validateCoupon({ portalId: 'p1', offerId: 'offer-other', code: 'half' });
    expect(res).toMatchObject({ isValid: false, message: 'Offer not found.' });
  });
});
