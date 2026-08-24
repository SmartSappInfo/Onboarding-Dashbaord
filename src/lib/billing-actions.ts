'use server';

/**
 * SmartSapp Finance 2.0 - Billing & Invoicing Actions
 * Comprehensive server actions for invoice creation, issuance, lifecycle transitions,
 * snapshot freezing, voiding with ledger reversals, and tokenized public viewing.
 */

import { adminDb } from './firebase-admin';
import { resolveContact } from './contact-adapter';
import type { Invoice, BillingProfile, BillingPeriod } from './types';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import { canUser } from './workspace-permissions';

import { FinancialAccountService } from './services/financial-account-service';
import { FinancialEventService } from './services/financial-event-service';
import { InvoiceSequenceService } from './services/invoice-sequence-service';
import { InvoiceLifecycleService } from './services/invoice-lifecycle-service';
import { FinancialApprovalService } from './services/financial-approval-service';
import { FinancialAuditService } from './services/financial-audit-service';
import crypto from 'crypto';

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
 * Checks direct document ID or tokenized publicToken UUID.
 */
export async function getPublicInvoiceAction(id: string): Promise<ActionResponse> {
    try {
        let docSnap = await adminDb.collection('invoices').doc(id).get();
        
        if (!docSnap.exists) {
            const tokenSnap = await adminDb.collection('invoices').where('publicToken', '==', id).limit(1).get();
            if (!tokenSnap.empty) {
                docSnap = tokenSnap.docs[0];
            } else {
                return { success: false, error: 'Invoice not found.' };
            }
        }
        
        const data = docSnap.data() as Invoice;

        // Prevent public viewing of unfinalized draft invoices
        if (data.status === 'draft' || data.lifecycleStatus === 'draft') {
            return { success: false, error: 'Draft invoices cannot be accessed publicly prior to official issuance.' };
        }
        
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
 * @param workspaceId - Workspace ID
 */
export async function getInvoicesByEntityAction(entityId: string, workspaceId: string): Promise<ActionResponse> {
    try {
        if (!entityId || !workspaceId) return { success: true, invoices: [] };
        
        const snap = await adminDb.collection('invoices')
            .where('entityId', '==', entityId)
            .where('workspaceIds', 'array-contains', workspaceId)
            .orderBy('createdAt', 'desc')
            .get();

        const invoices = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Invoice, 'id'>) }));
        return { success: true, invoices };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to retrieve invoices';
        return { success: false, error: message };
    }
}

/**
 * Generates a draft invoice from institutional configuration.
 * Auto-provisions FinancialAccount and assigns sequential draft number.
 * 
 * @param contactId - Target contact/entity ID
 * @param periodId - Billing cycle ID
 * @param profileId - Billing profile ID
 * @param userId - Requesting user UID
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

        // 3. Generate Sequence Number & Public Token
        const invoiceNumber = await InvoiceSequenceService.getNextInvoiceNumber(activeWorkspaceId, 'DRAFT');
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
            lifecycleStatus: 'draft',
            paymentStatus: 'unpaid',
            collectionStatus: 'none',
            items: [
                { 
                    name: `Subscription (${school.subscriptionPackageName || 'Standard'})`, 
                    description: `Billing cycle fee for ${nominalRoll} enrolled units/members.`,
                    quantity: nominalRoll, 
                    unitPrice: rate,
                    amount: Math.round((nominalRoll * rate) * 100) / 100
                }
            ],
            paymentInstructions: profile.paymentInstructions || 'Direct bank transfer to SmartSapp Collection Account.',
            signatureName: profile.signatureName || 'Finance Administrator',
            signatureDesignation: profile.signatureDesignation || 'Head of Financial Operations',
            signatureUrl: profile.signatureUrl || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            workspaceIds: [activeWorkspaceId],
            billingProfileId: profileId
        };

        const docRef = await db.collection('invoices').add(invoiceData);
        
        await logActivity({
            userId,
            organizationId,
            workspaceId: activeWorkspaceId,
            type: 'status_change',
            source: 'finance_engine',
            description: `Generated draft invoice ${invoiceNumber} for ${school.name || contact.name}`,
            entityId,
            entityName: school.name || contact.name,
            metadata: {
                invoiceId: docRef.id,
                invoiceNumber,
                totalPayable,
                periodId
            }
        });

        revalidatePath('/admin/finance/invoices');
        return { success: true, id: docRef.id };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to generate invoice';
        return { success: false, error: message };
    }
}

/**
 * Updates an invoice record or publishes a draft into an official issued invoice.
 * Enforces atomic sub-ledger posting, sequential numbering, and snapshot freezing.
 */
export async function updateInvoiceAction(
    id: string, 
    updates: Partial<Invoice>, 
    userId: string
): Promise<ActionResponse> {
    try {
        const existingDoc = await adminDb.collection('invoices').doc(id).get();
        if (!existingDoc.exists) throw new Error('Invoice not found');
        
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

        // If transitioning from draft to sent/issued, run atomic issuance routine
        const isBecomingIssued = (updates.status === 'sent' || updates.status === 'issued') && existingInvoice.status === 'draft';
        
        let accountId = existingInvoice.accountId;
        if (isBecomingIssued && !accountId && existingInvoice.entityId) {
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

        if (isBecomingIssued && accountId) {
            await adminDb.runTransaction(async (tx) => {
                const invRef = adminDb.collection('invoices').doc(id);

                await InvoiceLifecycleService.issueInvoiceInTx(
                    tx,
                    invRef,
                    { ...existingInvoice, ...updates, id } as Invoice,
                    userId,
                    workspaceId,
                    accountId!
                );
            });

            FinancialEventService.emitInvoiceIssued(
                { ...existingInvoice, ...updates, id } as Invoice,
                userId
            ).catch(err => console.error('[BILLING_ACTION] Event emit error:', err));
        } else {
            await adminDb.collection('invoices').doc(id).update(safeUpdates);
        }
        
        revalidatePath('/admin/finance/invoices');
        revalidatePath(`/admin/finance/invoices/${id}`);
        return { success: true };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to update invoice';
        return { success: false, error: message };
    }
}

/**
 * Controlled invoice voiding with compensating sub-ledger reversal and allocation release.
 */
export async function voidInvoiceAction(
    invoiceId: string,
    voidReason: string,
    userId: string,
    userName: string = 'Authorized Staff'
): Promise<ActionResponse<{ requiresApproval?: boolean }>> {
    try {
        const invSnap = await adminDb.collection('invoices').doc(invoiceId).get();
        if (!invSnap.exists) return { success: false, error: 'Invoice not found' };

        const invoice = { id: invSnap.id, ...(invSnap.data() as Omit<Invoice, 'id'>) };
        const workspaceId = invoice.workspaceIds?.[0] || 'default';

        const permission = await canUser(userId, 'finance', 'invoices', 'delete', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        // 1. Check if workspace approval policy requires managerial signoff
        const needsApproval = await FinancialApprovalService.requiresApproval(
            workspaceId,
            'void_issued_invoice',
            Number(invoice.totalPayable || 0)
        );

        if (needsApproval && invoice.status !== 'draft') {
            await FinancialApprovalService.createApprovalRequest({
                organizationId: invoice.organizationId || 'default',
                workspaceId,
                requestType: 'void_issued_invoice',
                referenceId: invoiceId,
                referenceNumber: invoice.invoiceNumber,
                entityId: invoice.entityId || '',
                entityName: invoice.entityName || 'Customer',
                amount: Number(invoice.totalPayable || 0),
                currency: invoice.currency || 'GHS',
                reason: voidReason,
                requestedByUserId: userId,
                requestedByName: userName,
            });

            return {
                success: true,
                data: { requiresApproval: true },
                error: undefined,
            };
        }

        // 2. Direct voiding execution
        const res = await InvoiceLifecycleService.voidInvoice({
            invoiceId,
            voidReason,
            userId,
        });

        if (res.success) {
            // 3. Log to immutable FinancialAuditService
            await FinancialAuditService.logAction({
                workspaceId,
                organizationId: invoice.organizationId || undefined,
                action: 'invoice.voided',
                entityId: invoice.entityId || undefined,
                entityName: invoice.entityName || undefined,
                documentType: 'invoice',
                documentId: invoiceId,
                documentNumber: invoice.invoiceNumber,
                amount: Number(invoice.totalPayable || 0),
                currency: invoice.currency || 'GHS',
                performedByUserId: userId,
                performedByName: userName,
                changeSummary: `Voided invoice ${invoice.invoiceNumber}. Reason: ${voidReason}`,
            });

            revalidatePath('/admin/finance/invoices');
            revalidatePath(`/admin/finance/invoices/${invoiceId}`);
            return { success: true };
        }

        return { success: false, error: res.error };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to void invoice';
        return { success: false, error: message };
    }
}

/**
 * Flags an invoice as disputed with audit trail.
 */
export async function disputeInvoiceAction(
    invoiceId: string,
    disputeReason: string,
    userId: string
): Promise<ActionResponse> {
    try {
        const invSnap = await adminDb.collection('invoices').doc(invoiceId).get();
        if (!invSnap.exists) return { success: false, error: 'Invoice not found' };

        const invoice = invSnap.data() as Invoice;
        const workspaceId = invoice.workspaceIds?.[0] || 'default';

        const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const res = await InvoiceLifecycleService.disputeInvoice(invoiceId, disputeReason, userId);
        if (res.success) {
            revalidatePath('/admin/finance/invoices');
            revalidatePath(`/admin/finance/invoices/${invoiceId}`);
            return { success: true };
        }

        return { success: false, error: res.error };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to dispute invoice';
        return { success: false, error: message };
    }
}

/**
 * Permanently removes an unfinalized draft invoice record.
 */
export async function deleteInvoiceAction(
    id: string, 
    invoiceNumber: string, 
    userId: string
): Promise<ActionResponse> {
    try {
        const docSnap = await adminDb.collection('invoices').doc(id).get();
        if (!docSnap.exists) throw new Error('Invoice not found');
        
        const invoiceData = docSnap.data() as Invoice;
        if (invoiceData.status !== 'draft') {
            throw new Error('Issued or finalized invoices cannot be deleted. Use Void Invoice instead.');
        }

        const workspaceId = invoiceData.workspaceIds?.[0] || 'default';
        const permission = await canUser(userId, 'finance', 'invoices', 'delete', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        await adminDb.collection('invoices').doc(id).delete();
        
        await logActivity({
            userId,
            organizationId: invoiceData.organizationId || 'default',
            workspaceId,
            type: 'status_change',
            source: 'finance_engine',
            description: `Deleted draft invoice ${invoiceNumber}`,
            entityId: invoiceData.entityId || undefined,
            entityName: invoiceData.entityName || undefined,
            metadata: { invoiceNumber }
        });

        revalidatePath('/admin/finance/invoices');
        return { success: true };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to delete invoice';
        return { success: false, error: message };
    }
}
