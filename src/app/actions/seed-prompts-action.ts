'use server';

import { seedDefaultPrompts } from '@/lib/seed-prompts';
import { authorizeBackofficeSession } from '@/lib/backoffice/backoffice-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

interface SeedPromptsResult {
  success: boolean;
  seededCount: number;
  error?: string;
}

export async function seedPromptsAction(): Promise<SeedPromptsResult> {
  // SECURITY (audit F2): Server Actions are public endpoints. This platform
  // migration was reachable unauthenticated. Identity and permission are resolved
  // server-side from the session; the caller supplies neither.
  await authorizeBackofficeSession('operations', 'execute');

  try {
    return await seedDefaultPrompts();
  } catch (error: unknown) {
    console.error('[SEED_PROMPTS_ACTION] Failed:', error);
    return {
      success: false,
      seededCount: 0,
      error: getErrorMessage(error) || 'Unknown seeding failure.'
    };
  }
}
