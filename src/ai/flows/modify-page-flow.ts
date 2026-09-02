'use server';

/**
 * @fileOverview An AI flow to modify page structures, update block properties, or generate complete multi-section pages.
 *
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - All block types normalized to valid `PageBlockType`s via `normalizeBlockType`.
 * - Supports full-page generation (`generate_page`), multi-section insertion (`add_multiple_sections`),
 *   single section creation (`add_section`), and targeted property updates (`update_text`).
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';
import { normalizeBlockType } from '@/lib/page-builder/registry';
import type { PageBlockType } from '@/lib/types';

const pageBlockSchema = z.object({
  id: z.string(),
  type: z.string(),
  props: z.record(z.unknown()),
  blocks: z.array(z.lazy(() => pageBlockSchema)).optional(),
});

const pageSectionSchema = z.object({
  id: z.string(),
  type: z.literal('section'),
  props: z.record(z.unknown()).default({}),
  blocks: z.array(pageBlockSchema).default([]),
});

const ModifyPageInputSchema = z.object({
  userMessage: z.string().describe("The user's instruction, marketing brief, or copy document."),
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
  aiSummary: z.string().describe('A brief, professional explanation of the page structure, sections, or changes generated.'),
  suggestedAction: z.object({
    type: z.enum(['generate_page', 'add_multiple_sections', 'add_section', 'update_text', 'none']),
    label: z.string().describe('Action button label (e.g. "Generate 17-Section Montessori Page", "Append Hero Section")'),
    payload: z.object({
      // For generate_page:
      pageStructure: z.object({
        sections: z.array(pageSectionSchema),
        header: z.record(z.unknown()).optional(),
        footer: z.record(z.unknown()).optional(),
      }).optional(),

      // For add_multiple_sections:
      sections: z.array(pageSectionSchema).optional(),

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
      blocks: z.array(pageBlockSchema).optional(),

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
  prompt: `You are an elite Frontend Architect and Landing Page Experience Designer.
Your job is to transform copy briefs, school marketing materials, and website structures into high-converting, visually stunning, multi-section landing pages.

### INPUT DATA:
1. User Request / Copy Brief:
{{{userMessage}}}

2. Selected Block ID (if any): "{{selectedBlockId}}"
3. Current Page Layout Structure:
{{{json currentStructure}}}

--- SOURCE MATERIALS ---
{{#if docContent}}DOCUMENT CONTENT: {{{docContent}}}{{/if}}
{{#if docDataUri}}MULTIMODAL ATTACHMENT: {{media url=docDataUri}}{{/if}}

---

### CRITICAL RULES & REGISTERED BLOCK CATALOG:
You MUST ONLY output the following registered block types (using exact lowercase string values in the "type" field):

1. **hero**: Primary banner with headline, subtitle, buttons.
   - Props: { title: string, subtitle: string, align: 'left' | 'center' | 'right', ctaText: string, ctaUrl: string, ctaSecondaryText?: string, ctaSecondaryUrl?: string, gradientText?: boolean, fontSize?: 'md' | 'lg' | 'xl' | '2xl' }
2. **title**: Section title, tagline/eyebrow, and subheadings.
   - Props: { preset: 'section-heading' | 'hero-title' | 'accent-tagline' | 'badge-capsule' | 'elegant-serif' | 'left-accent-border', title: string, tagline?: string, subheading?: string, alignment: 'left' | 'center' | 'right', textColorMode: 'dark' | 'light' }
3. **text**: Body copy, lead paragraphs, quotes, checklists.
   - Props: { content: string (HTML paragraphs like '<p>...</p>' or '<ul><li>...</li></ul>'), preset: 'paragraph' | 'lead' | 'quote' | 'checklist' | 'two-columns', textAlign: 'left' | 'center' | 'right' }
4. **choice_cards**: Grid of persona cards, feature cards, or pillars.
   - Props: { heading: string, columns: '2' | '3' | '4', cards: Array<{ id: string, badgeText?: string, title: string, description: string, gradient?: string, ctaText?: string, ctaHref?: string }> }
5. **step_section**: Step-by-step numbered breakdown or process.
   - Props: { stepNumber: number, heading: string, description: string, accentColor?: string, mediaPosition?: 'top' | 'bottom' | 'left' | 'right' }
6. **procedure_list**: Numbered list of items, guidelines, or admissions steps.
   - Props: { title?: string, steps: string[], imageUrl?: string }
7. **testimonial_grid**: Grid of testimonials / parent reviews.
   - Props: { heading: string, subheading?: string, testimonials: Array<{ id: string, quote: string, author: string, role?: string, rating?: number }> }
8. **testimonial**: Single featured quote or spotlight review.
   - Props: { quote: string, author: string, role?: string, rating?: number }
9. **stats**: Numeric stats, ratios, milestones.
   - Props: { items: Array<{ id: string, value: string, label: string }> }
10. **faq**: Interactive accordion questions and answers.
    - Props: { items: Array<{ id: string, question: string, answer: string }> }
11. **cta**: Standalone action banner with primary/secondary buttons.
    - Props: { label: string, url: string, variant: 'primary' | 'secondary' | 'glow', buttons?: Array<{ id: string, label: string, url: string, variant: 'primary' | 'secondary' | 'glow' }> }
12. **logo_grid**: Partner/trust badges and affiliations.
    - Props: { title?: string, logos: Array<{ id: string, name: string, url?: string, imageUrl?: string }> }
13. **columns**: Multi-column container with nested child blocks.
14. **container**: Card wrapper with padding and background styling.

---

### ACTION DECISION LOGIC:

1. **Full-Page Generation (type: 'generate_page')**:
   - If the user provides a comprehensive multi-section website copy, a 10+ section outline (e.g. Marigold Montessori Hero's Journey), or asks to build a complete homepage, return:
     * 'suggestedAction.type': 'generate_page'
     * 'suggestedAction.label': 'Generate Complete [School/Brand] Website'
     * 'suggestedAction.payload.pageStructure': A complete object with an array of 'sections'.
   - **Visual Rhythm Guidelines for Sections**:
     - Alternate section backgrounds for high contrast:
       * Hero: Warm Sand/Cream ('#FDFBF7' or gradient) or Dark Forest ('#0F172A').
       * Challenge / Problem: Clean White ('#FFFFFF').
       * Guide / Pillars: Light Warm Gray ('#F8FAFC' or '#FBFBFA').
       * Method (Explore, Discover, Master): Clean White ('#FFFFFF') with 'choice_cards'.
       * Transformation: Dark Contrast ('#0F172A') or Amber Tint ('#FFFBEB').
       * Academic Areas: Light Warm Slate ('#F8FAFC') with 6 'choice_cards'.
       * Testimonials: Clean White ('#FFFFFF') with 'testimonial_grid'.
       * Admissions: Light Warm Cream ('#FDFBF7') with 'procedure_list' and 'cta'.
       * Final CTA: Warm Gradient or Emerald / Gold Banner.
     - Each section must have a unique ID (e.g. 'sec-hero', 'sec-challenge', 'sec-guide', 'sec-method', 'sec-academics', 'sec-admissions', etc.).
     - Give each block a unique ID (e.g. 'hero-main', 'title-challenge', 'cards-method', etc.).

2. **Add Multiple Sections (type: 'add_multiple_sections')**:
   - If the user asks to insert a sequence of 2-5 related sections (e.g. "Add a method section and testimonial grid"), return 'add_multiple_sections' with the 'sections' array.

3. **Add Single Section (type: 'add_section')**:
   - If the user asks for a single section (e.g. "Add a countdown timer section"), return 'add_section' with 'sectionProps' and 'blocks'.

4. **Dynamic Text Update (type: 'update_text')**:
   - If the user asks to update copy on an existing block, find the matching block in 'currentStructure' and return 'blockId' and 'props'.

5. **AI Summary**:
   - Provide a clear, inspiring summary highlighting how the layout and narrative flow equip the brand to engage and convert visitors.

Ensure valid, strict JSON conformant to the output schema.
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

        // Defensive normalization: sanitize block types across all generated sections
        if (output.suggestedAction?.payload?.pageStructure?.sections) {
          output.suggestedAction.payload.pageStructure.sections = output.suggestedAction.payload.pageStructure.sections.map(sec => ({
            ...sec,
            blocks: sec.blocks.map(b => ({
              ...b,
              type: normalizeBlockType(b.type) as PageBlockType,
            }))
          }));
        }

        if (output.suggestedAction?.payload?.sections) {
          output.suggestedAction.payload.sections = output.suggestedAction.payload.sections.map(sec => ({
            ...sec,
            blocks: sec.blocks.map(b => ({
              ...b,
              type: normalizeBlockType(b.type) as PageBlockType,
            }))
          }));
        }

        if (output.suggestedAction?.payload?.blocks) {
          output.suggestedAction.payload.blocks = output.suggestedAction.payload.blocks.map(b => ({
            ...b,
            type: normalizeBlockType(b.type) as PageBlockType,
          }));
        }

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

