import { NextRequest, NextResponse } from 'next/server';
import { seedMasterExperience } from '@/app/seeds/seed-master-experience';

/**
 * API Route: POST /api/admin/seed-experience
 *
 * Triggers the 12-Phase Unified Master Experience Platform Seeder.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let orgId = 'smartsapp-hq';
    try {
      const body = await req.json();
      if (body?.organizationId && typeof body.organizationId === 'string') {
        orgId = body.organizationId.trim();
      }
    } catch {
      // Body is optional; fallback to default organization ID
    }

    console.log(`[API /api/admin/seed-experience] Triggering master seed for organization: ${orgId}`);
    await seedMasterExperience(orgId);

    return NextResponse.json({
      success: true,
      message: 'Master Experience Platform seed completed successfully across all 12 phases.',
      organizationId: orgId,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Master seed failed';
    console.error('[API /api/admin/seed-experience] Error:', err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
