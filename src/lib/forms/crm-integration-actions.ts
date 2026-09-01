'use server';

/**
 * SmartSapp Forms 2.0: CRM Integration Server Actions
 * 
 * Provides tenant-isolated queries for CRM pipelines, stages, and team members
 * to power the Form Studio CRM Integration panel.
 */

import { adminDb } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/lib/collection-constants';
import type { 
  WorkspacePipeline, 
  WorkspacePipelineStage, 
  WorkspaceTeamMember,
  FormCrmSettings 
} from './form-crm-types';

/**
 * Fetches active CRM pipelines and their stages for a specific workspace.
 */
export async function getWorkspacePipelinesAction(workspaceId: string): Promise<WorkspacePipeline[]> {
  if (!workspaceId) return [];

  try {
    const [byWorkspaceIdSnap, byArrayContainsSnap] = await Promise.all([
      adminDb.collection('pipelines')
        .where('workspaceId', '==', workspaceId)
        .get(),
      adminDb.collection('pipelines')
        .where('workspaceIds', 'array-contains', workspaceId)
        .get(),
    ]);

    const pipelineMap = new Map<string, WorkspacePipeline>();

    const processDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      if (pipelineMap.has(doc.id)) return;
      const data = doc.data();
      const rawStages = Array.isArray(data.stages) ? data.stages : [];
      
      const stages: WorkspacePipelineStage[] = rawStages.map((st: Record<string, unknown>, idx: number) => ({
        id: String(st.id || `stage_${idx}`),
        name: String(st.name || st.title || `Stage ${idx + 1}`),
        order: typeof st.order === 'number' ? st.order : idx,
        color: typeof st.color === 'string' ? st.color : undefined,
      })).sort((a, b) => a.order - b.order);

      pipelineMap.set(doc.id, {
        id: doc.id,
        name: String(data.name || data.title || 'Default Pipeline'),
        stages,
      });
    };

    byWorkspaceIdSnap.docs.forEach(processDoc);
    byArrayContainsSnap.docs.forEach(processDoc);

    return Array.from(pipelineMap.values());
  } catch (error) {
    console.error('[FORMS:CRM] Error fetching workspace pipelines:', error);
    return [];
  }
}

/**
 * Fetches active team members belonging to the workspace for lead/task assignment.
 */
export async function getWorkspaceTeamMembersAction(workspaceId: string): Promise<WorkspaceTeamMember[]> {
  if (!workspaceId) return [];

  try {
    const usersSnap = await adminDb.collection('users')
      .where('workspaceIds', 'array-contains', workspaceId)
      .limit(100)
      .get();

    return usersSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: String(data.displayName || data.name || data.email || 'Team Member'),
        email: String(data.email || ''),
        role: typeof data.role === 'string' ? data.role : undefined,
        avatarUrl: typeof data.photoURL === 'string' ? data.photoURL : undefined,
      };
    });
  } catch (error) {
    console.error('[FORMS:CRM] Error fetching workspace team members:', error);
    return [];
  }
}

/**
 * Saves form CRM Integration Settings onto the parent form document.
 */
export async function saveFormCrmSettingsAction(
  formId: string, 
  settings: FormCrmSettings
): Promise<{ success: boolean; error?: string }> {
  if (!formId) return { success: false, error: 'Form ID required' };

  try {
    const formRef = adminDb.collection(COLLECTIONS.FORMS).doc(formId);
    const formSnap = await formRef.get();
    if (!formSnap.exists) {
      return { success: false, error: 'Form not found' };
    }

    const currentActions = formSnap.data()?.actions || {};

    await formRef.update({
      contactScope: settings.contactScope,
      actions: {
        ...currentActions,
        entityHandling: settings.entityHandling,
        leadSource: settings.leadSource,
        progressiveProfiling: settings.progressiveProfiling,
        dealCreation: settings.dealCreation,
        taskAssignment: settings.taskAssignment,
        tags: settings.tags,
      },
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[FORMS:CRM] Error saving CRM settings:', message);
    return { success: false, error: message || 'Failed to save CRM settings' };
  }
}
