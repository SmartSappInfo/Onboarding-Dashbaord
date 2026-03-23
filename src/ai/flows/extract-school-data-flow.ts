'use server';
/**
 * @fileOverview An AI flow to extract structured school data from unstructured text.
 * Upgraded to support deep discovery of all stakeholders and secondary contact points.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractSchoolDataInputSchema = z.object({
  text: z.string().describe('The raw text containing school information.'),
});
export type ExtractSchoolDataInput = z.infer<typeof ExtractSchoolDataInputSchema>;

const ExtractSchoolDataOutputSchema = z.object({
  name: z.string().describe('Official name of the school.'),
  initials: z.string().optional().describe('Acronym or short name.'),
  slogan: z.string().optional().describe('School motto or slogan.'),
  location: z.string().optional().describe('Physical address or general area.'),
  nominalRoll: z.number().optional().describe('Estimated total student population.'),
  focalPersons: z.array(z.object({
    name: z.string().describe('Full name of the contact or office department.'),
    email: z.string().email().describe('Professional email address.'),
    phone: z.string().describe('Contact number.'),
    type: z.enum(['Champion', 'Accountant', 'Administrator', 'Principal', 'School Owner']).describe('Organizational role.')
  })).optional().describe('All stakeholders and office contact points identified in the text.'),
  suggestedModuleNames: z.array(z.string()).optional().describe('Names of SmartSapp modules mentioned or implied (e.g. Billing, Attendance, Security).'),
  explanation: z.string().describe('Brief summary of what was extracted and why.'),
});
export type ExtractSchoolDataOutput = z.infer<typeof ExtractSchoolDataOutputSchema>;

const extractionPrompt = ai.definePrompt({
  name: 'extractSchoolDataPrompt',
  input: { schema: ExtractSchoolDataInputSchema },
  output: { schema: ExtractSchoolDataOutputSchema },
  prompt: `You are an expert institutional analyst for SmartSapp. Your task is to analyze the provided text and extract structured data for a new school onboarding.

### ANALYSIS RULES:
1. **Precision**: Extract the official name, initials (e.g. GIS for Ghana International School), and slogan exactly as they appear.
2. **Deep Contact Discovery**: Thoroughly scan the text for *every* individual and contact point mentioned. 
   - Capture every person and their specific role.
   - If a generic phone number is provided (e.g. "Main Office: 024..."), create a focal person entry with Name: "Main Office" and Role: "Administrator".
   - Map roles strictly to: 'Champion', 'Accountant', 'Administrator', 'Principal', or 'School Owner'.
3. **Logistics**: Find the student population (Nominal Roll) and physical location.
4. **Module Detection**: Identify which SmartSapp features the school needs. Common ones include 'Child Security', 'Student Billing', 'Attendance', and 'Reports'.
5. **Formatting**: Ensure all phone numbers are preserved and emails are valid.

Source Material:
"""
{{{text}}}
"""
`,
});

const extractSchoolDataFlow = ai.defineFlow(
  {
    name: 'extractSchoolDataFlow',
    inputSchema: ExtractSchoolDataInputSchema,
    outputSchema: ExtractSchoolDataOutputSchema,
  },
  async (input) => {
    const { output } = await extractionPrompt(input);
    if (!output) throw new Error("The AI failed to parse the institutional data.");
    return output;
  }
);

export async function extractSchoolData(input: ExtractSchoolDataInput): Promise<ExtractSchoolDataOutput> {
  return extractSchoolDataFlow(input);
}
