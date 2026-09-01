'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey Versioning Engine
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Zero-Downtime Immutability:
 *    - Once published, a version snapshot is immutable.
 *    - Drafts allow editing without affecting live public respondents.
 *    - Publishing atomically updates the master survey doc and marks prior versions as superseded.
 * 2. Strict Multi-Tenant Security:
 *    - All operations validate workspaceId.
 * 3. Strict Zero-Any Invariant:
 *    - Strictly typed inputs and returns.
 * 4. Testability:
 *    - Tested in src/lib/surveys/__tests__/survey-version-actions.test.ts.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Survey } from '@/lib/types';
import type { SurveyVersion } from './survey-v2-types';
import { computeSurveyChecksum, hydrateSurveyDocument, synthesizeVersionSnapshot } from './survey-hydration-adapter';

export interface VersionActionResult {
  success: boolean;
  version?: SurveyVersion;
  versions?: SurveyVersion[];
  error?: string;
}

/**
 * Creates a new draft version for a survey.
 */
export async function createDraftVersionAction(
  surveyId: string,
  workspaceId: string,
  userId: string,
  userName?: string
): Promise<VersionActionResult> {
  try {
    if (!surveyId || !workspaceId) {
      return { success: false, error: 'surveyId and workspaceId are required.' };
    }

    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();
    if (!surveySnap.exists) {
      return { success: false, error: 'Survey not found.' };
    }

    const survey = hydrateSurveyDocument({ id: surveySnap.id, ...surveySnap.data() });
    if (!survey.workspaceIds.includes(workspaceId)) {
      return { success: false, error: 'Unauthorized: Survey belongs to another workspace.' };
    }

    // Determine next version number
    const nextVersionNumber = (survey.currentVersionNumber || 1) + 1;
    const versionsRef = surveyRef.collection('versions');
    const newVersionDoc = versionsRef.doc();
    const now = new Date().toISOString();
    const checksum = computeSurveyChecksum(survey.elements, survey.resultRules, survey.scoringEnabled);

    const draftVersion: SurveyVersion = {
      id: newVersionDoc.id,
      surveyId,
      workspaceId,
      organizationId: survey.organizationId,
      versionNumber: nextVersionNumber,
      status: 'draft',
      elements: survey.elements,
      resultRules: survey.resultRules,
      resultPages: survey.resultPages,
      scoringEnabled: survey.scoringEnabled,
      maxScore: survey.maxScore,
      scoreDisplayMode: survey.scoreDisplayMode,
      checksum,
      changeLog: `Draft Version ${nextVersionNumber} initiated.`,
      createdBy: userId,
      createdByName: userName,
      createdAt: now,
    };

    const batch = adminDb.batch();
    batch.set(newVersionDoc, draftVersion);
    batch.update(surveyRef, {
      currentDraftVersionId: newVersionDoc.id,
      updatedAt: now,
    });

    await batch.commit();

    return { success: true, version: draftVersion };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error creating draft version';
    console.error('[createDraftVersionAction Error]:', message);
    return { success: false, error: message };
  }
}

/**
 * Publishes a survey version and synchronizes the master survey document.
 */
export async function publishSurveyVersionAction(
  surveyId: string,
  versionId: string,
  workspaceId: string,
  userId: string,
  userName?: string,
  changeLog?: string
): Promise<VersionActionResult> {
  try {
    if (!surveyId || !versionId || !workspaceId) {
      return { success: false, error: 'surveyId, versionId, and workspaceId are required.' };
    }

    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();
    if (!surveySnap.exists) {
      return { success: false, error: 'Survey not found.' };
    }

    const survey = hydrateSurveyDocument({ id: surveySnap.id, ...surveySnap.data() });
    if (!survey.workspaceIds.includes(workspaceId)) {
      return { success: false, error: 'Unauthorized: Survey belongs to another workspace.' };
    }

    const versionRef = surveyRef.collection('versions').doc(versionId);
    const versionSnap = await versionRef.get();
    if (!versionSnap.exists) {
      return { success: false, error: 'Survey version document not found.' };
    }

    const versionData = versionSnap.data() as SurveyVersion;
    const now = new Date().toISOString();
    const checksum = computeSurveyChecksum(versionData.elements, versionData.resultRules, versionData.scoringEnabled);

    const batch = adminDb.batch();

    // 1. Mark existing published versions as 'superseded'
    const priorPubSnap = await surveyRef
      .collection('versions')
      .where('status', '==', 'published')
      .get();

    for (const doc of priorPubSnap.docs) {
      if (doc.id !== versionId) {
        batch.update(doc.ref, { status: 'superseded', updatedAt: now });
      }
    }

    // 2. Publish target version
    const updatedVersion: Partial<SurveyVersion> = {
      status: 'published',
      publishedBy: userId,
      publishedByName: userName,
      publishedAt: now,
      changeLog: changeLog || versionData.changeLog || `Version ${versionData.versionNumber} published.`,
      checksum,
    };
    batch.update(versionRef, updatedVersion);

    // 3. Atomically synchronize master survey document
    batch.update(surveyRef, {
      elements: versionData.elements,
      resultRules: versionData.resultRules || [],
      resultPages: versionData.resultPages || [],
      scoringEnabled: versionData.scoringEnabled || false,
      maxScore: versionData.maxScore,
      scoreDisplayMode: versionData.scoreDisplayMode || 'percentage',
      currentVersionNumber: versionData.versionNumber,
      publishedVersionId: versionId,
      currentDraftVersionId: null,
      lifecycleStatus: 'published',
      status: 'published',
      updatedAt: now,
    });

    await batch.commit();

    return {
      success: true,
      version: {
        ...versionData,
        ...updatedVersion,
        id: versionId,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error publishing survey version';
    console.error('[publishSurveyVersionAction Error]:', message);
    return { success: false, error: message };
  }
}

/**
 * Retrieves the complete version history for a survey.
 */
export async function getSurveyVersionHistoryAction(
  surveyId: string,
  workspaceId: string
): Promise<VersionActionResult> {
  try {
    if (!surveyId || !workspaceId) {
      return { success: false, error: 'surveyId and workspaceId are required.' };
    }

    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();
    if (!surveySnap.exists) {
      return { success: false, error: 'Survey not found.' };
    }

    const survey = hydrateSurveyDocument({ id: surveySnap.id, ...surveySnap.data() });
    if (!survey.workspaceIds.includes(workspaceId)) {
      return { success: false, error: 'Unauthorized: Survey belongs to another workspace.' };
    }

    const snap = await surveyRef.collection('versions').get();
    let versions: SurveyVersion[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        surveyId,
        workspaceId,
        organizationId: data.organizationId,
        versionNumber: data.versionNumber || 1,
        status: data.status || 'draft',
        elements: Array.isArray(data.elements) ? data.elements : [],
        resultRules: Array.isArray(data.resultRules) ? data.resultRules : [],
        resultPages: Array.isArray(data.resultPages) ? data.resultPages : [],
        scoringEnabled: !!data.scoringEnabled,
        maxScore: data.maxScore,
        scoreDisplayMode: data.scoreDisplayMode || 'percentage',
        themeId: data.themeId,
        checksum: data.checksum || '',
        changeLog: data.changeLog || '',
        createdBy: data.createdBy || 'system',
        createdByName: data.createdByName,
        publishedBy: data.publishedBy,
        publishedByName: data.publishedByName,
        createdAt: data.createdAt || new Date().toISOString(),
        publishedAt: data.publishedAt,
      };
    });

    // If no version documents exist yet in subcollection (legacy survey), synthesize Version 1 snapshot
    if (versions.length === 0) {
      const v1 = synthesizeVersionSnapshot(survey, 1, 'system', 'Original Creator');
      versions = [v1];
    }

    // Sort versions by versionNumber descending
    versions.sort((a, b) => b.versionNumber - a.versionNumber);

    return { success: true, versions };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching version history';
    console.error('[getSurveyVersionHistoryAction Error]:', message);
    return { success: false, error: message };
  }
}
