'use server';

import { adminDb } from './firebase-admin';
import { resolveContact } from './contact-adapter';
import type { Invoice, BillingProfile, BillingPeriod } from './types';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import { canUser } from './workspace-permissions';

import { FinancialAccountService } from './services/financial-account-service';
import { LedgerService } from './services/ledger-service';
import { FinancialEventService } from './services/financial-event-service';
import crypto from 'crypto';

/**
 * @fileOverview Server-side actions for the Invoicing Engine.
 * Supports multi-workspace scoping, strict typing, and zero `any` usage.
 */

export interface ActionResponse<T = undefined> {
    success: boolean;
    error?: string;
    id?: string;
    invoice?: Invoice;
    invoices?: Invoice[];
    data?: T;
}

/**
 * Fetches an invoice for public viewing without authentication requirement.
 */
export async function getPublicInvoiceAction(id: string): Promise<ActionResponse> {
    try {
        const docSnap = await adminDb.collection('invoices').doc(id).get();
        if (!docSnap.exists) {
            return { success: false, error: 'Invoice not found.' };
        }
        
        const data = docSnap.data() as Invoice;
        return { success: true, invoice: { ...data, id: docSnap.id } };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to retrieve invoice';
        return { success: false, error: message };
    }
}

/**
 * Fetches invoices for a specific entity.
 * 
 * @param entityId - Canonical entity ID
 * @param workspaceId - Optional workspace filter
 */
export async function getInvoicesForContactAction(
    entityId: string,
    workspaceId?: string
): Promise<ActionResponse> {
    try {
        const db = adminDb;
        let invoiceQuery: FirebaseFirestore.Query = db.collection('invoices');
        
        if (entityId) {
            invoiceQuery = invoiceQuery.where('entityId', '==', entityId);
        } else {
            throw new Error('Entity ID must be provided');
        }
        
        if (workspaceId) {
            invoiceQuery = invoiceQuery.where('workspaceIds', 'array-contains', workspaceId);
        }
        
        invoiceQuery = invoiceQuery.orderBy('createdAt', 'desc');
        
        const snapshot = await invoiceQuery.get();
        const invoices = snapshot.docs.map((doc) => ({
            ...(doc.data() as Invoice),
            id: doc.id
        }));
        
        return { success: true, invoices };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to retrieve invoices for entity';
        return { success: false, error: message, invoices: [] };
    }
}

/**
 * Generates a draft invoice for a specific entity and period using a selected profile.
 * 
 * @param contactId - Either entityId or document ID
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
): Promise<ActionResponse> {
    try {
        // 0. Permission Check
        const permission = await canUser(userId, 'finance', 'invoices', 'create', activeWorkspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const db = adminDb;
        
        // 1. Fetch Contextual Data
        const [profileSnap, periodSnap] = await Promise.all([
            db.collection('billing_profiles').doc(profileId).get(),
            db.collection('billing_periods').doc(periodId).get(),
        ]);

        if (!profileSnap.exists) throw new Error('Billing profile not found.');
        if (!periodSnap.exists) throw new Error('Billing cycle not found.');

        const profile = profileSnap.data() as BillingProfile;
        const period = periodSnap.data() as BillingPeriod;

        // Resolve contact from entities & workspace_entities via adapter
        const contact = await resolveContact(contactId, activeWorkspaceId);
        if (!contact || !contact.schoolData) throw new Error('Institutional record missing.');
        
        const school = contact.schoolData;
        const entityId = contact.id;
        const entityType = contact.entityType || 'institution';
        const organizationId = school.organizationId || profile.organizationId || 'default';

        // Auto-provision or retrieve linked financial account
        const financialAccount = await FinancialAccountService.getOrCreateFinancialAccount({
            entityId,
            workspaceId: activeWorkspaceId,
            organizationId,
            entityName: school.name || contact.name || 'Organization',
            currency: school.currency || 'GHS',
            actorId: userId
        });

        const pkgSnap = await db.collection('subscription_packages').doc(school.subscriptionPackageId || 'none').get();
        const pkgData = pkgSnap.exists ? pkgSnap.data() : null;

        // 2. Calculation Logic
        const nominalRoll = Number(school.nominalRoll) || 0;
        const rate = Number(school.subscriptionRate) || Number(pkgData?.ratePerStudent) || 0;
        
        const subtotal = Math.round((nominalRoll * rate) * 100) / 100;
        const levyAmount = Math.round(((subtotal * (Number(profile.levyPercent) || 0)) / 100) * 100) / 100;
        const vatAmount = Math.round(((subtotal * (Number(profile.vatPercent) || 0)) / 100) * 100) / 100;
        const discount = Math.round(((subtotal * (Number(profile.defaultDiscount) || 0)) / 100) * 100) / 100;

        const totalPayable = Math.max(0, Math.round((subtotal + levyAmount + vatAmount + (Number(school.arrearsBalance) || 0) - (Number(school.creditBalance) || 0) - discount) * 100) / 100);

        // 3. Generate Invoice Number & Public Token
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
        const invoiceNumber = `INV-${new Date().getFullYear()}-${randomStr}`;
        const publicToken = crypto.randomUUID();

        // 4. Construct Record
        const invoiceData: Omit<Invoice, 'id'> = {
            organizationId,
            accountId: financialAccount.id,
            publicToken,
            invoiceNumber,
            entityId,
            entityName: school.name || contact.name || 'Organization',
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
            arrearsAdded: Number(school.arrearsBalance) || 0,
            creditDeducted: Number(school.creditBalance) || 0,
            totalPayable,
            amountPaid: 0,
            amountCredited: 0,
            balanceDue: totalPayable,
            status: 'draft',
            paymentStatus: 'unpaid',
            collectionStatus: 'none',
            items: [
                { 
                    name: `Subscription (${school.subscriptionPackageName || 'Standard'})`, 
                    description: `Billing cycle fee for ${nominalRoll} enrolled units/members.`,
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
            workspaceIds: [activeWorkspaceId]
        };

        const docRef = await db.collection('invoices').add(invoiceData);
        
        // Log activity
        await logActivity({
            entityId,
            organizationId,
            userId,
            workspaceId: activeWorkspaceId,
            type: 'entity_updated',
            source: 'user_action',
            description: `generated draft invoice ${invoiceNumber} for "${school.name}"`
        });

        revalidatePath('/admin/finance/invoices');
        return { success: true, id: docRef.id };

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Invoice generation failed';
        console.error('>>> [BILLING] Action Failure:', message);
        return { success: false, error: message };
    }
}

/**
 * Updates an existing invoice record and posts ledger transactions upon issuance.
 */
export async function updateInvoiceAction(
    id: string, 
    updates: Partial<Invoice>, 
    userId: string
): Promise<ActionResponse> {
    try {
        const existingDoc = await adminDb.collection('invoices').doc(id).get();
        if (!existingDoc.exists) {
            throw new Error('Invoice not found');
        }
        
        const existingInvoice = { id: existingDoc.id, ...(existingDoc.data() as Omit<Invoice, 'id'>) };
        const workspaceId = existingInvoice.workspaceIds?.[0] || 'default';

        const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }
        
        const timestamp = new Date().toISOString();
        const safeUpdates: Record<string, unknown> = {
            ...updates,
            entityId: updates.entityId ?? existingInvoice.entityId,
            entityType: updates.entityType ?? existingInvoice.entityType,
            updatedAt: timestamp
        };

        // If transitioning from draft to sent/issued, post ledger debit entry
        const isBecomingIssued = (updates.status === 'sent' || updates.status === 'issued') && existingInvoice.status === 'draft';
        if (isBecomingIssued) {
            safeUpdates.issuedAt = timestamp;
            safeUpdates.sentAt = timestamp;

            // Ensure financial account linkage
            let accountId = existingInvoice.accountId;
            if (!accountId && existingInvoice.entityId) {
                const acc = await FinancialAccountService.getOrCreateFinancialAccount({
                    entityId: existingInvoice.entityId,
                    workspaceId,
                    organizationId: existingInvoice.organizationId || 'default',
                    entityName: existingInvoice.entityName || 'Organization',
                    currency: existingInvoice.currency || 'GHS',
                    actorId: userId
                });
                accountId = acc.id;
                safeUpdates.accountId = acc.id;
            }

            if (accountId && existingInvoice.entityId) {
                const totalDebit = Number(updates.totalPayable ?? existingInvoice.totalPayable) || 0;
                await LedgerService.postTransaction({
                    organizationId: existingInvoice.organizationId || 'default',
                    workspaceId,
                    accountId,
                    entityId: existingInvoice.entityId,
                    transactionType: 'invoice_issued',
                    referenceType: 'invoice',
                    referenceId: id,
                    referenceNumber: existingInvoice.invoiceNumber,
                    debit: totalDebit,
                    credit: 0,
                    currency: existingInvoice.currency || 'GHS',
                    source: 'user',
                    createdBy: userId,
                    description: `Invoice ${existingInvoice.invoiceNumber} issued for ${existingInvoice.currency || 'GHS'} ${totalDebit}`,
                });

                await FinancialEventService.emitInvoiceIssued(
                    { ...existingInvoice, ...updates, id } as Invoice,
                    userId
                );
            }
        }
        
        await adminDb.collection('invoices').doc(id).update(safeUpdates);
        revalidatePath('/admin/finance/invoices');
        revalidatePath(`/admin/finance/invoices/${id}`);
        return { success: true };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to update invoice';
        return { success: false, error: message };
    }
}

/**
 * Permanently removes an invoice record.
 */
export async function deleteInvoiceAction(
    id: string, 
    invoiceNumber: string, 
    userId: string
): Promise<ActionResponse> {
    try {
        const docSnap = await adminDb.collection('invoices').doc(id).get();
        if (!docSnap.exists) throw new Error('Invoice not found');
        const workspaceId = docSnap.data()?.workspaceIds?.[0];

        const permission = await canUser(userId, 'finance', 'invoices', 'delete', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        await adminDb.collection('invoices').doc(id).delete();
        revalidatePath('/admin/finance/invoices');
        return { success: true };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to delete invoice';
        return { success: false, error: message };
    }
}
