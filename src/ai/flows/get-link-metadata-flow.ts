'use server';
/**
 * @fileOverview A flow to extract metadata from a URL.
 *
 * - getLinkMetadata - A function that fetches a URL and extracts its metadata.
 * - GetLinkMetadataInput - The input type for the getLinkMetadata function.
 * - GetLinkMetadataOutput - The return type for the getLinkMetadata function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GetLinkMetadataInputSchema = z.object({
  url: z.string().url().describe('The URL to fetch metadata from.'),
});
export type GetLinkMetadataInput = z.infer<typeof GetLinkMetadataInputSchema>;

const GetLinkMetadataOutputSchema = z.object({
  title: z.string().optional().describe('The title of the webpage.'),
  description: z.string().optional().describe('The meta description of the webpage.'),
  imageUrl: z.string().url().optional().describe('The Open Graph (og:image) URL of the webpage.'),
});
export type GetLinkMetadataOutput = z.infer<typeof GetLinkMetadataOutputSchema>;


const metadataExtractionPrompt = ai.definePrompt({
    name: 'getLinkMetadataPrompt',
    input: { schema: z.object({ htmlContent: z.string() }) },
    output: { schema: GetLinkMetadataOutputSchema },
    prompt: `You are an expert at parsing HTML to extract metadata. From the following HTML content, extract the page title, the meta description, and the Open Graph image URL (og:image).

If a value is not present, you can omit it.

HTML Content:
\`\`\`html
{{{htmlContent}}}
\`\`\`
`,
});


const getLinkMetadataFlow = ai.defineFlow(
  {
    name: 'getLinkMetadataFlow',
    inputSchema: GetLinkMetadataInputSchema,
    outputSchema: GetLinkMetadataOutputSchema,
  },
  async ({ url }) => {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' } });
        if (!response.ok) {
            console.error(`Failed to fetch URL: ${response.statusText}`);
            return {};
        }
        const htmlContent = await response.text();
        
        // Limit the content size to avoid oversized LLM requests
        const truncatedContent = htmlContent.substring(0, 20000);

        const { output } = await metadataExtractionPrompt({ htmlContent: truncatedContent });
        
        return output || {};

    } catch (error) {
        console.error('Error fetching or parsing URL metadata:', error);
        return {};
    }
  }
);


export async function getLinkMetadata(input: GetLinkMetadataInput): Promise<GetLinkMetadataOutput> {
  return getLinkMetadataFlow(input);
}
