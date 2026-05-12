'use server';

import { adminDb } from '@/lib/firebase-admin';
import { DashboardLayoutConfig } from '@/lib/types/dashboard';
import { DashboardTemplates } from '@/lib/config/dashboard-templates';

/**
 * Fetches the dashboard configuration for a workspace and entity type.
 * It merges the industry default template with any workspace-level overrides.
 */
export async function getDashboardConfig(
  workspaceId: string,
  industry: string = 'saas',
  entityType?: string
): Promise<DashboardLayoutConfig> {
  // Get the default template for the industry
  const template = DashboardTemplates[industry] || DashboardTemplates['saas'];
  let config = template.defaultLayout;

  // Fetch workspace override from 'dashboards' collection
  const docId = entityType ? `${workspaceId}_${entityType}` : workspaceId;
  
  try {
    const snap = await adminDb.collection('dashboards').doc(docId).get();

    if (snap.exists) {
      const override = snap.data() as Partial<DashboardLayoutConfig>;
      config = {
        ...config,
        // Override layouts if user has customized them
        layouts: override.layouts || config.layouts,
      };
    }
  } catch (error) {
    console.error('Error fetching dashboard override:', error);
    // Fallback to default config on error
  }

  return config;
}

/**
 * Saves a customized dashboard layout for a workspace.
 */
export async function saveDashboardLayout(
  workspaceId: string,
  layouts: DashboardLayoutConfig['layouts'],
  entityType?: string
) {
  // Note: Authentication and authorization checks should happen here 
  // or at the route handler level before invoking this service.
  
  const docId = entityType ? `${workspaceId}_${entityType}` : workspaceId;
  
  try {
    await adminDb.collection('dashboards').doc(docId).set({
      workspaceId, // Required for Firestore security rules validation
      layouts,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error('Error saving dashboard layout:', error);
    throw new Error('Failed to save dashboard layout');
  }
}
