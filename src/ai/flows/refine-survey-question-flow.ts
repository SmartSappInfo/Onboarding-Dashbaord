/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Contextual AI Question Copilot Flow
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Genkit flow for contextual question improvement:
 *    - Eliminate bias / make less leading.
 *    - Simplify grade-level readability.
 *    - Generate balanced Likert and choice options.
 *    - Suggest contextual follow-up branching questions.
 *    - Translate into target language.
 * 2. Strict Zero-Any Invariant.
 * 3. Protected by Preview -> Approve -> Apply workflow in UI.
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';

export const RefineSurveyQuestionInputSchema = z.object({
  organizationId: z.string().optional(),
  questionTitle: z.string().min(1, 'Question title is required'),
  questionDescription: z.string().optional(),
  questionType: z.string().default('text'),
  options: z.array(z.string()).optional(),
  actionType: z.enum([
    'eliminate_bias',
    'simplify_language',
    'generate_options',
    'add_followup',
    'translate',
  ]),
  targetLanguage: z.string().optional(),
  contextPrompt: z.string().optional(),
});

export type RefineSurveyQuestionInput = z.infer<typeof RefineSurveyQuestionInputSchema>;

export const RefineSurveyQuestionOutputSchema = z.object({
  improvedTitle: z.string().describe('Refined question prompt'),
  improvedDescription: z.string().optional().describe('Clarified guidance or subtitle'),
  improvedOptions: z.array(z.string()).optional().describe('Balanced choices if requested'),
  suggestedFollowup: z
    .object({
      title: z.string(),
      type: z.string(),
      options: z.array(z.string()).optional(),
      branchCondition: z.string().optional(),
    })
    .optional()
    .describe('Suggested next question if add_followup was selected'),
  rationale: z.string().describe('Explanation of why this improves measurement fidelity'),
});

export type RefineSurveyQuestionOutput = z.infer<typeof RefineSurveyQuestionOutputSchema>;

export const refineSurveyQuestionFlow = ai.defineFlow(
  {
    name: 'refineSurveyQuestionFlow',
    inputSchema: RefineSurveyQuestionInputSchema,
    outputSchema: RefineSurveyQuestionOutputSchema,
  },
  async (input: RefineSurveyQuestionInput): Promise<RefineSurveyQuestionOutput> => {
    const resolvedModel = await getModel({
      organizationId: input.organizationId,
      provider: 'google',
      modelId: 'gemini-1.5-flash',
    });

    const generatorAi = resolvedModel.customAi || ai;

    const systemPrompt = `
You are an expert Psychometrician and Survey Design Methodologist at SmartSapp.
Your goal is to optimize survey questions to maximize response fidelity, eliminate bias, ensure balanced choice scales, and reduce cognitive friction for respondents.

ACTION INSTRUCTION:
${
  input.actionType === 'eliminate_bias'
    ? 'Rephrase the question to be neutral, objective, and non-leading. Avoid emotionally charged words or implied desired answers.'
    : input.actionType === 'simplify_language'
    ? 'Simplify vocabulary and syntax to a 6th-grade reading level. Remove jargon, double-barreled clauses, and ambiguous phrasing.'
    : input.actionType === 'generate_options'
    ? 'Generate 4-6 balanced, mutually exclusive, and collectively exhaustive options (e.g. balanced Likert scale, clear categorical tiers).'
    : input.actionType === 'add_followup'
    ? 'Provide an improved version of the question AND generate a high-value follow-up question that digs deeper into respondent sentiment or reasoning.'
    : `Translate the question and options into ${input.targetLanguage || 'Spanish'} with native fluency, cultural nuance, and high clarity.`
}

Original Question Title: "${input.questionTitle}"
${input.questionDescription ? `Description: "${input.questionDescription}"` : ''}
Question Type: ${input.questionType}
${input.options && input.options.length > 0 ? `Current Options: ${JSON.stringify(input.options)}` : ''}
${input.contextPrompt ? `Additional Instructions: "${input.contextPrompt}"` : ''}

Respond with valid structured output matching the schema.
`;

    const { output } = await generatorAi.generate({
      model: resolvedModel.modelString,
      prompt: systemPrompt,
      output: { schema: RefineSurveyQuestionOutputSchema },
    });

    if (!output) {
      throw new Error('AI Question Refinement failed to generate structured output.');
    }

    return output;
  }
);