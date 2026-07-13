'use server';

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';
import { getLinkMetadata } from './get-link-metadata-flow';
import {
  CanvasElementSchema,
  GenerateThumbnailInputSchema,
  GenerateThumbnailOutputSchema,
  TopicAnalysisSchema,
  DesignSchemeSchema
} from './schemas';

export type GenerateThumbnailInput = z.infer<typeof GenerateThumbnailInputSchema>;
export type GenerateThumbnailOutput = z.infer<typeof GenerateThumbnailOutputSchema>;

// Agent 1: Topic Analyst & Copywriter Prompt
const topicAnalystPrompt = ai.definePrompt({
  name: 'topicAnalystPrompt',
  input: { schema: z.object({ prompt: z.string(), videoContext: z.string() }) },
  output: { schema: TopicAnalysisSchema },
  prompt: `You are an elite YouTube CTR Copywriter and Topic Analyst.
Your task is to analyze the user instructions and video description to build a CTR copy strategy:
1. Identify the target audience's demographic profile.
2. Choose the primary emotional trigger (curiosity, fear, desire, urgency).
3. Generate a primary high-converting hook phrase (2-4 words maximum, UPPERCASE, punchy) and 3 alternative options.
Do NOT repeat the video title exactly. Create tension/gap (e.g. "STOP THIS!", "NEVER DO THIS", "FINALLY!").

User Prompt: "{{prompt}}"
Video Context: "{{videoContext}}"`,
});

// Agent 2: Design Scheme Consultant Prompt
const designSchemePrompt = ai.definePrompt({
  name: 'designSchemePrompt',
  input: { schema: TopicAnalysisSchema },
  output: { schema: DesignSchemeSchema },
  prompt: `You are an expert Graphic Designer and Color Theory Consultant.
Given the target audience ("{{targetAudience}}") and CTR Hook ("{{chosenCopy}}"), select a highly vibrant, high-contrast visual palette:
1. Define a background color/gradient that complements the subject.
2. Select a fat, readable headline font family (Montserrat, Impact, Outfit, Arial Black) and a clean subtitle font.
3. Configure a text fill color, high-contrast stroke/outline color (e.g. black outline on yellow text), and a text effect (neon, 3d, gradient, metallic).`,
});

// Agent 3: Layout Planner & CTR Reviewer Prompt
const layoutPlannerPrompt = ai.definePrompt({
  name: 'layoutPlannerPrompt',
  input: {
    schema: z.object({
      strategy: TopicAnalysisSchema,
      design: DesignSchemeSchema,
      subjectImageUrls: z.array(z.string()).optional(),
      templateId: z.string().optional(),
    }),
  },
  output: { schema: GenerateThumbnailOutputSchema },
  prompt: `You are an elite YouTube Thumbnail layout architect.
Given the copy strategy and design styles below, construct the final elements on a 16:9 canvas (coordinates 0 to 100).

### INPUT DETAILS:
- Chosen Copy: "{{strategy.chosenCopy}}"
- Fonts: "{{design.fontHeadline}}" (Headline), "{{design.fontSub}}" (Sub)
- Colors: Text: "{{design.textColor}}", Background: "{{design.backgroundColor}}", Stroke: "{{design.strokeColor}}"
- Text Effect: "{{design.textEffect}}"
- Subject Images: [{{#each subjectImageUrls}}"{{this}}",{{/each}}]
- Enforced Template: "{{templateId}}"

### CANVAS LAYOUT RULES:
1. Position elements relative to the 16:9 canvas dimensions (0-100%).
2. Place the headline text in a prominent, highly readable position (typically left side, x: 5-10%, y: 15-20%, width: 45-50%, height: 25-30%).
3. Place subject images on the opposite side (typically right side, x: 55-60%, y: 10%, width: 35-40%, height: 80%). Apply outline stroke POP glow.
4. Add a guiding arrow pointing from the text area to the subject image to drive attention flow.
5. NEVER place any vital text or logos in the bottom-right corner (x: 80-100%, y: 75-100%) because the YouTube video timestamp overlays here.
6. Return the finalized composition coordinates. Explain your layout choices.`,
});

export async function correctDeadZoneCoordinates(elements: z.infer<typeof CanvasElementSchema>[]): Promise<z.infer<typeof CanvasElementSchema>[]> {
  return elements.map((el) => {
    // Check if element intersects with YouTube timestamp overlay (x > 80 && y > 75)
    const overlapsX = el.x + el.width > 80;
    const overlapsY = el.y + el.height > 75;
    if (overlapsX && overlapsY) {
      // Shift it to the left out of the dead zone
      return {
        ...el,
        x: Math.max(0, 75 - el.width),
      };
    }
    return el;
  });
}

const generateThumbnailFlow = ai.defineFlow(
  {
    name: 'generateThumbnailFlow',
    inputSchema: GenerateThumbnailInputSchema,
    outputSchema: GenerateThumbnailOutputSchema,
  },
  async (input) => {
    let videoContext = 'None';
    if (input.videoUrl) {
      try {
        const metadata = await getLinkMetadata({ url: input.videoUrl });
        videoContext = `Video Title: "${metadata.title || ''}". Description: "${metadata.description || ''}"`;
      } catch (err) {
        console.error('Failed to scrape video link:', err);
      }
    }

    let resolvedModel;
    let fallbackUsed = false;
    try {
      resolvedModel = await getModel({
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet',
      });
    } catch (err) {
      console.warn('Primary Anthropic model config failed, trying fallback Gemini model...', err);
      resolvedModel = await getModel({
        provider: 'google-genai',
        modelId: 'gemini-2.5-flash',
      });
      fallbackUsed = true;
    }

    const generatorAi = resolvedModel.customAi || ai;

    // Step 1: Run Topic Analyst + Copywriter
    const topicOutput = await generatorAi.generate({
      model: resolvedModel.modelString,
      prompt: await topicAnalystPrompt.render({
        prompt: input.prompt,
        videoContext,
      }),
      output: { schema: TopicAnalysisSchema },
    });
    const strategy = topicOutput.output;
    if (!strategy) throw new Error("Topic Analyst failed to build CTR strategy.");

    // Step 2: Run Color & Typography Consultant
    const designOutput = await generatorAi.generate({
      model: resolvedModel.modelString,
      prompt: await designSchemePrompt.render(strategy),
      output: { schema: DesignSchemeSchema },
    });
    const designScheme = designOutput.output;
    if (!designScheme) throw new Error("Design Consultant failed to output styles.");

    // Step 3: Run Layout Planner & CTR Reviewer
    const plannerOutput = await generatorAi.generate({
      model: resolvedModel.modelString,
      prompt: await layoutPlannerPrompt.render({
        strategy,
        design: designScheme,
        subjectImageUrls: input.subjectImageUrls,
        templateId: input.templateId,
      }),
      output: { schema: GenerateThumbnailOutputSchema },
    });

    const finalComposition = plannerOutput.output;
    if (!finalComposition) throw new Error("Layout Planner failed to compose canvas.");

    // Inject dead zone checking and auto-corrections
    const correctedElements = await correctDeadZoneCoordinates(finalComposition.elements);

    return {
      ...finalComposition,
      elements: correctedElements,
      alternativeCopies: strategy.alternativeCopies,
    };
  }
);

export async function generateThumbnailDesign(input: GenerateThumbnailInput): Promise<GenerateThumbnailOutput> {
  return generateThumbnailFlow(input);
}
