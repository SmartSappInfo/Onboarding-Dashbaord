
'use server';
/**
 * @fileOverview An AI flow to detect potential form fields in a PDF document.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DetectPdfFieldsInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF file encoded as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
    prompt: z.string().optional().describe("An optional prompt to guide the AI, e.g., 'focus on finding signature and date fields'"),
});
export type DetectPdfFieldsInput = z.infer<typeof DetectPdfFieldsInputSchema>;

const FieldSuggestionSchema = z.object({
    type: z.enum(['text', 'signature', 'date']).describe("The type of form field detected."),
    pageNumber: z.number().int().min(1).describe("The 1-based page number where the field was found."),
    position: z.object({
        x: z.number().min(0).max(100).describe("The x-coordinate of the top-left corner as a percentage of the page width."),
        y: z.number().min(0).max(100).describe("The y-coordinate of the top-left corner as a percentage of the page height."),
    }),
    dimensions: z.object({
        width: z.number().min(1).max(100).describe("The width of the field as a percentage of the page width."),
        height: z.number().min(1).max(100).describe("The height of the field as a percentage of the page height."),
    }),
    label: z.string().optional().describe("A concise, human-readable label for the field, inferred from any nearby text on the PDF. For example, if the PDF has 'Applicant Name:' next to a blank line, the label should be 'Applicant Name'."),
});


const DetectPdfFieldsOutputSchema = z.object({
  fields: z.array(FieldSuggestionSchema).describe("An array of suggested form fields detected in the PDF."),
});
export type DetectPdfFieldsOutput = z.infer<typeof DetectPdfFieldsOutputSchema>;


const detectionPrompt = ai.definePrompt({
    name: 'detectPdfFieldsPrompt',
    input: { schema: DetectPdfFieldsInputSchema },
    output: { schema: DetectPdfFieldsOutputSchema },
    prompt: `You are an expert document analyst specializing in form field detection. Analyze the following PDF document and identify all potential interactive form fields like text inputs, signature areas, and date fields.

Your task is to return a structured JSON object containing an array of field suggestions.

For each field you identify, provide:
1.  **type**: The most likely field type ('text', 'signature', or 'date').
2.  **pageNumber**: The 1-based page number where the field is located.
3.  **position**: The top-left corner (x, y) of the field's bounding box, expressed as percentages of the page dimensions.
4.  **dimensions**: The size (width, height) of the field's bounding box, also expressed as percentages.
5.  **label**: A concise, human-readable label for the field, inferred from any text printed on the PDF to the left of, or directly above, the field. For example, if the PDF has 'Applicant Name:' next to a blank line, the label should be 'Applicant Name'. This is a critical field; do not leave it blank unless there is absolutely no descriptive text nearby.

**IMPORTANT**:
-   Pay close attention to underlined spaces, boxes, and labels like "Name:", "Signature:", or "Date:".
-   'signature' type should be used for lines explicitly labeled for signing.
-   'date' type should be used for fields explicitly labeled for a date.
-   'text' type is for all other general text inputs.
-   All coordinate and dimension values MUST be percentages (0-100), not pixels.

{{#if prompt}}
User's guidance: {{{prompt}}}
{{/if}}

PDF Document for analysis:
{{media url=pdfDataUri}}
`,
});

const detectPdfFieldsFlow = ai.defineFlow(
  {
    name: 'detectPdfFieldsFlow',
    inputSchema: DetectPdfFieldsInputSchema,
    outputSchema: DetectPdfFieldsOutputSchema,
  },
  async (input) => {
    const { output } = await detectionPrompt(input);
    if (!output) {
        throw new Error("The AI model failed to detect any fields in the PDF.");
    }
    return output;
  }
);


export async function detectPdfFields(input: DetectPdfFieldsInput): Promise<DetectPdfFieldsOutput> {
  return detectPdfFieldsFlow(input);
}
