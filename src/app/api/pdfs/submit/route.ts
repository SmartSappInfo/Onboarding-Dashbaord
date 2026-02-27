import { adminDb } from '@/lib/firebase-admin';
import { logActivity } from '@/lib/activity-logger';
import { sendMessage } from '@/lib/messaging-engine';

export async function POST(req: Request) {
  try {
    const { pdfId, formData } = await req.json();

    if (!pdfId || !formData) {
      return Response.json({ error: 'Missing required data' }, { status: 400 });
    }

    const pdfRef = adminDb.collection('pdfs').doc(pdfId);
    const pdfSnap = await pdfRef.get();

    if (!pdfSnap.exists) {
      return Response.json({ error: 'Form not found' }, { status: 404 });
    }

    const pdfData = pdfSnap.data();
    if (pdfData?.status !== 'published') {
      return Response.json({ error: 'Form is not published' }, { status: 403 });
    }

    const submissionData = {
      pdfId,
      submittedAt: new Date().toISOString(),
      formData,
      status: 'submitted',
    };

    const submissionRef = await pdfRef.collection('submissions').add(submissionData);

    // Messaging Automation Trigger
    if (pdfData?.confirmationMessagingEnabled && pdfData?.confirmationTemplateId && pdfData?.confirmationSenderProfileId) {
        // Attempt to find a recipient from the form data (look for email or phone)
        const recipientField = pdfData.fields.find((f: any) => f.type === 'email' || f.type === 'phone');
        const recipientValue = recipientField ? formData[recipientField.id] : null;

        if (recipientValue) {
            console.log(`>>> [AUTOMATION] Triggering PDF Confirmation for ${recipientValue}`);
            // Non-blocking call to messaging engine
            sendMessage({
                templateId: pdfData.confirmationTemplateId,
                senderProfileId: pdfData.confirmationSenderProfileId,
                recipient: recipientValue,
                variables: {
                    ...formData,
                    form_name: pdfData.name,
                    submission_date: format(new Date(), 'PPPP'),
                }
            }).catch(e => console.error(">>> [AUTOMATION] Messaging failed:", e));
        }
    }

    await logActivity({
      schoolId: pdfData?.schoolId || '',
      userId: null,
      type: 'pdf_form_submitted',
      source: 'public',
      description: `Submission received for "${pdfData?.name}"`,
      metadata: { pdfId, submissionId: submissionRef.id }
    });

    return Response.json({ submissionId: submissionRef.id });
  } catch (error: any) {
    console.error(">>> [API: SUBMIT] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function format(date: Date, pattern: string) {
    // Basic date formatting helper
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
