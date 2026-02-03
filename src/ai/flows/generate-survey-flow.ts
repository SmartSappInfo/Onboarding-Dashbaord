
'use server';
/**
 * @fileOverview An AI flow to generate a survey from various content sources.
 *
 * - generateSurvey - A function that takes text or a URL and generates a survey structure.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ------ Zod Schemas for the Survey Structure ------

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
    title: z.string().describe('A concise and engaging title for the survey based on the provided content.'),
    description: z.string().describe('A brief introduction or instruction for the survey respondents, derived from the content.'),
    elements: z.array(elementSchema).describe("An array of questions, layout, and logic blocks structured from the content. Ensure IDs are unique for each element (e.g., 'el_timestamp_random')."),
    thankYouTitle: z.string().describe('A friendly title for the "Thank You" page shown after submission.'),
    thankYouDescription: z.string().describe('A polite message for the "Thank You" page.'),
    bannerImageQuery: z.string().describe('A 1-2 word search query for finding a suitable banner image from a media library. E.g., "feedback survey" or "event registration".'),
});
export type GenerateSurveyOutput = z.infer<typeof GenerateSurveyOutputSchema>;


// ------ The Genkit Flow ------

const generationPrompt = ai.definePrompt({
    name: 'surveyGenerationPrompt',
    input: { schema: z.object({ sourceText: z.string() }) },
    output: { schema: GenerateSurveyOutputSchema },
    prompt: `You are an expert at creating well-structured surveys. Analyze the following text content and convert it into a complete survey object.

    Follow these instructions carefully:
    1.  **Analyze Content**: Read the text and identify all potential survey questions, sections, and introductory/concluding text.
    2.  **Generate Title and Description**: Create a concise 'title' and a helpful 'description' for the survey based on the overall context of the text.
    3.  **Structure Elements**:
        *   Convert the identified questions into a JSON array for the 'elements' field.
        *   For each question, determine the most appropriate 'type' (e.g., 'text', 'multiple-choice', 'rating', 'yes-no').
        *   If options are provided for a question, populate the 'options' array.
        *   Use 'heading' or 'section' layout blocks to group related questions logically. A 'section' can have a title and a description.
        *   Generate a unique 'id' for every single element in the 'elements' array. A good format is 'el_timestamp_random' (e.g., 'el_17123456_a9b8c7').
        *   Set 'isRequired' to true for questions that seem mandatory. Be conservative.
    4.  **Generate Thank You Message**: Create a suitable 'thankYouTitle' and 'thankYouDescription' for when the user completes the survey.
    5.  **Suggest Banner Image**: Provide a simple, 2-3 word 'bannerImageQuery' that could be used to find a relevant background image for the survey banner.
    
    Source Text to be converted into a survey:
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
                if (!response.ok) {
                    throw new Error(`Failed to fetch URL: ${response.statusText}`);
                }
                const htmlContent = await response.text();
                // Send the full HTML to the LLM for parsing.
                sourceText = htmlContent;
            } catch (e: any) {
                console.error("URL fetch failed:", e);
                throw new Error("Could not retrieve content from the provided URL.");
            }
        }
        
        const { output } = await generationPrompt({ sourceText });

        if (!output) {
            throw new Error("The AI model failed to generate a survey structure.");
        }

        return output;
    }
);


// The exported wrapper function that client components will call.
export async function generateSurvey(input: GenerateSurveyInput): Promise<GenerateSurveyOutput> {
    return generateSurveyFlow(input);
}
