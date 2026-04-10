
'use server';
/**
 * @fileOverview An AI flow to modify an existing survey structure based on user chat instructions.
 *
 * - modifySurvey - A function that takes current survey state and a message to produce an updated state.
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';

// Redefining schemas for the prompt to ensure the model has full context of the structure
const resultBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['heading', 'text', 'image', 'video', 'button', 'quote', 'divider', 'score-card']),
  title: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  link: z.string().optional(),
  openInNewTab: z.boolean().optional(),
  variant: z.enum(['h1', 'h2', 'h3']).optional(),
  style: z.object({
    textAlign: z.enum(['left', 'center', 'right']).optional(),
    variant: z.string().optional(),
    animate: z.boolean().optional(),
  }).optional(),
});

const resultPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  blocks: z.array(resultBlockSchema),
});

const resultRuleSchema = z.object({
  id: z.string(),
  label: z.string(),
  minScore: z.number(),
  maxScore: z.number(),
  priority: z.number(),
  pageId: z.string(),
});

const questionSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['text', 'long-text', 'yes-no', 'multiple-choice', 'checkboxes', 'dropdown', 'rating', 'date', 'time', 'file-upload', 'email', 'phone']),
  options: z.array(z.string()).optional(),
  allowOther: z.boolean().optional(),
  isRequired: z.boolean(),
  hidden: z.boolean().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.any().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  enableScoring: z.boolean().optional(),
  optionScores: z.array(z.number()).optional(),
  yesScore: z.number().optional(),
  noScore: z.number().optional(),
  autoAdvance: z.boolean().optional(),
});

const layoutBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['heading', 'description', 'divider', 'image', 'video', 'audio', 'document', 'embed', 'section']),
  title: z.string().optional(),
  text: z.string().optional(),
  url: z.string().url().optional(),
  html: z.string().optional(),
  hidden: z.boolean().optional(),
  description: z.string().optional(),
  renderAsPage: z.boolean().optional(),
  validateBeforeNext: z.boolean().optional(),
  stepperTitle: z.string().optional(),
  variant: z.enum(['h1', 'h2', 'h3']).optional(),
});

const logicActionSchema = z.object({
  type: z.enum(['jump', 'require', 'show', 'hide', 'disableSubmit']),
  targetElementId: z.string().optional(),
  targetElementIds: z.array(z.string()).optional(),
});

const logicBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['logic']),
  rules: z.array(z.object({
    sourceQuestionId: z.string(),
    operator: z.enum(['isEqualTo', 'isNotEqualTo', 'contains', 'doesNotContain', 'startsWith', 'doesNotStartWith', 'endsWith', 'doesNotEndWith', 'isEmpty', 'isNotEmpty', 'isGreaterThan', 'isLessThan']),
    targetValue: z.any().optional(),
    action: logicActionSchema,
  })),
});

const elementSchema = z.union([questionSchema, layoutBlockSchema, logicBlockSchema]);

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
  modelId: z.string().optional().default('gemini-1.5-flash'),
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
        backgroundPattern: z.enum(['none', 'dots', 'grid', 'circuit', 'topography', 'cubes', 'gradient']).optional(),
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
2. **Logic Updates**: If you add or remove questions, update any 'logic' blocks or 'resultRules' that might be affected.
3. **Scoring**: If 'scoringEnabled' is true (or if the content suggests an assessment), ensure questions have appropriate scores and 'maxScore' is updated.
4. **Unique IDs**: Generate unique, descriptive IDs for any new elements (e.g., 'q_satisfaction_level', 'sec_pricing').
5. **Layouts**: Use appropriate variants for headings (h1, h2, h3).
6. **Multimodal Analysis**: If a PDF Data URI is provided, use it for deep discovery of fields and structure.
7. **Entity Focus**: Always refer to the institution/campus as an "Entity". Avoid terms like "School" unless it's part of the official name.
8. **No Hallucinations**: Only change what is requested or what is logically necessary to support the request.

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
                // Resolve dynamic model based on organization and user preference
                const resolvedModel = await getModel({
                    organizationId: input.organizationId,
                    provider: input.provider || 'googleai',
                    modelId: input.modelId || 'gemini-1.5-flash',
                });

                const { output } = await modifyPrompt(input, { model: resolvedModel });
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
