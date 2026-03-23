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
    existingFields: z.array(z.object({
        id: z.string(),
        label: z.string().optional(),
        type: z.string(),
        pageNumber: z.number(),
        position: z.object({ x: z.number(), y: z.number() }),
        dimensions: z.object({ width: z.number(), height: z.number() })
    })).optional().describe("A list of fields already placed by the user to provide context and avoid duplicates."),
});
export type DetectPdfFieldsInput = z.infer<typeof DetectPdfFieldsInputSchema>;

const FieldSuggestionSchema = z.object({
    type: z.enum(['text', 'signature', 'date', 'dropdown', 'phone', 'email', 'time', 'photo']).describe("The type of form field detected."),
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
    isNamingField: z.boolean().optional().describe("Flag this as true if this field is the primary 'Naming' field for the form (the person who the document belongs to)."),
    fontSize: z.number().min(6).max(36).optional().describe("The suggested font size in points, based on the text around the field."),
});


const DetectPdfFieldsOutputSchema = z.object({
  fields: z.array(FieldSuggestionSchema).describe("An array of suggested form fields detected in the PDF."),
});
export type DetectPdfFieldsOutput = z.infer<typeof DetectPdfFieldsOutputSchema>;


const detectionPrompt = ai.definePrompt({
    name: 'detectPdfFieldsPrompt',
    input: { schema: DetectPdfFieldsInputSchema },
    output: { schema: DetectPdfFieldsOutputSchema },
    prompt: `You are an expert document analyst specializing in high-precision form field detection. Analyze the provided PDF and identify all potential interactive fields.

### Rules for Detection:

1.  **Field Types (CRITICAL)**: Correctly identify types as 'text', 'signature', 'date', 'dropdown', 'phone', 'email', 'time', or 'photo'.
    - Use 'phone' for any telephone, mobile, or contact number fields.
    - Use 'email' for email address fields.
    - Use 'signature' for explicit signing lines.
    - Use 'date' for fields labeled for dates (DOB, Today's Date).
    - Use 'time' for time-of-day selection.
    - Use 'photo' for designated photo attachment areas (e.g., passport photo boxes).
    - Use 'dropdown' for fields that suggest multiple choice or have selector icons (arrows).
    - Use 'text' for general alphanumeric inputs.

2.  **Naming & Numbering**: 
    - Create concise labels (e.g., "Parent Name", "Contact No").
    - **REPEAT FIELDS / TABLES**: If multiple lines exist for the same info (e.g., a table or list of students), you MUST number them sequentially: "Student 1 Name", "Student 2 Name", "Student 3 Name", etc.

3.  **Placeholders**:
    - For names: "Type your name here", "Your First Child's Name Here".
    - For IDs: "Enter Your Ghana Card No.", etc.
    - For phone: "eg. 233 20 000 0000".
    - For dropdowns: "Select [Field Name]".

4.  **Required Fields (PRECISION)**: Detect if a field is mandatory based on asterisks (*), bold labels, or explicit text like "(Req)". If a field is essential to the form's purpose (like Name or Signature), mark it as required.

5.  **Key Naming Field**: Identify exactly one 'isNamingField'. This should be the primary name of the person filling the form (usually at the very top).

6.  **Typography Estimation**: Estimate the 'fontSize' (6-36) based on the height of the lines or the surrounding labels. Standard is usually 10-12.

7.  **Coordinates**: Ensure position and dimensions are accurate percentages (0-100) of the page. Align fields perfectly with the lines/boxes on the document.

{{#if existingFields}}
### Context: Continuing Work
The user has already placed some fields. 
1. DO NOT duplicate these fields in your output.
2. Focus on finding the GAPS (missing fields).
Existing Fields:
{{#each existingFields}}
- Label: "{{label}}", Type: {{type}}, Page: {{pageNumber}}, Pos: ({{position.x}}%, {{position.y}}%)
{{/each}}
{{/if}}

{{#if prompt}}
User's specific guidance: {{{prompt}}}
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
