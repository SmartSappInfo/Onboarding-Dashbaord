import { adminDb } from '@/lib/firebase-admin';
import type { PDFForm } from '@/lib/types';
import PdfFormRenderer from './components/PdfFormRenderer';
import { notFound } from 'next/navigation';
import PasswordGatedForm from './components/PasswordGatedForm';

async function getPdfForm(id: string): Promise<PDFForm | null> {
    try {
        const docSnap = await adminDb.collection('pdfs').doc(id).get();

        if (!docSnap.exists || docSnap.data()?.status !== 'published') {
            return null;
        }

        return { ...docSnap.data(), id: docSnap.id } as PDFForm;
    } catch (error) {
        console.error("Error fetching PDF form:", error);
        return null;
    }
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
