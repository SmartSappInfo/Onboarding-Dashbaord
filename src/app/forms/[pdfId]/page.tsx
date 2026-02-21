import { adminDb } from '@/lib/firebase-admin';
import type { PDFForm } from '@/lib/types';
import PdfFormRenderer from './components/PdfFormRenderer';
import { notFound } from 'next/navigation';
import PasswordGatedForm from './components/PasswordGatedForm';
import { Metadata } from 'next';

async function getPdfForm(id: string): Promise<PDFForm | null> {
    try {
        // First try by ID
        let docSnap = await adminDb.collection('pdfs').doc(id).get();

        // If not found, try by Slug
        if (!docSnap.exists) {
            const querySnap = await adminDb.collection('pdfs').where('slug', '==', id).limit(1).get();
            if (!querySnap.empty) {
                docSnap = querySnap.docs[0];
            }
        }

        if (!docSnap.exists || docSnap.data()?.status !== 'published') {
            return null;
        }

        return { ...docSnap.data(), id: docSnap.id } as PDFForm;
    } catch (error) {
        console.error("Error fetching PDF form:", error);
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ pdfId: string }> }): Promise<Metadata> {
    const { pdfId } = await params;
    const pdfForm = await getPdfForm(pdfId);

    if (!pdfForm) {
        return {
            title: 'Form Not Found',
        };
    }

    return {
        title: `Form - ${pdfForm.name}`,
        description: 'Powered by SmartSapp',
    };
}

export default async function PublicPdfFormPage({ params }: { params: Promise<{ pdfId: string }> }) {
    const { pdfId } = await params;
    const pdfForm = await getPdfForm(pdfId);

    if (!pdfForm) {
        notFound();
    }
    
    if (pdfForm.passwordProtected && pdfForm.password) {
        return <PasswordGatedForm pdfForm={pdfForm} />;
    }

    return <PdfFormRenderer pdfForm={pdfForm} />;
}
