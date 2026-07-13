'use server';

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';

export const HookAlternativeSchema = z.object({
  text: z.string().describe('The short title hook text (1-3 words max).'),
  score: z.number().min(0).max(100).describe('Predicted CTR score (e.g., 75-98) based on copywriting rules.'),
  emotion: z.enum(['Greed', 'Curiosity', 'Fear', 'Awe', 'Pride']).describe('Psychological emotional hook trigger category.'),
  readability: z.enum(['High', 'Excellent', 'Standard']).describe('Visual readability scale based on text length.'),
});

export type HookAlternative = z.infer<typeof HookAlternativeSchema>;

export const GenerateHooksInputSchema = z.object({
  topic: z.string().describe('The raw title topic or description to brainstorm hooks for.'),
});

export type GenerateHooksInput = z.infer<typeof GenerateHooksInputSchema>;

export const GenerateHooksOutputSchema = z.object({
  hooks: z.array(HookAlternativeSchema),
});

export type GenerateHooksOutput = z.infer<typeof GenerateHooksOutputSchema>;

const copywriterHookPrompt = ai.definePrompt({
  name: 'copywriterHookPrompt',
  input: { schema: z.object({ topic: z.string() }) },
  output: { schema: GenerateHooksOutputSchema },
  prompt: `You are an elite YouTube CTR Copywriter and Audience Analyst.
Given the video topic/title: "{{topic}}", generate exactly 4 premium, high-CTR hook alternative phrases.
Keep each hook extremely short (1 to 3 words max).

Ensure you generate one for each of these 4 psychological triggers:
1. Curiosity Hook: Inspires intrigue or mystery (e.g. "SAAS SECRET")
2. Fear Hook: Warns against mistakes, loss or failure (e.g. "DON'T BUILD SAAS")
3. Greed Hook: Promises big metrics, wealth, speed, or growth (e.g. "$10K BLUEPRINT")
4. Direct Hook: Clear, simple and bold value focus (e.g. "30-DAY SAAS")

Assign:
- score: Predicted CTR rating out of 100 based on word brevity and curiosity strength (from 75 to 98).
- emotion: Match the hook's dominant psychological category: Greed, Curiosity, Fear, Awe, Pride.
- readability: Grade as "Excellent" for 1-2 words, "High" for 3 words, and "Standard" for 4+ words.`,
});

export const generateHookAlternatives = ai.defineFlow(
  {
    name: 'generateHookAlternatives',
    inputSchema: GenerateHooksInputSchema,
    outputSchema: GenerateHooksOutputSchema,
  },
  async (input) => {
    let resolvedModel;
    try {
      resolvedModel = await getModel({
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet',
      });
    } catch (err) {
      console.warn('Anthropic model failed, trying fallback Gemini model...', err);
      resolvedModel = await getModel({
        provider: 'google-genai',
        modelId: 'gemini-2.5-flash',
      });
    }

    const generatorAi = resolvedModel.customAi || ai;

    const response = await generatorAi.generate({
      model: resolvedModel.modelString,
      prompt: await copywriterHookPrompt.render({
        topic: input.topic,
      }),
      output: { schema: GenerateHooksOutputSchema },
    });

    const output = response.output;
    if (!output || !output.hooks || output.hooks.length === 0) {
      throw new Error('Copywriter model failed to return hook alternatives.');
    }

    return output;
  }
);
