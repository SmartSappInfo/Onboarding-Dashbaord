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
        description: `Institutional bill for ${result.invoice.entityName}.`,
    };
}

import { adminDb } from '@/lib/firebase-admin';
import { getOrgBranding } from '@/lib/org-branding';

export default async function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const result = await getPublicInvoiceAction(id);

    if (!result.success || !result.invoice) {
        notFound();
    }

    let organizationId = null;
    const firstWorkspaceId = result.invoice.workspaceIds?.[0];
    if (firstWorkspaceId) {
        try {
            const wsSnap = await adminDb.collection('workspaces').doc(firstWorkspaceId).get();
            if (wsSnap.exists) {
                organizationId = wsSnap.data()?.organizationId || null;
            }
        } catch (err) {
            console.error('Error fetching workspace for invoice branding:', err);
        }
    }

    const orgBranding = await getOrgBranding(organizationId);
    const primaryColor = orgBranding?.brandPrimaryColor || '#3B5FFF';
    const secondaryColor = orgBranding?.brandSecondaryColor || '#8B5CF6';
    const brandFont = orgBranding?.brandFontFamily || 'Inter';

    const themeStyles = `
        :root {
            --primary: ${primaryColor};
            --secondary: ${secondaryColor};
            --radius: 1rem;
        }
        body {
            font-family: ${brandFont}, sans-serif;
        }
    `;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: themeStyles }} />
            <InvoicePortalClient invoice={result.invoice} orgBranding={orgBranding} />
        </>
    );
}
