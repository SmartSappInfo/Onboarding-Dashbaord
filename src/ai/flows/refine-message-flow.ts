'use server';
/**
 * @fileOverview An AI flow to refine and rephrase message content while preserving variables.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RefineMessageInputSchema = z.object({
  text: z.string().describe('The original message text containing {{variable}} tags.'),
  tone: z.enum(['formal', 'friendly', 'urgent', 'concise']).describe('The desired tone for the refinement.'),
  channel: z.enum(['email', 'sms']).describe('The communication channel constraints.'),
});
export type RefineMessageInput = z.infer<typeof RefineMessageInputSchema>;

const RefineMessageOutputSchema = z.object({
  refinedText: z.string().describe('The rephrased message. Variables MUST be preserved exactly.'),
  explanation: z.string().describe('Brief summary of the changes made.'),
});
export type RefineMessageOutput = z.infer<typeof RefineMessageOutputSchema>;

const refinePrompt = ai.definePrompt({
  name: 'refineMessagePrompt',
  input: { schema: RefineMessageInputSchema },
  output: { schema: RefineMessageOutputSchema },
  prompt: `You are an expert Communications Consultant. 

### TASK:
Refine the provided message to match the requested **{{tone}}** tone for the **{{channel}}** channel.

### RULES:
1. **VARIABLES (CRITICAL)**: You MUST preserve all {{variable_name}} tags exactly as they are. Do not translate or change them.
2. **CHANNEL CONSTRAINTS**:
   - For **SMS**: Keep the message extremely concise and avoid HTML.
   - For **Email**: Use clear structure and professional phrasing.
3. **TONE GUIDANCE**:
   - **Formal**: Professional, respectful, and authoritative.
   - **Friendly**: Warm, welcoming, and community-focused.
   - **Urgent**: Action-oriented, direct, and time-sensitive.
   - **Concise**: Minimalist and to-the-point.

Original Message:
"""
{{{text}}}
"""
`,
});

const refineMessageFlow = ai.defineFlow(
  {
    name: 'refineMessageFlow',
    inputSchema: RefineMessageInputSchema,
    outputSchema: RefineMessageOutputSchema,
  },
  async (input) => {
    const { output } = await refinePrompt(input);
    if (!output) throw new Error("The AI failed to refine the message.");
    return output;
  }
);

export async function refineMessage(input: RefineMessageInput): Promise<RefineMessageOutput> {
  return refineMessageFlow(input);
}
