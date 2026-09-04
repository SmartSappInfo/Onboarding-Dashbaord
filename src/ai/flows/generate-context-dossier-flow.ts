// NOTE: Intentionally NOT 'use server' — internal Genkit flow invoked via ContextBuilderService on server.

/**
 * @fileOverview CompanyBrain 2.0 Phase 5: Grounded Context Dossier Synthesis Flow
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Grounded Executive Dossier Generation:
 *    - Synthesizes a structured, natural-language executive dossier from a ContextPackage.
 * 2. Zero-Hallucination Invariant:
 *    - Prohibits asserting claims not present in the supplied structured facts,
 *      memories, or citations.
 * 3. Resilient Deterministic Fallback:
 *    - If Gemini 2.5 Flash is rate-limited, offline, or unconfigured, provides
 *      a rule-based analytical executive summary without service disruption.
 * 4. Strict Zero-`any` Standard:
 *    - 100% typed with Zod schemas.
 *
 * @testability Covered in `src/lib/memory/__tests__/context-builder.test.ts`.
 */

import { ai, getModel } from '../genkit';
import { z } from 'genkit';

export const contextDossierInputSchema = z.object({
  subjectName: z.string(),
  subjectType: z.string(),
  category: z.string().optional(),
  dealValue: z.number().optional(),
  facts: z.array(z.string()),
  memories: z.array(z.string()),
  openActions: z.array(z.string()),
  activeConflicts: z.array(z.string()),
  citationCount: z.number(),
});

export type ContextDossierInput = z.infer<typeof contextDossierInputSchema>;

export const contextDossierOutputSchema = z.object({
  executiveSummary: z.string().describe('Comprehensive, grounded briefing summary of the subject account'),
  commercialOutlook: z.string().describe('Commercial deal status, value outlook, and revenue momentum analysis'),
  concernsAndRisks: z.array(z.string()).describe('Specific operational blockers, pricing concerns, or risks cited in notes'),
  strategicRecommendations: z.array(z.string()).describe('Actionable next steps and talk tracks for upcoming interactions'),
  confidenceScore: z.number().min(0).max(1),
});

export type ContextDossierOutput = z.infer<typeof contextDossierOutputSchema>;

/**
 * Deterministic fallback generator when Gemini API is unconfigured or rate-limited.
 */
export function generateContextDossierDeterministic(
  input: ContextDossierInput
): ContextDossierOutput {
  const { subjectName, subjectType, category, dealValue, openActions, memories, activeConflicts } = input;

  const valueDesc = dealValue && dealValue > 0
    ? `maintains an active commercial deal value of GHS ${dealValue.toLocaleString()}`
    : 'currently has no open commercial deal opportunities recorded';

  const conflictWarning = activeConflicts.length > 0
    ? ` Attention: There are ${activeConflicts.length} active contradiction dispute(s) requiring management review.`
    : '';

  const executiveSummary = `${subjectName} is classified as ${category || 'General'} in the ${subjectType} register. The account ${valueDesc} with ${memories.length} institutional memory point(s) and ${openActions.length} pending operational task(s).${conflictWarning}`;

  const commercialOutlook = dealValue && dealValue > 0
    ? `Active pipeline value stands at GHS ${dealValue.toLocaleString()}. Advance scheduled milestones to sustain deal momentum.`
    : 'No active commercial pipeline commitments. Explore potential commercial expansion with primary account stakeholders.';

  const concernsAndRisks: string[] = [];
  if (activeConflicts.length > 0) {
    concernsAndRisks.push(`Active institutional dispute: ${activeConflicts[0]}`);
  }
  if (openActions.length > 3) {
    concernsAndRisks.push(`Operational backlog: ${openActions.length} pending tasks may delay delivery.`);
  }
  if (concernsAndRisks.length === 0) {
    concernsAndRisks.push('No critical operational risks or commercial blockers flagged.');
  }

  const strategicRecommendations: string[] = [
    `Schedule next progress review with primary stakeholders for ${subjectName}.`,
  ];
  if (activeConflicts.length > 0) {
    strategicRecommendations.push('Resolve conflicting commercial terms in the Conflict Center before quoting final rates.');
  }
  if (openActions.length > 0) {
    strategicRecommendations.push(`Complete highest priority task: "${openActions[0]}".`);
  }

  return {
    executiveSummary,
    commercialOutlook,
    concernsAndRisks,
    strategicRecommendations,
    confidenceScore: 0.9,
  };
}

/**
 * Genkit AI flow for synthesizing an executive briefing from structured context.
 */
export const generateContextDossierFlow = ai.defineFlow(
  {
    name: 'generateContextDossierFlow',
    inputSchema: contextDossierInputSchema,
    outputSchema: contextDossierOutputSchema,
  },
  async (input): Promise<ContextDossierOutput> => {
    try {
      const prompt = `You are the SmartSapp CompanyBrain Executive Intelligence Analyst.
Synthesize an executive briefing dossier for the following account based EXCLUSIVELY on the provided facts and memories.
Strict grounding constraint: Do not hallucinate or invent unverified facts. If conflicts exist, highlight them prominently.

ACCOUNT CONTEXT:
- Name: ${input.subjectName} (${input.subjectType})
- Category: ${input.category || 'General'}
- Commercial Pipeline Value: ${input.dealValue ? `GHS ${input.dealValue}` : 'None open'}
- Structured Facts: ${input.facts.join('; ')}
- Institutional Memories: ${input.memories.join('; ')}
- Open Actions: ${input.openActions.join('; ')}
- Active Conflicts: ${input.activeConflicts.join('; ')}
- Citations Available: ${input.citationCount}

Synthesize a comprehensive, executive-ready briefing in the required structured schema.`;

      const { modelString, customAi } = await getModel('gemini-2.5-flash');
      const generator = customAi || ai;
      const response = await generator.generate({
        model: modelString,
        prompt,
        output: { schema: contextDossierOutputSchema },
      });

      if (!response.output) {
        return generateContextDossierDeterministic(input);
      }

      return response.output;
    } catch (err) {
      console.warn('[generateContextDossierFlow] LLM synthesis failed, using deterministic fallback:', err);
      return generateContextDossierDeterministic(input);
    }
  }
);
