/**
 * @fileOverview Saved Directory Views Service (Analytics 2.0)
 *
 * Manages custom and preset filter lenses for the People & Workforce Hub (`/admin/users`).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Provides 7 canonical preset views out of the box.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `analytics-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { SavedDirectoryView } from '@/lib/types';

export class SavedDirectoryViewService {
  private static collectionName = 'saved_directory_views';

  /**
   * Returns canonical preset directory views.
   */
  static getPresetViews(): SavedDirectoryView[] {
    const now = '2026-01-01T00:00:00.000Z';
    return [
      {
        id: 'preset_all',
        organizationId: 'global',
        userId: 'system',
        name: 'All People',
        icon: 'Users',
        isPreset: true,
        filters: {},
        createdAt: now,
      },
      {
        id: 'preset_pending',
        organizationId: 'global',
        userId: 'system',
        name: 'Pending Approval',
        icon: 'Clock',
        isPreset: true,
        filters: { status: 'pending' },
        createdAt: now,
      },
      {
        id: 'preset_recent',
        organizationId: 'global',
        userId: 'system',
        name: 'Recently Joined',
        icon: 'Sparkles',
        isPreset: true,
        filters: { engagementStatus: 'highly_active' },
        createdAt: now,
      },
      {
        id: 'preset_inactive',
        organizationId: 'global',
        userId: 'system',
        name: 'Inactive 30+ Days',
        icon: 'Moon',
        isPreset: true,
        filters: { engagementStatus: 'inactive' },
        createdAt: now,
      },
      {
        id: 'preset_admins',
        organizationId: 'global',
        userId: 'system',
        name: 'Administrators',
        icon: 'Shield',
        isPreset: true,
        filters: { roleId: 'admin' },
        createdAt: now,
      },
      {
        id: 'preset_finance',
        organizationId: 'global',
        userId: 'system',
        name: 'Finance Access',
        icon: 'DollarSign',
        isPreset: true,
        filters: { roleId: 'finance' },
        createdAt: now,
      },
      {
        id: 'preset_high_risk',
        organizationId: 'global',
        userId: 'system',
        name: 'High Risk / SoD',
        icon: 'AlertTriangle',
        isPreset: true,
        filters: { engagementStatus: 'dormant' },
        createdAt: now,
      },
    ];
  }

  /**
   * Creates or updates a custom saved view.
   */
  static async createOrUpdateSavedView(
    organizationId: string,
    userId: string,
    payload: {
      viewId?: string;
      name: string;
      icon?: string;
      filters: SavedDirectoryView['filters'];
    }
  ): Promise<SavedDirectoryView> {
    const docRef = payload.viewId
      ? adminDb.collection(this.collectionName).doc(payload.viewId)
      : adminDb.collection(this.collectionName).doc();

    const now = new Date().toISOString();
    const view: SavedDirectoryView = {
      id: docRef.id,
      organizationId,
      userId,
      name: payload.name.trim(),
      icon: payload.icon || 'Bookmark',
      isPreset: false,
      filters: payload.filters,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(view, { merge: true });
    return view;
  }

  /**
   * Deletes a custom saved view.
   */
  static async deleteSavedView(
    organizationId: string,
    viewId: string,
    userId: string
  ): Promise<void> {
    const docRef = adminDb.collection(this.collectionName).doc(viewId);
    const snap = await docRef.get();
    if (!snap.exists) return;

    const data = snap.data() as SavedDirectoryView;
    if (data.organizationId !== organizationId || data.userId !== userId) {
      throw new Error('Access denied to delete saved view');
    }

    await docRef.delete();
  }

  /**
   * Lists all available views (presets + user custom views).
   */
  static async listSavedViews(
    organizationId: string,
    userId: string
  ): Promise<SavedDirectoryView[]> {
    const presets = this.getPresetViews();

    const snap = await adminDb
      .collection(this.collectionName)
      .where('organizationId', '==', organizationId)
      .where('userId', '==', userId)
      .get();

    const customViews = snap.docs.map((d) => d.data() as SavedDirectoryView);
    return [...presets, ...customViews];
  }
}
