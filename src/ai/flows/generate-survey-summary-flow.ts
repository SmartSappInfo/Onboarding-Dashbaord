
'use server';
/**
 * @fileOverview An AI flow to generate a summary of survey results.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateSurveySummaryInputSchema = z.object({
  survey: z.any().describe('The survey object, including title, description, and elements array.'),
  responses: z.array(z.any()).describe('An array of survey response objects.'),
});
export type GenerateSurveySummaryInput = z.infer<typeof GenerateSurveySummaryInputSchema>;


const GenerateSurveySummaryOutputSchema = z.object({
    summary: z.string().describe('A professional, insightful summary of the survey results, formatted as a simple HTML string.'),
});
export type GenerateSurveySummaryOutput = z.infer<typeof GenerateSurveySummaryOutputSchema>;


const summaryGenerationPrompt = ai.definePrompt({
    name: 'generateSurveySummaryPrompt',
    input: { schema: z.object({
        title: z.string(),
        description: z.string(),
        elementsJson: z.string(),
        responsesJson: z.string(),
        scoringEnabled: z.boolean(),
        maxScore: z.number().optional(),
    }) },
    output: { schema: GenerateSurveySummaryOutputSchema },
    prompt: `You are a professional data analyst tasked with creating a concise and actionable summary of survey results. Your summary must be brief, precise, and help inform decisions.

    --- CONTEXT ---
    Title: {{{title}}}
    Description: {{{description}}}
    Scoring Enabled: {{{scoringEnabled}}}
    {{#if scoringEnabled}}
    Max Possible Score: {{{maxScore}}}
    {{/if}}

    --- SURVEY STRUCTURE (Elements) ---
    \`\`\`json
    {{{elementsJson}}}
    \`\`\`

    --- RESPONSES ---
    \`\`\`json
    {{{responsesJson}}}
    \`\`\`

    --- TASK ---
    Please provide a high-level summary of the results. 
    {{#if scoringEnabled}}
    SINCE SCORING IS ENABLED: 
    1. Analyze the distribution of scores across all respondents.
    2. Identify which "Result Rules" (outcomes) were most common based on the response scores.
    3. Synthesize how these performance metrics relate to the survey's intended goals.
    {{/if}}

    Your summary MUST:
    1.  Start with a brief overview stating the total number of responses.
    2.  Synthesize the data to identify 1-2 most critical, non-obvious findings that someone might easily miss.
    3.  Conclude with a bulleted list of 3-5 actionable insights or key takeaways for the survey creator.
    4.  Format your response in simple, clean HTML for readability. Use headings (e.g., <h2>), paragraphs (<p>), bold text (<strong>), and unordered lists (<ul> with <li>). Use blockquotes (<blockquote>) to highlight key statistics or findings. Ensure each paragraph, list item, and heading is enclosed in its own tag to ensure proper spacing. Do not use complex HTML, inline styles, or <style> tags.
    `,
});

const generateSurveySummaryFlow = ai.defineFlow(
    {
        name: 'generateSurveySummaryFlow',
        inputSchema: GenerateSurveySummaryInputSchema,
        outputSchema: GenerateSurveySummaryOutputSchema,
    },
    async ({ survey, responses }) => {
        const surveyElementsJson = JSON.stringify(survey.elements, null, 2);
        const responsesJson = JSON.stringify(responses, null, 2);
        
        const promptInput = {
            title: survey.title,
            description: survey.description,
            elementsJson: surveyElementsJson,
            responsesJson: responsesJson,
            scoringEnabled: !!survey.scoringEnabled,
            maxScore: survey.maxScore,
        };

        const { output } = await summaryGenerationPrompt(promptInput);

        if (!output) {
            throw new Error("The AI model failed to generate a summary.");
        }

        return output;
    }
);

export async function generateSurveySummary(input: GenerateSurveySummaryInput): Promise<GenerateSurveySummaryOutput> {
    return generateSurveySummaryFlow(input);
}
