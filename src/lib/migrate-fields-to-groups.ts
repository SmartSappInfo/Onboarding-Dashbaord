import { adminDb } from './firebase-admin';
import type { AppField, FieldGroup, Workspace, IndustryVertical } from './types';
import { resolveGroupIcon } from './industry-field-registry';

/**
 * Migration Script: Fields to Groups
 * 
 * Purpose:
 * Converts legacy `section`-based AppFields to `groupId`-based fields.
 * It reads all workspaces, looks at their fields, and for any fields missing a `groupId`,
 * creates a FieldGroup based on the legacy `section` name, and backfills the `groupId`.
 * 
 * Idempotency:
 * Safe to run multiple times. It skips fields that already have a `groupId`.
 */
export async function migrateFieldsToGroups() {
  console.log('Starting Migration: Fields to Groups...');
  let migratedWorkspaces = 0;
  let createdGroups = 0;
  let migratedFields = 0;

  try {
    const workspacesSnap = await adminDb.collection('workspaces').get();
    
    for (const wsDoc of workspacesSnap.docs) {
      const workspaceId = wsDoc.id;
      const workspace = wsDoc.data() as Workspace;
      const organizationId = workspace.organizationId;
      const industry: IndustryVertical = workspace.industry || 'SchoolEnrollment';

      // 1. Fetch all fields for this workspace that DO NOT have a groupId
      // We do a manual filter because checking for existence in firestore is tricky sometimes
      const fieldsSnap = await adminDb.collection('app_fields')
        .where('workspaceId', '==', workspaceId)
        .get();

      const fieldsToMigrate = fieldsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as AppField))
        .filter(f => !f.groupId);

      if (fieldsToMigrate.length === 0) {
        continue; // Nothing to migrate for this workspace
      }

      console.log(`Migrating Workspace ${workspaceId} - Found ${fieldsToMigrate.length} legacy fields`);
      
      const batch = adminDb.batch();
      
      // 2. Extract unique sections and create groups for them
      const uniqueSections = new Set(fieldsToMigrate.map(f => f.section || 'General'));
      const sectionToGroupId = new Map<string, string>();

      // Check if we already have some groups (maybe from a partial migration)
      const existingGroupsSnap = await adminDb.collection('field_groups')
        .where('workspaceId', '==', workspaceId)
        .get();
        
      const existingGroups = existingGroupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as FieldGroup));

      let orderCounter = existingGroups.length * 10;

      for (const section of uniqueSections) {
        const slug = section.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
        
        // See if a group already exists for this section slug
        const existingGroup = existingGroups.find(g => g.slug === slug);
        
        if (existingGroup) {
          sectionToGroupId.set(section, existingGroup.id);
        } else {
          // Create new group
          const groupRef = adminDb.collection('field_groups').doc();
          
          // Map legacy sections to friendly names
          let groupName = section.charAt(0).toUpperCase() + section.slice(1).replace(/_/g, ' ');
          if (section === 'common') groupName = 'General Fields';
          if (section === 'institution') groupName = 'Institution Data';
          if (section === 'family') groupName = 'Family Data';
          if (section === 'person' || section === 'child') groupName = 'Contact Data';

          const newGroup: FieldGroup = {
            id: groupRef.id,
            workspaceId,
            organizationId,
            name: groupName,
            slug,
            icon: resolveGroupIcon(groupName),
            color: '#6b7280', // Default gray for migrated legacy groups
            entityTypes: ['institution', 'person', 'family'], // Broadest compatibility
            industry: industry,
            isSystem: false, // Make them custom so they can be deleted/modified
            order: orderCounter,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          batch.set(groupRef, newGroup);
          sectionToGroupId.set(section, groupRef.id);
          createdGroups++;
          orderCounter += 10;
        }
      }

      // 3. Backfill the groupId onto the legacy fields
      for (const field of fieldsToMigrate) {
        const section = field.section || 'General';
        const groupId = sectionToGroupId.get(section);
        
        if (groupId) {
          const fieldRef = adminDb.collection('app_fields').doc(field.id);
          batch.update(fieldRef, {
            groupId: groupId,
            updatedAt: new Date().toISOString()
          });
          migratedFields++;
        }
      }

      await batch.commit();
      migratedWorkspaces++;
    }

    console.log(`Migration Complete.`);
    console.log(`- Workspaces Processed: ${migratedWorkspaces}`);
    console.log(`- Groups Created: ${createdGroups}`);
    console.log(`- Fields Migrated: ${migratedFields}`);
    
    return { success: true, migratedWorkspaces, createdGroups, migratedFields };
  } catch (error: any) {
    console.error('>>> Migration Failed:', error);
    return { success: false, error: error.message };
  }
}
