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

/**
 * Retrieves all commercial quotes attached to a specific deal.
 */
export async function getDealQuotesAction(
  dealId: string,
  workspaceId?: string
): Promise<{ success: boolean; quotes?: DealQuote[]; error?: string }> {
  try {
    let q = adminDb.collection('deal_quotes').where('dealId', '==', dealId);
    if (workspaceId) {
      q = q.where('workspaceId', '==', workspaceId);
    }
    const snap = await q.get();
    const quotes: DealQuote[] = snap.docs.map(doc => doc.data() as DealQuote);
    // Sort chronologically descending
    quotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, quotes };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch deal quotes';
    console.error('[getDealQuotesAction] Error:', error);
    return { success: false, error: msg };
  }
}

/**
 * Retrieves a public quote safely via its unique 32-character crypto token.
 */
export async function getPublicQuoteByTokenAction(
  token: string
): Promise<{ success: boolean; quote?: DealQuote; error?: string }> {
  try {
    if (!token || typeof token !== 'string' || token.length < 16) {
      return { success: false, error: 'Invalid or missing quote token.' };
    }

    const snap = await adminDb.collection('deal_quotes').where('token', '==', token).limit(1).get();
    if (snap.empty) {
      return { success: false, error: 'Proposal not found or the link has expired.' };
    }

    const quote = snap.docs[0].data() as DealQuote;
    return { success: true, quote };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve proposal.';
    console.error('[getPublicQuoteByTokenAction] Error:', error);
    return { success: false, error: msg };
  }
}

/**
 * Updates the lifecycle status of a commercial quote (e.g. draft -> sent -> accepted -> declined).
 */
export async function updateQuoteStatusAction(
  quoteId: string,
  status: DealQuote['status'],
  notes?: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const quoteRef = adminDb.collection('deal_quotes').doc(quoteId);
    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists) {
      return { success: false, error: 'Quote not found.' };
    }

    const quote = quoteSnap.data() as DealQuote;

    if (userId) {
      const permission = await canUser(userId, 'operations', 'pipeline', 'edit', quote.workspaceId);
      if (!permission.granted) {
        return { success: false, error: permission.reason || 'Permission denied.' };
      }
    }

    const timestamp = new Date().toISOString();
    const updates: Partial<DealQuote> = {
      status,
      updatedAt: timestamp,
    };
    if (notes !== undefined) {
      updates.notes = notes;
    }

    await quoteRef.update(updates);

    await logActivity({
      organizationId: quote.organizationId,
      entityId: quote.entityId,
      userId: userId || null,
      workspaceId: quote.workspaceId,
      type: 'deal_updated',
      source: userId ? 'user' : 'system',
      description: `marked commercial quote #${quote.quoteNumber} as "${status}"`,
      metadata: {
        quoteId,
        quoteNumber: quote.quoteNumber,
        dealId: quote.dealId,
        status,
      },
    });

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update quote status';
    console.error('[updateQuoteStatusAction] Error:', error);
    return { success: false, error: msg };
  }
}

/**
 * Public recipient digital sign-off handler.
 * Validates the quote token and records customer acceptance.
 */
export async function acceptPublicQuoteAction(
  token: string,
  signatoryName: string,
  signatoryEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!token || !signatoryName?.trim()) {
      return { success: false, error: 'Signatory name is required to accept this proposal.' };
    }

    const snap = await adminDb.collection('deal_quotes').where('token', '==', token).limit(1).get();
    if (snap.empty) {
      return { success: false, error: 'Proposal not found or expired.' };
    }

    const quoteDoc = snap.docs[0];
    const quote = quoteDoc.data() as DealQuote;

    if (quote.status === 'accepted') {
      return { success: true }; // Idempotent success
    }

    if (quote.status === 'declined' || quote.status === 'expired') {
      return { success: false, error: `This quote is currently ${quote.status} and cannot be accepted.` };
    }

    const timestamp = new Date().toISOString();

    await quoteDoc.ref.update({
      status: 'accepted',
      recipientName: signatoryName.trim(),
      recipientEmail: signatoryEmail?.trim() || quote.recipientEmail || null,
      updatedAt: timestamp,
      acceptedAt: timestamp,
    });

    // Also update parent deal probability to 100% and notify
    if (quote.dealId) {
      try {
        const dealRef = adminDb.collection('deals').doc(quote.dealId);
        await dealRef.update({
          probability: 100,
          forecastCategory: 'closed',
          updatedAt: timestamp,
        });
      } catch (dealErr) {
        console.error('[acceptPublicQuoteAction] Parent deal update notice:', dealErr);
      }
    }

    await logActivity({
      organizationId: quote.organizationId,
      entityId: quote.entityId,
      userId: null,
      workspaceId: quote.workspaceId,
      type: 'deal_updated',
      source: 'system',
      description: `customer ${signatoryName.trim()} accepted commercial quote #${quote.quoteNumber}`,
      metadata: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        dealId: quote.dealId,
        signatoryName: signatoryName.trim(),
        signatoryEmail: signatoryEmail?.trim() || null,
      },
    });

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to accept proposal.';
    console.error('[acceptPublicQuoteAction] Error:', error);
    return { success: false, error: msg };
  }
}

/**
 * Converts a commercial quote directly into a formal finance invoice draft.
 */
export async function convertQuoteToInvoiceAction(
  quoteId: string,
  workspaceId: string,
  userId?: string
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    const quoteRef = adminDb.collection('deal_quotes').doc(quoteId);
    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists) {
      return { success: false, error: 'Quote not found.' };
    }

    const quote = quoteSnap.data() as DealQuote;

    if (userId) {
      const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
      if (!permission.granted) {
        return { success: false, error: permission.reason || 'Permission denied.' };
      }
    }

    const invoiceNumber = `INV-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    const invoiceItems = quote.lineItems.map(item => ({
      name: item.name,
      description: item.description || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.total,
    }));

    const invoiceData = {
      invoiceNumber,
      organizationId: quote.organizationId,
      workspaceIds: [workspaceId],
      entityId: quote.entityId,
      entityName: quote.entityName,
      recipientName: quote.recipientName || '',
      recipientEmail: quote.recipientEmail || '',
      currency: quote.currency || 'USD',
      subtotal: quote.subtotal,
      totalDiscount: quote.totalDiscount,
      totalTax: quote.totalTax,
      totalPayable: quote.grandTotal,
      status: 'draft',
      issueDate: timestamp.split('T')[0],
      dueDate: quote.validUntil ? quote.validUntil.split('T')[0] : timestamp.split('T')[0],
      items: invoiceItems,
      notes: quote.notes || '',
      terms: quote.terms || 'Payment due within 30 days of invoice.',
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        dealId: quote.dealId,
      },
    };

    const invDocRef = await adminDb.collection('invoices').add(invoiceData);

    // Update quote status to accepted or linked
    await quoteRef.update({
      status: 'accepted',
      invoiceId: invDocRef.id,
      updatedAt: timestamp,
    });

    await logActivity({
      organizationId: quote.organizationId,
      entityId: quote.entityId,
      userId: userId || null,
      workspaceId,
      type: 'deal_updated',
      source: userId ? 'user' : 'system',
      description: `converted commercial quote #${quote.quoteNumber} to invoice ${invoiceNumber}`,
      metadata: {
        quoteId: quote.id,
        invoiceId: invDocRef.id,
        invoiceNumber,
        grandTotal: quote.grandTotal,
      },
    });

    return { success: true, invoiceId: invDocRef.id };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to convert quote to invoice';
    console.error('[convertQuoteToInvoiceAction] Error:', error);
    return { success: false, error: msg };
  }
}

/**
 * Deletes a commercial quote document.
 */
export async function deleteDealQuoteAction(
  quoteId: string,
  workspaceId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const quoteRef = adminDb.collection('deal_quotes').doc(quoteId);
    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists) {
      return { success: false, error: 'Quote not found.' };
    }

    const quote = quoteSnap.data() as DealQuote;

    if (userId) {
      const permission = await canUser(userId, 'operations', 'pipeline', 'delete', workspaceId);
      if (!permission.granted) {
        return { success: false, error: permission.reason || 'Permission denied.' };
      }
    }

    await quoteRef.delete();

    await logActivity({
      organizationId: quote.organizationId,
      entityId: quote.entityId,
      userId: userId || null,
      workspaceId,
      type: 'deal_updated',
      source: userId ? 'user' : 'system',
      description: `deleted commercial quote #${quote.quoteNumber}`,
      metadata: {
        quoteId,
        quoteNumber: quote.quoteNumber,
        dealId: quote.dealId,
      },
    });

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete quote';
    console.error('[deleteDealQuoteAction] Error:', error);
    return { success: false, error: msg };
  }
}
