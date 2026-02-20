import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/server-only-firestore';
import { logActivity } from '@/lib/activity-logger';

export async function POST(req: Request) {
  console.log(">>> [API: SUBMIT] POST Request Received");
  try {
    const body = await req.json();
    const { pdfId, formData } = body;

    if (!pdfId || !formData) {
      console.error(">>> [API: SUBMIT] Error: pdfId or formData is missing from body");
      return Response.json({ error: 'Missing required data' }, { status: 400 });
    }

    const fieldKeys = Object.keys(formData);
    console.log(`>>> [API: SUBMIT] Processing ${fieldKeys.length} fields for PDF: ${pdfId}`);
    console.log(`>>> [API: SUBMIT] Fields Received: ${fieldKeys.join(', ')}`);
    
    const db = getDb();
    
    // Security check: verify form exists and is published
    const pdfFormRef = doc(db, 'pdfs', pdfId);
    const pdfFormSnap = await getDoc(pdfFormRef);

    if (!pdfFormSnap.exists()) {
      console.error(`>>> [API: SUBMIT] Error: PDF Form ${pdfId} not found in database`);
      return Response.json({ error: 'Form not found' }, { status: 404 });
    }

    const formStatus = pdfFormSnap.data().status;
    if (formStatus !== 'published') {
      console.warn(`>>> [API: SUBMIT] Access Denied: Form ${pdfId} is in ${formStatus} status`);
      return Response.json({ error: 'Form is not published' }, { status: 403 });
    }

    const submissionData = {
      pdfId,
      submittedAt: new Date().toISOString(),
      formData, // Contains all captured text and base64 images
      status: 'submitted',
    };

    console.log(">>> [API: SUBMIT] Saving to Firestore...");
    const submissionRef = await addDoc(collection(db, `pdfs/${pdfId}/submissions`), submissionData);
    console.log(`>>> [API: SUBMIT] Success! Created document: ${submissionRef.id}`);

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
    console.error(">>> [API: SUBMIT] Critical Internal Error:", error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
