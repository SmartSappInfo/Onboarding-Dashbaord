'use server';

/**
 * ARCHITECTURE:
 * Server Actions for Brand Studio & Design Governance (Creative Studio 2.0 - Phase 1)
 * 
 * Replaces browser localStorage with multi-tenant Firestore cloud persistence
 * in `creative_brand_kits/{workspaceId}`.
 * 
 * CAUTION:
 * Always validate workspace boundaries.
 * 0% any/any[] strictly enforced.
 */

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/firebase-admin';
import type { BrandKit } from '@/lib/creative/creative-types';
import type { ActionResult } from './creative-project-actions';

export const DEFAULT_BRAND_KIT: BrandKit = {
  workspaceId: 'default',
  name: 'Default Brand Palette',
  colors: {
    primary: ['#0f172a', '#1e293b', '#334155'],
    secondary: ['#10b981', '#06b6d4', '#3b82f6'],
    accent: ['#facc15', '#f97316', '#ef4444'],
    neutral: ['#ffffff', '#f8fafc', '#64748b', '#020617'],
  },
  typography: {
    displayFont: 'Impact',
    headingFont: 'Montserrat',
    bodyFont: 'Inter',
  },
  watermarkUrl: '',
  aiRules: [
    {
      id: 'rule-high-contrast',
      type: 'accessibility',
      rule: 'Headlines must maintain a minimum contrast ratio of 4.5:1 against the canvas background.',
      severity: 'required',
      active: true,
    },
    {
      id: 'rule-brand-accent',
      type: 'color',
      rule: 'Use high-vibrancy accent colors (#facc15 or #10b981) on focal text badges.',
      severity: 'recommended',
      active: true,
    },
  ],
  isDefault: true,
};

export async function getWorkspaceBrandKitAction(
  workspaceId: string
): Promise<ActionResult<BrandKit>> {
  try {
    if (!workspaceId) {
      return { success: false, error: 'Workspace ID is required.' };
    }

    const kitRef = adminDb.collection('creative_brand_kits').doc(workspaceId);
    const snap = await kitRef.get();

    if (!snap.exists) {
      const defaultKit: BrandKit = {
        ...DEFAULT_BRAND_KIT,
        workspaceId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await kitRef.set(defaultKit);
      return { success: true, data: defaultKit };
    }

    const kit = snap.data() as BrandKit;
    return { success: true, data: kit };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve brand kit';
    console.error('[getWorkspaceBrandKitAction] Error:', error);
    return { success: false, error: message };
  }
}

export async function saveWorkspaceBrandKitAction(
  workspaceId: string,
  kit: Partial<BrandKit>
): Promise<ActionResult<BrandKit>> {
  try {
    if (!workspaceId) {
      return { success: false, error: 'Workspace ID is required.' };
    }

    const kitRef = adminDb.collection('creative_brand_kits').doc(workspaceId);
    const snap = await kitRef.get();
    const now = new Date().toISOString();

    let existing: BrandKit = DEFAULT_BRAND_KIT;
    if (snap.exists) {
      existing = snap.data() as BrandKit;
    }

    const updated: BrandKit = {
      ...existing,
      ...kit,
      workspaceId,
      updatedAt: now,
    };

    await kitRef.set(updated, { merge: true });

    revalidatePath('/admin/creative-studio/brand');
    revalidatePath('/admin/creative-studio');

    return { success: true, data: updated };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save brand kit';
    console.error('[saveWorkspaceBrandKitAction] Error:', error);
    return { success: false, error: message };
  }
}
