'use server';

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';
import { getLinkMetadata } from './get-link-metadata-flow';

const GenerateThumbnailInputSchema = z.object({
  prompt: z.string().describe('User instructions or core topic description.'),
  videoUrl: z.string().url().optional().describe('An optional video URL to extract context from.'),
  subjectImageUrls: z.array(z.string().url()).optional().describe('List of selected image asset URLs to position as subjects on the canvas.'),
  templateId: z.string().optional().describe('Optional ID of a template layout formula to enforce.'),
});
export type GenerateThumbnailInput = z.infer<typeof GenerateThumbnailInputSchema>;

const CanvasElementSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'rect', 'circle', 'arrow']),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  zIndex: z.number(),
  rotation: z.number().optional(),
  opacity: z.number().optional(),
  
  // Text Specific
  text: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  fill: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  textStrokeColor: z.string().optional(),
  textStrokeWidth: z.number().optional(),
  badgeColor: z.string().optional(),
  badgeOpacity: z.number().optional(),
  
  // Image Specific
  imageSrc: z.string().optional(),
  imageOutlineColor: z.string().optional(),
  imageOutlineWidth: z.number().optional(),
});

const GenerateThumbnailOutputSchema = z.object({
  backgroundColor: z.string(),
  backgroundGradient: z.object({
    type: z.enum(['linear', 'radial']),
    angle: z.number().optional(),
    colors: z.array(z.string()),
  }).optional(),
  elements: z.array(CanvasElementSchema),
  explanation: z.string().describe('Explanation of the CTR optimization decisions.'),
});
export type GenerateThumbnailOutput = z.infer<typeof GenerateThumbnailOutputSchema>;

const thumbnailArchitectPrompt = ai.definePrompt({
  name: 'thumbnailArchitectPrompt',
  input: { schema: z.object({
    prompt: z.string(),
    videoContext: z.string(),
    subjectImageUrls: z.array(z.string()).optional(),
    templateId: z.string().optional()
  })},
  output: { schema: GenerateThumbnailOutputSchema },
  prompt: `You are an elite, highly experienced YouTube CTR Designer (Thumbnail Architect). 
Your task is to design a high-converting 1280x720 thumbnail layout by outputting a JSON schema for a responsive coordinates canvas.

### DESIGN STRATEGY RULES:
1. **The 3-Second Rule**: Make sure the visual hook is instantly clear.
2. **Curiosity Gap Hook**: Create a punchy hook text (typically 2-3 words, max 4 words). Do NOT repeat the video title exactly. Choose text like: "DON'T DO THIS!", "FINALLY!", "SECRET REVEALED", "STOP WAITING".
3. **Typography**: Use bold, fat fonts ('Impact', 'Montserrat', 'Outfit', 'Arial Black'). Render in uppercase.
4. **Contrast & Glows**: Always configure 'textStrokeColor' (e.g., black '#000000') and 'textStrokeWidth' (3 to 6 pixels) for maximum readability.
5. **Subject Placement**: Place subject images on one side (typically right side, x: 60-65%, y: 10-15%, width: 30-35%, height: 70-80%) and apply 'imageOutlineColor' (e.g., yellow '#facc15' or neon green) and 'imageOutlineWidth' (4 to 8 pixels) to make them pop!
6. **Dead Zone Avoidance**: Never place vital text, logos, or subjects in the bottom-right corner (x: 80-100%, y: 75-100%), as the YouTube video duration timestamp overlays here.
7. **Shapes/Arrows**: Add a bright yellow/red arrow element pointing from the text area to the subject to guide attention.

### USER INPUTS:
- User Prompt: "{{prompt}}"
- Context (Video Metadata): "{{videoContext}}"
- User Subject Images: [{{#each subjectImageUrls}}"{{this}}",{{/each}}]
- Enforced Template Theme: "{{templateId}}"

Construct a list of elements positioned in relative coordinates (0 to 100) on a 16:9 canvas. Ensure background and outline colors are highly vibrant and complementary. Output the complete JSON state.`,
});

const generateThumbnailFlow = ai.defineFlow(
  {
    name: 'generateThumbnailFlow',
    inputSchema: GenerateThumbnailInputSchema,
    outputSchema: GenerateThumbnailOutputSchema,
  },
  async (input) => {
    let videoContext = '';
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
    const rendered = await thumbnailArchitectPrompt.render({
      prompt: input.prompt,
      videoContext,
      subjectImageUrls: input.subjectImageUrls,
      templateId: input.templateId,
    });

    let result;
    try {
      result = await generatorAi.generate({
        model: resolvedModel.modelString,
        ...rendered,
        output: { schema: GenerateThumbnailOutputSchema },
      });
    } catch (err) {
      if (!fallbackUsed) {
        console.warn('Anthropic generation failed, triggering Gemini failover...', err);
        const backupModel = await getModel({
          provider: 'google-genai',
          modelId: 'gemini-2.5-flash',
        });
        const backupAi = backupModel.customAi || ai;
        result = await backupAi.generate({
          model: backupModel.modelString,
          ...rendered,
          output: { schema: GenerateThumbnailOutputSchema },
        });
      } else {
        throw err;
      }
    }

    const { output } = result;

    if (!output) throw new Error("Thumbnail Architect failed to generate composition.");
    return output;
  }
);

export async function generateThumbnailDesign(input: GenerateThumbnailInput): Promise<GenerateThumbnailOutput> {
  return generateThumbnailFlow(input);
}
