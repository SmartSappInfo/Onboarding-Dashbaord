import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * AI Idea Deconstruction & Structuring Flow (Company Brain Phase 6).
 *
 * Takes raw thought fragments, customer feedback, or unstructured notes and decomposes
 * them into a scientific Idea model: Problem statement, Proposed Solution, Key Risky Assumptions,
 * SMART Hypotheses, Target Segments, and estimated ICE (Impact, Confidence, Effort) ratings.
 */

export const developIdeaInputSchema = z.object({
  rawInput: z.string().describe('Raw note text, user thought, or customer observation'),
  existingTitle: z.string().optional().describe('Optional existing title of the note/idea'),
  crmContext: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        contextSummary: z.string().optional(),
      })
    )
    .optional()
    .describe('Attached CRM entities (e.g. Schools, Contacts, Deals) for contextual grounding'),
  customDirectives: z.string().optional().describe('Optional workspace ideation guidelines'),
});

export const developIdeaOutputSchema = z.object({
  title: z.string().describe('Crisp, professional idea title'),
  problem: z.string().describe('Clear statement of the friction, customer pain, or market problem'),
  proposedSolution: z.string().describe('Concise description of the proposed solution or mechanism'),
  assumptions: z
    .array(
      z.object({
        statement: z.string().describe('An underlying assumption that must hold true for this idea to succeed'),
        riskLevel: z.enum(['low', 'medium', 'high', 'critical']).describe('Risk level if this assumption is invalid'),
        notes: z.string().optional().describe('Rationale or validation suggestion for this assumption'),
      })
    )
    .describe('List of 3 to 5 critical assumptions'),
  hypotheses: z
    .array(
      z.object({
        statement: z
          .string()
          .describe('SMART hypothesis statement in the format: If we [action], then [outcome], because [rationale]'),
        action: z.string().describe('The concrete test or operational action to be taken'),
        expectedOutcome: z.string().describe('The expected quantitative or qualitative change'),
        metricTarget: z.string().optional().describe('Measurable target metric (e.g. +20% conversion, <24h response time)'),
      })
    )
    .describe('List of 2 to 3 testable hypotheses'),
  estimatedImpact: z.number().min(1).max(10).describe('Estimated business/revenue/strategic impact (1-10)'),
  estimatedEffort: z.number().min(1).max(10).describe('Estimated implementation/engineering effort (1-10)'),
  estimatedConfidence: z.number().min(1).max(10).describe('Confidence score in this estimation (1-10)'),
  reasoning: z.string().describe('Explanation of why these impact, effort, and confidence scores were assigned'),
  targetAudienceHints: z.array(z.string()).describe('Identified target personas, customer segments, or school types'),
});

export type DevelopIdeaInput = z.infer<typeof developIdeaInputSchema>;
export type DevelopIdeaOutput = z.infer<typeof developIdeaOutputSchema>;

export const developIdeaFlow = ai.defineFlow(
  {
    name: 'developIdeaFlow',
    inputSchema: developIdeaInputSchema,
    outputSchema: developIdeaOutputSchema,
  },
  async (input): Promise<DevelopIdeaOutput> => {
    const { rawInput, existingTitle, crmContext, customDirectives } = input;

    let crmContextStr = '';
    if (crmContext && crmContext.length > 0) {
      crmContextStr = `Attached CRM Context:\n${crmContext
        .map((c) => `- ${c.name} (${c.type}): ${c.contextSummary || 'Relevant Entity'}`)
        .join('\n')}\n`;
    }

    const systemPrompt = `
You are the SmartSapp Senior Product Strategist & Idea Intelligence Agent.
Your role is to deconstruct raw notes, thoughts, and feedback into structured, evidence-backed, and testable Idea records.

Guidelines:
1. PROBLEM DEFINITION: Clearly delineate the core pain point or friction from the solution. Avoid combining them.
2. PROPOSED SOLUTION: Specify the mechanism, user flow, or operational approach in clear, direct language.
3. ASSUMPTIONS: Identify 3 to 5 critical unverified assumptions. Assign realistic risk levels ('critical', 'high', 'medium', 'low').
4. SMART HYPOTHESES: Write 2 to 3 testable hypotheses strictly following the structure:
   "If we [specific action], then [measurable outcome], because [underlying mechanism]".
5. ESTIMATION (ICE Framework):
   - Impact (1-10): Potential business value, retention boost, or revenue growth.
   - Effort (1-10): Engineering, design, and organizational complexity (1 = trivial, 10 = massive overhaul).
   - Confidence (1-10): Degree of certainty based on available evidence and domain clarity.
6. ZERO HALLUCINATIONS: Ground your analysis strictly in the provided text and CRM context.

${crmContextStr}
${customDirectives ? `Workspace Directives:\n${customDirectives}\n` : ''}

Raw Input:
${existingTitle ? `Title: ${existingTitle}\n` : ''}
${rawInput}
`;

    const response = await ai.generate({
      prompt: systemPrompt,
      output: { schema: developIdeaOutputSchema },
      config: {
        temperature: 0.3,
      },
    });

    if (!response.output) {
      throw new Error('Failed to generate structured idea deconstruction');
    }

    return response.output;
  }
);
