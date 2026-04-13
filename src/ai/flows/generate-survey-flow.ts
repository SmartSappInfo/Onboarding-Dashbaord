'use server';
/**
 * @fileOverview An AI flow to generate an intelligent, scored survey from various content sources.
 */

import { ai, getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import { z } from 'genkit';

// ------ Zod Schemas for the Result Structure ------

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

// ------ Zod Schemas for the Survey Elements ------

const questionSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['text', 'long-text', 'yes-no', 'multiple-choice', 'checkboxes', 'dropdown', 'rating', 'date', 'time', 'file-upload']),
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

// ------ Input and Output Schemas for the Flow ------

const GenerateSurveyInputSchema = z.object({
  sourceType: z.enum(['text', 'url']),
  content: z.string(),
  organizationId: z.string().optional(),
  provider: z.string().optional().default('openrouter'),
  modelId: z.string().optional().default('openrouter/free'),
});
export type GenerateSurveyInput = z.infer<typeof GenerateSurveyInputSchema>;

const GenerateSurveyOutputSchema = z.object({
    title: z.string().describe('A concise and engaging title for the survey.'),
    description: z.string().describe('A brief introduction for the survey respondents.'),
    elements: z.array(elementSchema).describe("Questions and layout blocks. For 'multiple-choice', 'dropdown', 'checkboxes', or 'yes-no', YOU MUST include suggested point values in 'optionScores', 'yesScore', or 'noScore' to enable scoring."),
    scoringEnabled: z.boolean().optional().default(false).describe('True if the survey behaves like an assessment or quiz.'),
    maxScore: z.number().optional().default(0).describe('The total possible points if everything is answered perfectly.'),
    resultRules: z.array(resultRuleSchema).optional().default([]).describe('Logic to map score ranges to specific outcome pages.'),
    resultPages: z.array(resultPageSchema).optional().default([]).describe('Complete landing pages for the outcomes.'),
    thankYouTitle: z.string().optional().default("Thank you!"),
    thankYouDescription: z.string().optional().default("We appreciate your feedback."),
    bannerImageQuery: z.string().optional().default("background pattern"),
});
export type GenerateSurveyOutput = z.infer<typeof GenerateSurveyOutputSchema>;

// ------ The Genkit Flow ------

const PROMPT_TEMPLATE = `You are an expert at creating high-conversion, intelligent surveys and assessments. 
Analyze the provided text and convert it into a fully functional, scored survey engine.

### MISSION:
If the content suggests an assessment, quiz, or qualification flow, ENABLE SCORING and build high-fidelity OUTCOME PAGES.

### GUIDELINES:
1. **Scoring Logic**:
   - Assign points to 'yes-no', 'multiple-choice', 'dropdown', and 'checkboxes'.
   - Ensure the 'maxScore' is the sum of all highest-possible points.
2. **Outcome Design**:
   - Create 2-3 logical result buckets (e.g., Low, Medium, High).
   - For each bucket, design a 'resultPage' using blocks.
   - EVERY result page should include a 'score-card' block at the top.
   - Use 'heading', 'text', and 'button' blocks to provide personalized advice or next steps based on that score level.
3. **Structure Elements**:
   - Use 'section' blocks with 'renderAsPage: true' to group questions.
   - Use 'validateBeforeNext: true' on sections that are critical for logic.
   - Provide a 'stepperTitle' for every section (e.g., "Entity Profile", "Risk Assessment").
   - For 'heading' blocks, choose an appropriate 'variant' (h1, h2, or h3).
4. **Logic Blocks**:
   - Use 'logic' blocks to skip irrelevant questions based on previous answers if the content allows.

Source Text:
\`\`\`text
{{{sourceText}}}
\`\`\`
`;

const generateSurveyFlow = ai.defineFlow(
    {
        name: 'generateSurveyFlow',
        inputSchema: GenerateSurveyInputSchema,
        outputSchema: GenerateSurveyOutputSchema,
    },
    async (input) => {
        let sourceText = input.content;

        if (input.sourceType === 'url') {
            try {
                const response = await fetch(input.content);
                if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
                sourceText = await response.text();
            } catch (e: any) {
                console.error("URL fetch failed:", e);
                throw new Error("Could not retrieve content from the provided URL.");
            }
        }
        
        // Bypass genkitx-openai-compatible entirely for OpenRouter due to slash mutation bug
        if (input.provider === 'openrouter') {
            // Retrieve OpenRouter API key manually
            let apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey && input.organizationId) {
                const orgDoc = await adminDb.collection('organizations').doc(input.organizationId).get();
                apiKey = orgDoc.data()?.openRouterApiKey;
            }
            if (!apiKey) throw new Error("OpenRouter API key is missing. Please add it to your organization settings.");

            const fullPrompt = `${PROMPT_TEMPLATE.replace('{{{sourceText}}}', sourceText)}\n\nYou MUST return raw, strictly well-formed JSON matching the exact schema requirements defined. Do not use markdown wrappers.`;
            
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: input.modelId || 'openrouter/free',
                    response_format: { type: "json_object" },
                    messages: [
                        { role: 'system', content: 'You are an AI generating exactly formatted JSON mapping back to strict schema constraints.' },
                        { role: 'user', content: fullPrompt }
                    ]
                })
            });

            if (!response.ok) throw new Error(`OpenRouter API refused generation: ${response.statusText}`);
            const data = await response.json();
            const contentString = data.choices?.[0]?.message?.content;
            if (!contentString) throw new Error("OpenRouter returned an empty payload.");

            try {
                // Manually execute schema validation 
                let parsedJSON = JSON.parse(contentString.replace(/```json/g, '').replace(/```/g, '').trim());
                return GenerateSurveyOutputSchema.parse(parsedJSON);
            } catch (e: any) {
                console.error("Failed to parse OpenRouter structured output:", e);
                throw new Error("OpenRouter hallucinated invalid JSON schema payload layout. Generation aborted.");
            }
        }

        // --- Native Genkit Path for Gemini and OpenAI ---
        const model = await getModel({
            organizationId: input.organizationId,
            provider: input.provider || 'googleai',
            modelId: input.modelId || 'gemini-3-flash-preview',
        });

        const { output } = await ai.generate({
            model,
            prompt: PROMPT_TEMPLATE.replace('{{{sourceText}}}', sourceText),
            output: { schema: GenerateSurveyOutputSchema }
        });

        if (!output) throw new Error("The AI model failed to generate a survey structure.");

        return output;
    }
);

export async function generateSurvey(input: GenerateSurveyInput): Promise<GenerateSurveyOutput> {
    return generateSurveyFlow(input);
}
