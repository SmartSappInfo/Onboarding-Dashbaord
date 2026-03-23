'use server';
/**
 * @fileOverview An AI flow to generate HTML email wrappers (Visual Styles).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateVisualStyleInputSchema = z.object({
  name: z.string().describe('The name of the visual style.'),
  prompt: z.string().describe('Instructions, description, or code to transform into a style.'),
  photoDataUri: z.string().optional().describe("An optional inspiration image as a data URI."),
});
export type GenerateVisualStyleInput = z.infer<typeof GenerateVisualStyleInputSchema>;

const GenerateVisualStyleOutputSchema = z.object({
  htmlWrapper: z.string().describe('The complete, responsive HTML wrapper. MUST include the {{content}} placeholder.'),
  explanation: z.string().describe('A brief explanation of the design choices made.'),
});
export type GenerateVisualStyleOutput = z.infer<typeof GenerateVisualStyleOutputSchema>;

const stylePrompt = ai.definePrompt({
  name: 'generateVisualStylePrompt',
  input: { schema: GenerateVisualStyleInputSchema },
  output: { schema: GenerateVisualStyleOutputSchema },
  prompt: `You are an expert Email Design Architect. Your task is to create a premium, responsive HTML email wrapper based on the user's input.

### RULES:
1. **Placeholder (CRITICAL)**: You MUST include the string "{{content}}" exactly where the dynamic message body should be injected.
2. **Compatibility**: Use inline CSS and table-based layouts where necessary for maximum compatibility across Outlook, Gmail, and Apple Mail.
3. **Responsiveness**: Ensure the layout looks great on both mobile and desktop.
4. **Branding**: If an inspiration image is provided, extract the color palette and "vibe" (modern, corporate, playful) from it.
5. **Structure**: Include a clean header area (placeholder for logo) and a footer with copyright info.

User Instructions:
{{{prompt}}}

{{#if photoDataUri}}
Visual Inspiration:
{{media url=photoDataUri}}
{{/if}}
`,
});

const generateVisualStyleFlow = ai.defineFlow(
  {
    name: 'generateVisualStyleFlow',
    inputSchema: GenerateVisualStyleInputSchema,
    outputSchema: GenerateVisualStyleOutputSchema,
  },
  async (input) => {
    const { output } = await stylePrompt(input);
    if (!output) throw new Error("The AI failed to generate a visual style.");
    return output;
  }
);

export async function generateVisualStyle(input: GenerateVisualStyleInput): Promise<GenerateVisualStyleOutput> {
  return generateVisualStyleFlow(input);
}
