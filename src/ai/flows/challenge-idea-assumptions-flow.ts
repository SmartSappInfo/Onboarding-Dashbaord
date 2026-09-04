import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * AI Assumption Challenger & Devil's Advocate Flow (Company Brain Phase 6).
 *
 * Subjecting an idea to rigorous critical analysis by uncovering unstated premises,
 * identifying hidden failure modes, and formulating targeted empirical experiments
 * to stress-test the concept before committing resources.
 */

export const challengeIdeaAssumptionsInputSchema = z.object({
  title: z.string().describe('Title of the idea'),
  problem: z.string().optional().describe('Problem statement'),
  proposedSolution: z.string().optional().describe('Proposed solution description'),
  existingAssumptions: z
    .array(
      z.object({
        statement: z.string(),
        riskLevel: z.string().optional(),
      })
    )
    .optional()
    .describe('Assumptions already identified by the team'),
  existingHypotheses: z
    .array(
      z.object({
        statement: z.string(),
      })
    )
    .optional(),
  customDirectives: z.string().optional(),
});

export const challengeIdeaAssumptionsOutputSchema = z.object({
  unstatedAssumptions: z
    .array(
      z.object({
        statement: z.string().describe('An unstated or implicit assumption that has not been acknowledged'),
        riskLevel: z.enum(['low', 'medium', 'high', 'critical']).describe('Risk level if this assumption proves false'),
        potentialFailureMode: z.string().describe('How the idea fails if this assumption is wrong'),
      })
    )
    .describe('List of 2 to 4 unstated risky assumptions'),
  criticalFlaws: z
    .array(z.string())
    .describe('Potential fatal flaws, blind spots, or friction points in the proposed mechanism'),
  suggestedValidationExperiments: z
    .array(
      z.object({
        name: z.string().describe('Short experiment title (e.g. 5-Call Smoke Test, Fake Door WhatsApp Button)'),
        hypothesis: z.string().describe('What this experiment proves or disproves'),
        metricsToTrack: z.string().describe('Measurable success/failure signal'),
      })
    )
    .describe('2 to 3 low-cost experiments to test assumptions before full rollout'),
  overallRiskRating: z
    .enum(['low', 'moderate', 'high', 'fatal'])
    .describe('Overall risk assessment of the concept in its current unvalidated form'),
});

export type ChallengeIdeaAssumptionsInput = z.infer<typeof challengeIdeaAssumptionsInputSchema>;
export type ChallengeIdeaAssumptionsOutput = z.infer<typeof challengeIdeaAssumptionsOutputSchema>;

export const challengeIdeaAssumptionsFlow = ai.defineFlow(
  {
    name: 'challengeIdeaAssumptionsFlow',
    inputSchema: challengeIdeaAssumptionsInputSchema,
    outputSchema: challengeIdeaAssumptionsOutputSchema,
  },
  async (input): Promise<ChallengeIdeaAssumptionsOutput> => {
    const {
      title,
      problem,
      proposedSolution,
      existingAssumptions,
      existingHypotheses,
      customDirectives,
    } = input;

    const existingAssumptionsStr = existingAssumptions && existingAssumptions.length > 0
      ? existingAssumptions.map((a) => `- ${a.statement} (${a.riskLevel || 'unspecified'})`).join('\n')
      : 'None provided yet.';

    const existingHypoStr = existingHypotheses && existingHypotheses.length > 0
      ? existingHypotheses.map((h) => `- ${h.statement}`).join('\n')
      : 'None provided yet.';

    const systemPrompt = `
You are the "Devil's Advocate" Strategy Reviewer in SmartSapp Company Brain.
Your mission is to rigorously challenge the provided idea, surface hidden risks, and identify blindspots BEFORE engineering or marketing resources are spent.

Idea Details:
- Title: ${title}
- Problem Statement: ${problem || 'Not specified'}
- Proposed Solution: ${proposedSolution || 'Not specified'}

Existing Assumptions Already Listed:
${existingAssumptionsStr}

Existing Hypotheses:
${existingHypoStr}

${customDirectives ? `Workspace Directives:\n${customDirectives}\n` : ''}

CRITICAL REVIEW RULES:
1. Be constructive, objective, but uncompromisingly rigorous.
2. Focus on UNSTATED assumptions (e.g. user behavior, willingness to pay, operational capacity, technical hurdles, regulatory constraints).
3. Identify concrete low-cost experiments (e.g. smoke tests, manual Concierge tests, customer interviews) that can invalidate or validate assumptions in < 48 hours.
4. Assign an objective overall risk rating ('low', 'moderate', 'high', 'fatal').
`;

    const response = await ai.generate({
      prompt: systemPrompt,
      output: { schema: challengeIdeaAssumptionsOutputSchema },
      config: {
        temperature: 0.25,
      },
    });

    if (!response.output) {
      throw new Error('Failed to generate assumption challenge critique');
    }

    return response.output;
  }
);
