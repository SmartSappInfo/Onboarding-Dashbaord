import { adminDb } from '@/lib/firebase-admin';
import type { PDFForm, WorkspaceEntity, Entity, Contract, Submission } from '@/lib/types';
import PdfFormRenderer from './components/PdfFormRenderer';
import { notFound } from 'next/navigation';
import PasswordGatedForm from './components/PasswordGatedForm';
import { Metadata } from 'next';
import { cache } from 'react';
import { resolveSeoMetadata } from '@/lib/seo';

// Force dynamic rendering - requires Firebase Admin
export const dynamic = 'force-dynamic';

interface PageData {
    pdfForm: PDFForm;
    entity?: WorkspaceEntity;
    identity?: Entity;
    initialData?: Record<string, any>;
    isLocked: boolean;
    submissionId?: string;
}

// React.cache dedupes this (and all its sub-reads) between generateMetadata and
// the page body, which call it with identical arguments.
const getPdfFormData = cache(async function getPdfFormData(id: string, querySchoolId?: string): Promise<PageData | null> {
    try {
        // 1. Fetch PDF Metadata
        let docSnap = await adminDb.collection('pdfs').doc(id).get();
        if (!docSnap.exists) {
            const querySnap = await adminDb.collection('pdfs').where('slug', '==', id).limit(1).get();
            if (!querySnap.empty) docSnap = querySnap.docs[0];
        }

        if (!docSnap.exists || docSnap.data()?.status !== 'published') return null;
        const pdfForm = { ...docSnap.data(), id: docSnap.id } as PDFForm;
        
        // 2. Resolve associated Entity (Operational & Identity)
        let entity: WorkspaceEntity | undefined = undefined;
        let identity: Entity | undefined = undefined;
        
        const targetEntityId = querySchoolId || pdfForm.entityId;
        const workspaceId = pdfForm.workspaceIds?.[0] || 'onboarding';

        if (targetEntityId) {
            // Fetch identity
            const entitySnap = await adminDb.collection('entities').doc(targetEntityId).get();
            if (entitySnap.exists) {
                identity = { id: entitySnap.id, ...entitySnap.data() } as Entity;
            }

            // Fetch workspace-specific operational data
            const workspaceEntityId = `${workspaceId}_${targetEntityId}`;
            const workspaceEntitySnap = await adminDb.collection('workspace_entities').doc(workspaceEntityId).get();
            if (workspaceEntitySnap.exists) {
                entity = { id: workspaceEntitySnap.id, ...workspaceEntitySnap.data() } as WorkspaceEntity;
            }
        }

        // 3. Multi-Stage Signing Logic (Agreements Only)
        let initialData = {};
        let isLocked = false;
        let submissionId: string | undefined = undefined;

        if (pdfForm.isContractDocument && targetEntityId) {
            const contractQuery = await adminDb.collection('contracts')
                .where('entityId', '==', targetEntityId)
                .limit(1)
                .get();
            
            if (!contractQuery.empty) {
                const contract = contractQuery.docs[0].data() as Contract;
                if (contract.status === 'signed') {
                    isLocked = true;
                    submissionId = contract.submissionId;
                }
                
                if (contract.submissionId) {
                    const subSnap = await adminDb.collection('pdfs').doc(pdfForm.id)
                        .collection('submissions').doc(contract.submissionId).get();
                    if (subSnap.exists) initialData = subSnap.data()?.formData || {};
                }
            }
        }

        return { pdfForm, entity, identity, initialData, isLocked, submissionId };
    } catch (error) {
        console.error("Error fetching PDF form:", error);
        return null;
    }
});

export async function generateMetadata({ params, searchParams }: { params: Promise<{ pdfId: string }>, searchParams: Promise<{ entityId?: string }> }): Promise<Metadata> {
    const { pdfId } = await params;
    const sParams = await searchParams;
    const data = await getPdfFormData(pdfId, sParams.entityId);

    if (!data) return { title: 'Form Not Found', robots: { index: false, follow: false } };

    const title = data.entity
        ? `${data.entity.displayName} — ${data.pdfForm.publicTitle || data.pdfForm.name}`
        : data.identity?.name
            ? `${data.identity.name} — ${data.pdfForm.publicTitle || data.pdfForm.name}`
            : data.pdfForm.publicTitle || data.pdfForm.name;

    // Org branding supplies the logo for the `entity_logo` OG-image mode.
    const org = await getOrgBranding(data.pdfForm.organizationId);

    return resolveSeoMetadata({
        seo: data.pdfForm.seo,
        fallback: {
            title,
            description: 'Institutional document signing powered by SmartSapp.',
        },
        org,
    });
}

import { getOrgBranding } from '@/lib/org-branding';

export default async function PublicPdfFormPage({ params, searchParams }: { params: Promise<{ pdfId: string }>, searchParams: Promise<{ entityId?: string }> }) {
    const { pdfId } = await params;
    const sParams = await searchParams;
    const data = await getPdfFormData(pdfId, sParams.entityId);

    if (!data) notFound();
    
    // Resolve organizationId: from pdfForm or fallback to the first workspace's organization
    let organizationId = data.pdfForm.organizationId;
    if (!organizationId) {
        const firstWorkspaceId = data.pdfForm.workspaceIds?.[0];
        if (firstWorkspaceId) {
            try {
                const wsSnap = await adminDb.collection('workspaces').doc(firstWorkspaceId).get();
                if (wsSnap.exists) {
                    organizationId = wsSnap.data()?.organizationId;
                }
            } catch (err) {
                console.error('Error fetching workspace for form branding:', err);
            }
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
            {data.pdfForm.passwordProtected && data.pdfForm.password && !data.isLocked ? (
                <PasswordGatedForm pdfForm={data.pdfForm} entity={data.entity} orgBranding={orgBranding} />
            ) : (
                <PdfFormRenderer 
                    pdfForm={data.pdfForm} 
                    entity={data.entity}
                    identity={data.identity}
                    initialData={data.initialData}
                    isLocked={data.isLocked}
                    existingSubmissionId={data.submissionId}
                    orgBranding={orgBranding}
                />
            )}
        </>
    );
}
