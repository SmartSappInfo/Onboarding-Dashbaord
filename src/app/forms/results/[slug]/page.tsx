import { adminDb } from '@/lib/firebase-admin';
import type { PDFForm } from '@/lib/types';
import { notFound } from 'next/navigation';
import PasswordGatedResults from '../components/PasswordGatedResults';
import { Metadata } from 'next';

async function getPdfForm(id: string): Promise<PDFForm | null> {
    try {
        let docSnap = await adminDb.collection('pdfs').doc(id).get();
        if (!docSnap.exists) {
            const querySnap = await adminDb.collection('pdfs').where('slug', '==', id).limit(1).get();
            if (!querySnap.empty) docSnap = querySnap.docs[0];
        }
        if (!docSnap.exists || !docSnap.data()?.resultsShared) return null;
        return { ...docSnap.data(), id: docSnap.id } as PDFForm;
    } catch (error) {
        console.error("Error fetching PDF form for results:", error);
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const pdfForm = await getPdfForm(slug);
    if (!pdfForm) return { title: 'Shared Results Not Found' };
    return { title: `Results: ${pdfForm.name}`, description: 'Shared Submission Records' };
}

export default async function SharedResultsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const pdfForm = await getPdfForm(slug);
    if (!pdfForm) notFound();
    return <PasswordGatedResults pdfForm={pdfForm} />;
}
