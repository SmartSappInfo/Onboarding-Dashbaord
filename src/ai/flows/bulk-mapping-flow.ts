
'use server';
/**
 * @fileOverview An AI flow to suggest mappings between spreadsheet headers and school schema fields.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const BulkMappingInputSchema = z.object({
  headers: z.array(z.string()).describe('The column headers from the uploaded document.'),
  sampleRows: z.array(z.record(z.any())).describe('A small sample of rows to provide data context.'),
});
export type BulkMappingInput = z.infer<typeof BulkMappingInputSchema>;

const BulkMappingOutputSchema = z.object({
  mapping: z.object({
    name: z.string().optional().describe('Column for School Name.'),
    initials: z.string().optional().describe('Column for School Initials/Acronym.'),
    slogan: z.string().optional().describe('Column for Motto/Slogan.'),
    location: z.string().optional().describe('Column for Physical Address.'),
    nominalRoll: z.string().optional().describe('Column for total students.'),
    zone: z.string().optional().describe('Column for Geographic Zone/Region.'),
    assignedTo: z.string().optional().describe('Column for the internal Account Manager name.'),
    package: z.string().optional().describe('Column for Subscription Tier/Level.'),
    modules: z.string().optional().describe('Column for requested SmartSapp modules.'),
    implementationDate: z.string().optional().describe('Column for expected go-live date.'),
    contactName: z.string().optional().describe('Primary contact full name.'),
    contactEmail: z.string().optional().describe('Primary contact email.'),
    contactPhone: z.string().optional().describe('Primary contact phone.'),
    additionalContacts: z.string().optional().describe('Column containing other contact people or details.'),
    // Financial Extensions
    billingAddress: z.string().optional().describe('Column for financial billing address.'),
    currency: z.string().optional().describe('Column for currency (e.g. GHS, USD).'),
    subscriptionRate: z.string().optional().describe('Column for custom student rate.'),
    discountPercentage: z.string().optional().describe('Column for discount percentage.'),
    arrearsBalance: z.string().optional().describe('Column for outstanding arrears.'),
    creditBalance: z.string().optional().describe('Column for existing credit.'),
  }).describe('Maps system field keys to the document header names.'),
  explanation: z.string().describe('Reasoning for the suggested mapping.'),
});
export type BulkMappingOutput = z.infer<typeof BulkMappingOutputSchema>;

const mappingPrompt = ai.definePrompt({
  name: 'bulkMappingPrompt',
  input: { schema: BulkMappingInputSchema },
  output: { schema: BulkMappingOutputSchema },
  prompt: `You are an expert data migration specialist for SmartSapp. 
Analyze the following spreadsheet headers and sample data to suggest the best mapping to our internal school schema.

### SYSTEM FIELDS:
- **name**: The official name of the school.
- **initials**: Short name (e.g. GIS).
- **nominalRoll**: The total population of students.
- **zone**: The geographic region.
- **assignedTo**: The person in OUR team responsible for this school.
- **package**: The pricing tier (e.g. Level A, Platinum).
- **modules**: Specific features needed (e.g. Billing, Security).
- **contactName/Email/Phone**: The primary institutional representative.
- **Financial Profile**: billingAddress, currency, subscriptionRate, arrearsBalance, etc.

### HEADERS:
{{#each headers}}- {{this}}
{{/each}}

### SAMPLE DATA:
\`\`\`json
{{{json sampleRows}}}
\`\`\`

Suggest the most accurate mapping. If a system field cannot be matched, omit it.
`,
});

const bulkMappingFlow = ai.defineFlow(
  {
    name: 'bulkMappingFlow',
    inputSchema: BulkMappingInputSchema,
    outputSchema: BulkMappingOutputSchema,
  },
  async (input) => {
    let retries = 0;
    while (retries < 3) {
        try {
            const { output } = await mappingPrompt(input);
            if (!output) throw new Error("The AI failed to suggest a valid header mapping.");
            return output;
        } catch (e: any) {
            retries++;
            if (retries === 3) throw e;
            await new Promise(r => setTimeout(r, 2000 * retries));
        }
    }
    throw new Error("Mapping process timed out.");
  }
);

export async function suggestBulkMapping(input: BulkMappingInput): Promise<BulkMappingOutput> {
  return bulkMappingFlow(input);
}
