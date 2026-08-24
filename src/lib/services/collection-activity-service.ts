/**
 * SmartSapp Finance 2.0 - Collection Activity Service
 * Logs collection interactions (calls, SMS, WhatsApp, meetings, PTPs) and mirrors to CRM timeline.
 */

import { adminDb } from '../firebase-admin';
import { CollectionActivity, CollectionActivityType } from '../types';
import { logActivity } from '../activity-logger';

export interface LogCollectionActivityParams {
  workspaceId: string;
  organizationId?: string;
  caseId: string;
  entityId: string;
  type: CollectionActivityType;
  summary: string;
  details?: string;
  outcome?: string;
  userId: string;
  userName: string;
}

export class CollectionActivityService {
  /**
   * Logs a collection interaction and mirrors it to CRM entity timeline.
   */
  static async logActivity(params: LogCollectionActivityParams): Promise<CollectionActivity> {
    const {
      workspaceId,
      organizationId = 'default',
      caseId,
      entityId,
      type,
      summary,
      details,
      outcome,
      userId,
      userName,
    } = params;

    const timestamp = new Date().toISOString();

    const activityData: Omit<CollectionActivity, 'id'> = {
      organizationId,
      workspaceIds: [workspaceId],
      caseId,
      entityId,
      type,
      summary: summary.trim(),
      details: details?.trim() || undefined,
      outcome: outcome?.trim() || undefined,
      performedBy: userId,
      performedByName: userName,
      timestamp,
    };

    const docRef = await adminDb.collection('collection_activities').add(activityData);
    const activity: CollectionActivity = { id: docRef.id, ...activityData };

    // Mirror into unified CRM Activity Timeline
    await logActivity({
      userId,
      organizationId,
      workspaceId,
      type: 'interaction',
      source: 'finance_engine',
      description: `[Collection ${type.toUpperCase()}] ${summary}${outcome ? ` — Outcome: ${outcome}` : ''}`,
      entityId,
      metadata: {
        event: 'collection.activity_logged',
        caseId,
        activityId: docRef.id,
        activityType: type,
        details,
        outcome,
      },
    });

    return activity;
  }
}
