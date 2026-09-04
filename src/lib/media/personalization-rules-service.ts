/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Personalization & Dynamic Rules:
 *    - Evaluates declarative multi-condition CTA rules (progress %, contact score, deal stage, chapters).
 *    - Performs deterministic A/B test variant assignment using FNV-1a session hashing.
 *    - Injects personalized variables with safe dual-fallback interpolation (zero raw token leakage).
 * 2. Security & AST Safe Evaluation:
 *    Zero use of `eval()` or `new Function()`. All conditions evaluate through strict enum operators.
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { collection, doc, getDoc, getDocs, query, where, limit, type Firestore } from 'firebase/firestore';
import type { 
  DynamicCtaRule, RuleAction, RuleCondition, 
  ABExperimentConfig, ContentRecommendation, PersonaPreviewContext 
} from '../types/media-2.0';
import type { MediaAsset } from '../types';
import { resolveTextWithMap } from '@/lib/utils/variable-replacer';

export interface RuleEvaluationContext {
  watchProgressPercent: number;
  contactScore?: number;
  dealStage?: string;
  watchedChapterIds?: string[];
  contactTagIds?: string[];
}

/**
 * Evaluates a single rule condition against the runtime viewer context.
 */
function evaluateSingleCondition(
  condition: RuleCondition,
  context: RuleEvaluationContext
): boolean {
  switch (condition.type) {
    case 'watch_progress': {
      const target = Number(condition.value);
      const current = context.watchProgressPercent;
      if (condition.operator === 'gte') return current >= target;
      if (condition.operator === 'lte') return current <= target;
      if (condition.operator === 'eq') return current === target;
      return false;
    }

    case 'contact_score': {
      const target = Number(condition.value);
      const current = context.contactScore ?? 0;
      if (condition.operator === 'gte') return current >= target;
      if (condition.operator === 'lte') return current <= target;
      if (condition.operator === 'eq') return current === target;
      return false;
    }

    case 'deal_stage': {
      const target = String(condition.value).toLowerCase();
      const current = (context.dealStage || '').toLowerCase();
      if (condition.operator === 'eq') return current === target;
      if (condition.operator === 'neq') return current !== target;
      if (condition.operator === 'contains') return current.includes(target);
      return false;
    }

    case 'chapter_viewed': {
      const targetChapterId = String(condition.value);
      const viewed = context.watchedChapterIds || [];
      return viewed.includes(targetChapterId);
    }

    case 'contact_tag': {
      const targetTagId = String(condition.value);
      const tags = context.contactTagIds || [];
      return tags.includes(targetTagId);
    }

    default:
      return false;
  }
}

/**
 * Evaluates active Dynamic CTA rules in priority order and returns the first matching action.
 */
export function evaluateDynamicCtaRules(
  rules: DynamicCtaRule[] | undefined,
  context: RuleEvaluationContext
): RuleAction | null {
  if (!rules || rules.length === 0) return null;

  const activeRules = rules
    .filter((r) => r.isActive)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of activeRules) {
    if (rule.conditions.length === 0) continue;

    const allConditionsPassed = rule.conditions.every((cond) =>
      evaluateSingleCondition(cond, context)
    );

    if (allConditionsPassed) {
      return rule.action;
    }
  }

  return null;
}

/**
 * Client/server safe variable token interpolation.
 * Replaces {{contact.name}}, {{company.name}}, etc., with context values.
 * If variable is missing, gracefully falls back without leaking raw {{...}} tokens.
 */
export function resolvePersonalizedContent(
  templateText: string | undefined,
  context: {
    contactName?: string;
    companyName?: string;
    contactEmail?: string;
    dealStage?: string;
  },
  fallbackText: string = ''
): string {
  if (!templateText || !templateText.trim()) {
    return fallbackText;
  }

  const valuesMap = new Map<string, unknown>();
  if (context.contactName) {
    valuesMap.set('contact.name', context.contactName);
    valuesMap.set('contact_name', context.contactName);
    valuesMap.set('name', context.contactName);
  }
  if (context.companyName) {
    valuesMap.set('company.name', context.companyName);
    valuesMap.set('company_name', context.companyName);
    valuesMap.set('organization_name', context.companyName);
    valuesMap.set('entity_name', context.companyName);
  }
  if (context.contactEmail) {
    valuesMap.set('contact.email', context.contactEmail);
    valuesMap.set('contact_email', context.contactEmail);
    valuesMap.set('email', context.contactEmail);
  }
  if (context.dealStage) {
    valuesMap.set('deal.stage', context.dealStage);
    valuesMap.set('deal_stage', context.dealStage);
    valuesMap.set('stage', context.dealStage);
  }

  const resolved = resolveTextWithMap(templateText, valuesMap, false)
    .replace(/\s{2,}/g, ' ')
    .trim();
  return resolved || fallbackText;
}

/**
 * Deterministic FNV-1a 32-bit integer hashing for stable A/B test variant assignment.
 * Guarantees that a visitor with the same sessionId/contactId is always assigned the same variant.
 */
export function assignExperimentVariant(
  experiment: ABExperimentConfig | undefined,
  visitorSeed: string
): 'variantA' | 'variantB' {
  if (!experiment || !experiment.enabled) return 'variantA';

  // FNV-1a Hash
  let hash = 2166136261;
  for (let i = 0; i < visitorSeed.length; i++) {
    hash ^= visitorSeed.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  const normalizedPercent = Math.abs(hash) % 100;
  return normalizedPercent < experiment.trafficSplitPercent ? 'variantA' : 'variantB';
}

/**
 * Fetches next-best recommended media assets based on experience recommendation settings.
 */
export async function getRecommendedMediaAction(
  firestore: Firestore,
  workspaceId: string,
  config: ContentRecommendation | undefined
): Promise<MediaAsset[]> {
  if (!firestore || !config || !config.enabled) return [];

  try {
    const maxItems = Math.min(10, Math.max(1, config.maxRecommendations || 3));

    // Strategy 1: Target Package items
    if (config.strategy === 'package' && config.targetPackageId) {
      const pkgSnap = await getDoc(doc(firestore, 'media_packages', config.targetPackageId));
      if (pkgSnap.exists()) {
        const pkgData = pkgSnap.data() as { items?: { assetId: string }[] };
        const assetIds = (pkgData.items || []).map((i) => i.assetId).filter(Boolean);
        if (assetIds.length > 0) {
          const q = query(collection(firestore, 'media'), where('__name__', 'in', assetIds.slice(0, maxItems)));
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MediaAsset));
        }
      }
    }

    // Strategy 2: Target Collection items
    if (config.strategy === 'collection' && config.targetCollectionId) {
      const colSnap = await getDoc(doc(firestore, 'media_collections', config.targetCollectionId));
      if (colSnap.exists()) {
        const colData = colSnap.data() as { assetIds?: string[] };
        const assetIds = colData.assetIds || [];
        if (assetIds.length > 0) {
          const q = query(collection(firestore, 'media'), where('__name__', 'in', assetIds.slice(0, maxItems)));
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MediaAsset));
        }
      }
    }

    // Fallback: Recent workspace media assets
    const fallbackQ = query(
      collection(firestore, 'media'),
      where('workspaceIds', 'array-contains', workspaceId),
      limit(maxItems)
    );
    const fallbackSnap = await getDocs(fallbackQ);
    return fallbackSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MediaAsset));
  } catch (err: unknown) {
    console.error('[getRecommendedMediaAction] Error fetching recommendations:', err);
    return [];
  }
}
