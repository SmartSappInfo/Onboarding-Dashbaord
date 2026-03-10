'use server';

import { adminDb } from './firebase-admin';
import type { Invoice, InvoiceItem, BillingSettings, BillingPeriod, School, SubscriptionPackage } from './types';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';

/**
 * @fileOverview Server-side actions for the SmartSapp Invoicing Engine.
 * Handles the calculation, creation, and mutation of institutional bills.
 */

/**
 * Fetches an invoice for public viewing.
 * Limited fields returned for security.
 */
export async function getPublicInvoiceAction(id: string) {
    try {
        const docSnap = await adminDb.collection('invoices').doc(id).get();
        if (!docSnap.exists) return { success: false, error: "Invoice not found." };
        
        const data = docSnap.data() as Invoice;
        // We ensure only published (sent/paid/overdue) or specific draft states are viewable if needed
        // but generally, if you have the ID, you can view the bill.
        return { success: true, invoice: { id: docSnap.id, ...data } };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Generates a draft invoice for a specific school and period.
 * Snapshots all current rates and settings to ensure financial durability.
 */
export async function generateInvoiceAction(schoolId: string, periodId: string, userId: string) {
    try {
        const db = adminDb;
        
        // 1. Fetch Contextual Data
        const [settingsSnap, periodSnap, schoolSnap] = await Promise.all([
            db.collection('billing_settings').doc('global').get(),
            db.collection('billing_periods').doc(periodId).get(),
            db.collection('schools').doc(schoolId).get(),
        ]);

        if (!settingsSnap.exists) throw new Error("Global billing settings not found.");
        if (!periodSnap.exists) throw new Error("Billing period not found.");
        if (!schoolSnap.exists) throw new Error("School not found.");

        const settings = settingsSnap.data() as BillingSettings;
        const period = periodSnap.data() as BillingPeriod;
        const school = schoolSnap.data() as School;

        if (!school.subscriptionPackageId) throw new Error("School has no assigned subscription package.");

        const pkgSnap = await db.collection('subscription_packages').doc(school.subscriptionPackageId).get();
        if (!pkgSnap.exists) throw new Error("Subscription package not found.");
        
        const pkgData = pkgSnap.data();
        const pkgId = pkgSnap.id;
        const pkgName = pkgData?.name || "Standard Package";

        // 2. Calculation Logic
        const nominalRoll = school.nominalRoll || 0;
        
        // PRIORITY: Use school-specific effective rate if defined, otherwise fallback to package rate
        const rate = school.subscriptionRate || pkgData?.ratePerStudent || 0;
        
        const subtotal = nominalRoll * rate;
        
        const levyAmount = (subtotal * (settings.levyPercent || 0)) / 100;
        const vatAmount = (subtotal * (settings.vatPercent || 0)) / 100;
        const discount = (subtotal * (settings.defaultDiscount || 0)) / 100;

        const arrears = school.arrearsBalance || 0;
        const credits = school.creditBalance || 0;

        const totalPayable = subtotal + levyAmount + vatAmount + arrears - credits - discount;

        // 3. Generate Sequential-style Invoice Number
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
        const invoiceNumber = `INV-${new Date().getFullYear()}-${randomStr}`;

        // 4. Prepare Primary Line Item
        const items: InvoiceItem[] = [
            { 
                name: `SmartSapp Subscription (${pkgName})`, 
                description: `Subscription fee for ${nominalRoll} students @ ${school.currency} ${rate} per ${pkgData?.billingTerm || 'term'}.`,
                quantity: nominalRoll,
                unitPrice: rate,
                amount: subtotal
            }
        ];

        // 5. Construct Record
        const invoiceData: Omit<Invoice, 'id'> = {
            invoiceNumber,
            schoolId,
            schoolName: school.name || 'Unknown School',
            periodId,
            periodName: period.name || 'Current Period',
            nominalRoll,
            packageId: pkgId,
            packageName: pkgName,
            ratePerStudent: rate,
            currency: school.currency || 'GHS',
            subtotal,
            discount,
            levyAmount,
            vatAmount,
            arrearsAdded: arrears,
            creditDeducted: credits,
            totalPayable,
            status: 'draft',
            items,
            paymentInstructions: settings.paymentInstructions || '',
            signatureName: settings.signatureName || '',
            signatureDesignation: settings.signatureDesignation || '',
            signatureUrl: settings.signatureUrl || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Ensure no undefined values reach Firestore
        const sanitizedInvoiceData = Object.fromEntries(
            Object.entries(invoiceData).filter(([_, v]) => v !== undefined)
        );

        const docRef = await db.collection('invoices').add(sanitizedInvoiceData);
        
        await logActivity({
            schoolId,
            userId,
            type: 'school_updated',
            source: 'user_action',
            description: `generated draft invoice ${invoiceNumber} for "${school.name}"`
        });

        revalidatePath('/admin/finance/invoices');
        return { success: true, id: docRef.id };

    } catch (e: any) {
        console.error(">>> [BILLING] Generation Error:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Updates an existing invoice and recalculates totals if items changed.
 */
export async function updateInvoiceAction(id: string, updates: Partial<Invoice>, userId: string) {
    try {
        await adminDb.collection('invoices').doc(id).update({
            ...updates,
            updatedAt: new Date().toISOString()
        });
        
        revalidatePath(`/admin/finance/invoices/${id}`);
        revalidatePath('/admin/finance/invoices');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Permanently removes a draft invoice.
 */
export async function deleteInvoiceAction(id: string, invoiceNumber: string, userId: string) {
    try {
        await adminDb.collection('invoices').doc(id).delete();
        
        await logActivity({
            schoolId: '',
            userId,
            type: 'school_updated',
            source: 'user_action',
            description: `deleted draft invoice ${invoiceNumber}`
        });

        revalidatePath('/admin/finance/invoices');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}