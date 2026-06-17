
'use server';
/**
 * @fileOverview An AI flow to answer a user's natural language query about survey data.
 */

import { ai, getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import { z } from 'genkit';
import { getBaseUrl } from '@/lib/utils/url-helpers';

const QuerySurveyDataInputSchema = z.object({
  survey: z.any().describe('The survey object, including title, description, and elements array.'),
  responses: z.array(z.any()).describe('An array of survey response objects.'),
  query: z.string().describe('The user\'s natural language query about the data.'),
  organizationId: z.string().optional().describe('The organization ID for API key resolution.'),
  provider: z.string().optional().default('anthropic').describe('The AI provider to use.'),
  modelId: z.string().optional().default('claude-sonnet-4-6').describe('The model ID to use.'),
});
export type QuerySurveyDataInput = z.infer<typeof QuerySurveyDataInputSchema>;

const QuerySurveyDataOutputSchema = z.object({
    answer: z.string().describe('The answer to the user query, formatted as a simple HTML string.'),
});
export type QuerySurveyDataOutput = z.infer<typeof QuerySurveyDataOutputSchema>;

function renderQueryPrompt(input: {
  title: string;
  elementsJson: string;
  responsesJson: string;
  userQuery: string;
  scoringEnabled: boolean;
  maxScore?: number;
}): string {
  let p = `You are an expert data analyst. Your task is to answer a specific question from a user about a given set of survey data.

    --- CONTEXT ---
    Title: ${input.title}
    Scoring Enabled: ${input.scoringEnabled}
`;

  if (input.scoringEnabled && input.maxScore !== undefined) {
    p += `    Max Possible Score: ${input.maxScore}\n`;
  }

  p += `
    --- SURVEY STRUCTURE ---
    \`\`\`json
    ${input.elementsJson}
    \`\`\`

    --- RESPONSES ---
    \`\`\`json
    ${input.responsesJson}
    \`\`\`

    --- USER QUERY ---
    "${input.userQuery}"

    --- INSTRUCTIONS ---
    Based on the data provided, please provide a clear and concise answer to the user's query.
`;

  if (input.scoringEnabled) {
    p += `    - IMPORTANT: Since scoring is enabled, use the scores and result page logic to provide more meaningful context if relevant to the user's question.\n`;
  }

  p += `    - If possible, provide quantitative data (percentages, counts) to support your answer.
    - If the query is about qualitative data (text responses), identify common themes or provide representative examples.
    - Format your response in simple, clean HTML using tags like <p>, <strong>, <ul>, and <blockquote>. Ensure each paragraph, list item, and heading is enclosed in its own tag to ensure proper spacing. Do not use complex HTML, inline styles, or <style> tags.
  `;
  return p;
}

const querySurveyDataFlow = ai.defineFlow(
    {
        name: 'querySurveyDataFlow',
        inputSchema: QuerySurveyDataInputSchema,
        outputSchema: QuerySurveyDataOutputSchema,
    },
    async (input) => {
        const { survey, responses, query: userQuery, organizationId, provider = 'anthropic', modelId = 'claude-sonnet-4-6' } = input;
        const surveyElementsJson = JSON.stringify(survey.elements, null, 2);
        const responsesJson = JSON.stringify(responses, null, 2);
        
        const promptText = renderQueryPrompt({
            title: survey.title,
            elementsJson: surveyElementsJson,
            responsesJson: responsesJson,
            userQuery: userQuery,
            scoringEnabled: !!survey.scoringEnabled,
            maxScore: survey.maxScore,
        });

        // 1. OpenRouter Custom Path
        if (provider === 'openrouter') {
            let apiKey: string | undefined;
            if (organizationId) {
                const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
                if (orgDoc.exists) {
                    apiKey = orgDoc.data()?.openRouterApiKey;
                }
            }

            if (!apiKey) {
                apiKey = process.env.OPENROUTER_API_KEY;
                if (!apiKey) throw new Error('OpenRouter API key is not configured.');
            }

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': getBaseUrl(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: modelId,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: 'You are an AI generating exactly formatted JSON matching the exact schema requirements defined. Every response MUST be a single JSON object with an "answer" string key.' },
                        { role: 'user', content: `${promptText}\n\nYou MUST return raw, well-formed JSON containing a single "answer" key. Do not wrap in markdown blocks.` },
                    ],
                }),
            });

            if (!response.ok) throw new Error(`OpenRouter API refused generation: ${response.statusText}`);
            const data = await response.json();
            const contentString = data.choices?.[0]?.message?.content;
            if (!contentString) throw new Error('OpenRouter returned an empty payload.');

            const parsed = JSON.parse(contentString.replace(/```json/g, '').replace(/```/g, '').trim());
            return QuerySurveyDataOutputSchema.parse(parsed);
        }

        // 2. Native Genkit Path
        const resolvedModel = await getModel({
            organizationId,
            provider,
            modelId,
        });

        const generatorAi = resolvedModel.customAi || ai;

        const { output } = await generatorAi.generate({
            model: resolvedModel.modelString,
            prompt: promptText,
            output: { schema: QuerySurveyDataOutputSchema }
        });

        if (!output) {
            throw new Error("The AI model failed to answer the query.");
        }

        return output;
    }
);

export async function querySurveyData(input: QuerySurveyDataInput): Promise<QuerySurveyDataOutput> {
    return querySurveyDataFlow(input);
}
