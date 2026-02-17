
'use server';

import { doc, addDoc, collection, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, deleteObject, getBytes } from 'firebase/storage';
import { getDb, getServerStorage } from './server-only-firestore';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { PDFForm, PDFFormField, Submission } from './types';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';


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
        schoolId: '', // PDF forms are not tied to a school at creation
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
    // Security rules will verify user authorization.
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
        schoolId: '', // Not school-specific
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
            type: 'pdf_uploaded', // Should probably be pdf_deleted, but we don't have that type
            source: 'user_action',
            description: `deleted PDF form (ID: ${pdfId})`,
            metadata: { pdfId: pdfId, storagePath: storagePath }
        });

        revalidatePath('/admin/pdfs');
        return { success: true };
    } catch(error: any) {
        console.error('Failed to delete PDF form:', error);
        if (error.code === 'storage/object-not-found') {
             // If file doesn't exist but we want to delete the DB record anyway
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

async function generatePdfFromData(pdfForm: PDFForm, formData: { [key: string]: any }) {
    const storage = getServerStorage();
    const fileRef = ref(storage, pdfForm.storagePath);
    const pdfBuffer = await getBytes(fileRef);

    // Load PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    // Draw fields onto the PDF
    for (const fieldId in formData) {
        const value = formData[fieldId];
        if (!value) continue;

        const field = pdfForm.fields.find((f) => f.id === fieldId);
        if (!field || field.pageNumber > pages.length) continue;

        const page = pages[field.pageNumber - 1];
        const { width: pageWidth, height: pageHeight } = page.getSize();

        // Convert percentage-based coordinates to PDF points
        const x = (field.position.x / 100) * pageWidth;
        const y = pageHeight - ((field.position.y / 100) * pageHeight);

        const fieldHeight = (field.dimensions.height / 100) * pageHeight;
        const fontSize = field.fontSize || Math.max(8, fieldHeight * 0.8);

        if (field.type === 'text' || field.type === 'date') {
            page.drawText(String(value), {
                x: x + 2, // Small padding
                y: y - (fieldHeight / 2) - (fontSize / 3), // Center vertically
                font,
                size: fontSize,
                color: rgb(0, 0, 0),
            });
        } else if (field.type === 'signature' && value.startsWith('data:image/png;base64,')) {
            const pngImageBytes = Buffer.from(value.split(',')[1], 'base64');
            const pngImage = await pdfDoc.embedPng(pngImageBytes);
            const fieldWidth = (field.dimensions.width / 100) * pageWidth;

            const scale = Math.min(fieldWidth / pngImage.width, fieldHeight / pngImage.height);

            page.drawImage(pngImage, {
                x: x,
                y: y - fieldHeight,
                width: pngImage.width * scale,
                height: pngImage.height * scale,
            });
        }
    }

    // Return the modified PDF bytes
    return await pdfDoc.saveAsBase64({ dataUri: true });
}

export async function savePdfSubmission(pdfId: string, formData: { [key: string]: any }) {
  if (!pdfId || !formData) {
    return { error: 'Invalid input data.' };
  }

  const db = getDb();

  try {
    const pdfFormRef = doc(db, 'pdfs', pdfId);
    const pdfFormSnap = await getDoc(pdfFormRef);

    if (!pdfFormSnap.exists() || pdfFormSnap.data().status !== 'published') {
      return { error: 'This form is not available for submission.' };
    }
    const pdfForm = pdfFormSnap.data() as PDFForm;

    const submissionData = {
        pdfId,
        submittedAt: new Date().toISOString(),
        formData,
    };
    const submissionRef = await addDoc(collection(db, `pdfs/${pdfId}/submissions`), submissionData);
    
    await logActivity({
        schoolId: '', // Not tied to a specific school
        userId: null, // Public action
        type: 'pdf_form_submitted',
        source: 'public',
        description: `A submission for form "${pdfForm.name}" was received.`,
        metadata: { pdfId, submissionId: submissionRef.id }
    });

    return { success: true, submissionId: submissionRef.id };
  } catch (error: any) {
    console.error("Failed to save submission:", error);
    return { error: `An unexpected error occurred: ${error.message}` };
  }
}

export async function regenerateSubmissionPdf(pdfId: string, submissionId: string) {
    if (!pdfId || !submissionId) {
        return { error: 'Invalid input data.' };
    }

    const db = getDb();

    try {
        const pdfFormRef = doc(db, 'pdfs', pdfId);
        const submissionRef = doc(db, `pdfs/${pdfId}/submissions`, submissionId);

        const [pdfFormSnap, submissionSnap] = await Promise.all([
            getDoc(pdfFormRef),
            getDoc(submissionRef)
        ]);

        if (!pdfFormSnap.exists() || !submissionSnap.exists()) {
            return { error: 'Form or submission not found.' };
        }

        const pdfForm = pdfFormSnap.data() as PDFForm;
        const submission = submissionSnap.data() as Submission;

        const pdfDataUri = await generatePdfFromData(pdfForm, submission.formData);

        return { success: true, pdfDataUri };
    } catch (error: any) {
        console.error("Failed to regenerate PDF:", error);
        return { error: `An unexpected error occurred: ${error.message}` };
    }
}
