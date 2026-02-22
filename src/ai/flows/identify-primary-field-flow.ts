
'use server';
/**
 * @fileOverview An AI flow to identify the primary "naming" field in a form.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const IdentifyPrimaryFieldInputSchema = z.object({
  fields: z.array(z.object({
    id: z.string(),
    label: z.string().optional(),
    type: z.string(),
  })).describe("A list of form fields with their IDs, labels, and types."),
});
export type IdentifyPrimaryFieldInput = z.infer<typeof IdentifyPrimaryFieldInputSchema>;

const IdentifyPrimaryFieldOutputSchema = z.object({
  suggestedFieldId: z.string().nullable().describe("The ID of the field most likely to contain the name of the person filling the form."),
  reasoning: z.string().optional().describe("A brief explanation of why this field was chosen."),
});
export type IdentifyPrimaryFieldOutput = z.infer<typeof IdentifyPrimaryFieldOutputSchema>;

const identifyPrompt = ai.definePrompt({
  name: 'identifyPrimaryFieldPrompt',
  input: { schema: IdentifyPrimaryFieldInputSchema },
  output: { schema: IdentifyPrimaryFieldOutputSchema },
  prompt: `You are an expert at analyzing form structures. From the following list of fields, identify the one that is most likely to contain the "Name of the Respondent" or "Full Name of the Applicant".

Common labels include "Name", "Full Name", "Applicant Name", "Student Name", "Parent Name", "Parent/Guardian Name", etc. 
Prefer fields of type 'text'.

If no such field exists, return null for suggestedFieldId.

Fields:
{{#each fields}}
- ID: {{id}}, Label: "{{label}}", Type: {{type}}
{{/each}}
`,
});

const identifyPrimaryFieldFlow = ai.defineFlow(
  {
    name: 'identifyPrimaryFieldFlow',
    inputSchema: IdentifyPrimaryFieldInputSchema,
    outputSchema: IdentifyPrimaryFieldOutputSchema,
  },
  async (input) => {
    const { output } = await identifyPrompt(input);
    return output!;
  }
);

export async function identifyPrimaryField(input: IdentifyPrimaryFieldInput): Promise<IdentifyPrimaryFieldOutput> {
  return identifyPrimaryFieldFlow(input);
}
