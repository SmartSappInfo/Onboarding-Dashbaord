'use server';

import { summarizeEntityNotesFlow } from '@/ai/flows/entity-summarizer';

export interface EntityDossierNoteItem {
  content: string;
  noteType?: string;
  createdByName?: string;
  createdAt: string;
}

export interface EntityDossierDealItem {
  name: string;
  stageName?: string;
  amount?: number;
}

export interface EntityDossierTaskItem {
  title: string;
  status?: string;
  priority?: string;
  dueDate?: string;
}

export interface EntityDossierInput {
  entityName: string;
  entityType?: string;
  stageName?: string;
  leadScore?: number;
  assignedToName?: string;
  notes?: EntityDossierNoteItem[];
  deals?: EntityDossierDealItem[];
  tasks?: EntityDossierTaskItem[];
  workspaceId?: string;
  organizationId?: string;
}

export interface EntityDossierSummary {
  executiveSummary: string;
  keyThemes: string[];
  recentSentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  actionItems: string[];
  lastInteraction: string;
  relationshipStatus: string;
}

/**
 * Builds a deterministic, high-quality analytical summary when AI is unreachable or offline.
 */
function buildDeterministicSummary(input: EntityDossierInput): EntityDossierSummary {
  const entityName = input.entityName || 'Entity';
  const stage = input.stageName || 'Active';
  const score = input.leadScore ?? 50;
  const dealsCount = input.deals?.length ?? 0;
  const tasksCount = input.tasks?.length ?? 0;
  const notesCount = input.notes?.length ?? 0;

  const sentiment: 'positive' | 'neutral' | 'negative' | 'urgent' = 
    score >= 70 ? 'positive' : score < 30 ? 'negative' : 'neutral';

  const relationshipStatus = 
    score >= 75 ? 'High Momentum' : score >= 50 ? 'Steady Engagement' : 'Needs Nurturing';

  const dealSummary = dealsCount > 0 
    ? `There are ${dealsCount} active deal(s) linked to this account.`
    : 'No active commercial deals are currently open.';

  const taskSummary = tasksCount > 0
    ? `${tasksCount} open operational task(s) currently pending review.`
    : 'All scheduled operational tasks are up to date.';

  const executiveSummary = `${entityName} is categorized under ${input.entityType || 'General'} in the "${stage}" stage with an engagement score of ${score}/100. ${dealSummary} ${taskSummary}`;

  const keyThemes: string[] = [];
  if (dealsCount > 0) keyThemes.push('Commercial Pipeline Tracking');
  if (tasksCount > 0) keyThemes.push('Pending Operational Milestones');
  if (notesCount > 0) keyThemes.push('Documented Account Interactions');
  if (keyThemes.length === 0) keyThemes.push('Account Onboarding & Discovery');

  const actionItems: string[] = [];
  if (tasksCount > 0) {
    actionItems.push(`Complete outstanding operational tasks for ${entityName}.`);
  }
  if (dealsCount > 0) {
    actionItems.push(`Advance deal negotiation to the next pipeline milestone.`);
  } else {
    actionItems.push(`Identify commercial expansion or deal opportunities.`);
  }
  actionItems.push(`Schedule regular touchpoint with primary stakeholders.`);

  const lastNote = input.notes && input.notes.length > 0 ? input.notes[0] : null;
  const lastInteraction = lastNote 
    ? `${lastNote.noteType || 'General'} note logged by ${lastNote.createdByName || 'Team'}`
    : 'No recent logged interactions recorded.';

  return {
    executiveSummary,
    keyThemes,
    recentSentiment: sentiment,
    actionItems,
    lastInteraction,
    relationshipStatus,
  };
}

/**
 * Server action to generate an executive AI briefing for an entity dossier.
 * Seamlessly resolves through Genkit / Gemini flow, with deterministic fallback.
 */
export async function generateEntityDossierSummaryAction(
  input: EntityDossierInput
): Promise<{ success: boolean; summary: EntityDossierSummary; source: 'ai' | 'analytics' }> {
  try {
    const rawNotes = input.notes || [];

    // Synthesize notes list with context
    const enrichedNotes: Array<{
      createdAt: string;
      createdByName?: string;
      noteType?: string;
      content: string;
    }> = rawNotes.slice(0, 40).map((n) => ({
      createdAt: n.createdAt,
      createdByName: n.createdByName || 'Account Rep',
      noteType: n.noteType || 'general',
      content: n.content,
    }));

    // If notes are few, add contextual system signals
    if (enrichedNotes.length === 0) {
      const dealsText = (input.deals || []).map((d) => `Deal "${d.name}" (${d.stageName || 'Open'})`).join(', ');
      enrichedNotes.push({
        createdAt: new Date().toISOString(),
        createdByName: 'CRM Intelligence',
        noteType: 'summary',
        content: `Entity: ${input.entityName}. Stage: ${input.stageName || 'Active'}. Score: ${input.leadScore ?? 'N/A'}. Deals: ${dealsText || 'None'}. Tasks: ${input.tasks?.length ?? 0} active.`,
      });
    }

    const aiOutput = await summarizeEntityNotesFlow({
      notes: enrichedNotes,
      entityName: input.entityName,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
    });

    if (aiOutput && aiOutput.executiveSummary) {
      const relationshipStatus = 
        aiOutput.recentSentiment === 'positive' 
          ? 'Strong Momentum' 
          : aiOutput.recentSentiment === 'urgent' 
          ? 'Requires Attention' 
          : 'Active Relationship';

      return {
        success: true,
        summary: {
          executiveSummary: aiOutput.executiveSummary,
          keyThemes: aiOutput.keyThemes || ['Account Engagement'],
          recentSentiment: aiOutput.recentSentiment || 'neutral',
          actionItems: aiOutput.actionItems || ['Continue scheduled touchpoints'],
          lastInteraction: aiOutput.lastInteraction || 'Recent CRM activity logged',
          relationshipStatus,
        },
        source: 'ai',
      };
    }

    // Fallback if empty output
    return {
      success: true,
      summary: buildDeterministicSummary(input),
      source: 'analytics',
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[EntityDossier] AI Generation fallback triggered:', msg);
    return {
      success: true,
      summary: buildDeterministicSummary(input),
      source: 'analytics',
    };
  }
}
