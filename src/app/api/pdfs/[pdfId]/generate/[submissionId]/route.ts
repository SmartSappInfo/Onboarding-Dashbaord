import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/server-only-firestore';
import { generatePdfBuffer } from '@/lib/pdf-actions';
import type { PDFForm, Submission } from '@/lib/types';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pdfId: string; submissionId: string }> }
) {
  const { pdfId, submissionId } = await params;

  try {
    const db = getDb();
    
    const pdfFormRef = doc(db, 'pdfs', pdfId);
    const submissionRef = doc(db, `pdfs/${pdfId}/submissions`, submissionId);

    const [pdfFormSnap, submissionSnap] = await Promise.all([
      getDoc(pdfFormRef),
      getDoc(submissionRef)
    ]);

    if (!pdfFormSnap.exists() || !submissionSnap.exists()) {
      return new Response('Not found', { status: 404 });
    }

    const pdfForm = { id: pdfFormSnap.id, ...pdfFormSnap.data() } as PDFForm;
    const submission = submissionSnap.data() as Submission;

    const pdfBytes = await generatePdfBuffer(pdfForm, submission.formData);

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfForm.name}-signed.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('Generation API Error:', error);
    return new Response(error.message || 'Internal server error', { status: 500 });
  }
}
