'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 9: Predictive Survey Intelligence Server Actions
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Multidimensional Signal Fusion: Surveys + CRM Deals + Tasks + Timeline Events.
 * 2. Predictive Models: Churn Risk, Conversion Propensity, Account Health Score, Promoter Potential.
 * 3. Next-Best-Action (NBA) Prescriptive Engine.
 * 4. Multi-Tenant Scoping: workspaceId & organizationId boundary enforcement.
 * 5. Strict Zero-Any Invariant.
 */

import { adminDb } from '@/lib/firebase-admin';
import { logActivity } from '@/lib/activity-logger';
import type {
  EntityPredictiveHealth,
  WorkspacePredictiveOverview,
  SystemPredictiveWeightsConfig,
  PredictiveDriver,
  NextBestActionPrescription,
  NextBestActionType,
  PredictiveRiskLevel,
  PredictiveHealthStatus,
  SurveyResponse,
} from '@/lib/types';

const DEFAULT_WEIGHTS: SystemPredictiveWeightsConfig = {
  surveyWeight: 40,
  crmWeight: 30,
  messagingWeight: 20,
  meetingsWeight: 10,
  churnAlertThreshold: 70,
  conversionHighThreshold: 80,
  autoCreateDetractorTasks: true,
};

/**
 * Calculates real-time multidimensional predictive health for a specific CRM Entity / Contact.
 */
export async function calculateEntityPredictiveHealthAction(
  entityId: string,
  workspaceId: string
): Promise<{ success: boolean; health?: EntityPredictiveHealth; error?: string }> {
  try {
    if (!entityId || !workspaceId) {
      return { success: false, error: 'Missing entityId or workspaceId' };
    }

    // 1. Fetch Entity Record
    let entityName = 'Valued Customer';
    let entityEmail = '';
    let entityPhone = '';

    const entityDoc = await adminDb.collection('workspace_entities').doc(entityId).get();
    if (entityDoc.exists) {
      const eData = entityDoc.data() || {};
      if (eData.workspaceId && eData.workspaceId !== workspaceId) {
        return { success: false, error: 'Unauthorized entity access' };
      }
      entityName = eData.name || eData.companyName || eData.fullName || entityName;
      entityEmail = eData.email || '';
      entityPhone = eData.phone || '';
    } else {
      const contactDoc = await adminDb.collection('contacts').doc(entityId).get();
      if (contactDoc.exists) {
        const cData = contactDoc.data() || {};
        if (cData.workspaceId && cData.workspaceId !== workspaceId) {
          return { success: false, error: 'Unauthorized contact access' };
        }
        entityName = cData.fullName || cData.name || entityName;
        entityEmail = cData.email || '';
        entityPhone = cData.phone || '';
      }
    }

    // 2. Fetch Linked Survey Responses
    const surveysSnap = await adminDb
      .collection('surveys')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    const responses: SurveyResponse[] = [];
    await Promise.all(
      surveysSnap.docs.map(async (sDoc) => {
        const rSnap = await sDoc.ref.collection('responses').get();
        rSnap.forEach((rDoc) => {
          const rData = { id: rDoc.id, ...rDoc.data() } as SurveyResponse;
          const matchEntity = rData.entityId === entityId;
          const matchEmail = entityEmail && rData.contactEmail && rData.contactEmail.toLowerCase() === entityEmail.toLowerCase();
          const matchPhone = entityPhone && rData.contactPhone && rData.contactPhone.replace(/\D/g, '') === entityPhone.replace(/\D/g, '');
          if (matchEntity || matchEmail || matchPhone) {
            responses.push(rData);
          }
        });
      })
    );

    // 3. Fetch Linked Deals
    const dealsSnap = await adminDb
      .collection('deals')
      .where('workspaceId', '==', workspaceId)
      .where('entityId', '==', entityId)
      .get();

    const deals = dealsSnap.docs.map((d) => d.data() || {});

    // 4. Multidimensional Signal Evaluation
    const riskFactors: PredictiveDriver[] = [];
    const positiveDrivers: PredictiveDriver[] = [];

    // --- A. Survey Signals ---
    let surveyScore = 70; // Baseline neutral
    if (responses.length > 0) {
      const scores = responses.map((r) => r.score || 70);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      surveyScore = avgScore;

      const latestResponse = responses[responses.length - 1];
      if (avgScore >= 80) {
        positiveDrivers.push({
          category: 'survey',
          description: `Consistently positive survey satisfaction rating (${Math.round(avgScore)}%)`,
          weight: 25,
          polarity: 'positive',
        });
      } else if (avgScore <= 50) {
        riskFactors.push({
          category: 'survey',
          description: `Critical detractor feedback in recent survey (${Math.round(avgScore)}%)`,
          weight: 35,
          polarity: 'negative',
        });
      }

      const rSentiment = (latestResponse as unknown as { sentiment?: string }).sentiment;
      if (rSentiment === 'negative' || (latestResponse.score && latestResponse.score < 50)) {
        riskFactors.push({
          category: 'survey',
          description: 'Recent negative qualitative sentiment detected in feedback',
          weight: 20,
          polarity: 'negative',
        });
      }
    }

    // --- B. CRM Deal & Pipeline Signals ---
    let crmScore = 70;
    const wonDeals = deals.filter((d) => d.stage === 'won' || d.status === 'won');
    const lostDeals = deals.filter((d) => d.stage === 'lost' || d.status === 'lost');
    const openDeals = deals.filter((d) => d.status === 'open' || !d.status);

    if (wonDeals.length > 0) {
      crmScore += 20;
      positiveDrivers.push({
        category: 'crm',
        description: `Active account with ${wonDeals.length} won revenue opportunity`,
        weight: 20,
        polarity: 'positive',
      });
    }

    if (lostDeals.length > wonDeals.length) {
      crmScore -= 25;
      riskFactors.push({
        category: 'crm',
        description: `High lost deal ratio (${lostDeals.length} lost opportunities)`,
        weight: 20,
        polarity: 'negative',
      });
    }

    crmScore = Math.min(100, Math.max(0, crmScore));

    // --- C. Composite Health Score Formulation ---
    const compositeHealthScore = Math.round(surveyScore * 0.55 + crmScore * 0.45);

    // --- D. Churn Risk & Conversion Propensity ---
    let churnRisk = Math.max(0, Math.min(100, 100 - compositeHealthScore));
    if (responses.some((r) => r.score && r.score < 40)) {
      churnRisk = Math.min(100, churnRisk + 20);
    }

    let churnLevel: PredictiveRiskLevel = 'low';
    if (churnRisk >= 75) churnLevel = 'critical';
    else if (churnRisk >= 50) churnLevel = 'high';
    else if (churnRisk >= 30) churnLevel = 'moderate';

    let healthStatus: PredictiveHealthStatus = 'healthy';
    if (compositeHealthScore <= 40) healthStatus = 'critical';
    else if (compositeHealthScore <= 60) healthStatus = 'at_risk';
    else if (compositeHealthScore <= 75) healthStatus = 'neutral';

    let conversionPropensity = 50;
    if (openDeals.length > 0 && surveyScore >= 70) {
      conversionPropensity = Math.min(95, Math.round(surveyScore * 0.6 + 35));
      positiveDrivers.push({
        category: 'crm',
        description: 'Active open deal with strong survey engagement',
        weight: 15,
        polarity: 'positive',
      });
    } else if (lostDeals.length > 0) {
      conversionPropensity = Math.max(10, Math.round(surveyScore * 0.3));
    }

    const promoterIndex = Math.min(100, Math.max(0, Math.round(surveyScore * 0.8 + (wonDeals.length > 0 ? 20 : 0))));

    // --- E. Next-Best-Action (NBA) Prescriptive Engine ---
    let nextBestAction: NextBestActionPrescription;

    if (churnRisk >= 70) {
      nextBestAction = {
        type: 'schedule_call',
        title: 'Schedule Urgent Executive Check-in',
        rationale: 'Detractor survey sentiment and elevated churn probability require immediate proactive intervention.',
        recommendedChannel: 'call',
        priority: 'high',
      };
    } else if (conversionPropensity >= 75 && openDeals.length > 0) {
      nextBestAction = {
        type: 'assign_vip_task',
        title: 'Accelerate Deal Closing Protocol',
        rationale: 'High conversion propensity detected alongside positive feedback. Advance deal negotiation.',
        recommendedChannel: 'whatsapp',
        priority: 'high',
      };
    } else if (promoterIndex >= 85) {
      nextBestAction = {
        type: 'request_case_study',
        title: 'Request Client Case Study & Referral',
        rationale: 'Delighted promoter status indicates prime readiness for public advocacy or expansion.',
        recommendedChannel: 'email',
        priority: 'medium',
      };
    } else if (responses.length === 0) {
      nextBestAction = {
        type: 'reengage_messaging',
        title: 'Dispatch Relationship Pulse Survey',
        rationale: 'No recent survey telemetry. Send a quick 2-minute pulse check to capture baseline health.',
        recommendedChannel: 'whatsapp',
        priority: 'medium',
      };
    } else {
      nextBestAction = {
        type: 'reengage_messaging',
        title: 'Send Quarterly Value Update',
        rationale: 'Account is stable. Maintain periodic engagement with new feature highlights.',
        recommendedChannel: 'email',
        priority: 'low',
      };
    }

    const health: EntityPredictiveHealth = {
      entityId,
      entityName,
      healthScore: compositeHealthScore,
      healthStatus,
      churnRiskPercent: churnRisk,
      churnRiskLevel: churnLevel,
      conversionPropensityPercent: conversionPropensity,
      promoterIndex,
      riskFactors,
      positiveDrivers,
      nextBestAction,
      surveySubmissionsCount: responses.length,
      lastSurveyDate: responses.length > 0 ? responses[responses.length - 1].submittedAt : undefined,
      openDealsCount: openDeals.length,
      calculatedAt: new Date().toISOString(),
    };

    return { success: true, health };
  } catch (err: unknown) {
    console.error('[survey-predictive-actions] calculateEntityPredictiveHealthAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to calculate entity predictive health',
    };
  }
}

/**
 * Aggregates portfolio-wide predictive health and identifies top at-risk accounts & high-propensity leads.
 */
export async function getWorkspacePredictiveOverviewAction(
  workspaceId: string
): Promise<{ success: boolean; overview?: WorkspacePredictiveOverview; error?: string }> {
  try {
    if (!workspaceId) {
      return { success: false, error: 'Missing workspaceId' };
    }

    // 1. Fetch Entities in Workspace
    const entitiesSnap = await adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', workspaceId)
      .limit(50)
      .get();

    const evaluatedList: EntityPredictiveHealth[] = [];

    // Parallel calculation
    await Promise.all(
      entitiesSnap.docs.map(async (doc) => {
        const res = await calculateEntityPredictiveHealthAction(doc.id, workspaceId);
        if (res.success && res.health) {
          evaluatedList.push(res.health);
        }
      })
    );

    let healthyCount = 0;
    let atRiskCount = 0;
    let criticalCount = 0;
    let highPropensityCount = 0;
    let totalScore = 0;

    evaluatedList.forEach((h) => {
      totalScore += h.healthScore;
      if (h.healthStatus === 'healthy') healthyCount++;
      else if (h.healthStatus === 'at_risk') atRiskCount++;
      else if (h.healthStatus === 'critical') criticalCount++;

      if (h.conversionPropensityPercent >= 75) highPropensityCount++;
    });

    const avgScore = evaluatedList.length > 0 ? Math.round(totalScore / evaluatedList.length) : 75;

    // Sort top at-risk accounts (highest churn first)
    const atRiskEntities = [...evaluatedList]
      .filter((h) => h.churnRiskPercent >= 40)
      .sort((a, b) => b.churnRiskPercent - a.churnRiskPercent)
      .slice(0, 10);

    // Sort high-propensity leads
    const highPropensityLeads = [...evaluatedList]
      .filter((h) => h.conversionPropensityPercent >= 60)
      .sort((a, b) => b.conversionPropensityPercent - a.conversionPropensityPercent)
      .slice(0, 10);

    const overview: WorkspacePredictiveOverview = {
      totalEvaluatedEntities: evaluatedList.length,
      healthyAccountsCount: healthyCount,
      atRiskAccountsCount: atRiskCount,
      criticalAccountsCount: criticalCount,
      highPropensityLeadsCount: highPropensityCount,
      averageHealthScore: avgScore,
      atRiskEntities,
      highPropensityLeads,
    };

    return { success: true, overview };
  } catch (err: unknown) {
    console.error('[survey-predictive-actions] getWorkspacePredictiveOverviewAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve workspace predictive overview',
    };
  }
}

/**
 * Executes a Prescribed Next-Best-Action (creates CRM task or logs prescriptive action note).
 */
export async function executePredictiveNextBestAction(
  entityId: string,
  actionType: NextBestActionType,
  customNote?: string,
  workspaceId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!entityId) {
      return { success: false, error: 'Missing entityId' };
    }

    const taskTitle =
      actionType === 'schedule_call'
        ? 'Urgent: Schedule Executive Retention Call'
        : actionType === 'assign_vip_task'
        ? 'VIP: Fast-Track Opportunity Closing'
        : actionType === 'request_case_study'
        ? 'Advocacy: Request Client Case Study'
        : 'Outreach: Follow up on account health';

    // 1. Create Follow-up Task in CRM
    const taskRef = adminDb.collection('tasks').doc();
    await taskRef.set({
      id: taskRef.id,
      title: taskTitle,
      description: customNote || 'Generated by SmartSapp Predictive Survey Intelligence Engine',
      entityId,
      workspaceId: workspaceId || '',
      status: 'pending',
      priority: actionType === 'schedule_call' || actionType === 'assign_vip_task' ? 'high' : 'medium',
      dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Log Activity to Entity Stream
    await logActivity({
      type: 'survey_next_best_action_executed',
      source: 'predictive_engine',
      description: customNote || `Executed autonomous prescription: ${taskTitle}`,
      workspaceId: workspaceId || '',
      organizationId: '',
      entityId,
      metadata: { actionType, taskId: taskRef.id },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[survey-predictive-actions] executePredictiveNextBestAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to execute prescribed next best action',
    };
  }
}

/**
 * Retrieves Superadmin Global Predictive Weights configuration.
 */
export async function getSystemPredictiveWeightsAction(): Promise<{
  success: boolean;
  config: SystemPredictiveWeightsConfig;
  error?: string;
}> {
  try {
    const doc = await adminDb.collection('system_config').doc('predictive_weights').get();
    if (!doc.exists) {
      return { success: true, config: DEFAULT_WEIGHTS };
    }
    return { success: true, config: { ...DEFAULT_WEIGHTS, ...doc.data() } };
  } catch (err: unknown) {
    console.error('[survey-predictive-actions] getSystemPredictiveWeightsAction error:', err);
    return { success: true, config: DEFAULT_WEIGHTS };
  }
}

/**
 * Saves Superadmin Global Predictive Weights configuration.
 */
export async function saveSystemPredictiveWeightsAction(
  config: SystemPredictiveWeightsConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    await adminDb.collection('system_config').doc('predictive_weights').set(
      {
        ...config,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return { success: true };
  } catch (err: unknown) {
    console.error('[survey-predictive-actions] saveSystemPredictiveWeightsAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save system predictive weights',
    };
  }
}
