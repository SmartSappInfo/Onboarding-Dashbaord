import { adminDb } from '@/lib/firebase-admin';
import type { PDFForm, Submission, School } from '@/lib/types';
import { notFound } from 'next/navigation';
import SharedSubmissionView from '../../components/SharedSubmissionView';

/**
 * @fileOverview Individual Submission Audit Page (Server Entry).
 * Resolves the PDF form, the specific submission, and the institutional context.
 */

async function getAuditData(slug: string, submissionId: string) {
    try {
        // 1. Resolve PDF Form Template
        let docSnap = await adminDb.collection('pdfs').doc(slug).get();
        if (!docSnap.exists) {
            const querySnap = await adminDb.collection('pdfs').where('slug', '==', slug).limit(1).get();
            if (!querySnap.empty) docSnap = querySnap.docs[0];
        }
        
        if (!docSnap.exists) return null;
        const pdfForm = { ...docSnap.data(), id: docSnap.id } as PDFForm;
        
        // 2. Resolve Specific Submission
        const subSnap = await docSnap.ref.collection('submissions').doc(submissionId).get();
        if (!subSnap.exists) return null;
        const submission = { ...subSnap.data(), id: subSnap.id } as Submission;

        // 3. Resolve Institutional Context (The School this submission belongs to)
        let school: School | undefined = undefined;
        const targetSchoolId = submission.schoolId || pdfForm.schoolId;
        
        if (targetSchoolId) {
            const schoolSnap = await adminDb.collection('schools').doc(targetSchoolId).get();
            if (schoolSnap.exists) {
                school = { id: schoolSnap.id, ...schoolSnap.data() } as School;
            }
        }

        return { pdfForm, submission, school };
    } catch (error) {
        console.error(">>> [AUDIT:FETCH] Error:", error);
        return null;
    }
}

export default async function SharedSubmissionDetailPage({ params }: { params: Promise<{ slug: string; submissionId: string }> }) {
    const { slug, submissionId } = await params;
    const data = await getAuditData(slug, submissionId);
    
    if (!data) notFound();
    
    return (
        <SharedSubmissionView 
            pdfForm={data.pdfForm} 
            submission={data.submission} 
            school={data.school}
        />
    );
}
