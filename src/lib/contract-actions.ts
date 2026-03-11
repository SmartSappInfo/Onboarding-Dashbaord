'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import { sendMessage } from './messaging-engine';
import type { Contract, ContractStatus } from './types';

/**
 * @fileOverview Server actions for the Institutional Contract Lifecycle.
 * Updated to support multi-channel template dispatch.
 */

/**
 * Initializes or updates a contract draft for a school.
 */
export async function upsertContractAction(data: {
    schoolId: string;
    schoolName: string;
    pdfId: string;
    pdfName: string;
    status: ContractStatus;
    userId: string;
}) {
    try {
        const contractsCol = adminDb.collection('contracts');
        // Check for existing contract for this school
        const querySnap = await contractsCol.where('schoolId', '==', data.schoolId).limit(1).get();
        
        const timestamp = new Date().toISOString();
        let contractId = '';

        if (querySnap.empty) {
            const docRef = await contractsCol.add({
                ...data,
                createdAt: timestamp,
                updatedAt: timestamp,
                recipients: []
            });
            contractId = docRef.id;
        } else {
            contractId = querySnap.docs[0].id;
            await querySnap.docs[0].ref.update({
                pdfId: data.pdfId,
                pdfName: data.pdfName,
                status: data.status,
                updatedAt: timestamp
            });
        }

        revalidatePath('/admin/finance/contracts');
        return { success: true, id: contractId };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Dispatches a contract link to recipients and updates status to 'sent'.
 * Supports dual Email and SMS template dispatch.
 */
export async function sendContractAction(input: {
    contractId: string;
    schoolId: string;
    schoolName: string;
    emailTemplateId?: string;
    smsTemplateId?: string;
    recipients: { name: string; email?: string; phone?: string; type: string }[];
    userId: string;
    publicUrl: string;
}) {
    try {
        const { contractId, emailTemplateId, smsTemplateId, recipients, schoolId, schoolName, userId, publicUrl } = input;

        // 1. Prepare Dispatches
        const dispatchPromises: Promise<any>[] = [];

        recipients.forEach(recipient => {
            const baseVars = {
                school_name: schoolName,
                contact_name: recipient.name,
                agreement_url: publicUrl,
                contract_link: publicUrl,
                link: publicUrl,
                event_type: 'Agreement Execution Required'
            };

            // Queue Email
            if (emailTemplateId && emailTemplateId !== 'none' && recipient.email) {
                dispatchPromises.push(sendMessage({
                    templateId: emailTemplateId,
                    senderProfileId: 'default',
                    recipient: recipient.email,
                    variables: baseVars,
                    schoolId
                }));
            }

            // Queue SMS
            if (smsTemplateId && smsTemplateId !== 'none' && recipient.phone) {
                dispatchPromises.push(sendMessage({
                    templateId: smsTemplateId,
                    senderProfileId: 'default',
                    recipient: recipient.phone,
                    variables: baseVars,
                    schoolId
                }));
            }
        });

        await Promise.allSettled(dispatchPromises);

        // 2. Update Contract Record
        await adminDb.collection('contracts').doc(contractId).update({
            status: 'sent',
            sentAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            emailTemplateId: emailTemplateId || null,
            smsTemplateId: smsTemplateId || null,
            recipients: recipients
        });

        // 3. Log to Timeline
        await logActivity({
            schoolId,
            userId,
            type: 'notification_sent',
            source: 'user_action',
            description: `dispatched legal agreements via dual-channel to ${recipients.length} recipients for "${schoolName}"`
        });

        revalidatePath('/admin/finance/contracts');
        return { success: true };

    } catch (e: any) {
        console.error(">>> [CONTRACT:DISPATCH] Failed:", e.message);
        return { success: false, error: e.message };
    }
}
