
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
    type: z.enum(['text', 'signature', 'date', 'dropdown']).describe("The type of form field detected."),
    pageNumber: z.number().int().min(1).describe("The 1-based page number where the field was found."),
    position: z.object({
        x: z.number().min(0).max(100).describe("The x-coordinate of the top-left corner as a percentage of the page width."),
        y: z.number().min(0).max(100).describe("The y-coordinate of the top-left corner as a percentage of the page height."),
    }),
    dimensions: z.object({
        width: z.number().min(1).max(100).describe("The width of the field as a percentage of the page width."),
        height: z.number().min(1).max(100).describe("The height of the field as a percentage of the page height."),
    }),
    label: z.string().describe("A concise, human-readable label for the field. If multiple fields have the same name (e.g., several 'Student Name' lines), you MUST number them sequentially like 'Student 1 Name', 'Student 2 Name'."),
    placeholder: z.string().optional().describe("A helpful placeholder for the field, e.g., 'Type your name here', 'Your First Child\'s Name Here', or 'eg. 233 20 000 0000'."),
    required: z.boolean().describe("Whether the field is likely required based on visual markers like '*' or explicit text."),
    options: z.array(z.string()).optional().describe("Suggested list of items if the field type is 'dropdown'."),
    isNamingField: z.boolean().optional().describe("Flag this as true if this field is the primary 'Naming' field for the form."),
});


const DetectPdfFieldsOutputSchema = z.object({
  fields: z.array(FieldSuggestionSchema).describe("An array of suggested form fields detected in the PDF."),
});
export type DetectPdfFieldsOutput = z.infer<typeof DetectPdfFieldsOutputSchema>;


const detectionPrompt = ai.definePrompt({
    name: 'detectPdfFieldsPrompt',
    input: { schema: DetectPdfFieldsInputSchema },
    output: { schema: DetectPdfFieldsOutputSchema },
    prompt: `You are an expert document analyst specializing in form field detection. Analyze the provided PDF and identify all potential interactive fields.

### Rules for Detection:

1.  **Field Types**: Correctly identify types as 'text', 'signature', 'date', or 'dropdown'.
    - Use 'signature' for explicit signing lines.
    - Use 'date' for fields labeled for dates.
    - Use 'dropdown' for fields that suggest multiple choice or have selector icons (arrows).
    - Use 'text' for general inputs.

2.  **Naming & Numbering**: 
    - Create concise labels (e.g., "Parent Name", "Contact No").
    - **CRITICAL**: If multiple lines exist for the same info (e.g., several "Student Name" lines), you MUST number them sequentially: "Student 1 Name", "Student 2 Name", etc.

3.  **Placeholders**:
    - For names: "Type your name here", "Your First Child's Name Here", "Your Second Child's Name Here".
    - For IDs: "Enter Your Ghana Card No.", etc.
    - For phone: "eg. 233 20 000 0000".
    - For dropdowns: "Select [Field Name]".

4.  **Dropdown Suggestions**: For 'dropdown' fields, provide a list of context-appropriate 'options' (e.g., Grades, Statuses, or Categories).

5.  **Required Fields**: Detect if a field is mandatory based on asterisks (*) or nearby text.

6.  **Key Naming Field**: Identify exactly one 'isNamingField'. This should be the primary name of the person filling the form (usually at the top).

7.  **Coordinates**: Ensure position and dimensions are accurate percentages (0-100) of the page.

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
