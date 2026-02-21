
'use server';

import { adminDb, adminStorage } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { PDFForm, PDFFormField } from './types';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generates a PDF buffer by overlaying form data onto a template using Firebase Admin.
 * @param pdfForm The form metadata containing field definitions.
 * @param formData The user-submitted values.
 */
export async function generatePdfBuffer(pdfForm: PDFForm, formData: { [key: string]: any }) {
    console.log(`>>> [PDF:GEN] START: "${pdfForm.name}" (ID: ${pdfForm.id})`);
    
    let pdfBuffer: Buffer;
    try {
        console.log(`>>> [PDF:GEN] STEP 1: Downloading template from Admin Storage: ${pdfForm.storagePath}`);
        const file = adminStorage.file(pdfForm.storagePath);
        const [downloadedBuffer] = await file.download();
        pdfBuffer = downloadedBuffer;
        console.log(`>>> [PDF:GEN] SUCCESS: Downloaded ${pdfBuffer.length} bytes.`);
    } catch (e: any) {
        console.error(`>>> [PDF:GEN] FAIL: Storage Download Error:`, e);
        throw new Error(`Failed to download PDF template: ${e.message}`);
    }

    let pdfDoc: PDFDocument;
    try {
        console.log(`>>> [PDF:GEN] STEP 2: Loading buffer into pdf-lib...`);
        pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    } catch (e: any) {
        console.error(`>>> [PDF:GEN] FAIL: pdf-lib Load Error:`, e);
        throw new Error(`Failed to parse PDF template: ${e.message}`);
    }

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const fields = pdfForm.fields || [];
    
    console.log(`>>> [PDF:GEN] STEP 3: Processing ${fields.length} fields.`);

    for (const field of fields) {
        try {
            const rawValue = formData[field.id];
            
            if (rawValue === undefined || rawValue === null || field.pageNumber < 1 || field.pageNumber > pages.length) {
                continue;
            }

            const page = pages[field.pageNumber - 1];
            const { width: pageWidth, height: pageHeight } = page.getSize();

            // Coordinate Mapping: Percent (Top-Left) -> PDF Points (Bottom-Left)
            const x = (field.position.x / 100) * pageWidth;
            const y_top = pageHeight - ((field.position.y / 100) * pageHeight);
            const fieldHeight = (field.dimensions.height / 100) * pageHeight;
            const fieldWidth = (field.dimensions.width / 100) * pageWidth;

            if (field.type === 'text' || field.type === 'date' || field.type === 'dropdown') {
                let displayValue = String(rawValue);
                if (Array.isArray(rawValue)) displayValue = rawValue.join(', ');
                
                if (!displayValue || displayValue === 'undefined' || displayValue === 'null') continue;

                const fontSize = field.fontSize || 11;
                page.drawText(displayValue, {
                    x: x + 2,
                    y: y_top - fontSize - 2,
                    font,
                    size: fontSize,
                    color: rgb(0, 0, 0),
                    maxWidth: fieldWidth - 4,
                });
            } else if (field.type === 'signature') {
                if (typeof rawValue === 'string' && rawValue.includes('base64,')) {
                    const base64Data = rawValue.split('base64,')[1];
                    const signatureBuffer = Buffer.from(base64Data, 'base64');
                    
                    const pngImage = await pdfDoc.embedPng(signatureBuffer);
                    const scale = Math.min(fieldWidth / pngImage.width, fieldHeight / pngImage.height);

                    page.drawImage(pngImage, {
                        x: x,
                        y: y_top - fieldHeight,
                        width: pngImage.width * scale,
                        height: pngImage.height * scale,
                    });
                }
            }
        } catch (fieldError: any) {
            console.warn(`>>> [PDF:GEN] Skipping field ${field.id}:`, fieldError.message);
        }
    }

    console.log(`>>> [PDF:GEN] FINAL: Saving PDF...`);
    return await pdfDoc.save();
}

export async function createPdfForm(data: any, userId: string) {
  const slug = data.name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const docRef = await adminDb.collection('pdfs').add({
    ...data,
    slug,
    status: 'draft',
    fields: [],
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  await logActivity({
      schoolId: '', 
      userId,
      type: 'pdf_uploaded',
      source: 'user_action',
      description: `uploaded a new PDF form: "${data.name}"`,
      metadata: { pdfId: docRef.id }
  });

  revalidatePath('/admin/pdfs');
  return { success: true, id: docRef.id };
}

export async function updatePdfFormName(pdfId: string, newName: string) {
  await adminDb.collection('pdfs').doc(pdfId).update({
    name: newName.trim(),
    updatedAt: new Date().toISOString(),
  });
  revalidatePath(`/admin/pdfs/${pdfId}/edit`);
  revalidatePath('/admin/pdfs');
  return { success: true };
}

export async function updatePdfFormSlug(pdfId: string, newSlug: string) {
  const cleanSlug = newSlug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  
  if (cleanSlug.length < 3) {
    return { error: 'Slug must be at least 3 characters.' };
  }

  // Check for uniqueness
  const querySnap = await adminDb.collection('pdfs').where('slug', '==', cleanSlug).limit(1).get();
  if (!querySnap.empty && querySnap.docs[0].id !== pdfId) {
    return { error: 'This slug is already in use by another document.' };
  }

  await adminDb.collection('pdfs').doc(pdfId).update({
    slug: cleanSlug,
    updatedAt: new Date().toISOString(),
  });

  revalidatePath(`/admin/pdfs/${pdfId}/edit`);
  revalidatePath('/admin/pdfs');
  return { success: true, slug: cleanSlug };
}

export async function updatePdfFormMapping(pdfId: string, data: any) {
  await adminDb.collection('pdfs').doc(pdfId).update({
    fields: data.fields,
    password: data.password || null,
    passwordProtected: data.passwordProtected || false,
    updatedAt: new Date().toISOString(),
  });
  revalidatePath(`/admin/pdfs/${pdfId}/edit`);
  return { success: true };
}

export async function updatePdfFormStatus(pdfId: string, status: string, userId: string) {
    const pdfRef = adminDb.collection('pdfs').doc(pdfId);
    const pdfSnap = await pdfRef.get();
    
    if (!pdfSnap.exists) return { error: 'Document not found.' };
    const pdfData = pdfSnap.data();

    await pdfRef.update({
      status: status,
      updatedAt: new Date().toISOString(),
    });

    await logActivity({
      schoolId: '', 
      userId,
      type: 'pdf_status_changed',
      source: 'user_action',
      description: `changed status of PDF "${pdfData?.name}" to ${status}`,
      metadata: { pdfId: pdfId, from: pdfData?.status, to: status },
    });

    revalidatePath('/admin/pdfs');
    revalidatePath(`/admin/pdfs/${pdfId}/edit`);
    return { success: true };
}

export async function deletePdfForm(pdfId: string, storagePath: string, userId: string) {
    await adminDb.collection('pdfs').doc(pdfId).delete();
    try {
        await adminStorage.file(storagePath).delete();
    } catch (e) {
        console.warn("Storage file not found during deletion:", storagePath);
    }

    await logActivity({
        schoolId: '',
        userId,
        type: 'pdf_uploaded', 
        source: 'user_action',
        description: `deleted PDF form (ID: ${pdfId})`,
        metadata: { pdfId: pdfId, storagePath: storagePath }
    });

    revalidatePath('/admin/pdfs');
    return { success: true };
}
