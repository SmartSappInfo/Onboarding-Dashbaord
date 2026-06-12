
'use server';
/**
 * @fileOverview An AI flow to generate a summary of survey results.
 */

import { ai, getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import { z } from 'genkit';
import { getBaseUrl } from '@/lib/utils/url-helpers';

const GenerateSurveySummaryInputSchema = z.object({
  survey: z.any().describe('The survey object, including title, description, and elements array.'),
  responses: z.array(z.any()).describe('An array of survey response objects.'),
  organizationId: z.string().optional().describe('The organization ID for API key resolution.'),
  provider: z.string().optional().default('anthropic').describe('The AI provider to use.'),
  modelId: z.string().optional().default('claude-3-5-sonnet').describe('The model ID to use.'),
});
export type GenerateSurveySummaryInput = z.infer<typeof GenerateSurveySummaryInputSchema>;

const GenerateSurveySummaryOutputSchema = z.object({
    summary: z.string().describe('A professional, insightful summary of the survey results, formatted as a simple HTML string.'),
});
export type GenerateSurveySummaryOutput = z.infer<typeof GenerateSurveySummaryOutputSchema>;

function renderSummaryPrompt(input: {
  title: string;
  description: string;
  elementsJson: string;
  responsesJson: string;
  scoringEnabled: boolean;
  maxScore?: number;
}): string {
  let p = `You are a professional data analyst tasked with creating a concise and actionable summary of survey results. Your summary must be brief, precise, and help inform decisions.

    --- CONTEXT ---
    Title: ${input.title}
    Description: ${input.description}
    Scoring Enabled: ${input.scoringEnabled}
`;

  if (input.scoringEnabled && input.maxScore !== undefined) {
    p += `    Max Possible Score: ${input.maxScore}\n`;
  }

  p += `
    --- SURVEY STRUCTURE (Elements) ---
    \`\`\`json
    ${input.elementsJson}
    \`\`\`

    --- RESPONSES ---
    \`\`\`json
    ${input.responsesJson}
    \`\`\`

    --- TASK ---
    Please provide a high-level summary of the results. 
`;

  if (input.scoringEnabled) {
    p += `    SINCE SCORING IS ENABLED: 
    1. Analyze the distribution of scores across all respondents.
    2. Identify which "Result Rules" (outcomes) were most common based on the response scores.
    3. Synthesize how these performance metrics relate to the survey's intended goals.
`;
  }

  p += `
    Your summary MUST:
    1.  Start with a brief overview stating the total number of responses.
    2.  Synthesize the data to identify 1-2 most critical, non-obvious findings that someone might easily miss.
    3.  Conclude with a bulleted list of 3-5 actionable insights or key takeaways for the survey creator.
    4.  Format your response in simple, clean HTML for readability. Use headings (e.g., <h2>), paragraphs (<p>), bold text (<strong>), and unordered lists (<ul> with <li>). Use blockquotes (<blockquote>) to highlight key statistics or findings. Ensure each paragraph, list item, and heading is enclosed in its own tag to ensure proper spacing. Do not use complex HTML, inline styles, or <style> tags.
  `;
  return p;
}

const generateSurveySummaryFlow = ai.defineFlow(
    {
        name: 'generateSurveySummaryFlow',
        inputSchema: GenerateSurveySummaryInputSchema,
        outputSchema: GenerateSurveySummaryOutputSchema,
    },
    async (input) => {
        const { survey, responses, organizationId, provider = 'anthropic', modelId = 'claude-3-5-sonnet' } = input;
        const surveyElementsJson = JSON.stringify(survey.elements, null, 2);
        const responsesJson = JSON.stringify(responses, null, 2);
        
        const promptText = renderSummaryPrompt({
            title: survey.title,
            description: survey.description || '',
            elementsJson: surveyElementsJson,
            responsesJson: responsesJson,
            scoringEnabled: !!survey.scoringEnabled,
            maxScore: survey.maxScore,
        });

        // 1. OpenRouter Custom Path (if provider === 'openrouter')
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
                        { role: 'system', content: 'You are an AI generating exactly formatted JSON matching the exact schema requirements defined. Every response MUST be a single JSON object with a "summary" string key.' },
                        { role: 'user', content: `${promptText}\n\nYou MUST return raw, well-formed JSON containing a single "summary" key. Do not wrap in markdown blocks.` },
                    ],
                }),
            });

            if (!response.ok) throw new Error(`OpenRouter API refused generation: ${response.statusText}`);
            const data = await response.json();
            const contentString = data.choices?.[0]?.message?.content;
            if (!contentString) throw new Error('OpenRouter returned an empty payload.');

            const parsed = JSON.parse(contentString.replace(/```json/g, '').replace(/```/g, '').trim());
            return GenerateSurveySummaryOutputSchema.parse(parsed);
        }

        // 2. Native Genkit Path (Gemini / OpenAI)
        const resolvedModel = await getModel({
            organizationId,
            provider,
            modelId,
        });

        const generatorAi = resolvedModel.customAi || ai;

        const { output } = await generatorAi.generate({
            model: resolvedModel.modelString,
            prompt: promptText,
            output: { schema: GenerateSurveySummaryOutputSchema }
        });

        if (!output) {
            throw new Error("The AI model failed to generate a summary.");
        }

        return output;
    }
);

export async function generateSurveySummary(input: GenerateSurveySummaryInput): Promise<GenerateSurveySummaryOutput> {
    return generateSurveySummaryFlow(input);
}
