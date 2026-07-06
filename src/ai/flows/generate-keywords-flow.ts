'use server';
/**
 * @fileOverview A flow to generate SEO keywords for a survey using its title and description.
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateKeywordsInputSchema = z.object({
  title: z.string().describe('The title of the survey.'),
  description: z.string().describe('The description of the survey.'),
  organizationId: z.string().optional(),
});
export type GenerateKeywordsInput = z.infer<typeof GenerateKeywordsInputSchema>;

const GenerateKeywordsOutputSchema = z.object({
  keywords: z.array(z.string()).describe('List of 5 to 10 relevant SEO keywords for the survey.'),
});
export type GenerateKeywordsOutput = z.infer<typeof GenerateKeywordsOutputSchema>;

const generateKeywordsFlow = ai.defineFlow(
  {
    name: 'generateKeywordsFlow',
    inputSchema: GenerateKeywordsInputSchema,
    outputSchema: GenerateKeywordsOutputSchema,
  },
  async (input) => {
    try {
      const resolvedModel = await getModel({
        organizationId: input.organizationId,
        provider: 'googleai',
        modelId: 'gemini-3.5-flash',
      });

      const generatorAi = resolvedModel.customAi || ai;

      const promptText = `Generate 5 to 10 relevant SEO keywords for a survey based on the following title and description.
Survey Title: "${input.title}"
Survey Description: "${input.description}"

Focus on keywords that describe the target audience, subject, and goals of this survey. Return only the array of strings as defined in the output schema.`;

      const { output } = await generatorAi.generate({
        model: resolvedModel.modelString,
        prompt: promptText,
        output: { schema: GenerateKeywordsOutputSchema }
      });

      if (!output) {
        throw new Error("AI generated empty output for keywords.");
      }

      return output;
    } catch (error: unknown) {
      console.error('Error generating keywords inside AI flow:', error);
      return { keywords: [] };
    }
  }
);

export async function generateKeywords(input: GenerateKeywordsInput): Promise<GenerateKeywordsOutput> {
  return generateKeywordsFlow(input);
}
