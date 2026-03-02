'use server';
/**
 * @fileOverview An AI flow to generate dynamic, structured message templates.
 * Upgraded to produce modular blocks for the new Template Studio.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const BlockSchema = z.object({
  id: z.string(),
  type: z.enum(['heading', 'text', 'image', 'button', 'quote', 'divider', 'list', 'logo', 'header', 'footer']),
  title: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  link: z.string().optional(),
  variant: z.enum(['h1', 'h2', 'h3']).optional(),
  items: z.array(z.string()).optional(),
  listStyle: z.enum(['ordered', 'unordered']).optional(),
  style: z.object({
    textAlign: z.enum(['left', 'center', 'right']).optional(),
  }).optional(),
});

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
  body: z.string().describe('The plain text version or SMS content.'),
  blocks: z.array(BlockSchema).optional().describe('A structured list of content blocks for high-fidelity Email layouts.'),
  variables: z.array(z.string()).describe('A list of all dynamic variables used.'),
  explanation: z.string().describe('Brief summary of the design choices.'),
});
export type GenerateEmailTemplateOutput = z.infer<typeof GenerateEmailTemplateOutputSchema>;

const templatePrompt = ai.definePrompt({
  name: 'generateEmailTemplatePrompt',
  input: { schema: GenerateEmailTemplateInputSchema },
  output: { schema: GenerateEmailTemplateOutputSchema },
  prompt: `You are an expert Copywriter and Email Design Architect for SmartSapp.

### MISSION:
Generate a high-converting, professional message template for the {{channel}} channel.

### ARCHITECTURE (FOR EMAIL):
If the channel is **Email**, you MUST return a structured 'blocks' array. 
- Use 'header' and 'footer' for the frame.
- Use 'heading' (variants h1, h2, h3) for titles.
- Use 'text' for paragraphs.
- Use 'button' for calls-to-action (links can use variables).
- Use 'list' for bullet points.
- Use 'logo' at the top (defaults to {{'{{school_logo}}'}}).
- Use 'divider' for visual separation.

### LOGIC & VARIABLES:
You MUST use these variables where appropriate:
{{#if availableVariables}}
{{#each availableVariables}}- {{this}}
{{/each}}
{{else}}- school_name
- contact_name
- date
{{/if}}
Use the exact syntax: {{'{{variable_name}}'}}.

### RULES:
1. **Dynamic Intelligence**: Always prefer using variables for institutional data.
2. **Channel Constraints**:
   - **SMS**: Plain text only in the 'body' field. No blocks.
   - **Email**: Detailed 'blocks' array. Branded, professional, and mobile-responsive.
3. **Tone**: Modern, trustworthy, and supportive.

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
