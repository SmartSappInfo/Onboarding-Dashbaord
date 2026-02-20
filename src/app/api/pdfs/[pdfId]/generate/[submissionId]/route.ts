import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/server-only-firestore';
import { generatePdfBuffer } from '@/lib/pdf-actions';
import type { PDFForm, Submission } from '@/lib/types';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pdfId: string; submissionId: string }> }
) {
  const { pdfId, submissionId } = await params;

  console.log(`>>> [API:GEN] Request received for PDF: ${pdfId}, Submission: ${submissionId}`);

  try {
    const db = getDb();
    
    console.log(`>>> [API:GEN] Fetching records from Firestore...`);
    const pdfFormRef = doc(db, 'pdfs', pdfId);
    const submissionRef = doc(db, `pdfs/${pdfId}/submissions`, submissionId);

    const [pdfFormSnap, submissionSnap] = await Promise.all([
      getDoc(pdfFormRef),
      getDoc(submissionRef)
    ]);

    if (!pdfFormSnap.exists()) {
        console.error(`>>> [API:GEN] ERROR: PDF Form ${pdfId} not found in database.`);
        return new Response(JSON.stringify({ error: 'PDF Form not found' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (!submissionSnap.exists()) {
        console.error(`>>> [API:GEN] ERROR: Submission ${submissionId} not found in database.`);
        return new Response(JSON.stringify({ error: 'Submission not found' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const pdfForm = { id: pdfFormSnap.id, ...pdfFormSnap.data() } as PDFForm;
    const submission = submissionSnap.data() as Submission;

    console.log(`>>> [API:GEN] Records found. Starting buffer generation...`);
    
    const pdfBytes = await generatePdfBuffer(pdfForm, submission.formData);

    console.log(`>>> [API:GEN] SUCCESS: PDF generated successfully. Returning stream...`);

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfForm.name}-signed.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('>>> [API:GEN] CRITICAL ERROR:', error);
    return new Response(JSON.stringify({ 
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}
