'use server';

import { adminDb, adminStorage } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { PDFForm, PDFFormField, School } from './types';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { toTitleCase } from './utils';

/**
 * Converts a HEX color string to an RGB object for pdf-lib.
 * @param hex HEX color string (e.g. #FF0000)
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
 * Resolves technical variable tags (e.g. {{school_name}}) using school data.
 */
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
 * @param pdfForm The form metadata containing field definitions.
 * @param formData { [key: string]: any } The user-submitted values.
 */
export async function generatePdfBuffer(pdfForm: PDFForm, formData: { [key: string]: any }) {
    console.log(`>>> [PDF:GEN] START: "${pdfForm.name}" (ID: ${pdfForm.id})`);
    
    // Fetch school data for variable resolution if associated (Backup resolution)
    let school: School | undefined = undefined;
    if (pdfForm.schoolId) {
        const schoolSnap = await adminDb.collection('schools').doc(pdfForm.schoolId).get();
        if (schoolSnap.exists) {
            school = { id: schoolSnap.id, ...schoolSnap.data() } as School;
        }
    }

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

    // Embed fonts
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    
    const pages = pdfDoc.getPages();
    const fields = pdfForm.fields || [];
    
    console.log(`>>> [PDF:GEN] STEP 3: Processing ${fields.length} fields.`);

    for (const field of fields) {
        try {
            // RESOLUTION HIERARCHY: Stored Value (Snapshot) > Template Definition (Dynamic Resolution)
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

            // Coordinate Mapping: Percent (Top-Left) -> PDF Points (Bottom-Left)
            const x = (field.position.x / 100) * pageWidth;
            const y_top = pageHeight - ((field.position.y / 100) * pageHeight);
            const fieldHeight = (field.dimensions.height / 100) * pageHeight;
            const fieldWidth = (field.dimensions.width / 100) * pageWidth;

            const isImageField = field.type === 'signature' || field.type === 'photo';

            if (!isImageField) {
                let displayValue = String(rawValue);
                if (Array.isArray(rawValue)) displayValue = rawValue.join(', ');
                
                // APPLY TEXT TRANSFORMATIONS
                if (field.textTransform === 'uppercase') {
                    displayValue = displayValue.toUpperCase();
                } else if (field.textTransform === 'capitalize') {
                    displayValue = toTitleCase(displayValue);
                }
                
                if (!displayValue || displayValue === 'undefined' || displayValue === 'null') continue;

                const fontSize = field.fontSize || 11;
                let font = fontRegular;
                if (field.bold && field.italic) font = fontBoldItalic;
                else if (field.bold) font = fontBold;
                else if (field.italic) font = fontItalic;

                const textWidth = font.widthOfTextAtSize(displayValue, fontSize);
                
                // Horizontal Alignment (Default to Center)
                const hAlign = field.alignment || 'center';
                let textX = x + 2;
                if (hAlign === 'center') textX = x + (fieldWidth - textWidth) / 2;
                else if (hAlign === 'right') textX = x + fieldWidth - textWidth - 2;

                // Vertical Alignment (Default to Center)
                const vAlign = field.verticalAlignment || 'center';
                let textY = y_top - fontSize - 2; // Default (Topish)
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

                // Manual Underline support
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
                    
                    // Proportional scaling math (Contain)
                    const scale = Math.min(fieldWidth / img.width, fieldHeight / img.height);
                    const drawWidth = img.width * scale;
                    const drawHeight = img.height * scale;
                    
                    // Centering math
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
        } catch (fieldError: any) {
            console.warn(`>>> [PDF:GEN] Skipping field ${field.id}:`, fieldError.message);
        }
    }

    console.log(`>>> [PDF:GEN] FINAL: Saving PDF...`);
    return await pdfDoc.save();
}

export async function createPdfForm(data: any, userId: string) {
  const { size, mimeType, ...formData } = data;

  const slug = formData.name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const timestamp = new Date().toISOString();

  // 1. Create the PDF record
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
  
  // 2. If this was a direct upload (indicated by size/mimeType), also create a Media record
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

    if (!pdfSnap.exists) {
      return { success: false, error: 'Document template not found.' };
    }

    const originalData = pdfSnap.data() as PDFForm;
    const newName = `[Copy] ${originalData.name}`;
    const newSlug = `${originalData.slug || pdfId}-copy-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    // Prepare Clone Data
    // We explicitly exclude submissions (results) and reset the status to draft
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

    await logActivity({
      schoolId: originalData.schoolId || '',
      userId,
      type: 'pdf_uploaded',
      source: 'user_action',
      description: `cloned PDF document "${originalData.name}" as "${newName}"`,
      metadata: { originalPdfId: pdfId, newPdfId: newDocRef.id }
    });

    revalidatePath('/admin/pdfs');
    return { success: true, id: newDocRef.id };
  } catch (error: any) {
    console.error(">>> [PDF] Clone Failed:", error.message);
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
        if (storagePath) {
            await adminStorage.file(storagePath).delete();
        }
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

/**
 * Bulk deletes submissions and their associated storage files.
 */
export async function deleteSubmissions(pdfId: string, submissionIds: string[], userId: string) {
    const batch = adminDb.batch();
    const pdfRef = adminDb.collection('pdfs').doc(pdfId);
    
    for (const id of submissionIds) {
        const docRef = pdfRef.collection('submissions').doc(id);
        batch.delete(docRef);
        
        // Attempt to delete predictable storage file path
        const storagePath = `submissions/${pdfId}/${id}.pdf`;
        try {
            await adminStorage.file(storagePath).delete();
        } catch (e) {
            // File might not exist
        }
    }

    await batch.commit();

    await logActivity({
        schoolId: '',
        userId,
        type: 'pdf_status_changed',
        source: 'user_action',
        description: `bulk deleted ${submissionIds.length} submissions for a PDF document`,
        metadata: { pdfId, count: submissionIds.length }
    });

    revalidatePath(`/admin/pdfs/${pdfId}/submissions`);
    return { success: true };
}
