import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/server-only-firestore';
import type { PDFForm } from '@/lib/types';
import PdfFormRenderer from './components/PdfFormRenderer';
import { notFound } from 'next/navigation';

async function getPdfForm(id: string): Promise<PDFForm | null> {
    const db = getDb();
    const docRef = doc(db, 'pdfs', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().status !== 'published') {
        return null;
    }

    return { ...docSnap.data(), id: docSnap.id } as PDFForm;
}

export default async function PublicPdfFormPage({ params }: { params: { pdfId: string } }) {
    const pdfForm = await getPdfForm(params.pdfId);

    if (!pdfForm) {
        notFound();
    }

    return (
        <div className="bg-gray-100 min-h-screen">
            <header className="bg-white shadow-sm p-4 text-center">
                <h1 className="text-xl font-semibold">{pdfForm.name}</h1>
            </header>
            <main className="p-4 sm:p-8">
                <PdfFormRenderer pdfForm={pdfForm} />
            </main>
             <footer className="py-8 text-center text-sm text-gray-500">
                <p>Powered by SmartSapp</p>
            </footer>
        </div>
    );
}
