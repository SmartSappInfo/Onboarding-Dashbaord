import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, arrayUnion, orderBy, limit } from 'firebase/firestore';
import { firestore as db } from '@/firebase/config';
import { triggerAutomationProtocols } from './automation-processor';
import { buildAutomationPayload } from './automation-payload';
import type { HealthScore, Entity } from './types';

/**
 * Helper to update entity healthScoreIds reference array.
 */
async function associateHealthScoreWithEntity(entityId: string, healthScoreId: string): Promise<void> {
  const entityRef = doc(db, 'entities', entityId);
  const entitySnap = await getDoc(entityRef);

  if (!entitySnap.exists()) {
    return;
  }

  const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;
  const industryData = entity.industryData || {
    industry: 'SaaS',
    entityType: 'institution',
    companySize: 0,
    planType: '',
    features: [],
    signupDate: new Date().toISOString(),
    accountStatus: 'active' as const,
  };

  const updatedIndustryData = {
    ...industryData,
    healthScoreIds: arrayUnion(healthScoreId),
  };

  await updateDoc(entityRef, {
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
    const usageRef = collection(db, 'productUsage');
    const usageQuery = query(
      usageRef,
      where('entityId', '==', entityId),
      where('workspaceId', '==', workspaceId)
    );
    const usageSnap = await getDocs(usageQuery);
    let totalUsageFreq = 0;
    usageSnap.forEach((doc) => {
      const data = doc.data();
      totalUsageFreq += data.frequency || 0;
    });

    // usageScore calculation: scale frequency (e.g. 5 points per usage frequency, max 100)
    const usageScore = Math.min(100, Math.max(0, totalUsageFreq * 5));

    // 2. Fetch support tickets status
    const ticketsRef = collection(db, 'supportTickets');
    const ticketsQuery = query(
      ticketsRef,
      where('entityId', '==', entityId),
      where('workspaceId', '==', workspaceId)
    );
    const ticketsSnap = await getDocs(ticketsQuery);
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
    const activitiesRef = collection(db, 'activities');
    const activitiesQuery = query(
      activitiesRef,
      where('entityId', '==', entityId),
      where('workspaceId', '==', workspaceId)
    );
    const activitiesSnap = await getDocs(activitiesQuery);
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
    const healthScoresRef = collection(db, 'healthScores');
    const latestQuery = query(
      healthScoresRef,
      where('entityId', '==', entityId),
      orderBy('calculatedAt', 'desc'),
      limit(1)
    );
    const latestSnap = await getDocs(latestQuery);
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

      const docRef = await addDoc(healthScoresRef, healthScoreData);
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
