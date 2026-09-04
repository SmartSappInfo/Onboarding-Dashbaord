/**
 * @fileoverview Fetch, Enrich & Restore (FER) Migration Protocol for Performance Policy Studio (Phase 4).
 *
 * ARCHITECTURAL POINTER:
 * Provides automated, idempotent provisioning and migration for:
 * 1. Fetch: Scans existing workspace effortRules, dimension configurations, and legacy settings.
 * 2. Enrich: Synthesizes a canonical PerformancePolicy document combining the 31 catalog rules
 *    with anti-gaming safeguards, 5-dimension weights, and leaderboard visibility policies.
 * 3. Restore / Seed: Idempotently upserts performancePolicies/${workspaceId} and saves the initial
 *    audit snapshot in performancePolicyVersions.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% idempotent. Safe to run multiple times without data corruption.
 * - Strict typing policy enforced: Zero 'any' or 'any[]'.
 * - Must operate via adminDb inside authorized server actions.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  PerformancePolicy,
  PolicyScoringRule,
  PolicyVersionRecord,
  TieredDailyCap,
} from './types';
import { DEFAULT_EFFORT_RULES, type EffortRuleDoc } from '@/lib/scoring-performance-engine';

export interface PolicyMigrationResult {
  success: boolean;
  provisioned: boolean;
  version: number;
  rulesCount: number;
  message: string;
  error?: string;
}

/**
 * Maps default or custom effort rules to the canonical PolicyScoringRule format.
 */
function mapEffortRuleToScoringRule(rule: {
  eventType: string;
  entityType: string;
  points: number;
  enabled: boolean;
  description: string;
}): PolicyScoringRule {
  const eventType = rule.eventType;
  let category: PolicyScoringRule['category'] = 'crm';
  let targetDimension: PolicyScoringRule['targetDimension'] = 'effort';

  if (eventType.includes('call') || eventType.includes('email') || eventType.includes('sms') || eventType.includes('whatsapp')) {
    category = 'communication';
    targetDimension = 'effort';
  } else if (eventType.includes('meeting')) {
    category = 'meetings';
    targetDimension = eventType.includes('completed') ? 'effectiveness' : 'effort';
  } else if (eventType.includes('task') || eventType.includes('checklist')) {
    category = 'tasks';
    targetDimension = 'effort';
  } else if (eventType.includes('deal')) {
    category = 'deals';
    targetDimension = eventType.includes('won') ? 'outcome' : 'effectiveness';
  } else if (eventType.includes('proposal') || eventType.includes('contract') || eventType.includes('quote') || eventType.includes('form')) {
    category = 'documents';
    targetDimension = 'quality';
  } else if (eventType.includes('survey')) {
    category = 'surveys';
    targetDimension = 'quality';
  } else if (eventType.includes('automation') || eventType.includes('webhook')) {
    category = 'system';
    targetDimension = 'activity';
  }

  // Add sensible condition hurdles for calls
  const conditions = [];
  if (eventType === 'phone_call_completed') {
    conditions.push({
      field: 'durationSeconds',
      operator: 'greater_than_or_equal' as const,
      value: 30,
    });
  }

  // Add deal value multipliers
  const multipliers = [];
  if (category === 'deals') {
    multipliers.push({
      conditionField: 'dealValue',
      conditionOperator: 'greater_than' as const,
      conditionValue: 15000,
      multiplier: 1.5,
      label: 'High-Value Opportunity (> $15k)',
    });
  }

  return {
    id: `rule_${eventType}`,
    eventType,
    entityType: (rule.entityType as PolicyScoringRule['entityType']) || 'Contact',
    category,
    description: rule.description,
    enabled: rule.enabled,
    basePoints: rule.points,
    targetDimension,
    conditions,
    multipliers,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates the default system PerformancePolicy for a workspace.
 */
export function buildDefaultPerformancePolicy(params: {
  workspaceId: string;
  organizationId: string;
  authorId: string;
  authorName: string;
}): PerformancePolicy {
  const { workspaceId, organizationId, authorId, authorName } = params;
  const now = new Date().toISOString();

  const scoringRules = DEFAULT_EFFORT_RULES.map((r: Omit<EffortRuleDoc, 'id' | 'workspaceId' | 'organizationId'>) => mapEffortRuleToScoringRule(r));

  const tieredDailyCaps: TieredDailyCap[] = [
    {
      eventType: 'phone_call_completed',
      tier1Limit: 40,
      tier1Rate: 1.0,
      tier2Limit: 70,
      tier2Rate: 0.5,
      tier3Rate: 0.0,
    },
    {
      eventType: '*',
      tier1Limit: 100,
      tier1Rate: 1.0,
      tier2Limit: 150,
      tier2Rate: 0.5,
      tier3Rate: 0.0,
    },
  ];

  return {
    id: `${workspaceId}_active_policy`,
    workspaceId,
    organizationId,
    name: 'Standard 5-Dimension Performance Policy',
    description: 'System standard baseline balancing activity, effort, quality, effectiveness, and outcome.',
    status: 'active',
    version: 1,
    effectiveFrom: now,
    dimensions: {
      activityWeight: 0.3,
      effortWeight: 0.25,
      qualityWeight: 0.15,
      effectivenessWeight: 0.15,
      outcomeWeight: 0.15,
    },
    antiGaming: {
      tieredDailyCaps,
      repetitionCooldownSeconds: 180,
      minCallDurationSeconds: 45,
      requireNotesForCompletion: true,
      excludeMachineEffort: true,
    },
    scoringRules,
    leaderboardPolicy: {
      mode: 'organization',
      anonymizePeers: false,
      rankingMetric: 'compositeIndex',
      allowOptOut: false,
    },
    createdAt: now,
    updatedAt: now,
    updatedBy: {
      userId: authorId,
      userName: authorName,
    },
  };
}

/**
 * Executes the FER Migration protocol for a workspace.
 */
export async function executePolicyMigration(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  forceReset?: boolean;
}): Promise<PolicyMigrationResult> {
  try {
    const { workspaceId, organizationId, actorId, actorName, forceReset = false } = params;

    if (!workspaceId || !organizationId) {
      return {
        success: false,
        provisioned: false,
        version: 0,
        rulesCount: 0,
        message: 'Missing required workspace or organization context.',
        error: 'Missing context parameters',
      };
    }

    const policyDocRef = adminDb.collection('performancePolicies').doc(workspaceId);
    const existingSnap = await policyDocRef.get();

    if (existingSnap.exists && !forceReset) {
      const data = existingSnap.data() as PerformancePolicy;
      return {
        success: true,
        provisioned: false,
        version: data.version || 1,
        rulesCount: data.scoringRules?.length || 0,
        message: `Active PerformancePolicy already provisioned at version ${data.version || 1}.`,
      };
    }

    // Step 1: Fetch existing custom effortRules from workspace if available
    const existingRulesSnap = await adminDb
      .collection('effortRules')
      .where('workspaceId', '==', workspaceId)
      .get();

    const customRulesMap = new Map<string, EffortRuleDoc>();
    existingRulesSnap.forEach((doc) => {
      const r = doc.data() as EffortRuleDoc;
      customRulesMap.set(r.eventType, r);
    });

    // Step 2: Enrich with default catalog rules blended with workspace overrides
    const defaultPolicy = buildDefaultPerformancePolicy({
      workspaceId,
      organizationId,
      authorId: actorId,
      authorName: actorName,
    });

    if (customRulesMap.size > 0) {
      defaultPolicy.scoringRules = defaultPolicy.scoringRules.map((rule) => {
        const custom = customRulesMap.get(rule.eventType);
        if (custom) {
          return {
            ...rule,
            basePoints: custom.points,
            enabled: custom.enabled,
          };
        }
        return rule;
      });
    }

    // Step 3: Restore / Upsert into Firestore
    await policyDocRef.set(defaultPolicy, { merge: true });

    // Step 4: Create Initial Snapshot in performancePolicyVersions
    const versionRecord: PolicyVersionRecord = {
      id: `${workspaceId}_v1`,
      policyId: defaultPolicy.id,
      workspaceId,
      organizationId,
      version: 1,
      policySnapshot: defaultPolicy,
      changeSummary: 'Initial policy baseline provisioned via FER Migration protocol.',
      authorId: actorId,
      authorName: actorName,
      createdAt: defaultPolicy.createdAt,
    };

    await adminDb
      .collection('performancePolicyVersions')
      .doc(`${workspaceId}_v1`)
      .set(versionRecord, { merge: true });

    return {
      success: true,
      provisioned: true,
      version: 1,
      rulesCount: defaultPolicy.scoringRules.length,
      message: `FER Migration succeeded. Provisioned PerformancePolicy v1 with ${defaultPolicy.scoringRules.length} rules and anti-gaming safeguards.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[FER Migration Protocol] Error during policy migration:', err);
    return {
      success: false,
      provisioned: false,
      version: 0,
      rulesCount: 0,
      message: 'Policy migration failed',
      error: msg,
    };
  }
}
