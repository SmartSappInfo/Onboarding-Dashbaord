
'use server';
/**
 * @fileOverview An AI flow to modify an existing survey structure based on user chat instructions.
 *
 * - modifySurvey - A function that takes current survey state and a message to produce an updated state.
 * 
 * Uses shared schemas from @/ai/schemas/survey-schemas.ts for alignment with types.ts.
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';
import {
  questionSchema,
  layoutBlockSchema,
  logicBlockSchema,
  elementSchema,
  resultBlockSchema,
  resultPageSchema,
  resultRuleSchema,
  BACKGROUND_PATTERNS,
} from '@/ai/schemas/survey-schemas';

const ModifySurveyInputSchema = z.object({
  userMessage: z.string().describe('The user\'s request for changes.'),
  docContent: z.string().optional().describe('Extracted text from an uploaded document.'),
  docDataUri: z.string().optional().describe('multimodal PDF data URI.'),
  docUrl: z.string().url().optional().describe('URL of the document in media library.'),
  sourceUrl: z.string().url().optional().describe('A webpage URL to analyze for survey content.'),
  currentSurvey: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    elements: z.array(z.any()).default([]),
    scoringEnabled: z.boolean().optional(),
    maxScore: z.number().optional(),
    resultRules: z.array(z.any()).optional(),
    resultPages: z.array(z.any()).optional(),
    // Metadata and Styling
    backgroundColor: z.string().optional(),
    backgroundPattern: z.string().optional(),
    patternColor: z.string().optional(),
    logoUrl: z.string().optional(),
    bannerImageUrl: z.string().optional(),
    videoUrl: z.string().optional(),
    videoThumbnailUrl: z.string().optional(),
    videoCaption: z.string().optional(),
    thankYouTitle: z.string().optional(),
    thankYouDescription: z.string().optional(),
    startButtonText: z.string().optional(),
    showCoverPage: z.boolean().optional(),
    showSurveyTitles: z.boolean().optional(),
  }),
  organizationId: z.string().optional(),
  provider: z.string().optional().default('googleai'),
  modelId: z.string().optional().default('gemini-3-flash-preview'),
});
export type ModifySurveyInput = z.infer<typeof ModifySurveyInputSchema>;

const ModifySurveyOutputSchema = z.object({
    updatedSurvey: z.object({
        title: z.string(),
        description: z.string(),
        elements: z.array(elementSchema),
        scoringEnabled: z.boolean(),
        maxScore: z.number(),
        resultRules: z.array(resultRuleSchema),
        resultPages: z.array(resultPageSchema),
        // Preserved Metadata and Styling
        backgroundColor: z.string().optional(),
        backgroundPattern: z.enum(BACKGROUND_PATTERNS).optional(),
        patternColor: z.string().optional(),
        logoUrl: z.string().optional(),
        bannerImageUrl: z.string().optional(),
        videoUrl: z.string().optional(),
        videoThumbnailUrl: z.string().optional(),
        videoCaption: z.string().optional(),
        thankYouTitle: z.string().optional(),
        thankYouDescription: z.string().optional(),
        startButtonText: z.string().optional(),
        showCoverPage: z.boolean().optional(),
        showSurveyTitles: z.boolean().optional(),
    }),
    aiSummary: z.string().describe('A brief explanation of what changes were made.'),
});
export type ModifySurveyOutput = z.infer<typeof ModifySurveyOutputSchema>;

const modifyPrompt = ai.definePrompt({
    name: 'modifySurveyPrompt',
    input: { schema: ModifySurveyInputSchema },
    output: { schema: ModifySurveyOutputSchema },
    prompt: `You are an expert Survey Architect and Institutional Analyst. You help users refine their surveys through conversation and document analysis.
    
We are building specifically for "Entities" (Institutions, Campuses, Hubs).

### YOUR TASK:
Review the current survey structure (if any) and the user's request. You may also be provided with content from an uploaded document (Docx, Txt, PDF) or a URL. 

If this is a NEW survey (empty current state), your primary goal is to COMPOSE a complete, functional survey structure from the provided materials.

### RULES:
1. **Consistency**: Ensure new elements match professional standards and logical conventions.
2. **Logic Updates**: Every logic block MUST have \`type: "logic"\`. Every rule MUST specify a valid \`targetElementId\`. Place logic blocks immediately after their source questions. Implement "Negative Exclusion" for follow-ups (e.g., hide the "Why?" question if the answer is "No").
   - Example: \`{"type": "hide", "targetElementId": "q_next_field"}\` — NEVER leave \`targetElementId\` empty.
3. **Scoring**: If 'scoringEnabled' is true (or if the content suggests an assessment), ensure questions have appropriate scores and 'maxScore' is updated.
4. **Unique IDs**: Generate unique, descriptive IDs for any new elements (e.g., 'q_satisfaction_level', 'sec_pricing').
5. **Layouts**: Use appropriate variants for headings (h1, h2, h3).
6. **Multimodal Analysis**: If a PDF Data URI is provided, use it for deep discovery of fields and structure.
7. **Entity Focus**: Always refer to the institution/campus as an "Entity". Avoid terms like "School" unless it's part of the official name.
8. **Modern Controls**: 
   - Use \`email\` and \`phone\` types for contact information.
   - For \`multiple-choice\` and \`checkboxes\`, use \`allowOther: true\` if the list is not exhaustive.
9. **Faithful Extraction**: When creating elements from text, include EVERY option provided. If "Other" is listed, use the \`allowOther: true\` field instead of adding it to the options list.
10. **Outcome Communication**: Use \`resultPages\` for scored outcomes. If an outcome is significant, set \`emailTemplateId: "email_template_placeholder"\` or \`smsTemplateId: "sms_template_placeholder"\` in the \`resultRule\`.
11. **Required Fields**: Default to \`isRequired: false\` unless the user explicitly asks for a field to be required or it's marked as such in the provided text.
12. **Copy Fidelity**: For instructional or description blocks, follow the source copy EXACTLY. Do not summarize or rephrase.
13. **Paragraphs**: Respect white spaces and carriage returns. Use \`\\n\\n\` to preserve paragraph breaks.
14. **Auto-Advance (STRICT)**: Set \`autoAdvance: false\` for all questions. ONLY set \`autoAdvance: true\` for the LAST question of a section IF AND ONLY IF the following section has \`renderAsPage: true\`.
15. **Order Fidelity**: Maintain the exact sequence of questions provided in the source material or existing state. Do not re-order unless specifically asked.
16. **No Hallucinations**: Only change what is requested or what is logically necessary to support the request.

--- SOURCE MATERIALS ---
{{#if docContent}}DOCUMENT CONTENT: {{{docContent}}}{{/if}}
{{#if sourceUrl}}WEBPAGE CONTENT will be provided via multimodal if available, otherwise analyze the request.{{/if}}
{{#if docDataUri}}MULTIMODAL PDF: {{media url=docDataUri}}{{/if}}

--- CURRENT SURVEY STATE ---
Title: {{{currentSurvey.title}}}
Description: {{{currentSurvey.description}}}
Elements: {{{json currentSurvey.elements}}}
Scoring: {{{currentSurvey.scoringEnabled}}} (Max: {{{currentSurvey.maxScore}}})
Styling: Pattern: {{{currentSurvey.backgroundPattern}}}, Color: {{{currentSurvey.backgroundColor}}}
Media: Video: {{{currentSurvey.videoUrl}}}, Caption: {{{currentSurvey.videoCaption}}}, Banner: {{{currentSurvey.bannerImageUrl}}}
Result Rules: {{{json currentSurvey.resultRules}}}
Result Pages: {{{json currentSurvey.resultPages}}}

--- USER REQUEST ---
"{{{userMessage}}}"
`,
});

const modifySurveyFlow = ai.defineFlow(
    {
        name: 'modifySurveyFlow',
        inputSchema: ModifySurveyInputSchema,
        outputSchema: ModifySurveyOutputSchema,
    },
    async (input) => {
        // If a source URL is provided, try to fetch its text content to supplement the prompt
        if (input.sourceUrl && !input.docContent) {
            try {
                const response = await fetch(input.sourceUrl);
                if (response.ok) {
                    const text = await response.text();
                    input.docContent = text.substring(0, 15000); // Limit to avoid prompt blowup
                }
            } catch (e) {
                console.error("Failed to fetch source URL in flow:", e);
            }
        }

        let retries = 0;
        const maxRetries = 3;
        
        while (retries < maxRetries) {
            try {
                // Resolve the model instance with the correct API key for this organization
                const model = await getModel({
                    organizationId: input.organizationId,
                    provider: input.provider || 'googleai',
                    modelId: input.modelId || 'gemini-3-flash-preview',
                });

                const { output } = await ai.generate({
                    model,
                    prompt: modifyPrompt.render(input),
                    output: { schema: ModifySurveyOutputSchema },
                });
                
                if (!output) throw new Error("The AI model failed to process the request.");
                return output;
            } catch (error: any) {
                retries++;
                // Check for 503 (Service Unavailable) or 429 (Too Many Requests)
                const isRetryable = error.message?.includes('503') || 
                                  error.message?.includes('429') || 
                                  error.status === 503 || 
                                  error.status === 429;

                if (isRetryable && retries < maxRetries) {
                    // Exponential backoff: 1s, 2s, 4s... plus jitter
                    const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
                    console.warn(`AI Model Busy (Attempt ${retries}/${maxRetries}). Retrying in ${Math.round(delay)}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                // If not retryable or max retries reached, throw the error
                throw error;
            }
        }
        throw new Error("The AI service is currently unavailable. Please try again in a few moments.");
    }
);

export async function modifySurvey(input: ModifySurveyInput): Promise<ModifySurveyOutput> {
    return modifySurveyFlow(input);
}
