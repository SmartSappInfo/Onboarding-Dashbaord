
'use server';
/**
 * @fileOverview An AI flow to normalize raw spreadsheet data into structured school records.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const NormalizationContextSchema = z.object({
  zones: z.array(z.object({ id: z.string(), name: z.string() })),
  users: z.array(z.object({ id: z.string(), name: z.string() })),
  packages: z.array(z.object({ id: z.string(), name: z.string(), ratePerStudent: z.number() })),
  modules: z.array(z.object({ id: z.string(), name: z.string(), abbreviation: z.string(), color: z.string() })),
});

const BulkNormalizationInputSchema = z.object({
  rawData: z.record(z.any()).describe('The raw row data from the spreadsheet.'),
  mapping: z.record(z.string()).describe('The established header mapping.'),
  context: NormalizationContextSchema.describe('Available system entities for ID resolution.'),
});
export type BulkNormalizationInput = z.infer<typeof BulkNormalizationInputSchema>;

const FocalPersonSchema = z.object({
  name: z.string(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  type: z.string().describe('Role at the school.'),
  isSignatory: z.boolean().describe('True if this is the primary legal representative.'),
});

const BulkNormalizationOutputSchema = z.object({
  normalizedSchool: z.object({
    name: z.string(),
    initials: z.string().optional(),
    slogan: z.string().optional(),
    location: z.string().optional(),
    nominalRoll: z.number().optional(),
    zoneId: z.string().nullable().describe('The resolved ID of the geographic zone.'),
    assignedToId: z.string().nullable().describe('The resolved ID of the authorized team member.'),
    subscriptionPackageId: z.string().nullable().describe('The resolved ID of the pricing tier.'),
    subscriptionRate: z.number().optional().describe('The effective rate.'),
    discountPercentage: z.number().optional().describe('The calculated discount.'),
    arrearsBalance: z.number().optional(),
    creditBalance: z.number().optional(),
    billingAddress: z.string().optional(),
    currency: z.string().optional().default('GHS'),
    moduleIds: z.array(z.string()).optional().describe('Array of resolved module IDs.'),
    focalPersons: z.array(FocalPersonSchema),
    implementationDate: z.string().optional().describe('ISO date string.'),
  }),
  explanation: z.string().describe('Reasoning for the normalization choices.'),
});
export type BulkNormalizationOutput = z.infer<typeof BulkNormalizationOutputSchema>;

const normalizationPrompt = ai.definePrompt({
  name: 'bulkNormalizationPrompt',
  input: { schema: BulkNormalizationInputSchema },
  output: { schema: BulkNormalizationOutputSchema },
  prompt: `You are an expert Institutional Data Architect. Normalize the provided raw row into a SmartSapp School record.

### FUZZY MATCHING RULES:
1. **Zone**: Match the raw location/zone string to the best fitting Zone from the context.
2. **Account Manager**: Match "assignedTo" name to our User list.
3. **Package**: Match "package" string to our Subscription Packages.
4. **Financials**: Extract arrears, credits, and custom rates. Normalize currency to 3-letter codes (GHS, USD).
5. **Contact Discovery**: Scan ALL fields for focal persons and phone numbers. Designate exactly ONE signatory.

### CONTEXT:
- **Zones**: {{#each context.zones}}{{name}} (ID: {{id}}), {{/each}}
- **Users**: {{#each context.users}}{{name}} (ID: {{id}}), {{/each}}
- **Packages**: {{#each context.packages}}{{name}} (ID: {{id}}, Rate: {{ratePerStudent}}), {{/each}}
- **Modules**: {{#each context.modules}}{{name}} (ID: {{id}}), {{/each}}

### RAW ROW:
\`\`\`json
{{{json rawData}}}
\`\`\`

### MAPPING:
\`\`\`json
{{{json mapping}}}
\`\`\`
`,
});

const bulkNormalizationFlow = ai.defineFlow(
  {
    name: 'bulkNormalizationFlow',
    inputSchema: BulkNormalizationInputSchema,
    outputSchema: BulkNormalizationOutputSchema,
  },
  async (input) => {
    let retries = 0;
    while (retries < 3) {
        try {
            const { output } = await normalizationPrompt(input);
            if (!output) throw new Error("Normalization failure.");
            return output;
        } catch (e: any) {
            retries++;
            if (retries === 3) throw e;
            await new Promise(r => setTimeout(r, 2000 * retries));
        }
    }
    throw new Error("Normalization timed out.");
  }
);

export async function normalizeBulkRow(input: BulkNormalizationInput): Promise<BulkNormalizationOutput> {
  return bulkNormalizationFlow(input);
}
