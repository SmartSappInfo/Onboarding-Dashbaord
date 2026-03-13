'use server';

import { adminDb, adminStorage } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { PDFForm, PDFFormField, School, Contract, Submission } from './types';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { toTitleCase } from './utils';
import { sendMessage } from './messaging-engine';
import { triggerInternalNotification } from './notification-engine';
import { format } from 'date-fns';

/**
 * @fileOverview Server actions for the Institutional Contract Lifecycle.
 * Updated to support partial saves, multi-stage signing, and finalization logic.
 */

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
}

function resolvePdfVariables(text: string, school?: School): string {
    if (!text || !school) return text;
    
    return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
        const cleanKey = key.trim();
        switch (cleanKey) {
            case 'school_name': return school.name || '';
            case 'school_initials': return school.initials || '';
            case 'school_location': return school.location || '';
            case 'school_phone': return school.phone || '';
            case 'school_email': return school.email || '';
            case 'contact_name': return school.contactPerson || '';
            default: return match;
        }
    });
}

/**
 * Generates a PDF buffer by overlaying form data onto a template using Firebase Admin.
 */
export async function generatePdfBuffer(pdfForm: PDFForm, formData: { [key: string]: any }) {
    let school: School | undefined = undefined;
    if (pdfForm.schoolId) {
        const schoolSnap = await adminDb.collection('schools').doc(pdfForm.schoolId).get();
        if (schoolSnap.exists) {
            school = { id: schoolSnap.id, ...schoolSnap.data() } as School;
        }
    }

    let pdfBuffer: Buffer;
    try {
        const file = adminStorage.file(pdfForm.storagePath);
        const [downloadedBuffer] = await file.download();
        pdfBuffer = downloadedBuffer;
    } catch (e: any) {
        throw new Error(`Failed to download PDF template: ${e.message}`);
    }

    let pdfDoc: PDFDocument;
    try {
        pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    } catch (e: any) {
        throw new Error(`Failed to parse PDF template: ${e.message}`);
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
                if (typeof rawValue === 'string' && rawValue.includes('base64,')) {
                    const base64Data = rawValue.split('base64,')[1];
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    const img = await pdfDoc.embedPng(imageBuffer);
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
        } catch (err) {}
    }

    return await pdfDoc.save();
}

/**
 * Saves agreement progress (Partial Submission).
 */
export async function saveAgreementProgressAction(pdfId: string, schoolId: string, formData: any) {
    try {
        const timestamp = new Date().toISOString();
        const pdfRef = adminDb.collection('pdfs').doc(pdfId);
        const contractsCol = adminDb.collection('contracts');
        
        // 1. Resolve or Create Contract Record
        const contractQuery = await contractsCol
            .where('schoolId', '==', schoolId)
            .limit(1)
            .get();
        
        let contractDoc;
        if (contractQuery.empty) {
            const pdfSnap = await pdfRef.get();
            contractDoc = await contractsCol.add({
                schoolId,
                schoolName: (formData.school_name || 'School'),
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

        // 2. Resolve or Create Submission Record
        const contractData = (await contractDoc.get()).data();
        let submissionId = contractData?.submissionId;
        
        if (!submissionId) {
            const subRef = await pdfRef.collection('submissions').add({
                pdfId,
                schoolId,
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
    } catch (e: any) {
        console.error(">>> [PDF:PARTIAL] Failed:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Finalizes an agreement (Full Execution).
 */
export async function finalizeAgreementAction(pdfId: string, schoolId: string, formData: any) {
    try {
        const timestamp = new Date().toISOString();
        const pdfRef = adminDb.collection('pdfs').doc(pdfId);
        const pdfSnap = await pdfRef.get();
        if (!pdfSnap.exists) throw new Error("PDF Template not found.");
        const pdfData = { id: pdfSnap.id, ...pdfSnap.data() } as PDFForm;

        // 1. Resolve Contract Context
        const contractsCol = adminDb.collection('contracts');
        const contractQuery = await contractsCol.where('schoolId', '==', schoolId).limit(1).get();
        
        let contractRef;
        let submissionId;

        if (contractQuery.empty) {
            const newContract = await contractsCol.add({
                schoolId,
                schoolName: (formData.school_name || pdfData.schoolName || 'School'),
                pdfId,
                pdfName: pdfData.name || 'Agreement',
                status: 'signed',
                createdAt: timestamp,
                updatedAt: timestamp,
                signedAt: timestamp,
                recipients: []
            });
            contractRef = newContract;
        } else {
            contractRef = contractQuery.docs[0].ref;
            submissionId = contractQuery.docs[0].data().submissionId;
        }

        // 2. Resolve or Create Submission Record
        if (!submissionId) {
            const subRef = await pdfRef.collection('submissions').add({
                pdfId,
                schoolId,
                formData,
                submittedAt: timestamp,
                status: 'submitted'
            });
            submissionId = subRef.id;
            await contractRef.update({ 
                submissionId,
                status: 'signed',
                signedAt: timestamp,
                updatedAt: timestamp
            });
        } else {
            await pdfRef.collection('submissions').doc(submissionId).update({
                formData,
                submittedAt: timestamp,
                status: 'submitted'
            });
            await contractRef.update({
                status: 'signed',
                signedAt: timestamp,
                updatedAt: timestamp
            });
        }

        // 3. Dispatch Automations (Notifications)
        if (pdfData.confirmationMessagingEnabled && pdfData.confirmationTemplateId) {
            const recipientField = pdfData.fields.find(f => f.type === 'email' || f.type === 'phone');
            const recipient = recipientField ? formData[recipientField.id] : null;

            if (recipient) {
                let attachments = [];
                try {
                    const pdfBuffer = await generatePdfBuffer(pdfData, formData);
                    attachments.push({
                        content: Buffer.from(pdfBuffer).toString('base64'),
                        filename: `${pdfData.name}-Executed.pdf`,
                        type: 'application/pdf'
                    });
                } catch (err) {}

                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onboarding.smartsapp.com';
                const result_url = `${baseUrl}/forms/results/${pdfData.slug || pdfData.id}/${submissionId}`;

                await sendMessage({
                    templateId: pdfData.confirmationTemplateId,
                    senderProfileId: pdfData.confirmationSenderProfileId || 'default',
                    recipient: String(recipient),
                    variables: { 
                        ...formData, 
                        form_name: pdfData.name, 
                        submission_date: format(new Date(), 'PPPP'),
                        result_url,
                        download_url: result_url
                    },
                    attachments: attachments.length > 0 ? attachments : undefined,
                    schoolId
                });
            }
        }

        if (pdfData.adminAlertsEnabled) {
            const contractData = (await contractRef.get()).data();
            await triggerInternalNotification({
                schoolId,
                notifyManager: pdfData.adminAlertNotifyManager,
                specificUserIds: pdfData.adminAlertSpecificUserIds,
                emailTemplateId: pdfData.adminAlertEmailTemplateId,
                smsTemplateId: pdfData.adminAlertSmsTemplateId,
                variables: { 
                    ...formData, 
                    event_type: 'Agreement Executed', 
                    school_name: contractData?.schoolName || 'Institution',
                    submission_id: submissionId
                },
                channel: pdfData.adminAlertChannel
            });
        }

        await logActivity({
            schoolId,
            userId: null,
            type: 'pdf_status_changed',
            source: 'public',
            description: `successfully executed agreement: "${pdfData.name}"`,
            metadata: { pdfId, submissionId }
        });

        return { success: true, submissionId };
    } catch (e: any) {
        console.error(">>> [PDF:FINALIZE] Failed:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Resets an institutional contract record and deletes associated submissions.
 * Requires high-level administrative authorization.
 */
export async function purgeContractAction(schoolId: string, submissionIds: string[], userId: string) {
    try {
        const batch = adminDb.batch();
        
        // 1. Delete associated submissions across all relevant PDF subcollections
        const pdfsSnap = await adminDb.collection('pdfs').get();
        for (const pdfDoc of pdfsSnap.docs) {
            const subCol = pdfDoc.ref.collection('submissions');
            for (const subId of submissionIds) {
                batch.delete(subCol.doc(subId));
            }
        }

        // 2. Remove or reset the primary contract link
        const contractsCol = adminDb.collection('contracts');
        const contractQuery = await contractsCol.where('schoolId', '==', schoolId).limit(1).get();
        if (!contractQuery.empty) {
            batch.delete(contractQuery.docs[0].ref);
        }

        await batch.commit();

        await logActivity({
            schoolId,
            userId,
            type: 'pdf_status_changed',
            source: 'user_action',
            description: `purged legal agreement history and ${submissionIds.length} submissions for school`
        });

        revalidatePath('/admin/finance/contracts');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function createPdfForm(data: any, userId: string) {
  const { size, mimeType, ...formData } = data;
  const slug = formData.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const timestamp = new Date().toISOString();

  const docRef = await adminDb.collection('pdfs').add({
    ...formData,
    publicTitle: formData.name,
    slug,
    status: 'draft',
    fields: [],
    createdBy: userId,
    createdAt: timestamp,
    updatedAt: timestamp,
    backgroundPattern: 'none',
    backgroundColor: '#F1F5F9',
    patternColor: '#3B5FFF',
  });
  
  if (size !== undefined && mimeType !== undefined) {
    await adminDb.collection('media').add({
      name: formData.originalFileName || formData.name,
      originalName: formData.originalFileName || formData.name,
      url: formData.downloadUrl,
      fullPath: formData.storagePath,
      type: 'document',
      mimeType: mimeType,
      size: size,
      uploadedBy: userId,
      createdAt: timestamp,
    });
  }
  
  await logActivity({
      schoolId: '', 
      userId,
      type: 'pdf_uploaded',
      source: 'user_action',
      description: `uploaded a new PDF form: "${formData.name}"`,
      metadata: { pdfId: docRef.id }
  });

  revalidatePath('/admin/pdfs');
  return { success: true, id: docRef.id };
}

export async function clonePdfForm(pdfId: string, userId: string) {
  try {
    const pdfRef = adminDb.collection('pdfs').doc(pdfId);
    const pdfSnap = await pdfRef.get();
    if (!pdfSnap.exists) return { success: false, error: 'Document template not found.' };

    const originalData = pdfSnap.data() as PDFForm;
    const newName = `[Copy] ${originalData.name}`;
    const newSlug = `${originalData.slug || pdfId}-copy-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

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
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function savePdfForm(pdfId: string, data: Partial<PDFForm>) {
    await adminDb.collection('pdfs').doc(pdfId).update({
        ...data,
        updatedAt: new Date().toISOString(),
    });
    revalidatePath(`/admin/pdfs/${pdfId}/edit`);
    revalidatePath('/admin/pdfs');
    return { success: true };
}

export async function updatePdfFormSlug(pdfId: string, newSlug: string) {
  const cleanSlug = newSlug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (cleanSlug.length < 3) return { error: 'Slug must be at least 3 characters.' };
  const querySnap = await adminDb.collection('pdfs').where('slug', '==', cleanSlug).limit(1).get();
  if (!querySnap.empty && querySnap.docs[0].id !== pdfId) return { error: 'This slug is already in use.' };
  await adminDb.collection('pdfs').doc(pdfId).update({ slug: cleanSlug, updatedAt: new Date().toISOString() });
  revalidatePath(`/admin/pdfs/${pdfId}/edit`);
  revalidatePath('/admin/pdfs');
  return { success: true, slug: cleanSlug };
}

export async function updatePdfFormMapping(pdfId: string, data: any) {
  await adminDb.collection('pdfs').doc(pdfId).update({
    fields: data.fields,
    namingFieldId: data.namingFieldId || null,
    displayFieldIds: data.displayFieldIds || [],
    password: data.password || null,
    passwordProtected: data.passwordProtected || false,
    updatedAt: new Date().toISOString(),
  });
  revalidatePath(`/admin/pdfs/${pdfId}/edit`);
  return { success: true };
}

export async function updatePdfResultsSharing(pdfId: string, data: { shared: boolean; password?: string }) {
  await adminDb.collection('pdfs').doc(pdfId).update({
    resultsShared: data.shared,
    resultsPassword: data.password || '',
    updatedAt: new Date().toISOString(),
  });
  revalidatePath(`/admin/pdfs/${pdfId}/submissions`);
  return { success: true };
}

export async function updatePdfFormStatus(pdfId: string, status: string, userId: string) {
    const pdfRef = adminDb.collection('pdfs').doc(pdfId);
    const pdfSnap = await pdfRef.get();
    if (!pdfSnap.exists) return { error: 'Document not found.' };
    await pdfRef.update({ status: status, updatedAt: new Date().toISOString() });
    revalidatePath('/admin/pdfs');
    revalidatePath(`/admin/pdfs/${pdfId}/edit`);
    return { success: true };
}

export async function deletePdfForm(pdfId: string, storagePath: string, userId: string) {
    await adminDb.collection('pdfs').doc(pdfId).delete();
    try { if (storagePath) await adminStorage.file(storagePath).delete(); } catch (e) {}
    revalidatePath('/admin/pdfs');
    return { success: true };
}

export async function deleteSubmissions(pdfId: string, submissionIds: string[], userId: string) {
    const batch = adminDb.batch();
    const pdfRef = adminDb.collection('pdfs').doc(pdfId);
    for (const id of submissionIds) batch.delete(pdfRef.collection('submissions').doc(id));
    await batch.commit();
    revalidatePath(`/admin/pdfs/${pdfId}/submissions`);
    return { success: true };
}
