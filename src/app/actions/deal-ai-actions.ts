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
import type { Deal, DealTransferAiSummaryResult, DealNextStep } from '@/lib/types';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';

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
  // SECURITY (audit F2): the identity below feeds a permission check. The caller used
  // to supply it, so an authenticated low-privilege user could pass an administrator's
  // uid and pass the check as them. The caller-supplied value is discarded here and
  // replaced with the verified session identity before any check runs.
  const __verified = await requireWorkspace(workspaceId);
  userId = __verified.uid;

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

/**
 * Zod Schema for structured AI Deal Transfer Summary and Next-Step Recommendation
 */
const dealTransferSummarySchema = z.object({
  summary: z.string().describe('Concise 2-sentence executive summary of the deal status, context, and reasons/readiness for transfer.'),
  nextStepTitle: z.string().describe('Actionable, specific next step task or activity title (e.g., "Schedule onboarding discovery call with Decision Maker")'),
  nextStepType: z.enum(['task', 'meeting', 'call', 'follow_up']).describe('Type of next step activity'),
  nextStepDueDays: z.number().int().min(1).max(30).default(3).describe('Recommended business days from now until due date'),
  rationale: z.string().optional().describe('Short 1-sentence reason why this next step is critical now'),
});

/**
 * ARCHITECTURAL POINTER (Rule 10 & AI Governance Rules 21, 23, 24):
 * Analyzes the opportunity's activity history, notes, and velocity to synthesize:
 * 1. An executive Deal Summary for the destination team.
 * 2. An actionable, structured Next Step when no next step currently exists on the deal.
 * 
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Employs a strict Circuit Breaker (Rule 24). If the AI provider is unavailable or times out,
 *   a deterministic, safe baseline fallback is generated without failing the transfer workflow.
 * - Queries are capped (Rule 23) to the last 15 activities and last 5 notes to prevent token bloat.
 * 
 * TESTABILITY POINTER:
 * Validated by unit tests and returns structured DealTransferAiSummaryResult.
 */
export async function generateDealTransferAiSummaryAction(
  dealId: string,
  _targetWorkspaceId?: string
): Promise<DealTransferAiSummaryResult> {
  const { uid } = await requireAuth();

  try {
    if (!dealId) {
      return { success: false, error: 'Deal ID is required' };
    }

    const dealRef = adminDb.collection('deals').doc(dealId);
    const dealSnap = await dealRef.get();
    if (!dealSnap.exists) {
      return { success: false, error: 'Deal not found' };
    }

    const deal = dealSnap.data() as Deal;

    // Verify view permission in source workspace
    const sourcePerm = await canUser(uid, 'operations', 'pipeline', 'view', deal.workspaceId);
    if (!sourcePerm.granted) {
      return { success: false, error: sourcePerm.reason || 'Permission denied' };
    }

    // Query bounded activity history with composite index alignment (Rule 9 & 23)
    let activityCount = 0;
    const activitySnippets: string[] = [];
    try {
      const activitiesSnap = await adminDb.collection('activities')
        .where('workspaceId', '==', deal.workspaceId)
        .where('dealId', '==', dealId)
        .orderBy('timestamp', 'desc')
        .limit(15)
        .get();

      activityCount = activitiesSnap.size;
      activitiesSnap.forEach(d => {
        const data = d.data();
        const desc = data?.description || data?.type || '';
        const ts = data?.timestamp || '';
        if (desc) activitySnippets.push(`[${ts.slice(0, 10)}] ${desc}`);
      });
    } catch (actErr) {
      console.warn('[generateDealTransferAiSummaryAction] Activities query notice (proceeding):', actErr);
    }

    // Query bounded notes (in-memory sort to eliminate composite index requirement)
    const noteSnippets: string[] = [];
    if (deal.entityId) {
      try {
        const notesSnap = await adminDb.collection('notes')
          .where('workspaceId', '==', deal.workspaceId)
          .where('entityId', '==', deal.entityId)
          .limit(10)
          .get();

        const sortedNotes = notesSnap.docs
          .map(d => d.data())
          .sort((a, b) => {
            const timeA = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0;
            const timeB = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          })
          .slice(0, 5);

        for (const data of sortedNotes) {
          const content = data?.content;
          if (typeof content === 'string' && content.trim()) {
            noteSnippets.push(content.trim());
          }
        }
      } catch (notesErr) {
        console.warn('[generateDealTransferAiSummaryAction] Notes query notice (proceeding):', notesErr);
      }
    }

    // Baseline deterministic fallback if AI times out or is unconfigured
    const fallbackNextStep: DealNextStep = {
      type: 'follow_up',
      title: `Follow up with ${deal.focalContacts?.[0]?.name || 'primary contact'} regarding opportunity progression`,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      assigneeName: deal.assignedTo?.name || undefined,
    };
    const fallbackSummary = `Opportunity "${deal.name}" (${deal.stageName || 'Pipeline'}). Transferred to pipeline for continued qualification and progression.`;

    try {
      // Use 'fast' tier (Gemini 3 Flash / Flash-Lite) for low-latency synthesis without exhausting reasoning quotas
      const resolvedModel = await getModel({
        workspaceId: deal.workspaceId,
        tier: 'fast',
      });
      const activeAi = resolvedModel.customAi || ai;

      const prompt = `You are a Principal Revenue Operations Consultant and AI Sales Coach for enterprise software.
A deal is being transferred or duplicated across pipelines/workspaces.
Analyze the opportunity history below and synthesize:
1. A concise, professional 2-sentence Deal Summary for the receiving team explaining its current status and context.
2. The single most impactful Next Step action to advance this deal.

Deal Information:
- Name: "${deal.name}"
- Monetary Value: ${deal.currency || 'USD'} ${deal.value || 0}
- Current Stage: "${deal.stageName || deal.stageId}"
- Lifecycle Status: ${deal.status}
- Focal Stakeholders: ${deal.focalContacts?.map(c => `${c.name} (${c.role || 'Contact'})`).join(', ') || 'None specified'}
- Recent Timeline Activities (latest first):
${activitySnippets.length > 0 ? activitySnippets.map(a => `- ${a}`).join('\n') : 'No past activity logs recorded.'}

- Recent Notes:
${noteSnippets.length > 0 ? noteSnippets.map(n => `- ${n}`).join('\n') : 'No notes documented.'}

Synthesize following the strict schema:
- summary: 2 crisp sentences.
- nextStepTitle: imperative action title (e.g., "Schedule technical discovery call with Head of Admissions").
- nextStepType: 'call' | 'meeting' | 'task' | 'follow_up'.
- nextStepDueDays: recommended business days from today (1 to 14).
- rationale: why this next step is recommended.`;

      // 10-second timeout guard to ensure the client never hangs on network latency
      const generatePromise = activeAi.generate({
        model: resolvedModel.modelString,
        prompt,
        output: {
          schema: dealTransferSummarySchema,
        },
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI generation timed out after 10s')), 10000)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]);

      if (response.output) {
        const out = response.output;
        const days = Math.max(1, Math.min(30, out.nextStepDueDays || 3));
        const dueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

        return {
          success: true,
          summary: out.summary,
          nextStep: {
            title: out.nextStepTitle,
            type: out.nextStepType,
            dueDate,
            assigneeName: deal.assignedTo?.name || undefined,
          },
          activityCount,
          isFallback: false,
        };
      }
    } catch (aiErr) {
      // Circuit breaker fallback (Rule 24): Log warning and return resilient deterministic baseline
      console.warn('[generateDealTransferAiSummaryAction] AI generation fallback triggered:', aiErr);
    }

    // Return deterministic baseline fallback
    return {
      success: true,
      summary: fallbackSummary,
      nextStep: fallbackNextStep,
      activityCount,
      isFallback: true,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to generate deal transfer summary';
    console.error('[generateDealTransferAiSummaryAction] Fatal error:', error);
    return { success: false, error: msg };
  }
}

