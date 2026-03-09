import { adminDb } from '@/lib/firebase-admin';
import type { PDFForm, School } from '@/lib/types';
import PdfFormRenderer from './components/PdfFormRenderer';
import { notFound } from 'next/navigation';
import PasswordGatedForm from './components/PasswordGatedForm';
import { Metadata } from 'next';

async function getPdfFormData(id: string): Promise<{ pdfForm: PDFForm, school?: School } | null> {
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
        
        // 2. Fetch associated School if applicable
        let school: School | undefined = undefined;
        if (pdfForm.schoolId) {
            const schoolSnap = await adminDb.collection('schools').doc(pdfForm.schoolId).get();
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

export async function generateMetadata({ params }: { params: Promise<{ pdfId: string }> }): Promise<Metadata> {
    const { pdfId } = await params;
    const data = await getPdfFormData(pdfId);

    if (!data) {
        return {
            title: 'Form Not Found',
        };
    }

    return {
        title: data.pdfForm.name,
        description: 'Powered by SmartSapp',
    };
}

export default async function PublicPdfFormPage({ params }: { params: Promise<{ pdfId: string }> }) {
    const { pdfId } = await params;
    const data = await getPdfFormData(pdfId);

    if (!data) {
        notFound();
    }
    
    if (data.pdfForm.passwordProtected && data.pdfForm.password) {
        return <PasswordGatedForm pdfForm={data.pdfForm} />;
    }

    return <PdfFormRenderer pdfForm={data.pdfForm} school={data.school} />;
}
