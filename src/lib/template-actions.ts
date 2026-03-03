'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { MessageTemplate } from './types';

/**
 * Clones an existing message template.
 * @param templateId The ID of the template to clone.
 * @param userId The ID of the user performing the action.
 */
export async function cloneTemplate(templateId: string, userId: string) {
  try {
    const templateRef = adminDb.collection('message_templates').doc(templateId);
    const templateSnap = await templateRef.get();

    if (!templateSnap.exists) {
      return { success: false, error: 'Template not found.' };
    }

    const originalData = templateSnap.data() as MessageTemplate;
    
    const newName = `${originalData.name} (Copy)`;
    const timestamp = new Date().toISOString();

    const newTemplateData: Omit<MessageTemplate, 'id'> = {
      ...originalData,
      name: newName,
      isActive: true, // Reset to active for the copy
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const newTemplateRef = await adminDb.collection('message_templates').add(newTemplateData);

    await logActivity({
      schoolId: '', 
      userId,
      type: 'notification_sent', // Reusing messaging type for log
      source: 'user_action',
      description: `cloned template "${originalData.name}" as "${newName}"`,
      metadata: { originalTemplateId: templateId, newTemplateId: newTemplateRef.id }
    });

    revalidatePath('/admin/messaging/templates');
    return { success: true, id: newTemplateRef.id };
  } catch (error: any) {
    console.error(">>> [TEMPLATE] Clone Failed:", error.message);
    return { success: false, error: error.message };
  }
}
