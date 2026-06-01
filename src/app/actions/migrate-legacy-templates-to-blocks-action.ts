'use server';

import { migrateLegacyTemplatesToBlocks } from '@/lib/migrate-messaging-fer';

export interface MigrateLegacyTemplatesResult {
  success: boolean;
  total: number;
  migrated: number;
  error?: string;
}

export async function migrateLegacyTemplatesToBlocksAction(): Promise<MigrateLegacyTemplatesResult> {
  try {
    const result = await migrateLegacyTemplatesToBlocks();
    return {
      success: result.success,
      total: result.total,
      migrated: result.migrated,
      error: result.error,
    };
  } catch (error: any) {
    console.error('[MIGRATE_LEGACY_TEMPLATES] Migration failed:', error);
    return {
      success: false,
      total: 0,
      migrated: 0,
      error: error.message || 'Unknown error occurred during template migration.',
    };
  }
}
