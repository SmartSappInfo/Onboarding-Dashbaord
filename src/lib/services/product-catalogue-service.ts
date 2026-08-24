/**
 * SmartSapp Finance 2.0 - Product Catalogue Service
 * Manages product/service taxonomy, pricing plans, and legacy package compatibility.
 */

import { adminDb } from '../firebase-admin';
import { FinanceProduct, FinancePricingPlan, SubscriptionPackage } from '../types';

export class ProductCatalogueService {
  /**
   * Retrieves all active products for a workspace.
   */
  static async getProducts(workspaceId: string): Promise<FinanceProduct[]> {
    const snap = await adminDb
      .collection('finance_products')
      .where('workspaceIds', 'array-contains', workspaceId)
      .where('isActive', '==', true)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FinanceProduct, 'id'>) }));
  }

  /**
   * Retrieves pricing plans for a specific product.
   */
  static async getPricingPlans(productId: string): Promise<FinancePricingPlan[]> {
    const snap = await adminDb
      .collection('finance_pricing_plans')
      .where('productId', '==', productId)
      .where('isActive', '==', true)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FinancePricingPlan, 'id'>) }));
  }

  /**
   * Resolves a legacy package or converts it into a product reference.
   * Guarantees 100% backward compatibility for existing institutions.
   */
  static async resolveOrMigratePackage(
    packageId: string,
    _workspaceId?: string,
    _organizationId?: string
  ): Promise<{ productId: string; productName: string; defaultRate: number; currency: string }> {
    // 1. Try finding matching product in new catalogue
    const prodSnap = await adminDb.collection('finance_products').doc(packageId).get();
    if (prodSnap.exists) {
      const prod = prodSnap.data() as FinanceProduct;
      return {
        productId: prodSnap.id,
        productName: prod.name,
        defaultRate: 0,
        currency: prod.currency || 'GHS',
      };
    }

    // 2. Fallback to legacy subscription_packages
    const pkgSnap = await adminDb.collection('subscription_packages').doc(packageId).get();
    if (pkgSnap.exists) {
      const pkg = pkgSnap.data() as SubscriptionPackage;
      return {
        productId: pkgSnap.id,
        productName: pkg.name || 'Standard Package',
        defaultRate: Number(pkg.ratePerStudent || 0),
        currency: pkg.currency || 'GHS',
      };
    }

    // 3. Fallback default
    return {
      productId: packageId || 'standard_subscription',
      productName: 'Standard Institutional Subscription',
      defaultRate: 0,
      currency: 'GHS',
    };
  }
}
