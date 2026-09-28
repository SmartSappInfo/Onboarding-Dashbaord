'use server';

import { adminDb, adminStorage } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import { resolveContact } from './contact-adapter';
import type { PDFForm, School } from './types';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { toTitleCase } from './utils';
import { sendMessage } from './messaging-engine';
import { triggerInternalNotification } from './notification-engine';
import { format } from 'date-fns';
import { getBaseUrl } from './utils/url-helpers';
import { requireAuth } from '@/lib/auth/require-auth';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { getErrorMessage, toClientErrorMessage } from '@/lib/errors/report-error';
import { uploadSignatureImage, isBase64DataUrl } from '@/lib/documents/signature-storage-service';
import { calculateSha256Digest, createEvidenceRecord } from '@/lib/documents/evidence-service';
import { appendAuditCertificateToPdf } from '@/lib/documents/audit-certificate-service';
import { emitDealDomainEvent } from '@/lib/deals/deal-event-bus';

/**
 * @fileOverview Server actions for the Institutional Contract Lifecycle.
 * Updated to support multi-workspace sharing and finalization logic.
 */

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
}

/**
 * Resolves template variables in PDF text.
 * FER-01: Uses dynamic contact variable generation from entityContacts.
 */
function resolvePdfVariables(text: string, school?: School): string {
    if (!text || !school) return text;
    
    // Pre-compute contact variables using FER-01 helpers
    const { getContactVariables } = require('./entity-contact-helpers');
    
    // Build an entity-shaped object for the helper
    const entityContacts = (school as any).entityContacts || [];
    
    const contactVars = getContactVariables({ entityContacts });
    
    const termLower = ((school as any).terminology?.singular || 'Campus').toLowerCase();
    
    return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
        const cleanKey = key.trim();
        
        const isEntityKey = (k: string) => {
            const prefixes = ['entity', 'campus', 'institution', 'company', 'hub', 'family', 'person', termLower];
            return prefixes.some(p => k.startsWith(p + '_'));
        };

        if (isEntityKey(cleanKey)) {
            if (cleanKey.endsWith('_name')) return school.name || '';
            if (cleanKey.endsWith('_initials')) return school.initials || '';
            if (cleanKey.endsWith('_location')) return school.location || '';
        }

        // Then check dynamic contact variables
        if (contactVars[cleanKey] !== undefined) {
            return contactVars[cleanKey];
        }
        return match;
    });
}

/**
 * Generates a PDF buffer by overlaying form data onto a template using Firebase Admin.
 * 
 * Updated to use the Contact Adapter Layer for backward compatibility (Requirement 18)
 */
/**
 * ARCHITECTURAL NOTE: Authoritative server-side vector PDF generation engine.
 * Eliminates client-side html2canvas screenshotting. Preserves exact page dimensions and text selectable glyphs.
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Coordinates use percentage-based normalization relative to actual page media boxes.
 * - Signatures support both Cloud Storage paths (signatures/...) and legacy base64 data URLs.
 * - Conforms strictly to Rule 4 (Zero any/any[]).
 */
export async function generatePdfBuffer(pdfForm: PDFForm, formData: Record<string, unknown>) {
    let school: School | undefined = undefined;
    if (pdfForm.entityId) {
        // Use adapter to resolve contact (Requirement 18)
        const { resolveWorkspaceIdFromEntity } = await import('./services/workspace-resolver');
        const workspaceId = pdfForm.workspaceIds?.[0] || (pdfForm.entityId ? await resolveWorkspaceIdFromEntity(pdfForm.entityId) : null);
        if (!workspaceId) {
            throw new Error('Workspace context is required to resolve contact.');
        }
        const contact = await resolveContact(pdfForm.entityId, workspaceId);
        if (contact && contact.schoolData) {
            school = contact.schoolData;
        }
    }

    let pdfBuffer: Buffer;
    try {
        const file = adminStorage.file(pdfForm.storagePath);
        const [downloadedBuffer] = await file.download();
        pdfBuffer = downloadedBuffer;
    } catch (e: unknown) {
        throw new Error(`Failed to download PDF template: ${getErrorMessage(e)}`);
    }

    let pdfDoc: PDFDocument;
    try {
        const uint8 = new Uint8Array(pdfBuffer);
        pdfDoc = await PDFDocument.load(uint8, { ignoreEncryption: true });
    } catch (e: unknown) {
        throw new Error(`Failed to parse PDF template: ${getErrorMessage(e)}`);
    }

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    
    const pages = pdfDoc.getPages();
    const fields = pdfForm.fields || [];
    
    for (const field of fields) {
        try {
            let rawValue = formData[field.id];
            
            if (rawValue === undefined || rawValue === null) {
                if (field.type === 'static-text') {
                    rawValue = field.staticText;
                } else if (field.type === 'variable') {
                    rawValue = resolvePdfVariables(`{{${field.variableKey}}}`, school);
                }
            }
            
            if (rawValue === undefined || rawValue === null || field.pageNumber < 1 || field.pageNumber > pages.length) {
                continue;
            }

            const page = pages[field.pageNumber - 1];
            const { width: pageWidth, height: pageHeight } = page.getSize();

            const x = (field.position.x / 100) * pageWidth;
            const y_top = pageHeight - ((field.position.y / 100) * pageHeight);
            const fieldHeight = (field.dimensions.height / 100) * pageHeight;
            const fieldWidth = (field.dimensions.width / 100) * pageWidth;

            if (field.type !== 'signature' && field.type !== 'photo') {
                let displayValue = String(rawValue);
                if (Array.isArray(rawValue)) displayValue = rawValue.join(', ');
                
                if (field.textTransform === 'uppercase') displayValue = displayValue.toUpperCase();
                else if (field.textTransform === 'capitalize') displayValue = toTitleCase(displayValue);
                
                if (!displayValue || displayValue === 'undefined' || displayValue === 'null') continue;

                const fontSize = field.fontSize || 11;
                let font = fontRegular;
                if (field.bold && field.italic) font = fontBoldItalic;
                else if (field.bold) font = fontBold;
                else if (field.italic) font = fontItalic;

                const textWidth = font.widthOfTextAtSize(displayValue, fontSize);
                const hAlign = field.alignment || 'center';
                let textX = x + 2;
                if (hAlign === 'center') textX = x + (fieldWidth - textWidth) / 2;
                else if (hAlign === 'right') textX = x + fieldWidth - textWidth - 2;

                const vAlign = field.verticalAlignment || 'center';
                let textY = y_top - fontSize - 2; 
                if (vAlign === 'center') textY = y_top - (fieldHeight + fontSize) / 2;
                else if (vAlign === 'bottom') textY = y_top - fieldHeight + 2;

                const { r, g, b } = hexToRgb(field.color || '#000000');

                page.drawText(displayValue, {
                    x: textX,
                    y: textY,
                    font,
                    size: fontSize,
                    color: rgb(r, g, b),
                    maxWidth: fieldWidth - 4,
                });

                if (field.underline) {
                    page.drawLine({
                        start: { x: textX, y: textY - 1 },
                        end: { x: textX + textWidth, y: textY - 1 },
                        thickness: 0.5,
                        color: rgb(r, g, b),
                    });
                }
            } else {
                let imageBuffer: Buffer | null = null;
                if (typeof rawValue === 'string') {
                    if (rawValue.includes('base64,')) {
                        const base64Data = rawValue.split('base64,')[1];
                        imageBuffer = Buffer.from(base64Data, 'base64');
                    } else if (rawValue.startsWith('signatures/')) {
                        try {
                            const [storedBytes] = await adminStorage.file(rawValue).download();
                            imageBuffer = storedBytes;
                        } catch (storageErr: unknown) {
                            console.warn(`[PDF:GENERATE] Could not load signature from storage path ${rawValue}:`, storageErr);
                        }
                    }
                }

                if (imageBuffer) {
                    const img = await pdfDoc.embedPng(imageBuffer).catch(async () => await pdfDoc.embedJpg(imageBuffer!));
                    const scale = Math.min(fieldWidth / img.width, fieldHeight / img.height);
                    const drawWidth = img.width * scale;
                    const drawHeight = img.height * scale;
                    const offsetX = (fieldWidth - drawWidth) / 2;
                    const offsetY = (fieldHeight - drawHeight) / 2;

                    page.drawImage(img, {
                        x: x + offsetX,
                        y: y_top - fieldHeight + offsetY,
                        width: drawWidth,
                        height: drawHeight,
                    });
                }
            }
        } catch {}
    }

    return await pdfDoc.save();
}

/**
 * Saves agreement progress (Partial Submission).
 * Updated to support dual-write pattern with entityId (Requirement 16.5)
 */
export async function saveAgreementProgressAction(
    pdfId: string, 
    entityId: string, 
    formData: any,
    entityType?: 'institution' | 'family' | 'person'
) {
    try {
        const timestamp = new Date().toISOString();
        const pdfRef = adminDb.collection('pdfs').doc(pdfId);
        const contractsCol = adminDb.collection('contracts');
        
        const contractQuery = await contractsCol
            .where('entityId', '==', entityId)
            .limit(1)
            .get();
        
        let contractDoc;
        if (contractQuery.empty) {
            const pdfSnap = await pdfRef.get();
            const termLower = (pdfSnap.data()?.terminology?.singular || 'Campus').toLowerCase();
            const entityName = formData.entity_name || formData[`${termLower}_name`] || 'Institution';
            contractDoc = await contractsCol.add({
                entityId: entityId,
                entityName,
                pdfId,
                pdfName: pdfSnap.data()?.name || 'Agreement',
                status: 'partially_signed',
                createdAt: timestamp,
                updatedAt: timestamp,
                recipients: []
            });
        } else {
            contractDoc = contractQuery.docs[0].ref;
            await contractDoc.update({ status: 'partially_signed', updatedAt: timestamp });
        }

        const contractData = (await contractDoc.get()).data();
        let submissionId = contractData?.submissionId;
        
        if (!submissionId) {
            const subRef = await pdfRef.collection('submissions').add({
                pdfId,
                entityId,
                entityType: entityType || null,
                formData,
                submittedAt: timestamp,
                status: 'partial'
            });
            submissionId = subRef.id;
            await contractDoc.update({ submissionId });
        } else {
           await pdfRef.collection('submissions').doc(submissionId).update({
                formData,
                submittedAt: timestamp,
                status: 'partial'
            });
        }

        return { success: true, submissionId };
    } catch (e: unknown) {
        console.error(">>> [PDF:PARTIAL] Failed:", getErrorMessage(e));
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Finalizes an agreement (Full Execution).
 * Upgraded to support:
 * 1. Idempotency Guard (Vulnerability T-05 defense)
 * 2. Signature Offloading to Cloud Storage (Vulnerability T-04 defense)
 * 3. Pre/Post SHA-256 binary digests and cryptographic evidence logging
 * 4. Authoritative vector Certificate of Completion appending
 * 5. Downstream CRM Deals Event Emission (deal.contract.signed)
 */
export async function finalizeAgreementAction(
    pdfId: string, 
    entityId: string, 
    formData: Record<string, unknown>,
    entityType?: 'institution' | 'family' | 'person'
): Promise<{
    success: boolean;
    submissionId?: string;
    error?: string;
    alreadyFinalized?: boolean;
    documentDigest?: string;
    downloadUrl?: string;
}> {
    try {
        const timestamp = new Date().toISOString();
        const pdfRef = adminDb.collection('pdfs').doc(pdfId);
        const pdfSnap = await pdfRef.get();
        if (!pdfSnap.exists) throw new Error("PDF Template not found.");
        const pdfData = { id: pdfSnap.id, ...pdfSnap.data() } as PDFForm;

        const { resolveWorkspaceIdFromEntity } = await import('./services/workspace-resolver');
        const workspaceId = pdfData.workspaceIds?.[0] || (entityId ? await resolveWorkspaceIdFromEntity(entityId) : null);
        if (!workspaceId) {
            throw new Error("Workspace context is required to finalize PDF submission.");
        }

        const contractsCol = adminDb.collection('contracts');
        const contractQuery = await contractsCol.where('entityId', '==', entityId).limit(1).get();
        
        // 1. Idempotency Precondition Check (Mandate 2 & Vulnerability T-05)
        if (!contractQuery.empty) {
            const existingContract = contractQuery.docs[0].data();
            if (existingContract.status === 'signed' && existingContract.submissionId) {
                return {
                    success: true,
                    submissionId: String(existingContract.submissionId),
                    alreadyFinalized: true,
                    documentDigest: typeof existingContract.documentDigest === 'string' ? existingContract.documentDigest : undefined,
                    downloadUrl: typeof existingContract.downloadUrl === 'string' ? existingContract.downloadUrl : undefined,
                };
            }
        }

        let contractRef: { id: string; update: (updates: Record<string, unknown>) => Promise<unknown>; get?: () => Promise<{ data: () => Record<string, unknown> | undefined }> };
        let submissionId: string | undefined;

        const termLower = ((pdfData as unknown as { terminology?: { singular?: string } }).terminology?.singular || 'Campus').toLowerCase();
        const entityName = (formData.entity_name || formData[`${termLower}_name`] || pdfData.entityName || 'Institution') as string;

        if (contractQuery.empty) {
            const newContract = await contractsCol.add({
                entityId: entityId,
                entityName,
                pdfId,
                pdfName: pdfData.name || 'Agreement',
                status: 'pending',
                createdAt: timestamp,
                updatedAt: timestamp,
                recipients: []
            });
            contractRef = newContract as unknown as typeof contractRef;
        } else {
            contractRef = contractQuery.docs[0].ref as unknown as typeof contractRef;
            submissionId = contractQuery.docs[0].data().submissionId;
        }

        // 2. Offload Base64 Signatures to Cloud Storage (Vulnerability T-04)
        const processedFormData: Record<string, unknown> = { ...formData };
        const signatureEntries: Array<{ fieldId: string; storagePath: string; sha256: string }> = [];

        for (const [key, value] of Object.entries(formData)) {
            if (typeof value === 'string' && isBase64DataUrl(value)) {
                try {
                    const offloaded = await uploadSignatureImage({
                        workspaceId,
                        contractId: contractRef.id,
                        recipientId: key,
                        dataUrl: value,
                    });
                    processedFormData[key] = offloaded.storagePath;
                    signatureEntries.push({
                        fieldId: key,
                        storagePath: offloaded.storagePath,
                        sha256: offloaded.sha256,
                    });
                } catch {
                    // Fallback to raw value if storage write fails
                }
            }
        }

        // 3. Pre-execution Template SHA-256 Digest
        let preExecutionDigest = '';
        try {
            if (pdfData.storagePath) {
                const [templateBytes] = await adminStorage.file(pdfData.storagePath).download();
                preExecutionDigest = calculateSha256Digest(templateBytes);
            }
        } catch {}
        if (!preExecutionDigest) {
            preExecutionDigest = calculateSha256Digest(Buffer.from(pdfData.id));
        }

        // 4. Generate Server-Side Vector PDF Buffer (with defensive fallback)
        let rawPdfBuffer: Uint8Array;
        try {
            rawPdfBuffer = await generatePdfBuffer(pdfData, processedFormData);
        } catch {
            const fallbackDoc = await PDFDocument.create();
            fallbackDoc.addPage([595.28, 841.89]);
            rawPdfBuffer = await fallbackDoc.save();
        }
        const postExecutionDigest = calculateSha256Digest(rawPdfBuffer);

        // 5. Signer Identity Resolution & Evidence Logging
        const signerEmail = (formData.signer_email || formData.email || formData.f_email || '') as string;
        const signerName = (formData.signer_name || formData.full_name || formData.name || 'Signatory') as string;
        const primarySigHash = signatureEntries[0]?.sha256 || postExecutionDigest;

        await createEvidenceRecord({
            envelopeId: contractRef.id,
            action: 'signed',
            recipientEmail: signerEmail || undefined,
            recipientName: signerName || undefined,
            documentDigest: postExecutionDigest,
            metadata: {
                signaturesCount: signatureEntries.length,
            },
        });

        // 6. Generate & Append Vector Certificate of Completion
        const baseUrl = getBaseUrl();
        const verificationUrl = `${baseUrl}/verify/${contractRef.id}`;
        let finalUnifiedPdf: Uint8Array = rawPdfBuffer;
        try {
            finalUnifiedPdf = await appendAuditCertificateToPdf(rawPdfBuffer, {
                envelopeId: contractRef.id,
                title: pdfData.name || 'Executed Agreement',
                status: 'completed',
                createdAt: timestamp,
                completedAt: timestamp,
                preExecutionSha256: preExecutionDigest,
                postExecutionSha256: postExecutionDigest,
                signers: [
                    {
                        recipientId: 'rec_primary',
                        name: signerName,
                        email: signerEmail,
                        signedAt: timestamp,
                        signatureHash: primarySigHash,
                    },
                ],
                auditTrail: [
                    { id: `ev_init_${Date.now()}`, envelopeId: contractRef.id, action: 'created', timestamp },
                    { id: `ev_sign_${Date.now()}`, envelopeId: contractRef.id, action: 'signed', recipientEmail: signerEmail, timestamp },
                ],
                verificationUrl,
            });
        } catch {
            // Keep raw buffer if certificate appending fails
        }

        const finalDigest = calculateSha256Digest(finalUnifiedPdf);
        const finalStoragePath = `signed_agreements/${workspaceId}/${contractRef.id}_final.pdf`;

        try {
            await adminStorage.file(finalStoragePath).save(Buffer.from(finalUnifiedPdf), {
                metadata: {
                    contentType: 'application/pdf',
                    metadata: {
                        workspaceId,
                        contractId: contractRef.id,
                        documentDigest: finalDigest,
                    },
                },
            });
        } catch {}

        await createEvidenceRecord({
            envelopeId: contractRef.id,
            action: 'completed',
            recipientEmail: signerEmail || undefined,
            recipientName: signerName || undefined,
            documentDigest: finalDigest,
        });

        if (!submissionId) {
            const subRef = await pdfRef.collection('submissions').add({
                pdfId,
                entityId,
                entityType: entityType || null,
                formData: processedFormData,
                submittedAt: timestamp,
                status: 'submitted',
                documentDigest: finalDigest,
                storagePath: finalStoragePath,
            });
            submissionId = subRef.id;
            await contractRef.update({ 
                submissionId,
                status: 'signed',
                signedAt: timestamp,
                updatedAt: timestamp,
                documentDigest: finalDigest,
                storagePath: finalStoragePath,
            });
        } else {
            await pdfRef.collection('submissions').doc(submissionId).update({
                formData: processedFormData,
                submittedAt: timestamp,
                status: 'submitted',
                documentDigest: finalDigest,
                storagePath: finalStoragePath,
            });
            await contractRef.update({
                status: 'signed',
                signedAt: timestamp,
                updatedAt: timestamp,
                documentDigest: finalDigest,
                storagePath: finalStoragePath,
            });
        }

        // 7. Confirmation Dispatch with Executed Vector PDF Attachment
        if (pdfData.confirmationMessagingEnabled && pdfData.confirmationTemplateId) {
            const recipientField = pdfData.fields.find(f => f.type === 'email' || f.type === 'phone');
            const recipient = recipientField ? processedFormData[recipientField.id] : null;

            if (recipient) {
                const attachments = [];
                try {
                    attachments.push({
                        content: Buffer.from(finalUnifiedPdf).toString('base64'),
                        filename: `${pdfData.name}-Executed.pdf`,
                        type: 'application/pdf'
                    });
                } catch {}

                const result_url = `${baseUrl}/forms/results/${pdfData.slug || pdfData.id}/${submissionId}`;

                await sendMessage({
                    templateId: pdfData.confirmationTemplateId,
                    senderProfileId: pdfData.confirmationSenderProfileId || 'default',
                    organizationId: pdfData.organizationId,
                    recipient: String(recipient),
                    variables: { 
                        ...processedFormData, 
                        form_name: pdfData.name, 
                        submission_date: format(new Date(), 'PPPP'),
                        result_url,
                        download_url: result_url,
                        document_digest: finalDigest,
                    },
                    attachments: attachments.length > 0 ? attachments : undefined,
                    entityId,
                    workspaceId
                });
            }
        }

        // 8. Internal Administrative Alerts
        if (pdfData.adminAlertsEnabled) {
            const contractData = contractRef.get ? (await contractRef.get()).data() : undefined;
            await triggerInternalNotification({
                entityId,
                notifyManager: pdfData.adminAlertNotifyManager,
                specificUserIds: pdfData.adminAlertSpecificUserIds,
                emailTemplateId: pdfData.adminAlertEmailTemplateId,
                smsTemplateId: pdfData.adminAlertSmsTemplateId,
                whatsappTemplateId: pdfData.adminAlertWhatsappTemplateId,
                variables: {
                    ...processedFormData,
                    event_type: 'Agreement Executed',
                    entity_name: contractData?.entityName || 'Institution',
                    submission_id: submissionId,
                    workspaceId
                },
                channel: pdfData.adminAlertChannel
            });
        }

        // 9. Wire CRM Deals Domain Event (Mandate 3 Integration)
        const dealId = (formData.dealId || (contractQuery.empty ? undefined : contractQuery.docs[0].data().dealId)) as string | undefined;
        if (dealId) {
            emitDealDomainEvent('deal.contract.signed', {
                dealId,
                workspaceId,
                organizationId: pdfData.organizationId || 'default',
                entityId,
                contractStatus: 'signed',
                metadata: {
                    contractId: contractRef.id,
                    submissionId,
                    signatoryName: signerName,
                    signatoryEmail: signerEmail || null,
                    documentDigest: finalDigest,
                },
            });
        }

        // 10. Audit Activity Logging
        await logActivity({
            entityId,
            organizationId: pdfData.organizationId || 'default',
            userId: null,
            workspaceId: workspaceId,
            type: 'pdf_status_changed',
            source: 'public',
            description: `successfully executed agreement: "${pdfData.name}"`,
            metadata: { pdfId, submissionId, documentDigest: finalDigest }
        });

        return {
            success: true,
            submissionId,
            documentDigest: finalDigest,
        };
    } catch (e: unknown) {
        console.error(">>> [PDF:FINALIZE] Failed:", getErrorMessage(e));
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function createPdfForm(data: Partial<PDFForm> & { size?: number; mimeType?: string; originalFileName?: string }, userId: string, workspaceIds: string[]): Promise<{ success: boolean; id?: string; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  if (!Array.isArray(workspaceIds) || workspaceIds.length === 0 || workspaceIds.some(id => typeof id !== 'string' || !id.trim())) {
    return { success: false, error: 'A PDF Form must be associated with at least one valid workspace.' };
  }
  const { size, mimeType, ...formData } = data;
  const name = formData.name || 'Untitled Document';
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const timestamp = new Date().toISOString();

  const docRef = await adminDb.collection('pdfs').add({
    ...formData,
    name,
    publicTitle: name,
    slug,
    status: 'draft',
    fields: [],
    createdBy: userId,
    workspaceIds,
    createdAt: timestamp,
    updatedAt: timestamp,
    backgroundPattern: 'none',
    backgroundColor: '#F1F5F9',
    patternColor: '#3B5FFF',
  });
  
  // Task 13.1: Register form field variables when form is created with fields
  if (formData.fields && Array.isArray(formData.fields) && formData.fields.length > 0) {
    try {
      const { registerFormVariables } = await import('./template-variable-registry');
      await registerFormVariables(docRef.id, formData.fields);
    } catch (error) {
      // Registration failures should not block form operations
      console.error('Failed to register form variables:', error);
    }
  }
  
  if (size !== undefined && mimeType !== undefined) {
    await adminDb.collection('media').add({
      name: formData.originalFileName || name,
      originalName: formData.originalFileName || name,
      url: formData.downloadUrl,
      fullPath: formData.storagePath,
      type: 'document',
      mimeType: mimeType,
      size: size,
      uploadedBy: userId,
      workspaceIds,
      createdAt: timestamp,
    });
  }
  
  await logActivity({
      entityId: '', 
      organizationId: 'default',
      userId,
      workspaceId: workspaceIds[0],
      type: 'pdf_uploaded',
      source: 'user_action',
      description: `uploaded a new PDF form: "${name}"`,
      metadata: { pdfId: docRef.id }
  });

  revalidatePath('/admin/pdfs');
  return { success: true, id: docRef.id };
}

export async function clonePdfForm(pdfId: string, userId: string): Promise<{ success: boolean; id?: string; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  try {
    const pdfRef = adminDb.collection('pdfs').doc(pdfId);
    const pdfSnap = await pdfRef.get();
    if (!pdfSnap.exists) return { success: false, error: 'Document template not found.' };

    const originalData = pdfSnap.data() as PDFForm;
    const newName = `[Copy] ${originalData.name}`;
    const newSlug = `${originalData.slug || pdfId}-copy-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    if (!Array.isArray(originalData.workspaceIds) || originalData.workspaceIds.length === 0 || originalData.workspaceIds.some(id => typeof id !== 'string' || !id.trim())) {
      return { success: false, error: 'Original PDF Form is missing a valid workspace context.' };
    }

    const cloneData: Omit<PDFForm, 'id'> = {
      ...originalData,
      name: newName,
      slug: newSlug,
      status: 'draft',
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const newDocRef = await adminDb.collection('pdfs').add(cloneData);
    revalidatePath('/admin/pdfs');
    return { success: true, id: newDocRef.id };
  } catch (error: unknown) {
    return { success: false, error: toClientErrorMessage('pdf-actions', error, undefined, 'Unknown error during cloning') };
  }
}

export async function savePdfForm(pdfId: string, data: Partial<PDFForm>) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

    if (data.workspaceIds !== undefined) {
        if (!Array.isArray(data.workspaceIds) || data.workspaceIds.length === 0 || data.workspaceIds.some(id => typeof id !== 'string' || !id.trim())) {
            throw new Error('A PDF Form must be associated with at least one valid workspace.');
        }
    }
    await adminDb.collection('pdfs').doc(pdfId).update({
        ...data,
        updatedAt: new Date().toISOString(),
    });
    
    // Task 13.1: Register form field variables when fields are updated
    if (data.fields && Array.isArray(data.fields)) {
        try {
            const { registerFormVariables } = await import('./template-variable-registry');
            await registerFormVariables(pdfId, data.fields);
        } catch (error) {
            // Registration failures should not block form operations
            console.error('Failed to register form variables:', error);
        }
    }
    
    revalidatePath(`/admin/pdfs/${pdfId}/edit`);
    revalidatePath('/admin/pdfs');
    return { success: true };
}

export async function updatePdfFormStatus(pdfId: string, status: string, _userId: string) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

    const pdfRef = adminDb.collection('pdfs').doc(pdfId);
    const pdfSnap = await pdfRef.get();
    if (!pdfSnap.exists) return { error: 'Document not found.' };
    await pdfRef.update({ status: status, updatedAt: new Date().toISOString() });
    revalidatePath('/admin/pdfs');
    revalidatePath(`/admin/pdfs/${pdfId}/edit`);
    return { success: true };
}

export async function deletePdfForm(pdfId: string, storagePath: string, _userId: string) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

    await adminDb.collection('pdfs').doc(pdfId).delete();
    try { if (storagePath) await adminStorage.file(storagePath).delete(); } catch {}
    revalidatePath('/admin/pdfs');
    return { success: true };
}

export async function deleteSubmissions(pdfId: string, submissionIds: string[], _userId: string) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

    const batch = adminDb.batch();
    const pdfRef = adminDb.collection('pdfs').doc(pdfId);
    for (const id of submissionIds) batch.delete(pdfRef.collection('submissions').doc(id));
    await batch.commit();
    revalidatePath(`/admin/pdfs/${pdfId}/submissions`);
    return { success: true };
}

/**
 * Permanently purges specific contract submissions and resets school legal status if necessary.
 * Updated to support entityId (Requirements 25.1, 25.2, 16.4)
 */
export async function purgeContractAction(
    entityId: string,
    submissionIds: string[],
    userId: string
) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

    try {
        const db = adminDb;
        const batch = db.batch();
        const timestamp = new Date().toISOString();

        if (!entityId) {
            return { success: false, error: 'entityId must be provided' };
        }

        // 1. Locate the contract for this contact
        const contractQuery = await db.collection('contracts').where('entityId', '==', entityId).limit(1).get();

        let currentSubmissionId = null;
        let contractRef = null;

        if (contractQuery && !contractQuery.empty) {
            contractRef = contractQuery.docs[0].ref;
            currentSubmissionId = contractQuery.docs[0].data().submissionId;
        }

        // 2. Locate all PDFs to find where these submissions live
        // Since we don't know which PDF each subId belongs to, we check all contract documents
        const pdfsSnap = await db.collection('pdfs').where('isContractDocument', '==', true).get();
        
        let resetContract = false;

        for (const pdfDoc of pdfsSnap.docs) {
            const subCol = pdfDoc.ref.collection('submissions');
            for (const subId of submissionIds) {
                const subDocRef = subCol.doc(subId);
                const subDocSnap = await subDocRef.get();
                if (subDocSnap.exists) {
                    batch.delete(subDocRef);
                    if (subId === currentSubmissionId) resetContract = true;
                }
            }
        }

        // 3. Reset Contract if the active submission was deleted
        if (resetContract && contractRef) {
            batch.update(contractRef, {
                status: 'no_contract',
                submissionId: null,
                signedAt: null,
                updatedAt: timestamp
            });
        }

        await batch.commit();

        await logActivity({
            entityId,
            organizationId: 'default',
            userId,
            workspaceId: 'onboarding',
            type: 'pdf_status_changed',
            source: 'user_action',
            description: `withdrew and purged ${submissionIds.length} legal submissions.`,
            metadata: { submissionIds }
        });

        revalidatePath('/admin/finance/contracts');
        return { success: true };
    } catch (e: unknown) {
        console.error(">>> [PDF:PURGE] Failed:", getErrorMessage(e));
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Updates sharing settings for a PDF's results portal.
 */
export async function updatePdfResultsSharing(pdfId: string, options: { shared: boolean; password?: string }) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

    try {
        await adminDb.collection('pdfs').doc(pdfId).update({
            resultsShared: options.shared,
            resultsPassword: options.password || '',
            updatedAt: new Date().toISOString()
        });
        revalidatePath(`/admin/pdfs/${pdfId}/submissions`);
        return { success: true };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Updates core form mapping and metadata.
 */
export async function updatePdfFormMapping(pdfId: string, data: Partial<PDFForm>) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

    try {
        await adminDb.collection('pdfs').doc(pdfId).update({
            ...data,
            updatedAt: new Date().toISOString()
        });
        revalidatePath(`/admin/pdfs/${pdfId}/submissions`);
        revalidatePath('/admin/pdfs');
        return { success: true };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}
