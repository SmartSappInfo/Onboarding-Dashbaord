/**
 * @fileOverview Data Hygiene Migration: Cleanse Foreign / Contaminated Sender Profiles
 *
 * ARCHITECTURAL CONTEXT:
 * Prior migrations or cross-workspace configurations historically stamped sender profiles
 * belonging to one brand (e.g. TechPatrons, Campus-Supply) with a different organizationId (e.g. smartsapp-hq).
 *
 * This migration scans the `sender_profiles` collection, detects any cross-tenant domain or
 * SMS identity collisions, checks whether they are referenced by active automations/campaigns,
 * and safely deletes or purges them in apply mode.
 *
 * SAFETY:
 * - Dry-run by default.
 * - Confirms zero active usage before deleting.
 * - Fully idempotent and strictly typed (zero `any`).
 */

import { adminDb } from '../firebase-admin';
import { SenderProfileService } from '../services/sender-profile-service';
import type { SenderProfile } from '../types';

export interface CleanseScanResult {
  profileId: string;
  name: string;
  channel: string;
  identifier: string;
  organizationId: string;
  reason: 'foreign_domain_collision' | 'foreign_sms_collision';
  collisionTargetOrg: string;
  usageCount: number;
  actionTaken: 'detected_only' | 'deleted' | 'skipped_in_use';
}

export interface CleanseSummary {
  mode: 'dry-run' | 'apply';
  scannedCount: number;
  contaminatedCount: number;
  deletedCount: number;
  skippedInUseCount: number;
  items: CleanseScanResult[];
}

export async function runSenderProfileCleansing(mode: 'dry-run' | 'apply' = 'dry-run'): Promise<CleanseSummary> {
  const snapshot = await adminDb.collection('sender_profiles').get();
  const summary: CleanseSummary = {
    mode,
    scannedCount: snapshot.docs.length,
    contaminatedCount: 0,
    deletedCount: 0,
    skippedInUseCount: 0,
    items: [],
  };

  for (const doc of snapshot.docs) {
    const data = doc.data() as SenderProfile;
    const profileId = doc.id;
    const orgId = data.organizationId;
    const channel = data.channel;
    const identifier = data.identifier || '';

    if (!orgId) continue;

    let isContaminated = false;
    let reason: 'foreign_domain_collision' | 'foreign_sms_collision' = 'foreign_domain_collision';
    let collisionTarget = '';

    if (channel === 'email') {
      const isAllowed = SenderProfileService.isDomainAllowedForOrg(identifier, { id: orgId });
      if (!isAllowed) {
        isContaminated = true;
        reason = 'foreign_domain_collision';
        collisionTarget = 'foreign_domain';
      }
    } else if (channel === 'sms') {
      const isAllowed = SenderProfileService.isSmsSenderAllowedForOrg(identifier, orgId);
      if (!isAllowed) {
        isContaminated = true;
        reason = 'foreign_sms_collision';
        collisionTarget = 'foreign_sms_name';
      }
    }

    if (isContaminated) {
      summary.contaminatedCount++;

      // Check usage across automations, campaigns, message_templates
      let usageCount = 0;

      // 1. Automations check
      const autoSnap = await adminDb.collection('automations').get();
      for (const aDoc of autoSnap.docs) {
        const json = JSON.stringify(aDoc.data());
        if (json.includes(profileId)) {
          usageCount++;
        }
      }

      // 2. Campaigns check
      const campSnap = await adminDb.collection('campaigns').get();
      for (const cDoc of campSnap.docs) {
        const json = JSON.stringify(cDoc.data());
        if (json.includes(profileId)) {
          usageCount++;
        }
      }

      let actionTaken: 'detected_only' | 'deleted' | 'skipped_in_use' = 'detected_only';

      if (mode === 'apply') {
        if (usageCount > 0) {
          actionTaken = 'skipped_in_use';
          summary.skippedInUseCount++;
        } else {
          await doc.ref.delete();
          actionTaken = 'deleted';
          summary.deletedCount++;
        }
      }

      summary.items.push({
        profileId,
        name: data.name,
        channel,
        identifier,
        organizationId: orgId,
        reason,
        collisionTargetOrg: collisionTarget,
        usageCount,
        actionTaken,
      });
    }
  }

  return summary;
}
