
'use server';

import { doc, addDoc, collection, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, deleteObject, getBytes } from 'firebase/storage';
import { getDb, getServerStorage } from './server-only-firestore';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { PDFForm, PDFFormField, Submission } from './types';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generates a PDF buffer by overlaying form data onto a template.
 * @param pdfForm The form metadata containing field definitions.
 * @param formData The user-submitted values (text and base64 signatures).
 */
export async function generatePdfBuffer(pdfForm: PDFForm, formData: { [key: string]: any }) {
    console.log(`>>> [PDF:GEN] START: "${pdfForm.name}" (ID: ${pdfForm.id})`);
    
    const storage = getServerStorage();
    const fileRef = ref(storage, pdfForm.storagePath);
    
    let pdfBuffer: ArrayBuffer;
    try {
        console.log(`>>> [PDF:GEN] STEP 1: Fetching template from Storage: ${pdfForm.storagePath}`);
        const bytes = await getBytes(fileRef);
        // Ensure we have a clean ArrayBuffer from the storage bytes
        pdfBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        console.log(`>>> [PDF:GEN] SUCCESS: Fetched ${pdfBuffer.byteLength} bytes.`);
    } catch (e: any) {
        console.error(`>>> [PDF:GEN] FAIL: Storage Fetch Error:`, e);
        throw new Error(`Failed to fetch PDF template: ${e.message}`);
    }

    let pdfDoc: PDFDocument;
    try {
        console.log(`>>> [PDF:GEN] STEP 2: Loading buffer into pdf-lib...`);
        pdfDoc = await PDFDocument.load(pdfBuffer);
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
            
            // Validation: Skip if no value or invalid page reference
            if (rawValue === undefined || rawValue === null || field.pageNumber < 1 || field.pageNumber > pages.length) {
                continue;
            }

            const page = pages[field.pageNumber - 1];
            const { width: pageWidth, height: pageHeight } = page.getSize();

            // Coordinate Mapping: Percentage (Top-Left) -> PDF Points (Bottom-Left)
            const x = (field.position.x / 100) * pageWidth;
            const y_top = pageHeight - ((field.position.y / 100) * pageHeight);
            const fieldHeight = (field.dimensions.height / 100) * pageHeight;
            const fieldWidth = (field.dimensions.width / 100) * pageWidth;

            if (field.type === 'text' || field.type === 'date') {
                let displayValue = '';
                if (Array.isArray(rawValue)) {
                    displayValue = rawValue.join(', ');
                } else if (typeof rawValue === 'object') {
                    const parts = [];
                    if (rawValue.options) parts.push(rawValue.options.join(', '));
                    if (rawValue.other) parts.push(`Other: ${rawValue.other}`);
                    displayValue = parts.join('; ');
                } else {
                    displayValue = String(rawValue);
                }

                if (!displayValue) continue;

                const fontSize = field.fontSize || 11;
                
                page.drawText(displayValue, {
                    x: x + 2,
                    y: y_top - fontSize - 2, // Offset baseline
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

    console.log(`>>> [PDF:GEN] FINAL: Serializing bytes...`);
    return await pdfDoc.save();
}

type CreatePdfFormData = Pick<PDFForm, 'name' | 'originalFileName' | 'storagePath' | 'downloadUrl'>;

export async function createPdfForm(data: CreatePdfFormData, userId: string) {
  if (!data.name || !data.originalFileName || !data.storagePath || !data.downloadUrl || !userId) {
    return { error: 'Invalid input data.' };
  }
  
  const db = getDb();
  const pdfCollection = collection(db, 'pdfs');

  const newPdfData: Omit<PDFForm, 'id'> = {
    ...data,
    status: 'draft',
    fields: [],
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const docRef = await addDoc(pdfCollection, newPdfData);
    
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
  } catch (error) {
    console.error('Failed to create PDF form document:', error);
    return { error: 'Could not create the PDF form in the database.' };
  }
}

export async function updatePdfFormName(pdfId: string, newName: string) {
  if (!pdfId || !newName.trim()) {
    return { error: 'Invalid input.' };
  }
  const db = getDb();
  const pdfRef = doc(db, 'pdfs', pdfId);
  try {
    await updateDoc(pdfRef, {
      name: newName.trim(),
      updatedAt: new Date().toISOString(),
    });
    revalidatePath(`/admin/pdfs/${pdfId}/edit`);
    revalidatePath('/admin/pdfs');
    return { success: true };
  } catch (error) {
    console.error('Failed to update PDF form name:', error);
    return { error: 'Could not update the document name.' };
  }
}

export async function updatePdfFormMapping(
  pdfId: string,
  data: {
    fields: PDFFormField[];
    password?: string;
    passwordProtected?: boolean;
  }
) {
  if (!pdfId) {
    return { error: 'Invalid input provided.' };
  }

  const db = getDb();
  const pdfRef = doc(db, 'pdfs', pdfId);

  try {
    await updateDoc(pdfRef, {
      fields: data.fields,
      password: data.password || null,
      passwordProtected: data.passwordProtected || false,
      updatedAt: new Date().toISOString(),
    });
    
    revalidatePath(`/admin/pdfs/${pdfId}/edit`);
    return { success: true };
  } catch (error) {
    console.error('Failed to update PDF form mapping:', error);
    return { error: 'You do not have permission to edit this form or the form does not exist.' };
  }
}

export async function updatePdfFormStatus(pdfId: string, status: PDFForm['status'], userId: string) {
    if (!pdfId || !status || !userId) {
      return { error: 'Invalid arguments.' };
    }
  
    const db = getDb();
    const pdfRef = doc(db, 'pdfs', pdfId);
  
    try {
      const pdfSnap = await getDoc(pdfRef);
      if (!pdfSnap.exists()) {
        return { error: 'Document not found.' };
      }
      const pdfData = pdfSnap.data() as PDFForm;
  
      await updateDoc(pdfRef, {
        status: status,
        updatedAt: new Date().toISOString(),
      });
  
      await logActivity({
        schoolId: '', 
        userId,
        type: 'pdf_status_changed',
        source: 'user_action',
        description: `changed status of PDF "${pdfData.name}" to ${status}`,
        metadata: { pdfId: pdfId, from: pdfData.status, to: status },
      });
  
      revalidatePath('/admin/pdfs');
      revalidatePath(`/admin/pdfs/${pdfId}/edit`);
  
      return { success: true };
    } catch (error) {
      console.error('Failed to update PDF form status:', error);
      return { error: 'Could not update the document status.' };
    }
  }


export async function deletePdfForm(pdfId: string, storagePath: string, userId: string) {
    if (!pdfId || !storagePath || !userId) {
        return { error: 'Invalid arguments for deletion.' };
    }

    const db = getDb();
    const storage = getServerStorage();

    const docRef = doc(db, 'pdfs', pdfId);
    const fileRef = ref(storage, storagePath);

    try {
        await deleteDoc(docRef);
        await deleteObject(fileRef);

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
    } catch(error: any) {
        console.error('Failed to delete PDF form:', error);
        if (error.code === 'storage/object-not-found') {
             try {
                await deleteDoc(docRef);
                revalidatePath('/admin/pdfs');
                return { success: true, warning: 'File not found in storage, but database record was deleted.' };
             } catch (dbError) {
                return { error: 'File not found in storage, and failed to delete database record.' };
             }
        }
        return { error: 'Failed to delete the PDF form or its associated file.' };
    }
}
