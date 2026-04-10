
'use server';

import { adminDb } from './firebase-admin';
import { resolveContact } from './contact-adapter';
import type { Invoice, InvoiceItem, BillingProfile, BillingPeriod, School } from './types';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';

/**
 * @fileOverview Server-side actions for the SmartSapp Invoicing Engine.
 * Upgraded to select specific Billing Profiles per workspace.
 * 
 * FIRESTORE INDEXES REQUIRED (Requirement 22.3):
 * - invoices: (organizationId ASC, entityId ASC, status ASC)
 * - invoices: (workspaceIds ARRAY, entityId ASC, createdAt DESC)
 * - invoices: (workspaceIds ARRAY, entityId ASC, createdAt DESC) [legacy fallback]
 */

/**
 * Fetches an invoice for public viewing.
 */
export async function getPublicInvoiceAction(id: string) {
    try {
        const docSnap = await adminDb.collection('invoices').doc(id).get();
        if (!docSnap.exists) return { success: false, error: "Invoice not found." };
        
        const data = docSnap.data() as Invoice;
        return { success: true, invoice: { ...data, id: docSnap.id } };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Fetches invoices for a specific contact (by entityId or entityId).
 * Supports query fallback pattern (Requirement 8.4, 22.1).
 * 
 * @param contactIdentifier - Object with either entityId or entityId
 * @param workspaceId - Optional workspace filter
 */
export async function getInvoicesForContactAction(
    contactIdentifier: { entityId?: string; entityId?: string },
    workspaceId?: string
) {
    try {
        const db = adminDb;
        let query = db.collection('invoices');
        
        // Prefer entityId when both are provided (Requirement 22.1)
        if (contactIdentifier.entityId) {
            query = query.where('entityId', '==', contactIdentifier.entityId) as any;
        } else if (contactIdentifier.entityId) {
            query = query.where('entityId', '==', contactIdentifier.entityId) as any;
        } else {
            throw new Error("Either entityId or entityId must be provided");
        }
        
        // Add workspace filter if provided
        if (workspaceId) {
            query = query.where('workspaceIds', 'array-contains', workspaceId) as any;
        }
        
        query = query.orderBy('createdAt', 'desc') as any;
        
        const snapshot = await query.get();
        const invoices = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as Invoice[];
        
        return { success: true, invoices };
    } catch (e: any) {
        return { success: false, error: e.message, invoices: [] };
    }
}

/**
 * Generates a draft invoice for a specific contact (school or entity) and period using a selected profile.
 * Supports dual-write pattern: accepts either entityId or entityId, populates both when available.
 * 
 * @param contactId - Either entityId (legacy) or entityId (new)
 * @param periodId - Billing period ID
 * @param profileId - Billing profile ID
 * @param userId - User creating the invoice
 * @param activeWorkspaceId - Active workspace ID
 */
export async function generateInvoiceAction(
    contactId: string, 
    periodId: string, 
    profileId: string, 
    userId: string, 
    activeWorkspaceId: string
) {
    try {
        const db = adminDb;
        
        // 1. Fetch Contextual Data (Updated to use adapter layer - Requirement 18)
        const [profileSnap, periodSnap] = await Promise.all([
            db.collection('billing_profiles').doc(profileId).get(),
            db.collection('billing_periods').doc(periodId).get(),
        ]);

        if (!profileSnap.exists) throw new Error("Billing profile not found.");
        if (!periodSnap.exists) throw new Error("Billing cycle not found.");

        const profile = profileSnap.data() as BillingProfile;
        const period = periodSnap.data() as BillingPeriod;

        // Use adapter to resolve contact from either schools or entities + workspace_entities
        // This supports both legacy entityId and new entityId
        const contact = await resolveContact(contactId, activeWorkspaceId);
        if (!contact || !contact.schoolData) throw new Error("Institutional record missing.");
        
        const school = contact.schoolData;
        
        // Dual-write: Extract both identifiers for backward compatibility
        const entityId = school.id;
        const entityId = contact.entityId || null;
        const entityType = contact.entityType || null;

        const pkgSnap = await db.collection('subscription_packages').doc(school.subscriptionPackageId || 'none').get();
        const pkgData = pkgSnap.exists ? pkgSnap.data() : null;

        // 2. Calculation Logic
        const nominalRoll = school.nominalRoll || 0;
        const rate = school.subscriptionRate || pkgData?.ratePerStudent || 0;
        
        const subtotal = nominalRoll * rate;
        const levyAmount = (subtotal * (profile.levyPercent || 0)) / 100;
        const vatAmount = (subtotal * (profile.vatPercent || 0)) / 100;
        const discount = (subtotal * (profile.defaultDiscount || 0)) / 100;

        const totalPayable = subtotal + levyAmount + vatAmount + (school.arrearsBalance || 0) - (school.creditBalance || 0) - discount;

        // 3. Generate Invoice Number
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
        const invoiceNumber = `INV-${new Date().getFullYear()}-${randomStr}`;

        // 4. Construct Record with dual-write (Requirement 8.1)
        const invoiceData: Omit<Invoice, 'id'> = {
            invoiceNumber,
            // Dual-write: populate both legacy and new fields
            entityId,
            entityName: school.name,
            entityId,
            entityType,
            periodId,
            periodName: period.name,
            nominalRoll,
            packageId: school.subscriptionPackageId || 'custom',
            packageName: school.subscriptionPackageName || 'Standard',
            ratePerStudent: rate,
            currency: school.currency || 'GHS',
            subtotal,
            discount,
            levyAmount,
            vatAmount,
            arrearsAdded: school.arrearsBalance || 0,
            creditDeducted: school.creditBalance || 0,
            totalPayable,
            status: 'draft',
            items: [
                { 
                    name: `SmartSapp Subscription (${school.subscriptionPackageName || 'Standard'})`, 
                    description: `Termly subscription for ${nominalRoll} students.`,
                    quantity: nominalRoll,
                    unitPrice: rate,
                    amount: subtotal
                }
            ],
            billingProfileId: profileId,
            paymentInstructions: profile.paymentInstructions || '',
            signatureName: profile.signatureName || '',
            signatureDesignation: profile.signatureDesignation || '',
            signatureUrl: profile.signatureUrl || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            workspaceIds: [activeWorkspaceId] // Partitioned by active workspace
        };

        const docRef = await db.collection('invoices').add(invoiceData);
        
        // Log activity with dual-write support
        await logActivity({
            entityId,
            organizationId: school.organizationId || 'default',
            userId,
            workspaceId: activeWorkspaceId,
            type: 'school_updated',
            source: 'user_action',
            description: `generated draft invoice ${invoiceNumber} for "${school.name}"`
        });

        revalidatePath('/admin/finance/invoices');
        return { success: true, id: docRef.id };

    } catch (e: any) {
        console.error(">>> [BILLING] Action Failure:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Updates an existing invoice record.
 * Preserves entityId and entityType fields during updates (Requirement 8.2).
 */
export async function updateInvoiceAction(id: string, updates: Partial<Invoice>, userId: string) {
    try {
        // Fetch existing invoice to preserve identifier fields
        const existingDoc = await adminDb.collection('invoices').doc(id).get();
        if (!existingDoc.exists) {
            throw new Error("Invoice not found");
        }
        
        const existingInvoice = existingDoc.data() as Invoice;
        
        // Preserve identifier fields (Requirement 8.2)
        const safeUpdates = {
            ...updates,
            // Ensure these fields are not accidentally removed
            entityId: updates.entityId ?? existingInvoice.entityId: updates.entityId ?? existingInvoice.entityId,
            entityType: updates.entityType ?? existingInvoice.entityType,
            updatedAt: new Date().toISOString()
        };
        
        await adminDb.collection('invoices').doc(id).update(safeUpdates);
        revalidatePath('/admin/finance/invoices');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Permanently removes an invoice record.
 */
export async function deleteInvoiceAction(id: string, invoiceNumber: string, userId: string) {
    try {
        await adminDb.collection('invoices').doc(id).delete();
        revalidatePath('/admin/finance/invoices');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
