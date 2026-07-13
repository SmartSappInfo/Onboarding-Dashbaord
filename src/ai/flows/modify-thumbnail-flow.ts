'use server';

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';
import { correctDeadZoneCoordinates } from './generate-thumbnail-flow';
import {
  ModifyThumbnailInputSchema,
  ModifyThumbnailOutputSchema
} from './schemas';

export type ModifyThumbnailInput = z.infer<typeof ModifyThumbnailInputSchema>;
export type ModifyThumbnailOutput = z.infer<typeof ModifyThumbnailOutputSchema>;

const modifyPrompt = ai.definePrompt({
  name: 'modifyPrompt',
  input: {
    schema: z.object({
      backgroundColor: z.string(),
      elementsJson: z.string(),
      instruction: z.string(),
    }),
  },
  output: { schema: ModifyThumbnailOutputSchema },
  prompt: `You are an expert YouTube Thumbnail UI editor.
You are given the current canvas background color: "{{backgroundColor}}".
And the list of active elements currently on the 16:9 canvas:
\`\`\`json
{{elementsJson}}
\`\`\`

The user has given this modification instruction: "{{instruction}}".
Perform the modification strictly following these rules:
1. Preserve existing elements unless the instruction requests deletion or replacement.
2. When styling or repositioning, output coordinates strictly within the 16:9 canvas boundaries (0 to 100).
3. If background colors or typography needs changes, apply high-CTR colors and readable fonts.
4. Keep the output coordinates valid and well-formatted. Return the modified composition.`,
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
      console.warn('Anthropic model failed, trying fallback Gemini model...', err);
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

    // Run dead zone checks and auto-corrections to protect layout CTR
    const correctedElements = await correctDeadZoneCoordinates(output.elements);

    return {
      ...output,
      elements: correctedElements,
    };
  }
);

export async function modifyThumbnailDesign(input: ModifyThumbnailInput): Promise<ModifyThumbnailOutput> {
  return modifyThumbnailFlow(input);
}
