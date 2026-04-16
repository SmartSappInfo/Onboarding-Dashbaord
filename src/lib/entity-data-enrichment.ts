/**
 * Entity Data Enrichment — Fetch → Enrich → Restore Protocol
 *
 * Recovers omitted fields (logoUrl, location, implementationDate, zone,
 * referee, modules, initials, slogan) from the backup_entities_migration
 * collection and writes them into the corresponding entities collection records.
 *
 * Matching key: slug (present in both collections)
 *
 * This addresses an earlier migration omission that predates the
 * FER-01 unified contact architecture work.
 */

'use client';

import {
    collection,
    writeBatch,
    getDocs,
    type Firestore
} from 'firebase/firestore';

const BATCH_SIZE = 450;

export interface EnrichmentResult {
    totalBackups: number;
    matched: number;
    enriched: number;
    skipped: number;
    failed: number;
    errors: Array<{ slug: string; error: string }>;
    fieldStats: {
        logoUrl: number;
        location: number;
        implementationDate: number;
        zone: number;
        referee: number;
        modules: number;
        initials: number;
        slogan: number;
    };
}

/**
 * FETCH → ENRICH → RESTORE: Recover omitted institution fields
 *
 * For each record in backup_entities_migration:
 *   1. FETCH: Read the backup document, extract slug + missing fields
 *   2. MATCH: Find the corresponding entity in `entities` by slug
 *   3. ENRICH: Merge logoUrl, location, implementationDate, zone into
 *      the entity's institutionData (and root-level where applicable)
 *   4. RESTORE: Commit the enriched entity back to Firestore
 *
 * This function is idempotent — running it again will only overwrite
 * with the same backup values (no data loss risk).
 */
export async function enrichEntitiesFromBackup(
    firestore: Firestore
): Promise<EnrichmentResult> {
    console.log('🔄 Starting Entity Data Enrichment Protocol...');
    console.log('   Source: backup_entities_migration');
    console.log('   Target: entities');
    console.log('   Key: slug');

    const result: EnrichmentResult = {
        totalBackups: 0,
        matched: 0,
        enriched: 0,
        skipped: 0,
        failed: 0,
        errors: [],
        fieldStats: { logoUrl: 0, location: 0, implementationDate: 0, zone: 0, referee: 0, modules: 0, initials: 0, slogan: 0 },
    };

    try {
        // ── PHASE 1: FETCH all backups ──────────────────────────────
        const backupSnap = await getDocs(
            collection(firestore, 'backup_entities_migration')
        );
        result.totalBackups = backupSnap.size;
        console.log(`📊 Found ${result.totalBackups} backup records`);

        if (result.totalBackups === 0) {
            console.log('⚠️  No backup records found. Nothing to enrich.');
            return result;
        }

        // Build a lookup map: slug → backup data
        const backupBySlug = new Map<string, Record<string, any>>();
        for (const backupDoc of backupSnap.docs) {
            const data = backupDoc.data();
            const slug = data.slug;
            if (slug) {
                backupBySlug.set(slug, data);
            }
        }
        console.log(`🗂️  Built slug index: ${backupBySlug.size} slugs`);

        // ── PHASE 2: FETCH all entities ─────────────────────────────
        const entitiesSnap = await getDocs(
            collection(firestore, 'entities')
        );
        console.log(`📊 Found ${entitiesSnap.size} entities to check`);

        // ── PHASE 3: ENRICH + RESTORE ───────────────────────────────
        let batch = writeBatch(firestore);
        let operationCount = 0;

        for (const entityDoc of entitiesSnap.docs) {
            const entity = entityDoc.data();
            const entitySlug = entity.slug;

            if (!entitySlug) continue;

            const backup = backupBySlug.get(entitySlug);
            if (!backup) continue;

            result.matched++;

            try {
                // Extract fields from the backup (original School shape)
                const backupLogoUrl = backup.logoUrl;
                const backupLocation = backup.location; // string in School
                const backupZone = backup.zone; // { id, name } in School
                const backupImplementationDate = backup.implementationDate;
                const backupInitials = backup.initials;
                const backupSlogan = backup.slogan;
                const backupReferee = backup.referee;
                const backupModules = backup.modules; // array of module objects

                // Check if there's anything to enrich
                const hasAnyField =
                    backupLogoUrl || backupLocation || backupZone || backupImplementationDate ||
                    backupReferee || (backupModules && backupModules.length > 0) ||
                    backupInitials || backupSlogan;

                if (!hasAnyField) {
                    result.skipped++;
                    continue;
                }

                // Build the update payload
                const updatePayload: Record<string, any> = {};
                const existingInstitutionData = entity.institutionData || {};
                const updatedInstitutionData = { ...existingInstitutionData };
                let fieldsEnriched = 0;

                // logoUrl → institutionData.logoUrl
                if (backupLogoUrl && !existingInstitutionData.logoUrl) {
                    updatedInstitutionData.logoUrl = backupLogoUrl;
                    result.fieldStats.logoUrl++;
                    fieldsEnriched++;
                }

                // location (string) + zone → institutionData.location
                if ((backupLocation || backupZone) && !existingInstitutionData.location) {
                    updatedInstitutionData.location = {
                        locationString: backupLocation || '',
                        zone: backupZone || undefined,
                    };
                    if (backupLocation) result.fieldStats.location++;
                    if (backupZone) result.fieldStats.zone++;
                    fieldsEnriched++;
                }

                // implementationDate → institutionData.implementationDate
                if (backupImplementationDate && !existingInstitutionData.implementationDate) {
                    updatedInstitutionData.implementationDate = backupImplementationDate;
                    result.fieldStats.implementationDate++;
                    fieldsEnriched++;
                }

                // referee → institutionData.referee
                if (backupReferee && !existingInstitutionData.referee) {
                    updatedInstitutionData.referee = backupReferee;
                    result.fieldStats.referee++;
                    fieldsEnriched++;
                }

                // modules → institutionData.modules
                if (backupModules && backupModules.length > 0 && (!existingInstitutionData.modules || existingInstitutionData.modules.length === 0)) {
                    updatedInstitutionData.modules = backupModules;
                    result.fieldStats.modules++;
                    fieldsEnriched++;
                }

                // initials & slogan
                if (backupInitials && !existingInstitutionData.initials) {
                    updatedInstitutionData.initials = backupInitials;
                    result.fieldStats.initials++;
                    fieldsEnriched++;
                }
                if (backupSlogan && !existingInstitutionData.slogan) {
                    updatedInstitutionData.slogan = backupSlogan;
                    result.fieldStats.slogan++;
                    fieldsEnriched++;
                }

                if (fieldsEnriched === 0) {
                    result.skipped++;
                    continue;
                }

                updatePayload['institutionData'] = updatedInstitutionData;
                updatePayload['updatedAt'] = new Date().toISOString();

                // RESTORE: Write to Firestore
                batch.update(entityDoc.ref, updatePayload);
                operationCount++;

                if (operationCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`✅ Committed batch (${result.enriched + 1} entities enriched)`);
                    batch = writeBatch(firestore);
                    operationCount = 0;
                }

                result.enriched++;
                console.log(
                    `   ✓ Enriched "${entitySlug}" (+${fieldsEnriched} fields)`
                );
            } catch (error: any) {
                console.error(`❌ Error enriching "${entitySlug}":`, error);
                result.failed++;
                result.errors.push({ slug: entitySlug, error: error.message });
            }
        }

        // Commit remaining operations
        if (operationCount > 0) {
            await batch.commit();
            console.log(`✅ Committed final enrichment batch`);
        }

        // ── Summary ─────────────────────────────────────────────────
        console.log(`\n📈 Enrichment Summary:`);
        console.log(`   Total backups: ${result.totalBackups}`);
        console.log(`   Matched by slug: ${result.matched}`);
        console.log(`   ✅ Enriched: ${result.enriched}`);
        console.log(`   ⏭️  Skipped (already has data): ${result.skipped}`);
        console.log(`   ❌ Failed: ${result.failed}`);
        console.log(`   Field breakdown:`);
        console.log(`     • logoUrl: ${result.fieldStats.logoUrl}`);
        console.log(`     • location: ${result.fieldStats.location}`);
        console.log(`     • zone: ${result.fieldStats.zone}`);
        console.log(`     • implementationDate: ${result.fieldStats.implementationDate}`);
        console.log(`     • referee: ${result.fieldStats.referee}`);
        console.log(`     • modules: ${result.fieldStats.modules}`);
        console.log(`     • initials: ${result.fieldStats.initials}`);
        console.log(`     • slogan: ${result.fieldStats.slogan}`);

        return result;
    } catch (error: any) {
        console.error('💥 Fatal error during enrichment:', error);
        throw error;
    }
}

/**
 * DRY-RUN: Preview what would be enriched without writing anything.
 * Useful for verification before committing.
 */
export async function previewEnrichment(
    firestore: Firestore
): Promise<{
    wouldEnrich: Array<{
        slug: string;
        fields: string[];
    }>;
    totalBackups: number;
    totalEntities: number;
    matchCount: number;
}> {
    console.log('🔍 Preview: Entity Data Enrichment (dry run)...');

    const backupSnap = await getDocs(
        collection(firestore, 'backup_entities_migration')
    );
    const entitiesSnap = await getDocs(collection(firestore, 'entities'));

    const backupBySlug = new Map<string, Record<string, any>>();
    for (const backupDoc of backupSnap.docs) {
        const data = backupDoc.data();
        if (data.slug) backupBySlug.set(data.slug, data);
    }

    const wouldEnrich: Array<{ slug: string; fields: string[] }> = [];
    let matchCount = 0;

    for (const entityDoc of entitiesSnap.docs) {
        const entity = entityDoc.data();
        const entitySlug = entity.slug;
        if (!entitySlug) continue;

        const backup = backupBySlug.get(entitySlug);
        if (!backup) continue;
        matchCount++;

        const fields: string[] = [];
        const existingInstitutionData = entity.institutionData || {};

        if (backup.logoUrl && !existingInstitutionData.logoUrl) fields.push('logoUrl');
        if (backup.location && !existingInstitutionData.location) fields.push('location');
        if (backup.zone && !existingInstitutionData.location) fields.push('zone');
        if (backup.implementationDate && !existingInstitutionData.implementationDate)
            fields.push('implementationDate');
        if (backup.referee && !existingInstitutionData.referee) fields.push('referee');
        if (backup.modules?.length > 0 && (!existingInstitutionData.modules || existingInstitutionData.modules.length === 0))
            fields.push('modules');
        if (backup.initials && !existingInstitutionData.initials) fields.push('initials');
        if (backup.slogan && !existingInstitutionData.slogan) fields.push('slogan');

        if (fields.length > 0) {
            wouldEnrich.push({ slug: entitySlug, fields });
        }
    }

    console.log(`📊 Preview complete:`);
    console.log(`   Backups: ${backupSnap.size}`);
    console.log(`   Entities: ${entitiesSnap.size}`);
    console.log(`   Matched: ${matchCount}`);
    console.log(`   Would enrich: ${wouldEnrich.length}`);

    return {
        wouldEnrich,
        totalBackups: backupSnap.size,
        totalEntities: entitiesSnap.size,
        matchCount,
    };
}
