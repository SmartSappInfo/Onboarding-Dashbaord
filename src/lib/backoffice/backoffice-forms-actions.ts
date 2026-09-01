'use server';

/**
 * SmartSapp Forms 2.0 Backoffice Server Actions
 * 
 * Provides administrative controls for executing FER audits,
 * repairing legacy form bindings, and seeding industry vertical templates.
 */

import { executeFormsFerAudit, type FormHealthReport } from './forms-fer-logic';
import { adminDb } from '../firebase-admin';
import { COLLECTIONS } from '../collection-constants';
import type { Form, IndustryVertical } from '../types';
import { revalidatePath } from 'next/cache';

/**
 * Runs the Forms FER audit across a workspace or all workspaces.
 */
export async function runFormsFerAuditAction(
  workspaceId?: string,
  autoRepair = false
): Promise<{ success: boolean; report?: FormHealthReport; error?: string }> {
  try {
    const report = await executeFormsFerAudit(workspaceId, autoRepair);
    revalidatePath('/admin/forms');
    return { success: true, report };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Seeds standard industry form templates into a workspace.
 */
export async function seedIndustryFormTemplatesAction(
  workspaceId: string,
  organizationId: string,
  vertical: IndustryVertical
): Promise<{ success: boolean; createdCount: number; error?: string }> {
  try {
    const timestamp = new Date().toISOString();
    const formsCol = adminDb.collection(COLLECTIONS.FORMS);

    // Template definitions based on industry vertical
    const templates: Omit<Form, 'id'>[] = [
      {
        workspaceId,
        organizationId,
        internalName: `${vertical.toUpperCase()} - Lead Qualification Form`,
        title: 'Get Started with Our Services',
        slug: `lead-intake-${Date.now().toString(36)}`,
        description: 'Please complete this brief intake to help us tailor our recommendations.',
        formType: 'global',
        purpose: 'lead_capture',
        audienceMode: 'anonymous',
        fields: [],
        theme: {
          preset: 'professional',
          cardWidth: 'md',
          inputStyle: 'outline',
          labelPlacement: 'top',
          ctaLabel: 'Submit Application',
          ctaStyle: 'solid',
          ctaWidth: 'full',
          ctaAlignment: 'center',
          backgroundStyle: 'solid',
        },
        successBehavior: { type: 'message', value: 'Thank you! A representative will reach out shortly.' },
        actions: { tags: [], automations: [], notifications: { internalUserIds: [] }, webhooks: [] },
        status: 'draft',
        submissionCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ];

    let createdCount = 0;
    for (const tpl of templates) {
      await formsCol.add(tpl);
      createdCount++;
    }

    revalidatePath('/admin/forms');
    return { success: true, createdCount };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('>>> [FORMS:SEED_TEMPLATES] Failed:', msg);
    return { success: false, createdCount: 0, error: msg };
  }
}
