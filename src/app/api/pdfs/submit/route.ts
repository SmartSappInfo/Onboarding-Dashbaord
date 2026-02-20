
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/server-only-firestore';
import { logActivity } from '@/lib/activity-logger';

export async function POST(req: Request) {
  try {
    const { pdfId, formData } = await req.json();

    if (!pdfId || !formData) {
      return Response.json({ error: 'Missing required data' }, { status: 400 });
    }

    const db = getDb();
    
    // Security check: verify form exists and is published
    const pdfFormRef = doc(db, 'pdfs', pdfId);
    const pdfFormSnap = await getDoc(pdfFormRef);

    if (!pdfFormSnap.exists()) {
      return Response.json({ error: 'Form not found' }, { status: 404 });
    }

    if (pdfFormSnap.data().status !== 'published') {
      return Response.json({ error: 'Form is not published' }, { status: 403 });
    }

    const submissionData = {
      pdfId,
      submittedAt: new Date().toISOString(),
      formData,
      status: 'submitted',
    };

    const submissionRef = await addDoc(collection(db, `pdfs/${pdfId}/submissions`), submissionData);

    // Audit trail
    await logActivity({
      schoolId: '',
      userId: null,
      type: 'pdf_form_submitted',
      source: 'public',
      description: `Submission received for "${pdfFormSnap.data().name}"`,
      metadata: { pdfId, submissionId: submissionRef.id }
    });

    return Response.json({ submissionId: submissionRef.id });
  } catch (error: any) {
    console.error('Submission API Error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
