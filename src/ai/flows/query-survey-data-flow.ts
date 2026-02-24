
'use server';
/**
 * @fileOverview An AI flow to answer a user's natural language query about survey data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const QuerySurveyDataInputSchema = z.object({
  survey: z.any().describe('The survey object, including title, description, and elements array.'),
  responses: z.array(z.any()).describe('An array of survey response objects.'),
  query: z.string().describe('The user\'s natural language query about the data.'),
});
export type QuerySurveyDataInput = z.infer<typeof QuerySurveyDataInputSchema>;


const QuerySurveyDataOutputSchema = z.object({
    answer: z.string().describe('The answer to the user query, formatted as a simple HTML string.'),
});
export type QuerySurveyDataOutput = z.infer<typeof QuerySurveyDataOutputSchema>;


const queryPrompt = ai.definePrompt({
    name: 'querySurveyDataPrompt',
    input: { schema: z.object({
        title: z.string(),
        elementsJson: z.string(),
        responsesJson: z.string(),
        userQuery: z.string(),
        scoringEnabled: z.boolean(),
        maxScore: z.number().optional(),
    }) },
    output: { schema: QuerySurveyDataOutputSchema },
    prompt: `You are an expert data analyst. Your task is to answer a specific question from a user about a given set of survey data.

    --- CONTEXT ---
    Title: {{{title}}}
    Scoring Enabled: {{{scoringEnabled}}}
    {{#if scoringEnabled}}
    Max Possible Score: {{{maxScore}}}
    {{/if}}
    
    --- SURVEY STRUCTURE ---
    \`\`\`json
    {{{elementsJson}}}
    \`\`\`

    --- RESPONSES ---
    \`\`\`json
    {{{responsesJson}}}
    \`\`\`

    --- USER QUERY ---
    "{{{userQuery}}}"

    --- INSTRUCTIONS ---
    Based on the data provided, please provide a clear and concise answer to the user's query.
    {{#if scoringEnabled}}
    - IMPORTANT: Since scoring is enabled, use the scores and result page logic to provide more meaningful context if relevant to the user's question.
    {{/if}}
    - If possible, provide quantitative data (percentages, counts) to support your answer.
    - If the query is about qualitative data (text responses), identify common themes or provide representative examples.
    - Format your response in simple, clean HTML using tags like <p>, <strong>, <ul>, and <blockquote>. Ensure each paragraph, list item, and heading is enclosed in its own tag to ensure proper spacing. Do not use complex HTML, inline styles, or <style> tags.
    `,
});

const querySurveyDataFlow = ai.defineFlow(
    {
        name: 'querySurveyDataFlow',
        inputSchema: QuerySurveyDataInputSchema,
        outputSchema: QuerySurveyDataOutputSchema,
    },
    async ({ survey, responses, query }) => {
        const surveyElementsJson = JSON.stringify(survey.elements, null, 2);
        const responsesJson = JSON.stringify(responses, null, 2);
        
        const promptInput = {
            title: survey.title,
            elementsJson: surveyElementsJson,
            responsesJson: responsesJson,
            userQuery: query,
            scoringEnabled: !!survey.scoringEnabled,
            maxScore: survey.maxScore,
        };

        const { output } = await queryPrompt(promptInput);

        if (!output) {
            throw new Error("The AI model failed to answer the query.");
        }

        return output;
    }
);

export async function querySurveyData(input: QuerySurveyDataInput): Promise<QuerySurveyDataOutput> {
    return querySurveyDataFlow(input);
}
