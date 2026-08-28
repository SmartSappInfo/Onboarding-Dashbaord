import { NextRequest, NextResponse } from 'next/server';
import { seedMasterExperience } from '@/app/seeds/seed-master-experience';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';

/**
 * API Route: POST /api/admin/seed-experience
 *
 * Triggers the 12-Phase Unified Master Experience Platform Seeder.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Security: Strictly restricted to platform system administrators (`permissions: ['system_admin']`).
 * - Caution: This seeds baseline structural entities across all experience phases. Never allow
 *   unauthenticated execution.
 * - Zero `any` or `any[]` typing.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Enforce platform system admin authentication
    const authResult = await authenticateApiRequest(req, { requireSystemAdmin: true });
    if (!authResult.success) {
      return authResult.errorResponse;
    }

    let orgId = 'smartsapp-hq';
    try {
      const body = (await req.json()) as { organizationId?: string };
      if (body?.organizationId && typeof body.organizationId === 'string') {
        orgId = body.organizationId.trim();
      }
    } catch {
      // Body is optional; fallback to default organization ID
    }

    console.log(`[API /api/admin/seed-experience] Triggering master seed for organization: ${orgId} by admin ${authResult.user.uid}`);
    await seedMasterExperience(orgId);

    return NextResponse.json({
      success: true,
      message: 'Master Experience Platform seed completed successfully across all 12 phases.',
      organizationId: orgId,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Master seed failed';
    console.error('[API /api/admin/seed-experience] Error:', err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
