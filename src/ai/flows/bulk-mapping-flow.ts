'use server';
/**
 * @fileOverview An AI flow to suggest mappings between spreadsheet headers and school schema fields.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const BulkMappingInputSchema = z.object({
  headers: z.array(z.string()).describe('The column headers from the uploaded document.'),
  sampleRows: z.array(z.record(z.any())).describe('A small sample of rows to provide data context.'),
  systemFields: z.array(z.object({
      key: z.string(),
      label: z.string(),
      description: z.string().optional()
  })).describe('The dynamic entity schema fields available for mapping in the target workspace.')
});
export type BulkMappingInput = z.infer<typeof BulkMappingInputSchema>;

const BulkMappingOutputSchema = z.object({
  mapping: z.record(z.string()).describe('Maps system field keys to the document header names. Key is the system field key, value is the exact string of the document header. Omit the key if no good match is found.'),
  explanation: z.string().describe('Reasoning for the suggested mapping.'),
});
export type BulkMappingOutput = z.infer<typeof BulkMappingOutputSchema>;

const mappingPrompt = ai.definePrompt({
  name: 'bulkMappingPrompt',
  input: { schema: BulkMappingInputSchema },
  output: { schema: BulkMappingOutputSchema },
  prompt: `You are an expert data migration specialist. 
Analyze the following spreadsheet headers and sample data to suggest the best mapping to our internal dynamic entity schema.

### AVAILABLE SYSTEM FIELDS:
{{#each systemFields}}
- **{{this.key}}** ({{this.label}}): {{this.description}}
{{/each}}

### DOCUMENT HEADERS:
{{#each headers}}- {{this}}
{{/each}}

### SAMPLE DATA:
\`\`\`json
{{{json sampleRows}}}
\`\`\`

Suggest the most accurate mapping. Your output 'mapping' object MUST use the system field 'key' as the property name, and the exact document header string as the value.
If a system field cannot be matched to any document header with high confidence, omit it entirely from the mapping object.
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
