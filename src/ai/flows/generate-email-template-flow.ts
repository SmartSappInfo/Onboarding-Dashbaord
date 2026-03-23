'use server';
/**
 * @fileOverview An AI flow to generate dynamic, structured message templates.
 * Upgraded to detect institutional context and map technical tags from the registry.
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
  availableVariables: z.array(z.string()).optional().describe('A list of dynamic variables available for this specific context.'),
});
export type GenerateEmailTemplateInput = z.infer<typeof GenerateEmailTemplateInputSchema>;

const GenerateEmailTemplateOutputSchema = z.object({
  name: z.string().describe('A professional name for the template.'),
  subject: z.string().optional().describe('A compelling subject line (for email).'),
  body: z.string().describe('The plain text version or SMS content.'),
  blocks: z.array(BlockSchema).optional().describe('A structured list of content blocks for high-fidelity Email layouts.'),
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

### CONTEXT DETECTION:
Analyze the prompt to detect the relevant module and automatically use these variables:
- **Meeting Invite**: Use {{'{{meeting_time}}'}}, {{'{{meeting_link}}'}}, {{'{{meeting_type}}'}}.
- **Survey Result**: Use {{'{{survey_score}}'}}, {{'{{outcome_label}}'}}, {{'{{result_url}}'}}.
- **Doc Signed**: Use {{'{{form_name}}'}}, {{'{{submission_date}}'}}.
- **General**: Use {{'{{school_name}}'}}, {{'{{contact_name}}'}}.

### ARCHITECTURE (FOR EMAIL):
If the channel is **Email**, you MUST return a structured 'blocks' array. 
- Use 'header' and 'footer' for the frame.
- Use 'heading' (variants h1, h2, h3) for titles.
- Use 'text' for paragraphs.
- Use 'button' for calls-to-action (links can use variables).
- Use 'logo' at the top (defaults to {{'{{school_logo}}'}}).

### RULES:
1. **TAG PRECISION**: You MUST use the exact syntax: {{'{{variable_name}}'}}.
2. **VARIABLE INJECTION**: Use the available variables provided below whenever appropriate.
Available Keys:
{{#if availableVariables}}
{{#each availableVariables}}- {{this}}
{{/each}}
{{else}}- school_name
- contact_name
- survey_score
- meeting_time
{{/if}}

User Instructions:
{{{prompt}}}
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
    if (!output) throw new Error("The AI failed to generate a template blueprint.");
    return output;
  }
);

export async function generateEmailTemplate(input: GenerateEmailTemplateInput): Promise<GenerateEmailTemplateOutput> {
  return generateEmailTemplateFlow(input);
}
