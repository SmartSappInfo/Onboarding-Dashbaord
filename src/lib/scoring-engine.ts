import { adminDb, FieldValue } from './firebase-admin';
import { triggerAutomationProtocols } from './automation-processor';
import { buildAutomationPayload } from './automation-payload';
import type { HealthScore, Entity } from './types';
import { createMinimalIndustryData } from './industry-defaults';

/**
 * Helper to update entity healthScoreIds reference array.
 */
async function associateHealthScoreWithEntity(entityId: string, healthScoreId: string): Promise<void> {
  const entityRef = adminDb.collection('entities').doc(entityId);
  const entitySnap = await entityRef.get();

  if (!entitySnap.exists) {
    return;
  }

  const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;
  const industryData = entity.industryData || createMinimalIndustryData('SaaS', 'institution');

  const updatedIndustryData = {
    ...industryData,
    healthScoreIds: FieldValue.arrayUnion(healthScoreId),
  };

  await entityRef.update({
    industryData: updatedIndustryData,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Computes and recalculates the engagement/health score of an entity.
 * Persists a new snapshot if changed, and dispatches the SCORE_CHANGED trigger.
 */
export async function recalculateEntityScore(
  entityId: string,
  workspaceId: string,
  organizationId: string
): Promise<HealthScore | null> {
  try {
    // 1. Fetch recent product usage
    const usageSnap = await adminDb
      .collection('productUsage')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .get();
    let totalUsageFreq = 0;
    usageSnap.forEach((doc) => {
      const data = doc.data();
      totalUsageFreq += data.frequency || 0;
    });

    // usageScore calculation: scale frequency (e.g. 5 points per usage frequency, max 100)
    const usageScore = Math.min(100, Math.max(0, totalUsageFreq * 5));

    // 2. Fetch support tickets status
    const ticketsSnap = await adminDb
      .collection('supportTickets')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .get();
    let openCount = 0;
    ticketsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.status === 'open') {
        openCount++;
      }
    });

    // supportScore calculation: 100 base, subtract 25 points per open support ticket (min 0)
    const supportScore = Math.max(0, 100 - openCount * 25);

    // 3. Fetch activity log metrics (engagement)
    const activitiesSnap = await adminDb
      .collection('activities')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .get();
    const activityCount = activitiesSnap.size;

    // engagementScore calculation: 10 points per logged activity (max 100)
    const engagementScore = Math.min(100, activityCount * 10);

    // 4. Calculate overall Score (average of the three component scores)
    const overallScore = Math.round((usageScore + supportScore + engagementScore) / 3);

    // Churn Risk classification
    let churnRisk: 'low' | 'medium' | 'high' = 'low';
    if (overallScore < 40) {
      churnRisk = 'high';
    } else if (overallScore < 70) {
      churnRisk = 'medium';
    }

    // 5. Fetch latest health score directly from Firestore
    const healthScoresRef = adminDb.collection('healthScores');
    const latestSnap = await healthScoresRef
      .where('entityId', '==', entityId)
      .orderBy('calculatedAt', 'desc')
      .limit(1)
      .get();
    let oldScore: number | null = null;
    if (!latestSnap.empty) {
      oldScore = latestSnap.docs[0].data().overallScore;
    }

    if (oldScore === null || oldScore !== overallScore) {
      // Create new health score record in Firestore
      const now = new Date().toISOString();
      const healthScoreData = {
        organizationId,
        workspaceId,
        entityId,
        overallScore,
        usageScore,
        supportScore,
        engagementScore,
        churnRisk,
        calculatedAt: now,
        createdAt: now,
      };

      const docRef = await healthScoresRef.add(healthScoreData);
      await associateHealthScoreWithEntity(entityId, docRef.id);

      const newHealthScore: HealthScore = {
        id: docRef.id,
        ...healthScoreData,
      };

      // Dispatch SCORE_CHANGED trigger
      const payload = buildAutomationPayload({
        organizationId,
        workspaceId,
        entityId,
        action: 'score_changed',
        overallScore,
        usageScore,
        supportScore,
        engagementScore,
        churnRisk,
        metadata: {
          oldScore,
          newScore: overallScore,
          usageScore,
          supportScore,
          engagementScore,
          churnRisk,
        },
      });

      console.log(`>>> [Scoring Engine] Score Changed for ${entityId}: ${oldScore} -> ${overallScore}. Dispatching Trigger.`);
      await triggerAutomationProtocols('SCORE_CHANGED', payload);

      return newHealthScore;
    }

    return {
      id: latestSnap.docs[0].id,
      ...latestSnap.docs[0].data(),
    } as HealthScore;
  } catch (error) {
    console.error(`ScoringEngine: Failed to recalculate score for entity ${entityId}:`, error);
    return null;
  }
}
