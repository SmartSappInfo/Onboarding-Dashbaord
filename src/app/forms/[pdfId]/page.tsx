import { adminDb } from '@/lib/firebase-admin';
import type { PDFForm, School } from '@/lib/types';
import PdfFormRenderer from './components/PdfFormRenderer';
import { notFound } from 'next/navigation';
import PasswordGatedForm from './components/PasswordGatedForm';
import { Metadata } from 'next';

async function getPdfFormData(id: string, querySchoolId?: string): Promise<{ pdfForm: PDFForm, school?: School } | null> {
    try {
        // 1. Fetch PDF Metadata
        let docSnap = await adminDb.collection('pdfs').doc(id).get();

        if (!docSnap.exists) {
            const querySnap = await adminDb.collection('pdfs').where('slug', '==', id).limit(1).get();
            if (!querySnap.empty) {
                docSnap = querySnap.docs[0];
            }
        }

        if (!docSnap.exists || docSnap.data()?.status !== 'published') {
            return null;
        }

        const pdfForm = { ...docSnap.data(), id: docSnap.id } as PDFForm;
        
        // 2. Resolve associated School Context
        // Priority: Query Parameter (for unique shared links) > Stored schoolId (for dedicated forms)
        let school: School | undefined = undefined;
        const targetSchoolId = querySchoolId || pdfForm.schoolId;

        if (targetSchoolId) {
            const schoolSnap = await adminDb.collection('schools').doc(targetSchoolId).get();
            if (schoolSnap.exists) {
                school = { id: schoolSnap.id, ...schoolSnap.data() } as School;
            }
        }

        return { pdfForm, school };
    } catch (error) {
        console.error("Error fetching PDF form:", error);
        return null;
    }
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ pdfId: string }>, searchParams: Promise<{ schoolId?: string }> }): Promise<Metadata> {
    const { pdfId } = await params;
    const sParams = await searchParams;
    const data = await getPdfFormData(pdfId, sParams.schoolId);

    if (!data) {
        return {
            title: 'Form Not Found',
        };
    }

    const title = data.school 
        ? `${data.pdfForm.publicTitle || data.pdfForm.name} — ${data.school.name}`
        : data.pdfForm.publicTitle || data.pdfForm.name;

    return {
        title,
        description: 'Institutional document signing powered by SmartSapp.',
    };
}

export default async function PublicPdfFormPage({ params, searchParams }: { params: Promise<{ pdfId: string }>, searchParams: Promise<{ schoolId?: string }> }) {
    const { pdfId } = await params;
    const sParams = await searchParams;
    const data = await getPdfFormData(pdfId, sParams.schoolId);

    if (!data) {
        notFound();
    }
    
    if (data.pdfForm.passwordProtected && data.pdfForm.password) {
        return <PasswordGatedForm pdfForm={data.pdfForm} school={data.school} />;
    }

    return <PdfFormRenderer pdfForm={data.pdfForm} school={data.school} />;
}
