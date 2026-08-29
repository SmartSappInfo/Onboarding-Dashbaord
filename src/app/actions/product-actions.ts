'use server';

/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Phase 4 Revenue & Commercial Layer - Rule 10):
 * - Manages the workspace Product Catalog, Categories, and Tiered Price Books.
 * - Provides standardized reusable products with default pricing, tax rates, and billing intervals (monthly/quarterly/annual/one_time).
 * - Enforces multi-tenant isolation (workspaceId, organizationId) and role-based access control via canUser().
 * - Emits audit events to the unified activity logger and revalidates pipeline paths.
 * 
 * Caution Areas for Future Maintainers:
 * - When updating products or price books, never mutate historical deal line items. Historic deals preserve immutable snapshot copies.
 * - Ensure all numerical fields (unitPrice, taxRate, customUnitPrice) are strictly sanitized to prevent negative pricing.
 * - Firestore batch commits must always stay well below the 400 operation safety ceiling.
 */

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/firebase-admin';
import { canUser } from '@/lib/workspace-permissions';
import { logActivity } from '@/lib/activity-logger';
import type { Product, ProductCategory, PriceBook, PriceBookItem } from '@/lib/types';
import { nanoid } from 'nanoid';

// ==========================================
// 1. PRODUCT CATALOG ACTIONS
// ==========================================

export interface CreateProductInput {
  name: string;
  sku?: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  unitPrice: number;
  currency?: string;
  isRecurring?: boolean;
  billingInterval?: 'monthly' | 'quarterly' | 'annual' | 'one_time';
  taxRate?: number;
  isActive?: boolean;
}

export async function createProductAction(
  input: CreateProductInput,
  userId: string,
  workspaceId: string,
  organizationId: string = 'default'
): Promise<{ success: boolean; product?: Product; error?: string }> {
  try {
    if (!input.name?.trim()) {
      return { success: false, error: 'Product name is required.' };
    }
    if (!workspaceId) {
      return { success: false, error: 'Workspace ID is required.' };
    }

    const permission = await canUser(userId, 'operations', 'pipeline', 'create', workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason || 'Permission denied to create products.' };
    }

    const productId = `prod_${nanoid(12)}`;
    const now = new Date().toISOString();

    const sanitizedUnitPrice = Math.max(0, typeof input.unitPrice === 'number' && !Number.isNaN(input.unitPrice) ? input.unitPrice : 0);
    const sanitizedTaxRate = Math.max(0, typeof input.taxRate === 'number' && !Number.isNaN(input.taxRate) ? input.taxRate : 0);

    const product: Product = {
      id: productId,
      name: input.name.trim(),
      sku: input.sku?.trim() || undefined,
      description: input.description?.trim() || undefined,
      categoryId: input.categoryId || undefined,
      categoryName: input.categoryName || undefined,
      unitPrice: sanitizedUnitPrice,
      currency: input.currency || 'USD',
      isRecurring: Boolean(input.isRecurring),
      billingInterval: input.billingInterval || (input.isRecurring ? 'monthly' : 'one_time'),
      taxRate: sanitizedTaxRate,
      isActive: input.isActive !== false,
      workspaceId,
      organizationId,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection('products').doc(productId).set(product);

    await logActivity({
      organizationId,
      entityId: productId,
      userId,
      workspaceId,
      type: 'deal_updated',
      source: 'user',
      description: `created catalog product "${product.name}" (${product.currency} ${product.unitPrice})`,
      metadata: { productId, name: product.name, unitPrice: product.unitPrice },
    });

    revalidatePath('/admin/pipeline');
    revalidatePath('/admin/deals');

    return { success: true, product };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create product';
    console.error('[createProductAction] Error:', error);
    return { success: false, error: msg };
  }
}

export async function updateProductAction(
  productId: string,
  updates: Partial<CreateProductInput>,
  userId: string,
  workspaceId: string
): Promise<{ success: boolean; product?: Product; error?: string }> {
  try {
    const productRef = adminDb.collection('products').doc(productId);
    const snap = await productRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Product not found.' };
    }

    const existing = snap.data() as Product;
    if (existing.workspaceId !== workspaceId) {
      return { success: false, error: 'Tenant boundary violation.' };
    }

    const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason || 'Permission denied to update products.' };
    }

    const sanitizedUpdates: Partial<Product> = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.name !== undefined) sanitizedUpdates.name = updates.name.trim();
    if (updates.sku !== undefined) sanitizedUpdates.sku = updates.sku.trim() || undefined;
    if (updates.description !== undefined) sanitizedUpdates.description = updates.description.trim() || undefined;
    if (updates.categoryId !== undefined) sanitizedUpdates.categoryId = updates.categoryId || undefined;
    if (updates.categoryName !== undefined) sanitizedUpdates.categoryName = updates.categoryName || undefined;
    if (updates.unitPrice !== undefined) {
      sanitizedUpdates.unitPrice = Math.max(0, typeof updates.unitPrice === 'number' && !Number.isNaN(updates.unitPrice) ? updates.unitPrice : 0);
    }
    if (updates.currency !== undefined) sanitizedUpdates.currency = updates.currency;
    if (updates.isRecurring !== undefined) sanitizedUpdates.isRecurring = Boolean(updates.isRecurring);
    if (updates.billingInterval !== undefined) sanitizedUpdates.billingInterval = updates.billingInterval;
    if (updates.taxRate !== undefined) {
      sanitizedUpdates.taxRate = Math.max(0, typeof updates.taxRate === 'number' && !Number.isNaN(updates.taxRate) ? updates.taxRate : 0);
    }
    if (updates.isActive !== undefined) sanitizedUpdates.isActive = Boolean(updates.isActive);

    await productRef.update(sanitizedUpdates);

    const updatedProduct: Product = { ...existing, ...sanitizedUpdates };

    revalidatePath('/admin/pipeline');
    revalidatePath('/admin/deals');

    return { success: true, product: updatedProduct };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update product';
    console.error('[updateProductAction] Error:', error);
    return { success: false, error: msg };
  }
}

export async function deleteProductAction(
  productId: string,
  userId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const productRef = adminDb.collection('products').doc(productId);
    const snap = await productRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Product not found.' };
    }

    const existing = snap.data() as Product;
    if (existing.workspaceId !== workspaceId) {
      return { success: false, error: 'Tenant boundary violation.' };
    }

    const permission = await canUser(userId, 'operations', 'pipeline', 'delete', workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason || 'Permission denied to delete products.' };
    }

    // Soft-archive by setting isActive: false
    await productRef.update({
      isActive: false,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/admin/pipeline');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete product';
    console.error('[deleteProductAction] Error:', error);
    return { success: false, error: msg };
  }
}

export async function listProductsAction(
  workspaceId: string,
  includeInactive: boolean = false
): Promise<{ success: boolean; products?: Product[]; error?: string }> {
  try {
    if (!workspaceId) return { success: true, products: [] };

    let q = adminDb.collection('products').where('workspaceId', '==', workspaceId);
    if (!includeInactive) {
      q = q.where('isActive', '==', true);
    }

    const snap = await q.get();
    const products: Product[] = snap.docs.map(doc => doc.data() as Product);
    products.sort((a, b) => a.name.localeCompare(b.name));

    return { success: true, products };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to list products';
    console.error('[listProductsAction] Error:', error);
    return { success: false, error: msg };
  }
}

// ==========================================
// 2. PRODUCT CATEGORY ACTIONS
// ==========================================

export async function createProductCategoryAction(
  input: { name: string; description?: string; color?: string; order?: number },
  userId: string,
  workspaceId: string,
  organizationId: string = 'default'
): Promise<{ success: boolean; category?: ProductCategory; error?: string }> {
  try {
    if (!input.name?.trim()) {
      return { success: false, error: 'Category name is required.' };
    }

    const permission = await canUser(userId, 'operations', 'pipeline', 'create', workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason || 'Permission denied.' };
    }

    const categoryId = `cat_${nanoid(10)}`;
    const category: ProductCategory = {
      id: categoryId,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      color: input.color || '#4f46e5',
      order: typeof input.order === 'number' ? input.order : 0,
      workspaceId,
      organizationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('product_categories').doc(categoryId).set(category);

    return { success: true, category };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create category';
    return { success: false, error: msg };
  }
}

export async function listProductCategoriesAction(
  workspaceId: string
): Promise<{ success: boolean; categories?: ProductCategory[]; error?: string }> {
  try {
    if (!workspaceId) return { success: true, categories: [] };

    const snap = await adminDb.collection('product_categories')
      .where('workspaceId', '==', workspaceId)
      .get();

    const categories: ProductCategory[] = snap.docs.map(doc => doc.data() as ProductCategory);
    categories.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    return { success: true, categories };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to list categories';
    return { success: false, error: msg };
  }
}

// ==========================================
// 3. PRICE BOOK ACTIONS
// ==========================================

export async function createPriceBookAction(
  input: { name: string; description?: string; currency?: string; isStandard?: boolean },
  userId: string,
  workspaceId: string,
  organizationId: string = 'default'
): Promise<{ success: boolean; priceBook?: PriceBook; error?: string }> {
  try {
    if (!input.name?.trim()) {
      return { success: false, error: 'Price book name is required.' };
    }

    const permission = await canUser(userId, 'operations', 'pipeline', 'create', workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason || 'Permission denied.' };
    }

    const priceBookId = `pb_${nanoid(10)}`;
    const now = new Date().toISOString();

    const priceBook: PriceBook = {
      id: priceBookId,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      currency: input.currency || 'USD',
      isStandard: Boolean(input.isStandard),
      isActive: true,
      workspaceId,
      organizationId,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection('price_books').doc(priceBookId).set(priceBook);

    return { success: true, priceBook };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create price book';
    return { success: false, error: msg };
  }
}

export async function listPriceBooksAction(
  workspaceId: string
): Promise<{ success: boolean; priceBooks?: PriceBook[]; error?: string }> {
  try {
    if (!workspaceId) return { success: true, priceBooks: [] };

    const snap = await adminDb.collection('price_books')
      .where('workspaceId', '==', workspaceId)
      .where('isActive', '==', true)
      .get();

    const priceBooks: PriceBook[] = snap.docs.map(doc => doc.data() as PriceBook);
    priceBooks.sort((a, b) => (b.isStandard ? 1 : 0) - (a.isStandard ? 1 : 0) || a.name.localeCompare(b.name));

    return { success: true, priceBooks };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to list price books';
    return { success: false, error: msg };
  }
}

export async function savePriceBookItemsAction(
  priceBookId: string,
  items: Array<{ productId: string; productName: string; customUnitPrice: number; currency?: string; maxDiscountPercent?: number }>,
  userId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const pbSnap = await adminDb.collection('price_books').doc(priceBookId).get();
    if (!pbSnap.exists) {
      return { success: false, error: 'Price book not found.' };
    }

    const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason || 'Permission denied.' };
    }

    const batch = adminDb.batch();
    const now = new Date().toISOString();

    for (const item of items) {
      const itemId = `pbi_${priceBookId}_${item.productId}`;
      const itemRef = adminDb.collection('price_book_items').doc(itemId);
      const payload: PriceBookItem = {
        id: itemId,
        priceBookId,
        productId: item.productId,
        productName: item.productName,
        customUnitPrice: Math.max(0, item.customUnitPrice),
        currency: item.currency || 'USD',
        maxDiscountPercent: typeof item.maxDiscountPercent === 'number' ? Math.min(100, Math.max(0, item.maxDiscountPercent)) : undefined,
        updatedAt: now,
      };
      batch.set(itemRef, payload, { merge: true });
    }

    await batch.commit();
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to save price book items';
    return { success: false, error: msg };
  }
}

export async function getPriceBookItemsAction(
  priceBookId: string
): Promise<{ success: boolean; items?: PriceBookItem[]; error?: string }> {
  try {
    if (!priceBookId) return { success: true, items: [] };

    const snap = await adminDb.collection('price_book_items')
      .where('priceBookId', '==', priceBookId)
      .get();

    const items: PriceBookItem[] = snap.docs.map(doc => doc.data() as PriceBookItem);
    return { success: true, items };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to get price book items';
    return { success: false, error: msg };
  }
}
