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
    summary: z.string().describe('A professional, insightful summary of the survey results, formatted in Markdown.'),
});
export type GenerateSurveySummaryOutput = z.infer<typeof GenerateSurveySummaryOutputSchema>;


const summaryGenerationPrompt = ai.definePrompt({
    name: 'generateSurveySummaryPrompt',
    input: { schema: z.object({
        title: z.string(),
        description: z.string(),
        elementsJson: z.string(),
        responsesJson: z.string(),
    }) },
    output: { schema: GenerateSurveySummaryOutputSchema },
    prompt: `You are a professional data analyst tasked with summarizing survey results.

    Here is the survey structure:
    Title: {{{title}}}
    Description: {{{description}}}
    
    Here are all the survey elements (questions and layout blocks):
    \`\`\`json
    {{{elementsJson}}}
    \`\`\`

    Here are the raw responses collected:
    \`\`\`json
    {{{responsesJson}}}
    \`\`\`

    Please provide a professional, insightful summary of the results. Your summary should:
    1.  Start with a high-level overview stating the total number of responses and the key findings.
    2.  For each significant question, provide a quantitative and qualitative analysis. For example, for multiple-choice questions, give percentages. For text questions, identify common themes or representative quotes.
    3.  Identify any interesting correlations, patterns, or unexpected trends you notice in the data.
    4.  Conclude with a bulleted list of 3-5 actionable insights or key takeaways for the survey creator.
    
    Format your response in simple, clean Markdown for readability. Use headings (#), bold text (**text**), and bullet points (* point). Do not use complex markdown like tables.
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
