
'use server';

import { adminDb } from './firebase-admin';
import type { Invoice, InvoiceItem, BillingProfile, BillingPeriod, School } from './types';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';

/**
 * @fileOverview Server-side actions for the SmartSapp Invoicing Engine.
 * Upgraded to select specific Billing Profiles per workspace.
 */

/**
 * Fetches an invoice for public viewing.
 */
export async function getPublicInvoiceAction(id: string) {
    try {
        const docSnap = await adminDb.collection('invoices').doc(id).get();
        if (!docSnap.exists) return { success: false, error: "Invoice not found." };
        
        const data = docSnap.data() as Invoice;
        return { success: true, invoice: { id: docSnap.id, ...data } };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Generates a draft invoice for a specific school and period using a selected profile.
 */
export async function generateInvoiceAction(
    schoolId: string, 
    periodId: string, 
    profileId: string, 
    userId: string, 
    activeWorkspaceId: string
) {
    try {
        const db = adminDb;
        
        // 1. Fetch Contextual Data
        const [profileSnap, periodSnap, schoolSnap] = await Promise.all([
            db.collection('billing_profiles').doc(profileId).get(),
            db.collection('billing_periods').doc(periodId).get(),
            db.collection('schools').doc(schoolId).get(),
        ]);

        if (!profileSnap.exists) throw new Error("Billing profile not found.");
        if (!periodSnap.exists) throw new Error("Billing cycle not found.");
        if (!schoolSnap.exists) throw new Error("Institutional record missing.");

        const profile = profileSnap.data() as BillingProfile;
        const period = periodSnap.data() as BillingPeriod;
        const school = schoolSnap.data() as School;

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

        // 4. Construct Record
        const invoiceData: Omit<Invoice, 'id'> = {
            invoiceNumber,
            schoolId,
            schoolName: school.name,
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
        
        await logActivity({
            schoolId,
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
 */
export async function updateInvoiceAction(id: string, updates: Partial<Invoice>, userId: string) {
    try {
        await adminDb.collection('invoices').doc(id).update({
            ...updates,
            updatedAt: new Date().toISOString()
        });
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
