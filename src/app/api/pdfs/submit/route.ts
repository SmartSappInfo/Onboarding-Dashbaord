
import { adminDb } from '@/lib/firebase-admin';
import { logActivity } from '@/lib/activity-logger';
import { sendMessage } from '@/lib/messaging-engine';
import { generatePdfBuffer } from '@/lib/pdf-actions';
import { triggerInternalNotification } from '@/lib/notification-engine';
import type { PDFForm } from '@/lib/types';

/**
 * @fileOverview Public submission handler for PDF Forms.
 * Upgraded to handle high-fidelity contract closure and status synchronization.
 */

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

    const pdfData = { id: pdfSnap.id, ...pdfSnap.data() } as PDFForm;
    if (pdfData?.status !== 'published') {
      return Response.json({ error: 'Form is not published' }, { status: 403 });
    }

    const timestamp = new Date().toISOString();

    const submissionData = {
      pdfId,
      submittedAt: timestamp,
      formData,
      status: 'submitted',
    };

    const submissionRef = await pdfRef.collection('submissions').add(submissionData);

    // 1. CONTRACT CLOSURE LOGIC
    // If this is a formal contract, we find the institutional record and close it.
    if (pdfData.isContractDocument && pdfData.schoolId) {
        console.log(`>>> [CONTRACT:SYNC] Closing agreement for school: ${pdfData.schoolId}`);
        const contractsCol = adminDb.collection('contracts');
        const contractQuery = await contractsCol
            .where('schoolId', '==', pdfData.schoolId)
            .where('status', 'in', ['sent', 'draft'])
            .limit(1)
            .get();
        
        if (!contractQuery.empty) {
            const contractDoc = contractQuery.docs[0];
            await contractDoc.ref.update({
                status: 'signed',
                signedAt: timestamp,
                submissionId: submissionRef.id,
                updatedAt: timestamp
            });
            
            // Log specific legal activity
            await logActivity({
                schoolId: pdfData.schoolId,
                userId: null,
                type: 'pdf_status_changed',
                source: 'public',
                description: `legally executed agreement: "${pdfData.name}"`,
                metadata: { pdfId, submissionId: submissionRef.id, contractId: contractDoc.id }
            });
        }
    }

    // 2. PUBLIC ACKNOWLEDGEMENT (Email with Signed PDF)
    if (pdfData.confirmationMessagingEnabled && pdfData.confirmationTemplateId && pdfData.confirmationSenderProfileId) {
        const recipientField = (pdfData.fields as any[]).find((f: any) => f.type === 'email' || f.type === 'phone');
        const recipientValue = recipientField ? formData[recipientField.id] : null;

        if (recipientValue) {
            console.log(`>>> [AUTOMATION] Triggering PDF Confirmation for ${recipientValue}`);
            let attachments = [];
            try {
                const pdfBuffer = await generatePdfBuffer(pdfData, formData);
                attachments.push({
                    content: pdfBuffer.toString('base64'),
                    filename: `${pdfData.name}-Signed.pdf`,
                    type: 'application/pdf'
                });
            } catch (genError) {
                console.error(">>> [AUTOMATION] PDF Generation failed for email attachment:", genError);
            }

            await sendMessage({
                templateId: pdfData.confirmationTemplateId,
                senderProfileId: pdfData.confirmationSenderProfileId,
                recipient: String(recipientValue),
                attachments: attachments.length > 0 ? attachments : undefined,
                variables: {
                    ...formData,
                    form_name: pdfData.name,
                    submission_id: submissionRef.id,
                    submission_date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                }
            });
        }
    }

    // 3. INTERNAL TEAM NOTIFICATION
    if (pdfData.adminAlertsEnabled) {
        await triggerInternalNotification({
            schoolId: pdfData.schoolId || '',
            notifyManager: pdfData.adminAlertNotifyManager,
            specificUserIds: pdfData.adminAlertSpecificUserIds,
            emailTemplateId: pdfData.adminAlertEmailTemplateId,
            smsTemplateId: pdfData.adminAlertSmsTemplateId,
            channel: pdfData.adminAlertChannel,
            variables: {
                ...formData,
                form_name: pdfData.name,
                submission_id: submissionRef.id,
                event_type: pdfData.isContractDocument ? 'Contract Signed' : 'Doc Signed',
                school_name: pdfData.schoolName || 'Unknown'
            }
        });
    }

    // Log general activity if not already logged by contract closure
    if (!pdfData.isContractDocument) {
        await logActivity({
            schoolId: pdfData?.schoolId || '',
            userId: null,
            type: 'pdf_form_submitted',
            source: 'public',
            description: `Submission received for "${pdfData?.name}"`,
            metadata: { pdfId, submissionId: submissionRef.id }
        });
    }

    return Response.json({ submissionId: submissionRef.id });
  } catch (error: any) {
    console.error(">>> [API: SUBMIT] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
