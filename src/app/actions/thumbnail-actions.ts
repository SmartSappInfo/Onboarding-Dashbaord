'use server';

import { generateThumbnailDesign, GenerateThumbnailInput, GenerateThumbnailOutput } from '@/ai/flows/generate-thumbnail-flow';
import { modifyThumbnailDesign, ModifyThumbnailInput, ModifyThumbnailOutput } from '@/ai/flows/modify-thumbnail-flow';
import { generateHookAlternatives, GenerateHooksInput, GenerateHooksOutput } from '@/ai/flows/generate-hooks-flow';

export async function runGenerateThumbnail(input: GenerateThumbnailInput): Promise<GenerateThumbnailOutput> {
  return generateThumbnailDesign(input);
}

export async function runModifyThumbnail(input: ModifyThumbnailInput): Promise<ModifyThumbnailOutput> {
  return modifyThumbnailDesign(input);
}

export async function runGenerateHooks(input: GenerateHooksInput): Promise<GenerateHooksOutput> {
  return generateHookAlternatives(input);
}
