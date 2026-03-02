'use server';
/**
 * @fileOverview An AI flow to generate dynamic email templates based on institutional context and available variables.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateEmailTemplateInputSchema = z.object({
  prompt: z.string().describe('Instructions or description of what the email should convey.'),
  channel: z.enum(['email', 'sms']).describe('The communication channel.'),
  schoolContext: z.string().optional().describe('Details about the school to personalize the tone.'),
  availableVariables: z.array(z.string()).optional().describe('A list of dynamic variables available for this specific context.'),
});
export type GenerateEmailTemplateInput = z.infer<typeof GenerateEmailTemplateInputSchema>;

const GenerateEmailTemplateOutputSchema = z.object({
  name: z.string().describe('A professional name for the template.'),
  subject: z.string().optional().describe('A compelling subject line (for email).'),
  body: z.string().describe('The message content. Use {{variable_name}} for dynamic data.'),
  variables: z.array(z.string()).describe('A list of all dynamic variables used in the body.'),
  explanation: z.string().describe('Brief summary of the design choices.'),
});
export type GenerateEmailTemplateOutput = z.infer<typeof GenerateEmailTemplateOutputSchema>;

const templatePrompt = ai.definePrompt({
  name: 'generateEmailTemplatePrompt',
  input: { schema: GenerateEmailTemplateInputSchema },
  output: { schema: GenerateEmailTemplateOutputSchema },
  prompt: `You are an expert Copywriter and Communication Strategist for SmartSapp, an educational technology platform.

### MISSION:
Generate a high-converting, professional message template for the {{channel}} channel based on the user's instructions.

### LOGIC & VARIABLES:
{{#if availableVariables}}
You MUST use the following variables where appropriate to make the message dynamic. Use the exact syntax: {{'{{variable_name}}'}}.
Available Tags:
{{#each availableVariables}}
- {{this}}
{{/each}}
{{else}}
Use {{'{{variable_name}}'}} syntax for all dynamic data. Common variables include {{'{{name}}'}}, {{'{{school_name}}'}}, {{'{{date}}'}}.
{{/if}}

### RULES:
1. **Dynamic Logic (CRITICAL)**: Use {{'{{variable_name}}'}} syntax for all dynamic data.
2. **Channel Constraints**:
   - For **Email**: Use HTML for structure. Include a clear subject line.
   - For **SMS**: Keep it concise, professional, and text-only (no HTML).
3. **Tone**: Modern, trustworthy, and supportive. Use the provided school context to adjust the "voice" (e.g., prestigious, community-focused).
4. **Output**: Return a JSON object matching the schema.

User Instructions:
{{{prompt}}}

{{#if schoolContext}}
Institutional Context:
{{{schoolContext}}}
{{/if}}
`,
});

const generateEmailTemplateFlow = ai.defineFlow(
  {
    name: 'generateEmailTemplateFlow',
    inputSchema: GenerateEmailTemplateInputSchema,
    outputSchema: GenerateEmailTemplateOutputSchema,
  },
  async (input) => {
    const { output } = await templatePrompt(input);
    if (!output) throw new Error("The AI failed to generate a template.");
    return output;
  }
);

export async function generateEmailTemplate(input: GenerateEmailTemplateInput): Promise<GenerateEmailTemplateOutput> {
  return generateEmailTemplateFlow(input);
}
