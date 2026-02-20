import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/server-only-firestore';
import { generatePdfBuffer } from '@/lib/pdf-actions';
import type { PDFForm, Submission } from '@/lib/types';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pdfId: string; submissionId: string }> }
) {
  const { pdfId, submissionId } = await params;

  console.log(`>>> [API:GEN] Incoming Request - PDF: ${pdfId}, Submission: ${submissionId}`);

  try {
    const db = getDb();
    
    const pdfFormRef = doc(db, 'pdfs', pdfId);
    const submissionRef = doc(db, `pdfs/${pdfId}/submissions`, submissionId);

    console.log(`>>> [API:GEN] Fetching records from Firestore...`);
    const [pdfFormSnap, submissionSnap] = await Promise.all([
      getDoc(pdfFormRef),
      getDoc(submissionRef)
    ]);

    if (!pdfFormSnap.exists()) {
        console.error(`>>> [API:GEN] 404: PDF Form not found.`);
        return new Response(JSON.stringify({ error: 'PDF Form not found' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (!submissionSnap.exists()) {
        console.error(`>>> [API:GEN] 404: Submission not found.`);
        return new Response(JSON.stringify({ error: 'Submission not found' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const pdfForm = { id: pdfFormSnap.id, ...pdfFormSnap.data() } as PDFForm;
    const submission = submissionSnap.data() as Submission;

    console.log(`>>> [API:GEN] Starting byte generation...`);
    const pdfBytes = await generatePdfBuffer(pdfForm, submission.formData);

    console.log(`>>> [API:GEN] Generation SUCCESS. Returning binary stream.`);

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfForm.name}-signed.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('>>> [API:GEN] CRITICAL SERVER ERROR:', error);
    return new Response(JSON.stringify({ 
        error: error.message || 'Internal server error',
        phase: 'generation'
    }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}
