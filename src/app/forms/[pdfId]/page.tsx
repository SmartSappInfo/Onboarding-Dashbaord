import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/server-only-firestore';
import type { PDFForm } from '@/lib/types';
import PdfFormRenderer from './components/PdfFormRenderer';
import { notFound } from 'next/navigation';
import PasswordGatedForm from './components/PasswordGatedForm';

async function getPdfForm(id: string): Promise<PDFForm | null> {
    const db = getDb();
    const docRef = doc(db, 'pdfs', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().status !== 'published') {
        return null;
    }

    return { ...docSnap.data(), id: docSnap.id } as PDFForm;
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
