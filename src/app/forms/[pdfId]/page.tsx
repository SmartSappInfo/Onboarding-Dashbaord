import { adminDb } from '@/lib/firebase-admin';
import type { PDFForm, WorkspaceEntity, Entity, Contract, Submission } from '@/lib/types';
import PdfFormRenderer from './components/PdfFormRenderer';
import { notFound } from 'next/navigation';
import PasswordGatedForm from './components/PasswordGatedForm';
import { Metadata } from 'next';

interface PageData {
    pdfForm: PDFForm;
    entity?: WorkspaceEntity;
    identity?: Entity;
    initialData?: Record<string, any>;
    isLocked: boolean;
    submissionId?: string;
}

async function getPdfFormData(id: string, querySchoolId?: string): Promise<PageData | null> {
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
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ pdfId: string }>, searchParams: Promise<{ entityId?: string }> }): Promise<Metadata> {
    const { pdfId } = await params;
    const sParams = await searchParams;
    const data = await getPdfFormData(pdfId, sParams.entityId);

    if (!data) return { title: 'Form Not Found' };

    const title = data.entity 
        ? `${data.entity.displayName} — ${data.pdfForm.publicTitle || data.pdfForm.name}`
        : data.identity?.name 
            ? `${data.identity.name} — ${data.pdfForm.publicTitle || data.pdfForm.name}`
            : data.pdfForm.publicTitle || data.pdfForm.name;

    return {
        title,
        description: 'Institutional document signing powered by SmartSapp.',
    };
}

export default async function PublicPdfFormPage({ params, searchParams }: { params: Promise<{ pdfId: string }>, searchParams: Promise<{ entityId?: string }> }) {
    const { pdfId } = await params;
    const sParams = await searchParams;
    const data = await getPdfFormData(pdfId, sParams.entityId);

    if (!data) notFound();
    
    if (data.pdfForm.passwordProtected && data.pdfForm.password && !data.isLocked) {
        return <PasswordGatedForm pdfForm={data.pdfForm} entity={data.entity} />;
    }

    return (
        <PdfFormRenderer 
            pdfForm={data.pdfForm} 
            entity={data.entity}
            identity={data.identity}
            initialData={data.initialData}
            isLocked={data.isLocked}
            existingSubmissionId={data.submissionId}
        />
    );
}
