'use server';

import { seedDefaultPrompts } from '@/lib/seed-prompts';

interface SeedPromptsResult {
  success: boolean;
  seededCount: number;
  error?: string;
}

export async function seedPromptsAction(): Promise<SeedPromptsResult> {
  try {
    return await seedDefaultPrompts();
  } catch (error: any) {
    console.error('[SEED_PROMPTS_ACTION] Failed:', error);
    return {
      success: false,
      seededCount: 0,
      error: error.message || 'Unknown seeding failure.'
    };
  }
}
