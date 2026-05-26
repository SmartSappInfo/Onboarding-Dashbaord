import { adminDb } from '../firebase-admin';
import type { IndustryVertical, AppField, FieldGroup } from '../types';
import type { IndustryGroupDef } from '../industry-field-registry';
import { resolveGroupIcon } from '../industry-field-registry';

/**
 * Propagates changes made to an industry-specific field group (and its fields)
 * to all workspaces matching that industry.
 *
 * Runs in batches of 30 workspaces to remain well under Firestore's 500-op limit
 * while utilizing 'in' queries to minimize read overhead.
 *
 * @param industry The industry vertical to target
 * @param groupSlug The slug of the field group being updated or deleted
 * @param isDeleted Whether this is a deletion operation
 * @param groupData The full group and field definitions (null if isDeleted is true)
 */
export async function propagateIndustryGroupChanges(
  industry: IndustryVertical,
  groupSlug: string,
  isDeleted: boolean,
  groupData?: IndustryGroupDef
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const now = new Date().toISOString();

    // 1. Fetch workspaces matching this industry
    const workspacesSnap = await adminDb.collection('workspaces').get();
    const workspaces = workspacesSnap.docs.filter((doc) => {
      const ws = doc.data();
      const wsIndustry = ws.industry || 'SchoolEnrollment'; // SchoolEnrollment is fallback
      return wsIndustry === industry;
    });

    if (workspaces.length === 0) {
      return { success: true, count: 0 };
    }

    // 2. Chunk workspaces into batches of 30
    const chunkSize = 30;
    let totalUpdated = 0;

    for (let i = 0; i < workspaces.length; i += chunkSize) {
      const chunk = workspaces.slice(i, i + chunkSize);
      const wsIds = chunk.map((w) => w.id);

      // Fetch existing groups and fields for this chunk in parallel
      const [existingGroupsSnap, existingFieldsSnap] = await Promise.all([
        adminDb.collection('field_groups').where('workspaceId', 'in', wsIds).get(),
        adminDb.collection('app_fields').where('workspaceId', 'in', wsIds).get(),
      ]);

      const existingGroups = existingGroupsSnap.docs.map((d) => d.data() as FieldGroup);
      const existingFields = existingFieldsSnap.docs.map((d) => d.data() as AppField);

      const batch = adminDb.batch();

      for (const wsDoc of chunk) {
        const workspaceId = wsDoc.id;
        const organizationId = wsDoc.data().organizationId || 'default';

        // Deterministic ID for this workspace's group
        const groupDocId = `group_${workspaceId}_${groupSlug}`;
        const groupRef = adminDb.collection('field_groups').doc(groupDocId);

        if (isDeleted) {
          // Delete group document
          batch.delete(groupRef);

          // Find all fields belonging to this group in this workspace and delete them
          const wsFieldsToDelete = existingFields.filter(
            (f) => f.workspaceId === workspaceId && (f.groupId === groupDocId || (f.industryOrigin === industry && f.section === groupSlug))
          );

          for (const f of wsFieldsToDelete) {
            batch.delete(adminDb.collection('app_fields').doc(f.id));
          }
        } else if (groupData) {
          // Create or update the group
          const existingGroup = existingGroups.find((g) => g.id === groupDocId);
          const groupPayload: Record<string, any> = {
            id: groupDocId,
            workspaceId,
            organizationId,
            name: groupData.name,
            slug: groupData.slug,
            description: groupData.description || '',
            icon: resolveGroupIcon(groupData.name),
            color: '#3b82f6', // Industry fields default blue
            entityTypes: groupData.entityTypes,
            industry: industry,
            isSystem: false,
            order: groupData.order,
            updatedAt: now,
          };

          if (!existingGroup) {
            groupPayload.createdAt = now;
          }

          batch.set(groupRef, groupPayload, { merge: true });

          // Sync fields in this group
          const activeFieldIds = new Set<string>();

          for (const fieldDef of groupData.fields) {
            // Deterministic ID for this field
            const fieldDocId = `field_${workspaceId}_${fieldDef.variableName}`;
            activeFieldIds.add(fieldDocId);

            const fieldRef = adminDb.collection('app_fields').doc(fieldDocId);
            const existingField = existingFields.find((f) => f.id === fieldDocId);

            const fieldPayload: Record<string, any> = {
              id: fieldDocId,
              workspaceId,
              organizationId,
              name: fieldDef.name,
              variableName: fieldDef.variableName,
              type: fieldDef.type,
              groupId: groupDocId,
              section: groupSlug,
              industryOrigin: industry,
              isNative: false,
              compatibilityScope: fieldDef.compatibilityScope,
              updatedAt: now,
            };

            if (!existingField) {
              fieldPayload.label = fieldDef.name;
              fieldPayload.status = 'active';
              fieldPayload.createdAt = now;
              if (fieldDef.helpText !== undefined) fieldPayload.helpText = fieldDef.helpText;
              if (fieldDef.placeholder !== undefined) fieldPayload.placeholder = fieldDef.placeholder;
              if (fieldDef.defaultValue !== undefined) fieldPayload.defaultValue = fieldDef.defaultValue;
              if (fieldDef.options !== undefined) fieldPayload.options = fieldDef.options;
              if (fieldDef.validationRules !== undefined) fieldPayload.validationRules = fieldDef.validationRules;
            } else {
              // Smart Merge: Preserve workspace local overrides (label, helpText, placeholder, status, options)
              // if they have been customized by the user, but update structural definitions
              fieldPayload.label = existingField.label || fieldDef.name;
              fieldPayload.status = existingField.status || 'active';

              if (existingField.helpText !== undefined) fieldPayload.helpText = existingField.helpText;
              else if (fieldDef.helpText !== undefined) fieldPayload.helpText = fieldDef.helpText;

              if (existingField.placeholder !== undefined) fieldPayload.placeholder = existingField.placeholder;
              else if (fieldDef.placeholder !== undefined) fieldPayload.placeholder = fieldDef.placeholder;

              if (existingField.defaultValue !== undefined) fieldPayload.defaultValue = existingField.defaultValue;
              else if (fieldDef.defaultValue !== undefined) fieldPayload.defaultValue = fieldDef.defaultValue;

              // standard options list or customized options
              if (existingField.options !== undefined) fieldPayload.options = existingField.options;
              else if (fieldDef.options !== undefined) fieldPayload.options = fieldDef.options;

              if (existingField.validationRules !== undefined) fieldPayload.validationRules = existingField.validationRules;
              else if (fieldDef.validationRules !== undefined) fieldPayload.validationRules = fieldDef.validationRules;
            }

            batch.set(fieldRef, fieldPayload, { merge: true });
          }

          // Delete any existing fields in this group that are no longer part of the definition
          const wsFieldsInThisGroup = existingFields.filter(
            (f) => f.workspaceId === workspaceId && (f.groupId === groupDocId || (f.industryOrigin === industry && f.section === groupSlug))
          );

          for (const f of wsFieldsInThisGroup) {
            if (!activeFieldIds.has(f.id)) {
              batch.delete(adminDb.collection('app_fields').doc(f.id));
            }
          }
        }
      }

      await batch.commit();
      totalUpdated += chunk.length;
    }

    return { success: true, count: totalUpdated };
  } catch (error: any) {
    console.error(`>>> [INDUSTRY_PROPAGATION] Failed for industry ${industry}:`, error.message);
    return { success: false, count: 0, error: error.message };
  }
}
