'use server';

import { adminDb } from './firebase-admin';
import { Form, FormSubmission } from './types';
import { revalidatePath } from 'next/cache';
import { recordConversion } from './analytics-actions';
import { processLeadCaptureAction } from './lead-actions';


/**
 * Persists a submission for a standalone form.
 */
export async function submitStandaloneFormAction(
    formId: string, 
    data: Record<string, any>, 
    workspaceId: string, 
    organizationId: string,
    metadata?: { ipAddress?: string; userAgent?: string; sourcePageId?: string }
) {
    try {
        const timestamp = new Date().toISOString();
        const formRef = adminDb.collection('forms').doc(formId);
        const formSnap = await formRef.get();

        if (!formSnap.exists) throw new Error("Form not found.");
        const form = { id: formSnap.id, ...formSnap.data() } as Form;

        // 1. Create the submission record
        const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const submission: FormSubmission = {
            id: submissionId,
            formId,
            workspaceId,
            organizationId,
            data,
            sourcePageId: metadata?.sourcePageId,
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
            submittedAt: timestamp
        };

        await adminDb.collection('form_submissions').doc(submissionId).set(submission);

        // 2. Increment submission count on the form
        await formRef.update({
            submissionCount: (form.submissionCount || 0) + 1,
            updatedAt: timestamp
        });

        // 3. Handle Analytics if submitted from a campaign page
        if (metadata?.sourcePageId) {
            await recordConversion(metadata.sourcePageId);
            // Process as CRM lead in the background
            processLeadCaptureAction({
                submissionId,
                collection: 'form_submissions',
                data,
                organizationId,
                workspaceId,
                sourcePageId: metadata.sourcePageId,
                formId
            }).catch(console.error);
        }




        // 4. Handle Actions (Automations, Tags, etc. - Implementation detail for later)
        // For now, we just acknowledge receipt.

        revalidatePath(`/admin/forms/${formId}`);
        return { success: true, submissionId };


    } catch (error: any) {
        console.error(">>> [FORM:SUBMIT] Failed:", error.message);
        return { success: false, error: error.message };
    }
}
