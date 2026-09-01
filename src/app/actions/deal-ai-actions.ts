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
    recommendedProducts?: Array<{
      productId: string;
      name: string;
      rationale: string;
      suggestedQuantity: number;
    }>;
    pricingHealth?: {
      marginRating: 'optimal' | 'discount_heavy' | 'underpriced';
      assessmentNotes: string;
    };
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

    // Fetch active products and packages for smart recommendations
    const [productsSnap, packagesSnap] = await Promise.all([
      adminDb.collection('products')
        .where('workspaceId', '==', workspaceId)
        .where('isActive', '==', true)
        .limit(20)
        .get(),
      adminDb.collection('subscription_packages')
        .where('workspaceIds', 'array-contains', workspaceId)
        .where('isActive', '==', true)
        .limit(10)
        .get(),
    ]);

    const availableCatalog: Array<{
      id: string;
      name: string;
      unitPrice: number;
      isRecurring: boolean;
      billingInterval?: string;
    }> = [];

    productsSnap.forEach(d => {
      const p = d.data();
      availableCatalog.push({
        id: d.id,
        name: p.name || 'Unnamed Product',
        unitPrice: typeof p.unitPrice === 'number' ? p.unitPrice : 0,
        isRecurring: Boolean(p.isRecurring),
        billingInterval: p.billingInterval || 'one_time',
      });
    });

    packagesSnap.forEach(d => {
      const pkg = d.data();
      availableCatalog.push({
        id: d.id,
        name: pkg.name || 'Unnamed Package',
        unitPrice: typeof pkg.ratePerStudent === 'number' ? pkg.ratePerStudent : 0,
        isRecurring: true,
        billingInterval: pkg.billingTerm === 'annually' || pkg.billingTerm === 'year' ? 'annual' : 'monthly',
      });
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
      availableCatalog,
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
