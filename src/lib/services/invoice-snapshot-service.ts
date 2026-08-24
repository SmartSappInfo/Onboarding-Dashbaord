/**
 * SmartSapp Finance 2.0 - Invoice Snapshot Service
 * Captures immutable point-in-time entity, profile, line items, and tax snapshots upon invoice issuance.
 * 
 * Invariants:
 * 1. Once finalized and issued, subsequent entity or billing profile mutations NEVER alter this snapshot.
 * 2. Public portal & printable views exclusively render from this snapshot.
 */

import { adminDb } from '../firebase-admin';
import { Invoice, InvoiceSnapshot, BillingProfile } from '../types';

export class InvoiceSnapshotService {
  /**
   * Generates an immutable snapshot for an invoice being finalized/issued.
   */
  static async createSnapshot(
    invoice: Invoice,
    billingProfile?: BillingProfile | null
  ): Promise<InvoiceSnapshot> {
    const timestamp = new Date().toISOString();

    // 1. Resolve Billing Profile if not passed
    let profile = billingProfile;
    if (!profile && invoice.billingProfileId) {
      try {
        const snap = await adminDb.collection('billing_profiles').doc(invoice.billingProfileId).get();
        if (snap.exists) {
          profile = { id: snap.id, ...(snap.data() as Omit<BillingProfile, 'id'>) };
        }
      } catch (err) {
        console.error('[INVOICE_SNAPSHOT] Failed to resolve billing profile:', err);
      }
    }

    // 2. Resolve Entity Details if available
    let entitySlug: string | undefined;
    let entityPhone: string | undefined;
    let entityEmail: string | undefined;
    let entityAddress: string | undefined;

    if (invoice.entityId) {
      try {
        const entitySnap = await adminDb.collection('workspace_entities').doc(invoice.entityId).get();
        if (entitySnap.exists) {
          const entityData = entitySnap.data() || {};
          entitySlug = entityData.slug || undefined;
          entityPhone = entityData.primaryPhone || entityData.phone || undefined;
          entityEmail = entityData.primaryEmail || entityData.email || undefined;
          entityAddress = entityData.address || entityData.location || undefined;
        }
      } catch (err) {
        console.error('[INVOICE_SNAPSHOT] Failed to resolve entity details:', err);
      }
    }

    // 3. Assemble Immutable Snapshot
    const snapshot: InvoiceSnapshot = {
      snapshotAt: timestamp,
      entityName: invoice.entityName || 'Organization',
      entitySlug,
      entityPhone,
      entityEmail,
      entityAddress,
      billingProfileName: profile?.name || 'Standard Billing Profile',
      vatPercent: Number(profile?.vatPercent || 0),
      levyPercent: Number(profile?.levyPercent || 0),
      currency: invoice.currency || 'GHS',
      bankName: undefined,
      bankAccountNumber: undefined,
      bankBranch: undefined,
      bankSortCode: undefined,
      remittanceInstructions: invoice.paymentInstructions || profile?.paymentInstructions || undefined,
      items: (invoice.items || []).map((item) => {
        const qty = Number(item.quantity) || 1;
        const price = Math.round((Number(item.unitPrice) || 0) * 100) / 100;
        return {
          name: item.name,
          description: item.description || '',
          quantity: qty,
          unitPrice: price,
          amount: Math.round((qty * price) * 100) / 100,
        };
      }),
      subtotal: Math.round((Number(invoice.subtotal) || 0) * 100) / 100,
      vatAmount: Math.round((Number(invoice.vatAmount) || 0) * 100) / 100,
      levyAmount: Math.round((Number(invoice.levyAmount) || 0) * 100) / 100,
      discount: Math.round((Number(invoice.discount) || 0) * 100) / 100,
      totalPayable: Math.round((Number(invoice.totalPayable) || 0) * 100) / 100,
    };

    return snapshot;
  }
}
