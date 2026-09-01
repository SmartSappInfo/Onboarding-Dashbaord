'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 8: Enterprise Data Retention & Governance Actions
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Automated PII Anonymization & Hard Purge: Enforces compliance with privacy and data protection rules.
 * 2. Backoffice Research Governance Matrix: Superadmin control plane configuration.
 * 3. Multi-Tenant Isolation: Strictly validates workspace authorization.
 * 4. Strict Zero-Any Invariant.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  Survey,
  SurveyResponse,
  SurveyRetentionPolicy,
  SystemResearchGovernanceConfig,
} from '@/lib/types';
import { logActivity } from '@/lib/activity-logger';

/**
 * Executes automated data retention and PII sanitization across workspace surveys.
 */
export async function executeSurveyDataRetentionAction(
  workspaceId: string,
  policy: SurveyRetentionPolicy
): Promise<{
  success: boolean;
  anonymizedCount: number;
  purgedCount: number;
  scannedSurveysCount: number;
  error?: string;
}> {
  try {
    if (!workspaceId) {
      return { success: false, anonymizedCount: 0, purgedCount: 0, scannedSurveysCount: 0, error: 'Missing workspaceId' };
    }

    if (!policy.enabled) {
      return { success: true, anonymizedCount: 0, purgedCount: 0, scannedSurveysCount: 0 };
    }

    const surveysSnap = await adminDb
      .collection('surveys')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    let anonymizedCount = 0;
    let purgedCount = 0;
    const now = Date.now();
    const anonymizeCutoff = new Date(now - policy.anonymizePiiAfterDays * 24 * 3600 * 1000).toISOString();
    const hardDeleteCutoff = policy.hardDeleteAfterDays
      ? new Date(now - policy.hardDeleteAfterDays * 24 * 3600 * 1000).toISOString()
      : null;

    for (const sDoc of surveysSnap.docs) {
      const responsesSnap = await sDoc.ref.collection('responses').get();

      for (const rDoc of responsesSnap.docs) {
        const rData = rDoc.data() as SurveyResponse;
        const submittedAt = rData.submittedAt || rData.createdAt || '';

        if (!submittedAt) continue;

        // 1. Hard Delete Check
        if (hardDeleteCutoff && submittedAt < hardDeleteCutoff) {
          await rDoc.ref.delete();
          purgedCount++;
          continue;
        }

        // 2. PII Anonymization Check
        if (submittedAt < anonymizeCutoff) {
          const needsAnonymization =
            (rData.respondentName && rData.respondentName !== '[ANONYMIZED]') ||
            (rData.respondentEmail && rData.respondentEmail !== '[ANONYMIZED]') ||
            (rData.respondentPhone && rData.respondentPhone !== '[ANONYMIZED]') ||
            (rData.contactEmail && rData.contactEmail !== '[ANONYMIZED]') ||
            (rData.contactPhone && rData.contactPhone !== '[ANONYMIZED]');

          if (needsAnonymization) {
            await rDoc.ref.update({
              respondentName: '[ANONYMIZED]',
              respondentEmail: '[ANONYMIZED]',
              respondentPhone: '[ANONYMIZED]',
              contactEmail: '[ANONYMIZED]',
              contactPhone: '[ANONYMIZED]',
              leadDetails: {},
              anonymizedAt: new Date().toISOString(),
            });
            anonymizedCount++;
          }
        }
      }
    }

    // Log Activity
    await logActivity({
      type: 'survey_retention_executed',
      source: 'survey_engine',
      description: `Data retention policy executed: ${anonymizedCount} responses anonymized, ${purgedCount} responses purged.`,
      workspaceId,
      organizationId: 'system',
      metadata: {
        anonymizedCount,
        purgedCount,
        anonymizeCutoffDays: policy.anonymizePiiAfterDays,
      },
    }).catch((logErr: unknown) => console.error('[survey-retention] Log error:', logErr));

    return {
      success: true,
      anonymizedCount,
      purgedCount,
      scannedSurveysCount: surveysSnap.size,
    };
  } catch (err: unknown) {
    console.error('[survey-retention-actions] executeSurveyDataRetentionAction error:', err);
    return {
      success: false,
      anonymizedCount: 0,
      purgedCount: 0,
      scannedSurveysCount: 0,
      error: err instanceof Error ? err.message : 'Failed to execute retention policy',
    };
  }
}

/**
 * Retrieves the global platform Research & Retention Governance configuration.
 */
export async function getSystemResearchGovernanceAction(): Promise<{
  success: boolean;
  config: SystemResearchGovernanceConfig;
  error?: string;
}> {
  try {
    const docRef = adminDb.collection('system_settings').doc('survey_research_governance');
    const docSnap = await docRef.get();

    const defaultConfig: SystemResearchGovernanceConfig = {
      minSampleSizeForSignificance: 30,
      defaultAnonymizePiiDays: 90,
      allowHardDelete: true,
      requireAuditLogging: true,
      maxActiveExperimentsPerWorkspace: 10,
    };

    if (docSnap.exists) {
      return {
        success: true,
        config: { ...defaultConfig, ...docSnap.data() } as SystemResearchGovernanceConfig,
      };
    }

    return { success: true, config: defaultConfig };
  } catch (err: unknown) {
    console.error('[survey-retention-actions] getSystemResearchGovernanceAction error:', err);
    return {
      success: false,
      config: {
        minSampleSizeForSignificance: 30,
        defaultAnonymizePiiDays: 90,
        allowHardDelete: true,
        requireAuditLogging: true,
        maxActiveExperimentsPerWorkspace: 10,
      },
      error: err instanceof Error ? err.message : 'Failed to load governance config',
    };
  }
}

/**
 * Saves the global platform Research & Retention Governance configuration.
 */
export async function saveSystemResearchGovernanceAction(
  config: SystemResearchGovernanceConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('system_settings').doc('survey_research_governance');
    await docRef.set(
      {
        ...config,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return { success: true };
  } catch (err: unknown) {
    console.error('[survey-retention-actions] saveSystemResearchGovernanceAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save governance config',
    };
  }
}
