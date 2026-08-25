'use server';

/**
 * @fileoverview Server Action to trigger one-click meeting migration to the unified Phase 2 schema.
 */

import { migrateMeetingToUnifiedSchema, type MigrationSummary } from '@/lib/meetings/migration-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export async function migrateMeetingToUnifiedSchemaAction(
  meetingId: string
): Promise<{ success: boolean; summary?: MigrationSummary; error?: string }> {
  try {
    const summary = await migrateMeetingToUnifiedSchema(meetingId);
    return { success: true, summary };
  } catch (error) {
    console.error('[migrateMeetingToUnifiedSchemaAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
