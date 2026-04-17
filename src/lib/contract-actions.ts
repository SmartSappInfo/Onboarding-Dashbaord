'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import { sendMessage } from './messaging-engine';
import type { Contract, ContractStatus } from './types';
import { canUser } from './workspace-permissions';

/**
 * @fileOverview Server actions for the Institutional Contract Lifecycle.
 * Updated to support multi-channel template dispatch and bulk operations.
 */

/**
 * Initializes or updates a contract draft for a school.
 */
export async function upsertContractAction(data: {
    entityId: string;
    entityName: string;
    pdfId: string;
    pdfName: string;
    status: ContractStatus;
    userId: string;
    workspaceId: string;
}) {
    try {
        // 0. Permission Check
        const permission = await canUser(data.userId, 'finance', 'agreements', 'create', data.workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const contractsCol = adminDb.collection('contracts');
        // Check for existing contract for this school
        const querySnap = await contractsCol.where('entityId', '==', data.entityId).limit(1).get();
        
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
                workspaceId: data.workspaceId,
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
    entityId: string;
    entityName: string;
    emailTemplateId?: string;
    smsTemplateId?: string;
    recipients: { name: string; email?: string; phone?: string; type: string }[];
    userId: string;
    publicUrl: string;
    workspaceId?: string; // Workspace context (Requirement 11)
}) {
    try {
        const { contractId, emailTemplateId, smsTemplateId, recipients, entityId, entityName, userId, publicUrl, workspaceId } = input;

        // 0. Permission Check
        const permission = await canUser(userId, 'finance', 'agreements', 'edit', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        // 1. Prepare Dispatches
        const dispatchPromises: Promise<any>[] = [];

        recipients.forEach(recipient => {
            const baseVars = {
                school_name: entityName,
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
                    senderProfileId: 'default', // Fallback to default sender
                    recipient: recipient.email,
                    variables: baseVars,
                    entityId,
                    workspaceId: workspaceId || 'onboarding' // Pass workspace context (Requirement 11)
                }));
            }

            // Queue SMS
            if (smsTemplateId && smsTemplateId !== 'none' && recipient.phone) {
                dispatchPromises.push(sendMessage({
                    templateId: smsTemplateId,
                    senderProfileId: 'default',
                    recipient: recipient.phone,
                    variables: baseVars,
                    entityId,
                    workspaceId: workspaceId || 'onboarding' // Pass workspace context (Requirement 11)
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
            entityId,
            organizationId: 'default',
            userId,
            workspaceId: "onboarding",
            type: 'notification_sent',
            source: 'user_action',
            description: `dispatched legal agreements via dual-channel to ${recipients.length} recipients for "${entityName}"`
        });

        revalidatePath('/admin/finance/contracts');
        return { success: true };

    } catch (e: any) {
        console.error(">>> [CONTRACT:DISPATCH] Failed:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Permanently purges a contract record and its associated submission from the system.
 * Prevents orphan rows in the Doc Signing module.
 * Updated to support entityId (Requirements 25.1, 25.2)
 */
export async function deleteContractAction(
    contractId: string,
    pdfId: string,
    submissionId: string | null,
    entityId: string,
    userId: string
) {
    try {
        // 0. Permission Check (Try to resolve workspace from contract if not provided? 
        // For contracts, they are workspace-linked. Let's fetch the doc first.)
        const contractSnap = await adminDb.collection('contracts').doc(contractId).get();
        if (!contractSnap.exists) throw new Error("Contract not found.");
        const workspaceId = contractSnap.data()?.workspaceId;

        const permission = await canUser(userId, 'finance', 'agreements', 'delete', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const batch = adminDb.batch();
        
        // Use unified identifier strictly
        
        // 1. Delete primary Contract doc
        batch.delete(adminDb.collection('contracts').doc(contractId));

        // 2. Delete linked Submission doc to prevent orphan results
        if (pdfId && submissionId) {
            batch.delete(adminDb.collection('pdfs').doc(pdfId).collection('submissions').doc(submissionId));
        }

        await batch.commit();

        // 3. Log activity for audit trail with both identifiers (Requirement 25.2)
        await logActivity({
            entityId: entityId || undefined,
            organizationId: 'default',
            userId,
            workspaceId: "onboarding",
            type: 'pdf_status_changed',
            source: 'user_action',
            description: `permanently purged the agreement record and associated signed document.`,
            metadata: { contractId, pdfId, submissionId }
        });

        revalidatePath('/admin/finance/contracts');
        return { success: true };
    } catch (e: any) {
        console.error(">>> [CONTRACT:PURGE] Failed:", e.message);
        return { success: false, error: e.message };
    }
}
