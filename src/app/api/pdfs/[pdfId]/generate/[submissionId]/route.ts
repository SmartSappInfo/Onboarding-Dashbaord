
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
    
    console.log(`>>> [API:GEN] GET request for PDF: ${pdfId}, Submission: ${submissionId}`);
    
    const pdfFormRef = doc(db, 'pdfs', pdfId);
    const submissionRef = doc(db, `pdfs/${pdfId}/submissions`, submissionId);

    const [pdfFormSnap, submissionSnap] = await Promise.all([
      getDoc(pdfFormRef),
      getDoc(submissionRef)
    ]);

    if (!pdfFormSnap.exists()) {
        console.error(`>>> [API:GEN] PDF Form ${pdfId} not found.`);
        return new Response('PDF Form not found', { status: 404 });
    }
    
    if (!submissionSnap.exists()) {
        console.error(`>>> [API:GEN] Submission ${submissionId} not found.`);
        return new Response('Submission not found', { status: 404 });
    }

    const pdfForm = { id: pdfFormSnap.id, ...pdfFormSnap.data() } as PDFForm;
    const submission = submissionSnap.data() as Submission;

    const pdfBytes = await generatePdfBuffer(pdfForm, submission.formData);

    console.log(`>>> [API:GEN] PDF generated successfully. Bytes: ${pdfBytes.length}`);

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfForm.name}-signed.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('>>> [API:GEN] Critical Generation API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}
