#!/usr/bin/env tsx
process.env.FIREBASE_SERVICE_ACCOUNT_PATH = 'serviceAccountKey.json';
import { adminDb } from '../src/lib/firebase-admin';
import type { LeadScoringSettings } from '../src/lib/types';

const DEFAULT_GLOBAL_SCORING_SETTINGS: LeadScoringSettings = {
  emailVerificationRules: [
    { minScore: 90, scoreValue: 10 },
    { minScore: 40, scoreValue: 5 },
    { minScore: 0, scoreValue: 0 }
  ],
  phoneVerificationRules: [
    { minScore: 0, scoreValue: 0 }
  ],
  engagementRules: {
    'survey_completed': 15,
    'email_opened': 2,
    'email_clicked': 5,
    'meeting_attended': 20,
    'reply_received': 10,
    'outbound_call': 5,
    'email_bounced': -10,
    'sms_failed': -5,
    'page_visited': 5,
    'button_clicked': 3,
    'survey_started': 5,
    'sms_link_clicked': 8,
    'document_signed': 25,
    'call_outcome_positive': 15
  },
  callCampaignPositiveOutcomes: ['Agreed', 'Interested', 'Follow-up Scheduled'],
  callCampaignDefaultPoints: 15
};

async function runSeedingFER(): Promise<void> {
  console.log('[FER:LEAD_SCORING] Starting default lead scoring seeding protocol...');

  try {
    // 1. Seed global system settings default document
    const globalSettingsRef = adminDb.collection('system_settings').doc('lead_scoring');
    console.log('[FER:LEAD_SCORING] Seeding global system defaults...');
    await globalSettingsRef.set({
      ...DEFAULT_GLOBAL_SCORING_SETTINGS,
      updatedAt: new Date().toISOString()
    });
    console.log('[FER:LEAD_SCORING] Global system defaults seeded successfully.');

    // 2. Fetch all workspaces in the system
    console.log('[FER:LEAD_SCORING] Fetching workspaces...');
    const workspacesRef = adminDb.collection('workspaces');
    const workspacesSnap = await workspacesRef.get();
    console.log(`[FER:LEAD_SCORING] Found ${workspacesSnap.size} workspaces to process.`);

    let updatedCount = 0;
    const batch = adminDb.batch();

    // 3. Enrich & Restore (FER pipeline loop)
    for (const wsDoc of workspacesSnap.docs) {
      const wsData = wsDoc.data();
      const existingSettings: LeadScoringSettings = wsData.leadScoringSettings || {};
      
      // Merge rules to ensure all 14 common triggers are present
      const mergedEngagementRules = {
        ...DEFAULT_GLOBAL_SCORING_SETTINGS.engagementRules,
        ...(existingSettings.engagementRules || {})
      };

      const enrichedSettings: LeadScoringSettings = {
        emailVerificationRules: existingSettings.emailVerificationRules || DEFAULT_GLOBAL_SCORING_SETTINGS.emailVerificationRules,
        phoneVerificationRules: existingSettings.phoneVerificationRules || DEFAULT_GLOBAL_SCORING_SETTINGS.phoneVerificationRules,
        engagementRules: mergedEngagementRules,
        callCampaignPositiveOutcomes: existingSettings.callCampaignPositiveOutcomes || DEFAULT_GLOBAL_SCORING_SETTINGS.callCampaignPositiveOutcomes,
        callCampaignDefaultPoints: existingSettings.callCampaignDefaultPoints !== undefined 
          ? existingSettings.callCampaignDefaultPoints 
          : DEFAULT_GLOBAL_SCORING_SETTINGS.callCampaignDefaultPoints
      };

      batch.update(workspacesRef.doc(wsDoc.id), {
        leadScoringSettings: enrichedSettings,
        updatedAt: new Date().toISOString()
      });
      updatedCount++;
    }

    if (updatedCount > 0) {
      console.log(`[FER:LEAD_SCORING] Restoring/saving ${updatedCount} enriched workspaces in a batch...`);
      await batch.commit();
    }

    console.log('[FER:LEAD_SCORING] Seeding protocol complete.');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown seeding error';
    console.error('[FER:LEAD_SCORING] Seeding protocol failed:', msg);
    process.exit(1);
  }
}

runSeedingFER().catch((err) => {
  console.error('[FER:LEAD_SCORING] Unhandled fatal error:', err);
  process.exit(1);
});
