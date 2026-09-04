'use server';

import { CampaignConceptRepository } from './campaign-concept-repository';
import { QuickNotesRepository } from './quick-notes-repository';
import { IdeaRepository } from './idea-repository';
import { KnowledgeInboxRepository } from './knowledge-inbox-repository';
import {
  type CampaignConcept,
  type CampaignConceptStatus,
  type ObjectionBattlecard,
  type CampaignChannel,
  type KnowledgeInsight,
} from './quick-notes-types';
import {
  extractObjectionClusters,
  extractPlainText,
  calculateCampaignRelevanceScore,
} from './quick-notes-domain';
import { generateCampaignConceptFlow } from '@/ai/flows/generate-campaign-concept-flow';
import { synthesizeCampaignLearningsFlow } from '@/ai/flows/synthesize-campaign-learnings-flow';
import { generateDealBattlecardFlow } from '@/ai/flows/generate-deal-battlecard-flow';

/**
 * Campaign & Deal Intelligence Server Actions (Company Brain Phase 8).
 *
 * Implements bidirectional knowledge loops:
 * 1. Outbound: Knowledge/Ideas -> High-converting Campaign Concepts & Objection Battlecards.
 * 2. Inbound: Campaign performance signals -> Structured Knowledge Insights.
 * 3. Handoff: 1-click deployment to Campaign Studio.
 */

// In-memory sliding-window rate limiter: Max 15 AI actions / 60s per user
const aiActionLimiter = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_AI_CALLS_PER_WINDOW = 15;

function checkRateLimit(userId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const entry = aiActionLimiter.get(userId);

  if (!entry || now > entry.resetTime) {
    aiActionLimiter.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_AI_CALLS_PER_WINDOW) {
    const waitSec = Math.ceil((entry.resetTime - now) / 1000);
    return {
      allowed: false,
      reason: `AI Rate limit reached. Please wait ${waitSec}s before running another AI operation.`,
    };
  }

  entry.count += 1;
  return { allowed: true };
}

/* --------------------------------------------------------------------------
 * CAMPAIGN CONCEPTS ACTIONS
 * -------------------------------------------------------------------------- */

/**
 * Fetches all Campaign Concepts for a workspace.
 */
export async function getWorkspaceCampaignConceptsAction(
  workspaceId: string
): Promise<{ success: boolean; data?: CampaignConcept[]; error?: string }> {
  try {
    if (!workspaceId) return { success: false, error: 'Workspace ID is required' };
    const concepts = await CampaignConceptRepository.getByWorkspace(workspaceId);
    return { success: true, data: concepts };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch campaign concepts';
    return { success: false, error: msg };
  }
}

/**
 * Generates a structured Campaign Concept using Genkit AI from a source Idea or customer notes.
 */
export async function generateCampaignConceptAction(
  workspaceId: string,
  options: {
    ideaId?: string;
    noteIds?: string[];
    userId?: string;
    customDirectives?: string;
  }
): Promise<{ success: boolean; concept?: CampaignConcept; error?: string }> {
  const userId = options.userId || 'system';
  const rate = checkRateLimit(userId);
  if (!rate.allowed) return { success: false, error: rate.reason };

  try {
    let sourceIdeaData: {
      id: string;
      title: string;
      problemStatement?: string;
      proposedSolution?: string;
      targetAudience?: string;
      valueProposition?: string;
    } | undefined;

    if (options.ideaId) {
      const idea = await IdeaRepository.getById(options.ideaId);
      if (idea && idea.workspaceId === workspaceId) {
        sourceIdeaData = {
          id: idea.id,
          title: idea.title,
          problemStatement: idea.problemStatement,
          proposedSolution: idea.proposedSolution,
          targetAudience: idea.targetAudience,
          valueProposition: idea.valueProposition,
        };
      }
    }

    // Fetch qualitative notes in workspace
    const allNotes = await QuickNotesRepository.getByWorkspace(workspaceId);
    const validNotes = allNotes
      .filter((n) => !n.isArchived && (options.noteIds ? options.noteIds.includes(n.id) : true))
      .slice(0, 30)
      .map((n) => ({
        id: n.id,
        title: n.title || 'Untitled Note',
        content: extractPlainText(n.content),
        date: n.createdAt,
        entityNames: [
          ...(n.links?.schoolNames || []),
          ...(n.links?.contactNames || []),
          ...(n.links?.dealNames || []),
        ],
      }));

    // Call GenAI flow
    const aiResult = await generateCampaignConceptFlow({
      sourceIdea: sourceIdeaData,
      customerNotes: validNotes,
      workspaceContext: {
        customDirectives: options.customDirectives,
      },
    });

    const relevanceScore = calculateCampaignRelevanceScore(
      {
        id: '',
        workspaceId,
        title: aiResult.title,
        targetAudience: aiResult.targetAudience,
        targetPersonaSummary: aiResult.targetPersonaSummary,
        valueProposition: aiResult.valueProposition,
        valuePillars: aiResult.valuePillars,
        coreMessageHook: aiResult.coreMessageHook,
        objectionRebuttals: aiResult.objectionRebuttals,
        recommendedChannels: aiResult.recommendedChannels,
        callToAction: aiResult.callToAction,
        sourceKnowledgeIds: validNotes.map((n) => n.id),
        status: 'draft',
        createdBy: userId,
        createdAt: '',
        updatedAt: '',
      },
      aiResult.targetAudience.split(' ')
    );

    const created = await CampaignConceptRepository.createConcept({
      workspaceId,
      title: aiResult.title,
      targetAudience: aiResult.targetAudience,
      targetPersonaSummary: aiResult.targetPersonaSummary,
      valueProposition: aiResult.valueProposition,
      valuePillars: aiResult.valuePillars,
      coreMessageHook: aiResult.coreMessageHook,
      objectionRebuttals: aiResult.objectionRebuttals,
      recommendedChannels: aiResult.recommendedChannels,
      callToAction: aiResult.callToAction,
      sourceIdeaId: sourceIdeaData?.id,
      sourceIdeaTitle: sourceIdeaData?.title,
      sourceKnowledgeIds: validNotes.slice(0, 5).map((n) => n.id),
      status: 'draft',
      relevanceScore,
      createdBy: userId,
    });

    return { success: true, concept: created };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate campaign concept';
    return { success: false, error: msg };
  }
}

/**
 * 1-Click Handoff: Deploys a Campaign Concept to Campaign Studio / Messaging Wizard.
 */
export async function deployConceptToCampaignStudioAction(
  workspaceId: string,
  conceptId: string,
  _userId = 'system'
): Promise<{ success: boolean; deployedCampaignId?: string; error?: string }> {
  try {
    const concept = await CampaignConceptRepository.getById(conceptId);
    if (!concept || concept.workspaceId !== workspaceId) {
      return { success: false, error: 'Campaign concept not found' };
    }

    const syntheticCampaignId = `camp_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    await CampaignConceptRepository.updateConcept(conceptId, {
      status: 'deployed_to_campaign',
      deployedCampaignId: syntheticCampaignId,
      deployedAt: now,
    });

    return { success: true, deployedCampaignId: syntheticCampaignId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to deploy concept to campaign';
    return { success: false, error: msg };
  }
}

/**
 * Updates status of a Campaign Concept.
 */
export async function updateCampaignConceptStatusAction(
  workspaceId: string,
  conceptId: string,
  status: CampaignConceptStatus,
  _userId = 'system'
): Promise<{ success: boolean; error?: string }> {
  try {
    const concept = await CampaignConceptRepository.getById(conceptId);
    if (!concept || concept.workspaceId !== workspaceId) {
      return { success: false, error: 'Campaign concept not found' };
    }

    await CampaignConceptRepository.updateConcept(conceptId, { status });
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to update concept status';
    return { success: false, error: msg };
  }
}

/**
 * Deletes a Campaign Concept.
 */
export async function deleteCampaignConceptAction(
  workspaceId: string,
  conceptId: string,
  _userId = 'system'
): Promise<{ success: boolean; error?: string }> {
  try {
    const concept = await CampaignConceptRepository.getById(conceptId);
    if (!concept || concept.workspaceId !== workspaceId) {
      return { success: false, error: 'Campaign concept not found' };
    }

    await CampaignConceptRepository.deleteConcept(conceptId);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to delete concept';
    return { success: false, error: msg };
  }
}

/* --------------------------------------------------------------------------
 * INBOUND CAMPAIGN LEARNINGS INGESTION
 * -------------------------------------------------------------------------- */

/**
 * Ingests post-campaign engagement signals and saves qualitative Knowledge Insights.
 */
export async function synthesizeCampaignLearningsAction(
  workspaceId: string,
  input: {
    campaignId: string;
    campaignTitle: string;
    channel: CampaignChannel;
    metrics: {
      totalSent: number;
      deliveredCount?: number;
      openedCount?: number;
      clickedCount?: number;
      convertedCount?: number;
      unsubscribedCount?: number;
    };
    qualitativeReplies?: Array<{
      replyText: string;
      sentiment?: 'positive' | 'neutral' | 'negative' | 'urgent';
      date?: string;
    }>;
    userId?: string;
  }
): Promise<{ success: boolean; insightsCount?: number; error?: string }> {
  const userId = input.userId || 'system';
  const rate = checkRateLimit(userId);
  if (!rate.allowed) return { success: false, error: rate.reason };

  try {
    const aiResult = await synthesizeCampaignLearningsFlow({
      campaignId: input.campaignId,
      campaignTitle: input.campaignTitle,
      channel: input.channel,
      metrics: input.metrics,
      qualitativeReplies: input.qualitativeReplies,
    });

    if (!aiResult.insights || aiResult.insights.length === 0) {
      return { success: true, insightsCount: 0 };
    }

    // Convert to KnowledgeInsight records in Insight Center
    const insightRecords: Array<Omit<KnowledgeInsight, 'id' | 'createdAt' | 'updatedAt'>> = aiResult.insights.map((ins) => ({
      workspaceId,
      type: ins.type,
      severity: ins.severity,
      title: `[Campaign: ${input.campaignTitle}] ${ins.title}`,
      summary: `${ins.summary}\n\nStrategic Recommendations:\n${ins.strategicRecommendations.map((r) => `• ${r}`).join('\n')}`,
      evidenceCount: ins.evidenceQuotes.length,
      evidenceSources: ins.evidenceQuotes.map((q) => ({
        id: input.campaignId,
        title: input.campaignTitle,
        type: 'campaign',
        quote: q,
        date: new Date().toISOString().split('T')[0],
      })),
      suggestedActions: [
        {
          id: `act_${Date.now()}_1`,
          label: 'Create Refined Campaign Concept',
          actionType: 'create_campaign_concept',
          description: `Iterate on message angle based on ${ins.title}`,
        },
        {
          id: `act_${Date.now()}_2`,
          label: 'Review in Idea Studio',
          actionType: 'create_idea',
          description: 'Explore root cause hypothesis in Idea Canvas',
        },
      ],
      status: 'active',
      importanceScore: ins.severity === 'critical' ? 95 : ins.severity === 'high' ? 80 : 60,
      createdBy: 'ai_agent:campaign_learnings',
    }));

    await KnowledgeInboxRepository.batchCreateInsights(workspaceId, insightRecords);
    return { success: true, insightsCount: insightRecords.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to synthesize campaign learnings';
    return { success: false, error: msg };
  }
}

/* --------------------------------------------------------------------------
 * OBJECTION BATTLECARDS ACTIONS
 * -------------------------------------------------------------------------- */

/**
 * Fetches all Objection Battlecards for a workspace.
 */
export async function getWorkspaceBattlecardsAction(
  workspaceId: string
): Promise<{ success: boolean; data?: ObjectionBattlecard[]; error?: string }> {
  try {
    if (!workspaceId) return { success: false, error: 'Workspace ID is required' };
    const battlecards = await CampaignConceptRepository.getBattlecardsByWorkspace(workspaceId);
    return { success: true, data: battlecards };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch battlecards';
    return { success: false, error: msg };
  }
}

/**
 * Automatically scans workspace notes, clusters recurring customer objections, and synthesizes Battlecards.
 */
export async function generateWorkspaceBattlecardsAction(
  workspaceId: string,
  userId = 'system'
): Promise<{ success: boolean; battlecardsCount?: number; error?: string }> {
  const rate = checkRateLimit(userId);
  if (!rate.allowed) return { success: false, error: rate.reason };

  try {
    const allNotes = await QuickNotesRepository.getByWorkspace(workspaceId);
    const validNotes = allNotes
      .filter((n) => !n.isArchived)
      .slice(0, 40)
      .map((n) => ({
        id: n.id,
        title: n.title || 'Untitled Note',
        content: extractPlainText(n.content),
      }));

    // Pure domain clustering in microsecond JS
    const clusters = extractObjectionClusters(validNotes);

    if (clusters.length === 0) {
      return { success: true, battlecardsCount: 0 };
    }

    const generatedCards: Array<Omit<ObjectionBattlecard, 'id' | 'createdAt' | 'updatedAt'>> = [];

    // Synthesize Battlecard for top clusters
    for (const cluster of clusters.slice(0, 4)) {
      try {
        const aiResult = await generateDealBattlecardFlow({
          targetTopicOrCompetitor: cluster.topic,
          category: cluster.category,
          customerQuotes: cluster.quotes,
        });

        generatedCards.push({
          workspaceId,
          topic: aiResult.topic,
          category: aiResult.category,
          objection: aiResult.objection,
          rebuttalScript: aiResult.rebuttalScript,
          killerQuestion: aiResult.killerQuestion,
          proofPoints: aiResult.proofPoints,
          frequencyScore: Math.min(100, cluster.count * 20),
          sourceNoteIds: cluster.sourceNoteIds,
          sourceQuotes: cluster.quotes,
        });
      } catch (err) {
        console.warn(`[Phase 8] Skipped battlecard cluster ${cluster.topic}:`, err);
      }
    }

    if (generatedCards.length > 0) {
      await CampaignConceptRepository.batchSaveBattlecards(workspaceId, generatedCards);
    }

    return { success: true, battlecardsCount: generatedCards.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate battlecards';
    return { success: false, error: msg };
  }
}
