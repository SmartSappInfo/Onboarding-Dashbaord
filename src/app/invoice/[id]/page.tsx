import { notFound } from 'next/navigation';
import { getPublicInvoiceAction } from '@/lib/billing-actions';
import InvoicePortalClient from './InvoicePortalClient';
import type { Metadata } from 'next';

/**
 * @fileOverview Public Invoice Portal (Server Entry).
 * Handles high-fidelity rendering of institutional bills without authentication.
 */

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const result = await getPublicInvoiceAction(id);

    if (!result.success || !result.invoice) {
        return { title: 'Invoice Not Found' };
    }

    return {
        title: `Invoice ${result.invoice.invoiceNumber} — SmartSapp`,
        description: `Institutional bill for ${result.invoice.schoolName}.`,
    };
}

export default async function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const result = await getPublicInvoiceAction(id);

    if (!result.success || !result.invoice) {
        notFound();
    }

    return <InvoicePortalClient invoice={result.invoice} />;
}
