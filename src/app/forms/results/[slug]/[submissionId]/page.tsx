import { adminDb } from '@/lib/firebase-admin';
import type { PDFForm, Submission } from '@/lib/types';
import { notFound } from 'next/navigation';
import SharedSubmissionView from '../../components/SharedSubmissionView';

async function getDocAndSubmission(slug: string, submissionId: string) {
    try {
        let docSnap = await adminDb.collection('pdfs').doc(slug).get();
        if (!docSnap.exists) {
            const querySnap = await adminDb.collection('pdfs').where('slug', '==', slug).limit(1).get();
            if (!querySnap.empty) docSnap = querySnap.docs[0];
        }
        if (!docSnap.exists || !docSnap.data()?.resultsShared) return null;
        
        const subSnap = await docSnap.ref.collection('submissions').doc(submissionId).get();
        if (!subSnap.exists) return null;

        return {
            pdfForm: { ...docSnap.data(), id: docSnap.id } as PDFForm,
            submission: { ...subSnap.data(), id: subSnap.id } as Submission
        };
    } catch (error) {
        return null;
    }
}

export default async function SharedSubmissionDetailPage({ params }: { params: Promise<{ slug: string; submissionId: string }> }) {
    const { slug, submissionId } = await params;
    const data = await getDocAndSubmission(slug, submissionId);
    if (!data) notFound();
    return <SharedSubmissionView pdfForm={data.pdfForm} submission={data.submission} />;
}
