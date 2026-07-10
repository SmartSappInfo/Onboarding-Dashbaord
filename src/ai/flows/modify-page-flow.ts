'use server';

/**
 * @fileOverview An AI flow to modify page structures, update block properties, or generate sections.
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';

const pageBlockSchema = z.object({
  id: z.string(),
  type: z.string(),
  props: z.record(z.unknown()),
});

const pageSectionSchema = z.object({
  id: z.string(),
  type: z.literal('section'),
  props: z.record(z.unknown()),
  blocks: z.array(pageBlockSchema),
});

const ModifyPageInputSchema = z.object({
  userMessage: z.string().describe("The user's instruction or request."),
  selectedBlockId: z.string().nullable().optional().describe("The currently selected block ID in the builder canvas."),
  currentStructure: z.object({
    sections: z.array(pageSectionSchema).default([])
  }).describe("The current layout JSON of the page builder."),
  docContent: z.string().optional().describe('Extracted text from an uploaded document.'),
  docDataUri: z.string().optional().describe('multimodal PDF or Image data URI.'),
  organizationId: z.string().optional(),
  provider: z.string().optional(),
  modelId: z.string().optional(),
});

export type ModifyPageInput = z.infer<typeof ModifyPageInputSchema>;

const ModifyPageOutputSchema = z.object({
  aiSummary: z.string().describe('A brief explanation of what changes were made or recommended.'),
  suggestedAction: z.object({
    type: z.enum(['add_section', 'update_text', 'none']),
    label: z.string().describe('Button label for the user to apply this change (e.g. "Apply Name Change", "Insert Sunset Hero Section")'),
    payload: z.object({
      // For add_section:
      sectionProps: z.object({
        backgroundType: z.enum(['none', 'color', 'image', 'video', 'gradient', 'pattern']).optional(),
        backgroundColor: z.string().optional(),
        gradientFrom: z.string().optional(),
        gradientTo: z.string().optional(),
        gradientAngle: z.number().optional(),
        paddingTop: z.string().optional(),
        paddingBottom: z.string().optional(),
      }).optional(),
      blocks: z.array(z.object({
        id: z.string(),
        type: z.string(),
        props: z.record(z.unknown()),
      })).optional(),

      // For update_text:
      blockId: z.string().optional(),
      props: z.record(z.unknown()).optional(),
    }).optional()
  }).optional()
});

export type ModifyPageOutput = z.infer<typeof ModifyPageOutputSchema>;

const modifyPagePrompt = ai.definePrompt({
  name: 'modifyPagePrompt',
  input: { schema: ModifyPageInputSchema },
  output: { schema: ModifyPageOutputSchema },
  prompt: `You are an expert Frontend Architect and Page Builder AI Assistant. Your job is to help users modify, update, and build landing pages, section cards, and block copy.

### INPUT DATA:
1. User Request: "{{{userMessage}}}"
2. Selected Block ID (if any): "{{selectedBlockId}}"
3. Current Page Layout Structure:
   {{{json currentStructure}}}

--- SOURCE MATERIALS ---
{{#if docContent}}DOCUMENT CONTENT: {{{docContent}}}{{/if}}
{{#if docDataUri}}MULTIMODAL ATTACHMENT: {{media url=docDataUri}}{{/if}}

### DESIGN RULES & STRATEGIES:
1. **Dynamic Content Updates** (type: 'update_text'):
   - If the user asks to modify existing copy (e.g. changing names, descriptions, pricing, text strings, button labels), locate the corresponding block inside 'currentStructure.sections'.
   - Look at the text inside the block properties ('heading', 'subheading', 'content', 'author', 'quote', etc.). If a block matches the user's intent or contains the target text, return an 'update_text' action.
   - Example: If the user says "change Amos Bdoateng to Joseph a do in their testimonial card", scan blocks of type 'testimonial' (or any block containing "Amos Bdoateng"). Find that block's 'id' (e.g. "testimonial-123") and return:
     * 'suggestedAction.type': 'update_text'
     * 'suggestedAction.payload.blockId': the matched block ID
     * 'suggestedAction.payload.props': ONLY the fields that need updating (e.g. { author: "Joseph a do" } or { author: "Joseph a do", quote: "..." }). Preserve other fields or update them as requested.

2. **Add Layout Sections** (type: 'add_section'):
   - If the user asks to create or insert a new section/block (e.g. "Add a hero section", "insert countdown timer", "add testimonials card"), return an 'add_section' action.
   - Generate section properties and the appropriate blocks.
   - Assign unique generated IDs to new blocks (e.g. 'hero-12345678' or 'countdown-12345678').

3. **General Chatter / No Action** (type: 'none'):
   - If the request is a general question, greeting, or does not require structural changes, return 'suggestedAction.type' as 'none'.

4. **Consistency**:
   - Keep design colors, paddings, and alignment consistent with the page theme (e.g. using Tailwind colors, dark/light modes).

5. **AI Summary**:
   - Provide a clear, friendly summary explaining what changes are suggested and why.

Ensure valid, parseable JSON conformant to the output schema.
`,
});

const modifyPageFlow = ai.defineFlow(
  {
    name: 'modifyPageFlow',
    inputSchema: ModifyPageInputSchema,
    outputSchema: ModifyPageOutputSchema,
  },
  async (input) => {
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        const provider = input.provider || 'googleai';
        const modelId = input.modelId || 'gemini-3.5-flash';

        const resolvedModel = await getModel({
          organizationId: input.organizationId,
          provider,
          modelId,
        });

        const generatorAi = resolvedModel.customAi || ai;
        const rendered = await modifyPagePrompt.render(input);
        
        const { output } = await generatorAi.generate({
          model: resolvedModel.modelString,
          ...rendered,
          output: { schema: ModifyPageOutputSchema },
        });

        if (!output) throw new Error("The AI model failed to process page modification.");
        return output;
      } catch (error: unknown) {
        retries++;
        const err = error as { message?: string; status?: number };
        const isRetryable = err.message?.includes('503') ||
                            err.message?.includes('429') ||
                            err.status === 503 ||
                            err.status === 429;

        if (isRetryable && retries < maxRetries) {
          const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
          console.warn(`AI Model Busy (Attempt ${retries}/${maxRetries}). Retrying in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error("The AI page architect service is currently unavailable. Please try again.");
  }
);

export async function modifyPageStructure(input: ModifyPageInput): Promise<ModifyPageOutput> {
  return modifyPageFlow(input);
}
