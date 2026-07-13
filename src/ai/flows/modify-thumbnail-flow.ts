'use server';

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';

const ModifyCanvasElementSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'rect', 'circle', 'arrow', 'icon', 'emoji', 'svg']),
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

const ModifyThumbnailInputSchema = z.object({
  elements: z.array(ModifyCanvasElementSchema),
  backgroundColor: z.string(),
  backgroundGradient: z.object({
    type: z.enum(['linear', 'radial']),
    angle: z.number().optional(),
    colors: z.array(z.string()),
  }).optional(),
  instruction: z.string().describe('User text instructions on what to change/edit on the canvas.'),
});
export type ModifyThumbnailInput = z.infer<typeof ModifyThumbnailInputSchema>;

const ModifyThumbnailOutputSchema = z.object({
  backgroundColor: z.string(),
  backgroundGradient: z.object({
    type: z.enum(['linear', 'radial']),
    angle: z.number().optional(),
    colors: z.array(z.string()),
  }).optional(),
  elements: z.array(ModifyCanvasElementSchema),
  explanation: z.string().describe('Explanation of the CTR modifications.'),
});
export type ModifyThumbnailOutput = z.infer<typeof ModifyThumbnailOutputSchema>;

const modifyPrompt = ai.definePrompt({
  name: 'modifyThumbnailPrompt',
  input: { schema: z.object({
    backgroundColor: z.string(),
    elementsJson: z.string(),
    instruction: z.string(),
  })},
  output: { schema: ModifyThumbnailOutputSchema },
  prompt: `You are an expert design assistant. Modify the current canvas configuration based on the user's change instructions.
Preserve elements that aren't mentioned, but modify, move, resize, color, re-style, delete, or create elements based on the instruction.

### CURRENT CANVAS CONFIG:
- Background Color: "{{backgroundColor}}"
- Elements JSON:
\`\`\`json
{{{elementsJson}}}
\`\`\`

### USER INSTRUCTION:
"{{{instruction}}}"

Review current positions (x, y, width, height out of 100), colors, texts, and styles. Make corresponding updates, and output the updated canvas background and elements array.`,
});

const modifyThumbnailFlow = ai.defineFlow(
  {
    name: 'modifyThumbnailFlow',
    inputSchema: ModifyThumbnailInputSchema,
    outputSchema: ModifyThumbnailOutputSchema,
  },
  async (input) => {
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
    
    const elementsJson = JSON.stringify(input.elements, null, 2);
    const rendered = await modifyPrompt.render({
      backgroundColor: input.backgroundColor,
      elementsJson,
      instruction: input.instruction,
    });

    let result;
    try {
      result = await generatorAi.generate({
        model: resolvedModel.modelString,
        ...rendered,
        output: { schema: ModifyThumbnailOutputSchema },
      });
    } catch (err) {
      if (!fallbackUsed) {
        console.warn('Anthropic modification failed, triggering Gemini failover...', err);
        const backupModel = await getModel({
          provider: 'google-genai',
          modelId: 'gemini-2.5-flash',
        });
        const backupAi = backupModel.customAi || ai;
        result = await backupAi.generate({
          model: backupModel.modelString,
          ...rendered,
          output: { schema: ModifyThumbnailOutputSchema },
        });
      } else {
        throw err;
      }
    }

    const { output } = result;

    if (!output) throw new Error("Failed to modify thumbnail elements.");
    return output;
  }
);

export async function modifyThumbnailDesign(input: ModifyThumbnailInput): Promise<ModifyThumbnailOutput> {
  return modifyThumbnailFlow(input);
}
