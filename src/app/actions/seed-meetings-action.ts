'use server';

/**
 * @fileoverview Server Action to trigger Meetings 2.0 Demonstration Seeding.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Requires valid workspaceId and user credentials.
 * - Zero 'any' policy strictly enforced.
 */

import { seedMeetingsV2, type SeedMeetingsResult } from '@/app/seeds/seed-meetings-v2';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Seeds complete Meetings 2.0 demonstration dataset into the active workspace.
 */
export async function seedMeetingsV2Action(
  workspaceId: string,
  organizationId?: string,
  hostUserId?: string
): Promise<{ success: boolean; result?: SeedMeetingsResult; error?: string }> {
  try {
    if (!workspaceId || !workspaceId.trim()) {
      return { success: false, error: 'Valid workspaceId is required to seed meetings data.' };
    }

    const result = await seedMeetingsV2(
      workspaceId.trim(),
      organizationId?.trim() || 'org_default',
      hostUserId?.trim() || 'host_default'
    );

    return { success: true, result };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
