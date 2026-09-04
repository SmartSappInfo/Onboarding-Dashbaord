/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Experience Migration & FER Protocols:
 *    Idempotently enriches pre-existing `media_experiences` documents with Phase 5 fields:
 *    - `dynamicCtaRules: []`
 *    - `personalization: { enabled: false, headlineTemplate: '', descriptionTemplate: '', fallbackHeadline: '', fallbackDescription: '' }`
 *    - `recommendations: { enabled: false, strategy: 'collection', maxRecommendations: 3 }`
 *    - `abExperiment: { ... }`
 * 2. High Load & Chunked Batch Write Safety:
 *    Batch updates are strictly capped at 150 operations per commit to prevent Firestore batch size limits.
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { 
  collection, getDocs, writeBatch, query, where, 
  type Firestore, type DocumentData 
} from 'firebase/firestore';
import type { 
  MediaExperience, DynamicCtaRule, PersonalizationConfig, 
  ContentRecommendation, ABExperimentConfig 
} from '../types/media-2.0';

export interface MigrationSummary {
  totalScanned: number;
  totalEnriched: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * Idempotent Fetch-Enrich-Restore action upgrading workspace experiences to Phase 5.
 */
export async function migrateExperiencesToPhase5Action(
  firestore: Firestore,
  workspaceId: string
): Promise<MigrationSummary> {
  if (!firestore || !workspaceId) {
    return { totalScanned: 0, totalEnriched: 0, success: false, errorMessage: 'Missing firestore or workspaceId' };
  }

  try {
    const q = query(
      collection(firestore, 'media_experiences'),
      where('workspaceId', '==', workspaceId)
    );
    const snap = await getDocs(q);

    let totalEnriched = 0;
    let currentBatch = writeBatch(firestore);
    let batchCount = 0;

    const defaultPersonalization: PersonalizationConfig = {
      enabled: false,
      headlineTemplate: '',
      descriptionTemplate: '',
      fallbackHeadline: '',
      fallbackDescription: '',
    };

    const defaultRecommendations: ContentRecommendation = {
      enabled: false,
      strategy: 'collection',
      maxRecommendations: 3,
    };

    const defaultAbExperiment: ABExperimentConfig = {
      id: 'default_exp',
      name: 'Standard Split Test',
      enabled: false,
      trafficSplitPercent: 50,
      variantA: {},
      variantB: {},
      metrics: {
        variantAViews: 0,
        variantAClicks: 0,
        variantBViews: 0,
        variantBClicks: 0,
      },
    };

    for (const docSnap of snap.docs) {
      const data = docSnap.data() as DocumentData;
      let needsEnrichment = false;
      const updates: Partial<MediaExperience> = {};

      if (!Array.isArray(data.dynamicCtaRules)) {
        updates.dynamicCtaRules = [];
        needsEnrichment = true;
      }

      if (!data.personalization) {
        updates.personalization = defaultPersonalization;
        needsEnrichment = true;
      }

      if (!data.recommendations) {
        updates.recommendations = defaultRecommendations;
        needsEnrichment = true;
      }

      if (!data.abExperiment) {
        updates.abExperiment = defaultAbExperiment;
        needsEnrichment = true;
      }

      if (needsEnrichment) {
        currentBatch.update(docSnap.ref, updates);
        batchCount += 1;
        totalEnriched += 1;

        // Chunk commit every 150 operations to prevent Firestore transaction overloads
        if (batchCount >= 150) {
          await currentBatch.commit();
          currentBatch = writeBatch(firestore);
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await currentBatch.commit();
    }

    return {
      totalScanned: snap.docs.length,
      totalEnriched,
      success: true,
    };
  } catch (err: unknown) {
    console.error('[migrateExperiencesToPhase5Action] Migration failed:', err);
    return {
      totalScanned: 0,
      totalEnriched: 0,
      success: false,
      errorMessage: err instanceof Error ? err.message : 'Unknown error during experience migration',
    };
  }
}
