'use server';
/**
 * @fileOverview An AI flow to generate SMS or WhatsApp copywriting copy.
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateScriptInputSchema = z.object({
  prompt: z.string().describe("Instructions for script content."),
  channel: z.enum(['sms', 'whatsapp']),
  variables: z.array(z.string()).describe("List of CRM merge tags."),
  tone: z.enum(['professional', 'warm', 'urgent', 'friendly']).default('friendly'),
  organizationId: z.string().optional(),
  provider: z.string().optional(),
  modelId: z.string().optional(),
});
export type GenerateScriptInput = z.infer<typeof GenerateScriptInputSchema>;

const GenerateScriptOutputSchema = z.object({
  message: z.string().describe("The conversational message body, correctly escaped and formatted."),
  hasMedia: z.boolean().describe("Whether this message includes media attachments (always false for SMS)."),
  mediaPlaceholderUrl: z.string().optional().describe("Suggested background or graphic URL if channel is WhatsApp."),
  estimatedReadTimeSeconds: z.number().describe("Approximate time in seconds it takes to read this copy."),
});
export type GenerateScriptOutput = z.infer<typeof GenerateScriptOutputSchema>;

function renderScriptPrompt(input: {
  prompt: string;
  channel: string;
  variables: string[];
  tone: string;
}): string {
  return `You are an expert Copywriter and conversational interface designer. Your task is to generate short-form conversational copy for ${input.channel} matching a ${input.tone} tone of voice.

### CRITICAL RULES:
1. **Merge Tags Syntax**: Use the exact syntax {{variable_name}} for merge tags.
2. **Channel Limits**:
   - If channel is **SMS**: Keep copy under 160 characters if possible. Max limit is 320 characters. Be concise and direct. Avoid excessive exclamation marks. Do not recommend media/images.
   - If channel is **WhatsApp**: You can write up to 1000 characters, use emojis for visual hierarchy, and recommend structural dividers or formatting (*bold*, _italics_).
3. **Merge Tag Precision**: Only use merge tags from the available tags list below:
${input.variables.map(v => `- ${v}`).join('\n')}

Instructions:
"""
${input.prompt}
"""
`;
}

const generateScriptFlow = ai.defineFlow(
  {
    name: 'generateScriptFlow',
    inputSchema: GenerateScriptInputSchema,
    outputSchema: GenerateScriptOutputSchema,
  },
  async (input) => {
    const { organizationId, provider = 'anthropic', modelId = 'claude-sonnet-4-6' } = input;

    const resolvedModel = await getModel({
      organizationId,
      provider,
      modelId,
    });

    const generatorAi = resolvedModel.customAi || ai;
    
    const promptText = renderScriptPrompt({
      prompt: input.prompt,
      channel: input.channel,
      variables: input.variables,
      tone: input.tone,
    });

    const { output } = await generatorAi.generate({
      model: resolvedModel.modelString,
      prompt: promptText,
      output: { schema: GenerateScriptOutputSchema }
    });

    if (!output) {
      throw new Error("Failed to generate communication script copy.");
    }

    return output;
  }
);

export async function generateScript(input: GenerateScriptInput): Promise<GenerateScriptOutput> {
  return generateScriptFlow(input);
}
