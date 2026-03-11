'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import { sendMessage } from './messaging-engine';
import type { Contract, ContractStatus } from './types';

/**
 * @fileOverview Server actions for the Institutional Contract Lifecycle.
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
 */
export async function sendContractAction(input: {
    contractId: string;
    schoolId: string;
    schoolName: string;
    templateId: string;
    recipients: { name: string; email?: string; phone?: string; type: string }[];
    userId: string;
    publicUrl: string;
}) {
    try {
        const { contractId, templateId, recipients, schoolId, schoolName, userId, publicUrl } = input;

        // 1. Dispatch messages via the Messaging Engine
        const dispatchPromises = recipients.map(recipient => {
            const target = recipient.email || recipient.phone;
            if (!target) return Promise.resolve({ success: false });

            return sendMessage({
                templateId,
                senderProfileId: 'default',
                recipient: target,
                variables: {
                    school_name: schoolName,
                    contact_name: recipient.name,
                    contract_link: publicUrl,
                    agreement_url: publicUrl, // Standardized key for button resolution
                    link: publicUrl,
                    event_type: 'Agreement Signature Required'
                },
                schoolId
            });
        });

        await Promise.allSettled(dispatchPromises);

        // 2. Update Contract Record
        await adminDb.collection('contracts').doc(contractId).update({
            status: 'sent',
            sentAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            recipients: recipients
        });

        // 3. Log to Timeline
        await logActivity({
            schoolId,
            userId,
            type: 'notification_sent',
            source: 'user_action',
            description: `dispatched legal agreement to ${recipients.length} recipients for "${schoolName}"`
        });

        revalidatePath('/admin/finance/contracts');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
