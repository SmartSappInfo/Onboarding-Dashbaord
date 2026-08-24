'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import { sendMessage } from './messaging-engine';
import type { ContractStatus } from './types';
import { canUser } from './workspace-permissions';

/**
 * @fileOverview Server actions for the Contract Lifecycle.
 * Conforms to workspace rules, strict typing, and zero `any` usage.
 */

export interface ContractActionResponse {
    success: boolean;
    error?: string;
    id?: string;
}

/**
 * Initializes or updates a contract draft for an entity.
 */
export async function upsertContractAction(data: {
    entityId: string;
    entityName: string;
    pdfId: string;
    pdfName: string;
    status: ContractStatus;
    userId: string;
    workspaceId: string;
}): Promise<ContractActionResponse> {
    try {
        // 0. Permission Check
        const permission = await canUser(data.userId, 'finance', 'agreements', 'create', data.workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const contractsCol = adminDb.collection('contracts');
        const querySnap = await contractsCol
            .where('entityId', '==', data.entityId)
            .where('workspaceId', '==', data.workspaceId)
            .limit(1)
            .get();
        
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
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to initialize agreement';
        return { success: false, error: message };
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
    workspaceId?: string;
}): Promise<ContractActionResponse> {
    try {
        const { 
            contractId, 
            emailTemplateId, 
            smsTemplateId, 
            recipients, 
            entityId, 
            entityName, 
            userId, 
            publicUrl, 
            workspaceId 
        } = input;

        let resolvedWorkspaceId = workspaceId;
        if (!resolvedWorkspaceId || resolvedWorkspaceId === 'onboarding') {
            const contractDoc = await adminDb.collection('contracts').doc(contractId).get();
            if (contractDoc.exists) {
                resolvedWorkspaceId = contractDoc.data()?.workspaceId || undefined;
            }
        }
        if (!resolvedWorkspaceId) {
            const { resolveWorkspaceIdFromEntity } = await import('./services/workspace-resolver');
            resolvedWorkspaceId = (entityId ? await resolveWorkspaceIdFromEntity(entityId) : null) || undefined;
        }
        if (!resolvedWorkspaceId) {
            throw new Error('Workspace context is required to send contract.');
        }

        // 0. Permission Check
        const permission = await canUser(userId, 'finance', 'agreements', 'edit', resolvedWorkspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        // 1. Prepare Dispatches
        const dispatchPromises: Promise<unknown>[] = [];

        recipients.forEach((recipient) => {
            const baseVars: Record<string, string> = {
                name: entityName,
                school_name: entityName,
                entity_name: entityName,
                contact_name: recipient.name,
                first_name: recipient.name.split(' ')[0] || recipient.name,
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
                    entityId,
                    workspaceId: resolvedWorkspaceId
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
                    workspaceId: resolvedWorkspaceId
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
            workspaceId: resolvedWorkspaceId,
            type: 'notification_sent',
            source: 'user_action',
            description: `dispatched legal agreements to ${recipients.length} recipients for "${entityName}"`
        });

        revalidatePath('/admin/finance/contracts');
        return { success: true };

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Agreement dispatch failed';
        console.error('>>> [CONTRACT:DISPATCH] Failed:', message);
        return { success: false, error: message };
    }
}

/**
 * Permanently purges a contract record and its associated submission from the system.
 */
export async function deleteContractAction(
    contractId: string,
    pdfId: string,
    submissionId: string | null,
    entityId: string,
    userId: string
): Promise<ContractActionResponse> {
    try {
        const contractSnap = await adminDb.collection('contracts').doc(contractId).get();
        if (!contractSnap.exists) throw new Error('Contract not found.');
        const workspaceId = contractSnap.data()?.workspaceId;

        const permission = await canUser(userId, 'finance', 'agreements', 'delete', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const batch = adminDb.batch();
        
        // 1. Delete primary Contract doc
        batch.delete(adminDb.collection('contracts').doc(contractId));

        // 2. Delete linked Submission doc to prevent orphan results
        if (pdfId && submissionId) {
            batch.delete(adminDb.collection('pdfs').doc(pdfId).collection('submissions').doc(submissionId));
        }

        await batch.commit();

        // 3. Log activity
        await logActivity({
            entityId: entityId || undefined,
            organizationId: 'default',
            userId,
            workspaceId: workspaceId || 'default',
            type: 'pdf_status_changed',
            source: 'user_action',
            description: `permanently purged agreement record and associated signed document.`,
            metadata: { contractId, pdfId, submissionId }
        });

        revalidatePath('/admin/finance/contracts');
        return { success: true };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to purge agreement';
        console.error('>>> [CONTRACT:PURGE] Failed:', message);
        return { success: false, error: message };
    }
}
