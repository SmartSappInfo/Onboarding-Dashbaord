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
    const { pdfId, formData, entityId: submittedEntityId, entityType: submittedEntityType } = await req.json();

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

    // Determine the target identifiers for contract logic (dual-write support)
    const targetSchoolId = submittedSchoolId || pdfData.entityId;
    const targetEntityId = submittedEntityId || pdfData.entityId;
    const targetEntityType = submittedEntityType || null;

    const timestamp = new Date().toISOString();

    // Dual-write: populate both entityId and entityId (Requirement 16.5)
    const submissionData = {
      pdfId,
      submittedAt: timestamp,
      formData,
      status: 'submitted',
      entityId: targetEntityId || null,
      entityType: targetEntityType
    };

    const submissionRef = await pdfRef.collection('submissions').add(submissionData);
    const submissionId = submissionRef.id;

    // 1. CONTRACT CLOSURE LOGIC
    if (pdfData.isContractDocument && targetSchoolId) {
        console.log(`>>> [CONTRACT:SYNC] Closing agreement for school: ${targetSchoolId}`);
        const contractsCol = adminDb.collection('contracts');
        const contractQuery = await contractsCol
            .where('entityId', '==', targetSchoolId)
            .where('status', 'in', ['sent', 'draft', 'partially_signed'])
            .limit(1)
            .get();
        
        if (!contractQuery.empty) {
            const contractDoc = contractQuery.docs[0];
            await contractDoc.ref.update({
                status: 'signed',
                signedAt: timestamp,
                submissionId: submissionId,
                updatedAt: timestamp
            });
            
            // Use entityId for activity logging if available (Requirement 16.1)
            await logActivity({
                entityId: targetEntityId || null,
                organizationId: pdfData.organizationId || 'default',
                userId: null,
                workspaceId: pdfData.workspaceIds[0] || 'onboarding',
                type: 'pdf_status_changed',
                source: 'public',
                description: `legally executed agreement: "${pdfData.name}"`,
                metadata: { pdfId, submissionId, contractId: contractDoc.id }
            });
        }
    }

    // 2. PUBLIC ACKNOWLEDGEMENT (Email with Signed PDF)
    if (pdfData.confirmationMessagingEnabled && pdfData.confirmationTemplateId && pdfData.confirmationSenderProfileId) {
        const recipientField = (pdfData.fields as any[]).find((f: any) => f.type === 'email' || f.type === 'phone');
        const recipientValue = recipientField ? formData[recipientField.id] : null;

        if (recipientValue) {
            let attachments = [];
            try {
                const pdfBuffer = await generatePdfBuffer(pdfData, formData);
                attachments.push({
                    content: Buffer.from(pdfBuffer).toString('base64'),
                    filename: `${pdfData.name}-Signed.pdf`,
                    type: 'application/pdf'
                });
            } catch (genError) {
                console.error(">>> [AUTOMATION] PDF Generation failed for email attachment:", genError);
            }

            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onboarding.smartsapp.com';
            const result_url = `${baseUrl}/forms/results/${pdfData.slug || pdfData.id}/${submissionId}`;

            // Resolve workspaceId from pdfData (Requirement 11)
            const workspaceId = pdfData.workspaceIds?.[0] || 'onboarding';

            await sendMessage({
                templateId: pdfData.confirmationTemplateId,
                senderProfileId: pdfData.confirmationSenderProfileId,
                recipient: String(recipientValue),
                attachments: attachments.length > 0 ? attachments : undefined,
                variables: {
                    ...formData,
                    form_name: pdfData.name,
                    submission_id: submissionId,
                    submission_date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                    result_url,
                    download_url: result_url
                },
                entityId: targetEntityId || undefined, // Pass entityId for dual-write (Requirement 16.5)
                workspaceId // Pass workspace context (Requirement 11)
            });
        }
    }

    // 3. INTERNAL TEAM NOTIFICATION
    if (pdfData.adminAlertsEnabled) {
        await triggerInternalNotification({
            entityId: targetSchoolId || '',
            notifyManager: pdfData.adminAlertNotifyManager,
            specificUserIds: pdfData.adminAlertSpecificUserIds,
            emailTemplateId: pdfData.adminAlertEmailTemplateId,
            smsTemplateId: pdfData.adminAlertSmsTemplateId,
            channel: pdfData.adminAlertChannel,
            variables: {
                ...formData,
                form_name: pdfData.name,
                submission_id: submissionId,
                event_type: pdfData.isContractDocument ? 'Contract Signed' : 'Doc Signed',
                school_name: pdfData.entityName || 'Unknown'
            }
        });
    }

    // Log general activity if not already logged
    if (!pdfData.isContractDocument || !targetSchoolId) {
        await logActivity({
            entityId: targetEntityId || null,
            organizationId: pdfData.organizationId || 'default',
            userId: null,
            workspaceId: 'onboarding',
            type: 'pdf_form_submitted',
            source: 'public',
            description: `Submission received for "${pdfData?.name}"`,
            metadata: { pdfId, submissionId }
        });
    }

    return Response.json({ submissionId });
  } catch (error: any) {
    console.error(">>> [API: SUBMIT] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
