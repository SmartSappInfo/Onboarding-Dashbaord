/**
 * Tag Migration Utility for Global vs Workspace Tags
 * 
 * This utility migrates existing tags from the schools collection to the new
 * entity/workspace_entity model, classifying tags as either global (identity-level)
 * or workspace-scoped (operational).
 * 
 * Requirements: 7 (Global vs. Workspace Tag Separation)
 */

'use server';

import { adminDb } from './firebase-admin';
import type { Entity, WorkspaceEntity, School } from './types';
import { getOrganizationId } from './organization-utils';

/**
 * Classification rules for determining if a tag should be global or workspace-scoped.
 * 
 * Global tags represent identity-level attributes that are meaningful across all workspaces:
 * - VIP status
 * - Strategic account designations
 * - Industry/sector classifications
 * - Geographic regions
 * 
 * Workspace tags represent operational state specific to one workspace:
 * - Pipeline stages
 * - Engagement levels
 * - Campaign participation
 * - Billing status
 */
const GLOBAL_TAG_PATTERNS = [
  /vip/i,
  /strategic/i,
  /partner/i,
  /enterprise/i,
  /key\s*account/i,
  /tier\s*[123]/i,
  /region/i,
  /zone/i,
  /industry/i,
  /sector/i,
];

/**
 * Determines if a tag should be classified as global based on its name
 */
function isGlobalTag(tagName: string): boolean {
  return GLOBAL_TAG_PATTERNS.some(pattern => pattern.test(tagName));
}

interface MigrationResult {
  success: boolean;
  processed: number;
  globalTagsMigrated: number;
  workspaceTagsMigrated: number;
  errors: string[];
}

/**
 * Migrates tags from schools collection to entities.globalTags and workspace_entities.workspaceTags
 * 
 * Algorithm:
 * 1. Read all schools with tags
 * 2. For each school, find or create corresponding entity
 * 3. For each tag on the school:
 *    - If tag matches global pattern, add to entity.globalTags
 *    - Otherwise, add to workspace_entities.workspaceTags for each workspace the school belongs to
 * 4. Update entity and workspace_entities documents
 * 
 * @param dryRun - If true, only logs what would be done without making changes
 */
export async function migrateSchoolTagsAction(dryRun: boolean = false): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    processed: 0,
    globalTagsMigrated: 0,
    workspaceTagsMigrated: 0,
    errors: [],
  };

  try {
    console.log(`\n🏷️  Tag Migration: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('═══════════════════════════════════════════════════════\n');

    // 1. Fetch all schools with tags
    const schoolsSnap = await adminDb
      .collection('schools')
      .where('tags', '!=', null)
      .get();

    console.log(`Found ${schoolsSnap.size} schools with tags\n`);

    // 2. Fetch all tags to get tag names
    const tagsSnap = await adminDb.collection('tags').get();
    const tagMap = new Map<string, { name: string; workspaceId: string }>();
    tagsSnap.docs.forEach(doc => {
      const data = doc.data();
      tagMap.set(doc.id, { name: data.name, workspaceId: data.workspaceId });
    });

    // 3. Process each school
    for (const schoolDoc of schoolsSnap.docs) {
      try {
        const school = schoolDoc.data();
        const schoolId = schoolDoc.id;
        const tags: string[] = school.tags || [];
        const workspaceIds: string[] = school.workspaceIds || [];

        if (tags.length === 0) {
          continue;
        }

        result.processed++;

        // Find corresponding entity (assuming migration has already created entities)
        // We'll look for an entity with matching name and organization
        const entitySnap = await adminDb
          .collection('entities')
          .where('organizationId', '==', getOrganizationId(school as School, 'default-org'))
          .where('name', '==', school.name)
          .where('entityType', '==', 'institution')
          .limit(1)
          .get();

        if (entitySnap.empty) {
          result.errors.push(`No entity found for school ${schoolId} (${school.name})`);
          continue;
        }

        const entityDoc = entitySnap.docs[0];
        const entity = { id: entityDoc.id, ...entityDoc.data() } as Entity;

        // Classify tags
        const globalTags = new Set<string>(entity.globalTags || []);
        const workspaceTagsByWorkspace = new Map<string, Set<string>>();

        for (const tagId of tags) {
          const tagInfo = tagMap.get(tagId);
          if (!tagInfo) {
            console.log(`  ⚠️  Tag ${tagId} not found in tags collection`);
            continue;
          }

          if (isGlobalTag(tagInfo.name)) {
            // Global tag - add to entity.globalTags
            if (!globalTags.has(tagId)) {
              globalTags.add(tagId);
              result.globalTagsMigrated++;
              console.log(`  ✅ Global tag: "${tagInfo.name}" → entity ${entity.id}`);
            }
          } else {
            // Workspace tag - add to workspace_entities.workspaceTags for each workspace
            for (const workspaceId of workspaceIds) {
              if (!workspaceTagsByWorkspace.has(workspaceId)) {
                workspaceTagsByWorkspace.set(workspaceId, new Set());
              }
              workspaceTagsByWorkspace.get(workspaceId)!.add(tagId);
              result.workspaceTagsMigrated++;
              console.log(`  ✅ Workspace tag: "${tagInfo.name}" → workspace ${workspaceId}`);
            }
          }
        }

        if (!dryRun) {
          // Update entity with global tags
          if (globalTags.size > 0) {
            await adminDb.collection('entities').doc(entity.id).update({
              globalTags: Array.from(globalTags),
              updatedAt: new Date().toISOString(),
            });
          }

          // Update workspace_entities with workspace tags
          for (const [workspaceId, workspaceTags] of workspaceTagsByWorkspace.entries()) {
            // Find workspace_entities record
            const weSnap = await adminDb
              .collection('workspace_entities')
              .where('entityId', '==', entity.id)
              .where('workspaceId', '==', workspaceId)
              .limit(1)
              .get();

            if (!weSnap.empty) {
              const weDoc = weSnap.docs[0];
              const existingWorkspaceTags = new Set<string>(weDoc.data().workspaceTags || []);
              workspaceTags.forEach(tag => existingWorkspaceTags.add(tag));

              await weDoc.ref.update({
                workspaceTags: Array.from(existingWorkspaceTags),
                updatedAt: new Date().toISOString(),
              });
            } else {
              result.errors.push(
                `No workspace_entities record found for entity ${entity.id} in workspace ${workspaceId}`
              );
            }
          }
        }

        console.log(`  Processed school ${schoolId}: ${globalTags.size} global, ${workspaceTagsByWorkspace.size} workspace contexts\n`);
      } catch (error: any) {
        result.errors.push(`Error processing school ${schoolDoc.id}: ${error.message}`);
        console.error(`  ❌ Error processing school ${schoolDoc.id}:`, error);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('Migration Summary:');
    console.log(`  Schools processed: ${result.processed}`);
    console.log(`  Global tags migrated: ${result.globalTagsMigrated}`);
    console.log(`  Workspace tags migrated: ${result.workspaceTagsMigrated}`);
    console.log(`  Errors: ${result.errors.length}`);
    if (dryRun) {
      console.log('\n  ⚠️  DRY RUN - No changes were written');
    }
    console.log('═══════════════════════════════════════════════════════\n');

    return result;
  } catch (error: any) {
    console.error('Migration failed:', error);
    result.success = false;
    result.errors.push(`Fatal error: ${error.message}`);
    return result;
  }
}

/**
 * Manual tag classification override
 * Allows administrators to explicitly classify specific tags as global or workspace-scoped
 */
export async function classifyTagManuallyAction(
  tagId: string,
  scope: 'global' | 'workspace',
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // This would be used in a UI to manually override the automatic classification
    // For now, we'll just validate the inputs
    if (!tagId || !scope || !userId) {
      return { success: false, error: 'Missing required parameters' };
    }

    // In a full implementation, this would:
    // 1. Store the manual classification in a separate collection
    // 2. Use this during migration to override automatic classification
    // 3. Provide audit trail of manual overrides

    console.log(`Manual classification: tag ${tagId} → ${scope} (by user ${userId})`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
