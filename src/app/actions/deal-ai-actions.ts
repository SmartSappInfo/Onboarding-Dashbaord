'use server';

/**
 * @fileoverview Deals 2.0 AI Intelligence Server Actions
 *
 * ARCHITECTURAL POINTER (AI Insights Server Action):
 * Encapsulates the execution of Genkit deal intelligence flows on the server:
 * - Scopes data collection to active workspace with RBAC guards.
 * - Gathers focal contacts, deal notes, stage history, and line items.
 * - Executes `dealIntelligenceFlow` to produce structured win probability, risks, and next steps.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Must never expose internal API keys to the client.
 * - Zero 'any' or 'any[]' in types.
 *
 * TESTABILITY POINTER:
 * Verify action returns structured intelligence payload or descriptive error.
 */

import { adminDb } from '@/lib/firebase-admin';
import { canUser } from '@/lib/workspace-permissions';
import { dealIntelligenceFlow } from '@/ai/flows/deal-intelligence-flow';
import { calculateDaysInStage } from '@/lib/deals/deal-health-engine';
import type { Deal } from '@/lib/types';

export interface DealAiInsightsResult {
  success: boolean;
  insights?: {
    executiveSummary: string;
    winProbability: number;
    winDrivers: string[];
    riskFactors: string[];
    dealHealthAssessment: 'healthy' | 'at_risk' | 'stalled';
    nextBestActions: Array<{
      title: string;
      rationale: string;
      priority: 'high' | 'medium' | 'low';
      suggestedType: 'task' | 'meeting' | 'call' | 'follow_up';
    }>;
  };
  error?: string;
}

export async function generateDealAiInsightsAction(
  dealId: string,
  workspaceId: string,
  userId?: string
): Promise<DealAiInsightsResult> {
  try {
    const dealRef = adminDb.collection('deals').doc(dealId);
    const dealSnap = await dealRef.get();
    if (!dealSnap.exists) {
      return { success: false, error: 'Deal not found' };
    }

    const deal = dealSnap.data() as Deal;

    // Tenant isolation verification
    if (deal.workspaceId && deal.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    if (userId) {
      const permission = await canUser(userId, 'operations', 'pipeline', 'view', workspaceId);
      if (!permission.granted) {
        return { success: false, error: permission.reason || 'Permission denied.' };
      }
    }

    // Fetch notes attached to this entity/deal
    const notesSnap = await adminDb.collection('notes')
      .where('entityId', '==', deal.entityId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const notesText: string[] = [];
    notesSnap.forEach(doc => {
      const content = doc.data()?.content;
      if (typeof content === 'string' && content.trim()) {
        notesText.push(content.trim());
      }
    });

    const daysInStage = calculateDaysInStage(deal.stageEnteredAt, deal.createdAt);

    const inputData = {
      dealName: deal.name,
      dealValue: Number.isFinite(deal.value) ? deal.value : 0,
      currency: deal.currency || 'USD',
      stageName: deal.stageName || deal.stageId || 'Unknown Stage',
      daysInStage,
      status: deal.status,
      notes: notesText,
      focalContacts: (deal.focalContacts || []).map(c => ({
        name: c.name,
        role: c.role,
        email: c.email,
      })),
      lineItems: (deal.lineItems || []).map(l => ({
        name: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        total: l.total,
      })),
    };

    const output = await dealIntelligenceFlow(inputData);

    return {
      success: true,
      insights: output,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to generate AI insights';
    console.error('[generateDealAiInsightsAction] Error:', error);
    return { success: false, error: msg };
  }
}
