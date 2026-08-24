'use server';

/**
 * SmartSapp Finance 2.0 - Product & Pricing Server Actions
 */

import { adminDb } from './firebase-admin';
import { canUser } from './workspace-permissions';
import { FinanceProduct, FinancePricingPlan, ActionResponse } from './types';
import { logActivity } from './activity-logger';

export interface CreateProductInput {
  workspaceId: string;
  userId: string;
  organizationId?: string;
  name: string;
  sku: string;
  description?: string;
  category: FinanceProduct['category'];
  unitName: string;
  defaultBillingProfileId?: string;
  currency: string;
}

export async function createProductAction(
  input: CreateProductInput
): Promise<ActionResponse & { product?: FinanceProduct }> {
  try {
    const { workspaceId, userId, name, sku, category, unitName, currency } = input;
    if (!workspaceId || !userId || !name || !sku) {
      return { success: false, error: 'Product name and SKU are required.' };
    }

    const permission = await canUser(userId, 'finance', 'invoices', 'create', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance management permissions.' };
    }

    const timestamp = new Date().toISOString();
    const productData: Omit<FinanceProduct, 'id'> = {
      organizationId: input.organizationId || 'default',
      workspaceIds: [workspaceId],
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      description: input.description?.trim() || '',
      category: category || 'subscription',
      unitName: unitName?.trim() || 'unit',
      defaultBillingProfileId: input.defaultBillingProfileId || undefined,
      currency: currency || 'GHS',
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await adminDb.collection('finance_products').add(productData);
    const product: FinanceProduct = { id: docRef.id, ...productData };

    await logActivity({
      userId,
      organizationId: input.organizationId || 'default',
      workspaceId,
      type: 'status_change',
      source: 'finance_engine',
      description: `Created finance product ${product.name} (SKU: ${product.sku})`,
      metadata: { event: 'product.created', productId: docRef.id, sku: product.sku },
    });

    return { success: true, product };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create product';
    return { success: false, error: message };
  }
}

export async function updateProductAction(
  productId: string,
  workspaceId: string,
  userId: string,
  updates: Partial<FinanceProduct>
): Promise<ActionResponse> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance management permissions.' };
    }

    const docRef = adminDb.collection('finance_products').doc(productId);
    const timestamp = new Date().toISOString();

    await docRef.update({
      ...updates,
      updatedAt: timestamp,
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update product';
    return { success: false, error: message };
  }
}

export async function createPricingPlanAction(
  input: Omit<FinancePricingPlan, 'id' | 'createdAt' | 'updatedAt'> & { userId: string; workspaceId: string }
): Promise<ActionResponse & { plan?: FinancePricingPlan }> {
  try {
    const { userId, workspaceId, productId, name, rate, currency, billingFrequency, pricingModel } = input;
    const permission = await canUser(userId, 'finance', 'invoices', 'create', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance management permissions.' };
    }

    const timestamp = new Date().toISOString();
    const planData: Omit<FinancePricingPlan, 'id'> = {
      productId,
      organizationId: input.organizationId || 'default',
      workspaceIds: [workspaceId],
      name: name.trim(),
      pricingModel: pricingModel || 'per_unit',
      rate: Number(rate) || 0,
      currency: currency || 'GHS',
      billingFrequency: billingFrequency || 'termly',
      minUnits: input.minUnits,
      maxUnits: input.maxUnits,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await adminDb.collection('finance_pricing_plans').add(planData);
    const plan: FinancePricingPlan = { id: docRef.id, ...planData };

    return { success: true, plan };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create pricing plan';
    return { success: false, error: message };
  }
}
