
import { adminDb } from '@/lib/firebase-admin';
import { generatePdfBuffer } from '@/lib/pdf-actions';
import type { PDFForm, Submission } from '@/lib/types';
// SECURITY (audit F9): report the detail server-side, return an opaque message.
import { toClientErrorMessage } from '@/lib/errors/report-error';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pdfId: string; submissionId: string }> }
) {
  const { pdfId, submissionId } = await params;

  console.log(`>>> [API:GEN] Request Received - PDF: ${pdfId}, Submission: ${submissionId}`);

  try {
    const pdfDocRef = adminDb.collection('pdfs').doc(pdfId);
    const submissionRef = adminDb.collection('pdfs').doc(pdfId).collection('submissions').doc(submissionId);

    const [pdfSnap, subSnap] = await Promise.all([
      pdfDocRef.get(),
      submissionRef.get()
    ]);

    if (!pdfSnap.exists || !subSnap.exists) {
        return new Response('Document or submission not found', { status: 404 });
    }

    const pdfForm = { id: pdfSnap.id, ...pdfSnap.data() } as PDFForm;
    const submission = subSnap.data() as Submission;

    const pdfBytes = await generatePdfBuffer(pdfForm, submission.formData);

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfForm.name}-signed.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('>>> [API:GEN] CRITICAL SERVER ERROR:', error);
    return new Response(JSON.stringify({ error: toClientErrorMessage('api.pdfs.[pdfId].generate.[submissionId]', error, undefined, 'Internal server error') }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}
