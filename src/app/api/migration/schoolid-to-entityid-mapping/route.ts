import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * @fileOverview SchoolId to EntityId mapping endpoint for API consumers
 * Requirements: 24.3, 24.4 - Provide migration mapping for API clients
 */

/**
 * GET /api/migration/schoolid-to-entityid-mapping
 * Get mapping of schoolId to entityId for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Fetch all migrated schools for the organization
    const schoolsSnapshot = await adminDb
      .collection('schools')
      .where('organizationId', '==', organizationId)
      .where('migrationStatus', '==', 'migrated')
      .get();

    const mappings = schoolsSnapshot.docs.map(doc => {
      const school = doc.data();
      return {
        schoolId: doc.id,
        entityId: school.entityId,
        entityType: school.entityType || 'institution',
        name: school.name,
        slug: school.slug
      };
    });

    return NextResponse.json({
      organizationId,
      mappings,
      total: mappings.length,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[API:MIGRATION:MAPPING] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
