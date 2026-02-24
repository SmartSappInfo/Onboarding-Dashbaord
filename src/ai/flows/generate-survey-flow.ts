'use server';
/**
 * @fileOverview An AI flow to generate an intelligent, scored survey from various content sources.
 */

import { ai } from '@/ai/genkit';
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
});
export type GenerateSurveyInput = z.infer<typeof GenerateSurveyInputSchema>;

const GenerateSurveyOutputSchema = z.object({
    title: z.string().describe('A concise and engaging title for the survey.'),
    description: z.string().describe('A brief introduction for the survey respondents.'),
    elements: z.array(elementSchema).describe("Questions and layout blocks. For 'multiple-choice', 'dropdown', 'checkboxes', or 'yes-no', YOU MUST include suggested point values in 'optionScores', 'yesScore', or 'noScore' to enable scoring."),
    scoringEnabled: z.boolean().describe('True if the survey behaves like an assessment or quiz.'),
    maxScore: z.number().describe('The total possible points if everything is answered perfectly.'),
    resultRules: z.array(resultRuleSchema).describe('Logic to map score ranges to specific outcome pages.'),
    resultPages: z.array(resultPageSchema).describe('Complete landing pages for the outcomes.'),
    thankYouTitle: z.string(),
    thankYouDescription: z.string(),
    bannerImageQuery: z.string(),
});
export type GenerateSurveyOutput = z.infer<typeof GenerateSurveyOutputSchema>;

// ------ The Genkit Flow ------

const generationPrompt = ai.definePrompt({
    name: 'surveyGenerationPrompt',
    input: { schema: z.object({ sourceText: z.string() }) },
    output: { schema: GenerateSurveyOutputSchema },
    prompt: `You are an expert at creating high-conversion, intelligent surveys and assessments. 
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
   - Provide a 'stepperTitle' for every section (e.g., "Your Profile", "Risk Assessment").
   - For 'heading' blocks, choose an appropriate 'variant' (h1, h2, or h3).
4. **Logic Blocks**:
   - Use 'logic' blocks to skip irrelevant questions based on previous answers if the content allows.

Source Text:
\`\`\`text
{{{sourceText}}}
\`\`\`
`,
});

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
        
        const { output } = await generationPrompt({ sourceText });
        if (!output) throw new Error("The AI model failed to generate a survey structure.");

        return output;
    }
);

export async function generateSurvey(input: GenerateSurveyInput): Promise<GenerateSurveyOutput> {
    return generateSurveyFlow(input);
}
