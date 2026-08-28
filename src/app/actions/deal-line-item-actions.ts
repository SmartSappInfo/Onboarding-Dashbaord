'use server';

/**
 * @fileoverview Deal Line Items & Commercials Server Actions
 *
 * ARCHITECTURAL POINTER (Deal Line Items & Quotes Engine):
 * Manages product/service line items attached to a Deal opportunity.
 * - Enforces multi-tenant workspace verification and RBAC permissions.
 * - Recalculates subtotal, discounts, taxes, and grandTotal server-side using pure `calculateLineItemsTotals`.
 * - Synchronizes grandTotal with `deal.value` to guarantee single-source-of-truth accuracy.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All actions must remain strictly typed with zero 'any' or 'any[]'.
 * - Line item totals must always be validated server-side.
 *
 * TESTABILITY POINTER:
 * Covered by unit tests in `src/app/actions/__tests__/deal-line-item-actions.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { canUser } from '@/lib/workspace-permissions';
import { logActivity } from '@/lib/activity-logger';
import { calculateLineItemsTotals } from '@/lib/deals/deal-health-engine';
import type { Deal, DealLineItem, DealQuote } from '@/lib/types';
import { nanoid } from 'nanoid';

export interface SaveLineItemsResponse {
  success: boolean;
  grandTotal?: number;
  error?: string;
}

/**
 * Saves line items for a deal and updates deal.value with the calculated grand total.
 */
export async function saveDealLineItemsAction(
  dealId: string,
  lineItems: DealLineItem[],
  userId?: string
): Promise<SaveLineItemsResponse> {
  try {
    const dealRef = adminDb.collection('deals').doc(dealId);
    const dealSnap = await dealRef.get();
    if (!dealSnap.exists) {
      return { success: false, error: 'Deal not found' };
    }

    const deal = dealSnap.data() as Deal;

    if (userId) {
      const permission = await canUser(userId, 'operations', 'pipeline', 'edit', deal.workspaceId);
      if (!permission.granted) {
        return { success: false, error: permission.reason || 'Permission denied.' };
      }
    }

    // ARCHITECTURAL POINTER (Rule 10 - Numerical Invariant Hardening):
    // Sanitize item rows server-side to prevent negative quantities, negative prices,
    // or discount percentages > 100% from corrupting deal valuation.
    const sanitizedItems: DealLineItem[] = lineItems.map(item => {
      const quantity = Math.max(1, typeof item.quantity === 'number' && !Number.isNaN(item.quantity) ? Math.floor(item.quantity) : 1);
      const unitPrice = Math.max(0, typeof item.unitPrice === 'number' && !Number.isNaN(item.unitPrice) ? item.unitPrice : 0);
      const discount = Math.max(0, typeof item.discount === 'number' && !Number.isNaN(item.discount) ? item.discount : 0);
      const discountPercent = Math.min(100, Math.max(0, typeof item.discountPercent === 'number' && !Number.isNaN(item.discountPercent) ? item.discountPercent : 0));
      const taxRate = Math.max(0, typeof item.taxRate === 'number' && !Number.isNaN(item.taxRate) ? item.taxRate : 0);

      const rowSubtotal = quantity * unitPrice;
      let rowDiscount = discount;
      if (discountPercent > 0) {
        rowDiscount += (rowSubtotal * discountPercent) / 100;
      }
      const taxable = Math.max(0, rowSubtotal - rowDiscount);
      const rowTax = (taxable * taxRate) / 100;
      const total = Math.max(0, taxable + rowTax);

      return {
        ...item,
        quantity,
        unitPrice,
        discount,
        discountPercent,
        taxRate,
        total,
      };
    });

    // Server-side calculation of line item totals
    const totals = calculateLineItemsTotals(sanitizedItems);
    const timestamp = new Date().toISOString();

    await dealRef.update({
      lineItems: sanitizedItems,
      value: totals.grandTotal,
      updatedAt: timestamp,
    });

    await logActivity({
      organizationId: deal.organizationId,
      entityId: deal.entityId,
      userId: userId || null,
      workspaceId: deal.workspaceId,
      type: 'deal_updated',
      source: userId ? 'user' : 'system',
      description: `updated line items for deal "${deal.name}" (Grand Total: ${totals.grandTotal})`,
      metadata: {
        dealId,
        lineItemsCount: lineItems.length,
        grandTotal: totals.grandTotal,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        totalTax: totals.totalTax,
      },
    });

    return {
      success: true,
      grandTotal: totals.grandTotal,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to save line items';
    console.error('[saveDealLineItemsAction] Error:', error);
    return { success: false, error: msg };
  }
}

export interface CreateQuoteResponse {
  success: boolean;
  quote?: DealQuote;
  error?: string;
}

/**
 * Generates a formal commercial quote document from deal line items.
 */
export async function createDealQuoteAction(
  dealId: string,
  quoteData: {
    recipientName?: string;
    recipientEmail?: string;
    validDays?: number;
    notes?: string;
    terms?: string;
  },
  userId?: string
): Promise<CreateQuoteResponse> {
  try {
    const dealRef = adminDb.collection('deals').doc(dealId);
    const dealSnap = await dealRef.get();
    if (!dealSnap.exists) {
      return { success: false, error: 'Deal not found' };
    }

    const deal = dealSnap.data() as Deal;

    if (userId) {
      const permission = await canUser(userId, 'operations', 'pipeline', 'edit', deal.workspaceId);
      if (!permission.granted) {
        return { success: false, error: permission.reason || 'Permission denied.' };
      }
    }

    const lineItems = deal.lineItems || [];
    const totals = calculateLineItemsTotals(lineItems);
    const timestamp = new Date().toISOString();
    const validDays = quoteData.validDays || 30;
    const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();

    const quoteId = `quote_${nanoid(12)}`;
    const quoteNumber = `Q-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;
    const token = nanoid(32);

    const quote: DealQuote = {
      id: quoteId,
      quoteNumber,
      dealId: deal.id,
      workspaceId: deal.workspaceId,
      organizationId: deal.organizationId,
      entityId: deal.entityId,
      entityName: deal.name,
      recipientName: quoteData.recipientName,
      recipientEmail: quoteData.recipientEmail,
      lineItems,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      totalTax: totals.totalTax,
      grandTotal: totals.grandTotal,
      currency: deal.currency || 'USD',
      status: 'draft',
      validUntil,
      notes: quoteData.notes,
      terms: quoteData.terms,
      token,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await adminDb.collection('deal_quotes').doc(quoteId).set(quote);

    await logActivity({
      organizationId: deal.organizationId,
      entityId: deal.entityId,
      userId: userId || null,
      workspaceId: deal.workspaceId,
      type: 'deal_updated',
      source: userId ? 'user' : 'system',
      description: `generated commercial quote #${quoteNumber} for deal "${deal.name}" (${quote.currency} ${totals.grandTotal})`,
      metadata: {
        dealId,
        quoteId,
        quoteNumber,
        grandTotal: totals.grandTotal,
      },
    });

    return {
      success: true,
      quote,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to generate quote';
    console.error('[createDealQuoteAction] Error:', error);
    return { success: false, error: msg };
  }
}
