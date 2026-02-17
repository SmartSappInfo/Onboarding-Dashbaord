
'use server';

import { doc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { getStorage } from 'firebase/storage';
import { getDb } from './server-only-firestore';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { PDFForm } from './types';

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
    fieldMapping: [],
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

export async function deletePdfForm(pdfId: string, storagePath: string, userId: string) {
    if (!pdfId || !storagePath || !userId) {
        return { error: 'Invalid arguments for deletion.' };
    }

    const db = getDb();
    const storage = getStorage();

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
