'use server';

import { generateHeadlineVariations } from '@/lib/campaign-ai';
import type { HeadlineVariation } from '@/lib/types';

export async function generateHeadlineVariationsAction(params: {
  currentTitle: string;
  currentPreviewText?: string;
  framework: 'aida' | '4us' | 'pas';
  emailContext?: string;
  organizationId?: string;
}): Promise<{ success: boolean; result?: HeadlineVariation[]; error?: string }> {
  return generateHeadlineVariations(params);
}
