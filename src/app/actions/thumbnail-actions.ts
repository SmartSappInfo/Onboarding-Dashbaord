'use server';

import { generateThumbnailDesign, GenerateThumbnailInput, GenerateThumbnailOutput } from '@/ai/flows/generate-thumbnail-flow';
import { modifyThumbnailDesign, ModifyThumbnailInput, ModifyThumbnailOutput } from '@/ai/flows/modify-thumbnail-flow';

export async function runGenerateThumbnail(input: GenerateThumbnailInput): Promise<GenerateThumbnailOutput> {
  return generateThumbnailDesign(input);
}

export async function runModifyThumbnail(input: ModifyThumbnailInput): Promise<ModifyThumbnailOutput> {
  return modifyThumbnailDesign(input);
}
